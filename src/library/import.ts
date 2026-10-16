import { saveLocalFile, readLocalFiles } from '../storage/db';
import { useMusic } from '../storage/store';
import type { Track } from '../types';

export async function importAudio(
  files: File[],
  onProgress: (done: number, total: number) => void,
) {
  const supported = files.filter((file) =>
    /\.(flac|wav|mp3|m4a|aac|ogg|opus|aiff)$/i.test(file.name),
  );
  if (!supported.length) throw new Error('Choose FLAC, WAV, MP3 or M4A audio files.');
  const { parseBlob } = await import('music-metadata');
  let imported = 0;
  const failures: string[] = [];
  for (const file of supported) {
    try {
      const metadata = await parseBlob(file, { duration: true, skipCovers: false });
      const { common, format } = metadata;
      const id = `local-${file.name}-${file.size}-${file.lastModified}`;
      const picture = common.picture?.[0];
      const artwork = picture
        ? new Blob([new Uint8Array(picture.data)], { type: picture.format })
        : undefined;
      const track: Track = {
        id,
        title: common.title || file.name.replace(/\.[^.]+$/, ''),
        artist: common.artist || 'Unknown Artist',
        album: common.album || 'Your imports',
        albumArtist: common.albumartist,
        year: common.year,
        genre: common.genre?.[0],
        trackNumber: common.track.no ?? undefined,
        discNumber: common.disk.no ?? undefined,
        duration: format.duration || 0,
        audioUrl: '',
        artworkUrl: '/artwork/placeholder.svg',
        codec: format.codec || file.name.split('.').pop(),
        bitDepth: format.bitsPerSample,
        sampleRate: format.sampleRate,
        bitrate: format.bitrate,
        channels: format.numberOfChannels,
        fileSize: file.size,
        addedAt: Date.now(),
        local: true,
      };
      await saveLocalFile(id, { track, audio: file, artwork });
      imported++;
    } catch (error) {
      failures.push(`${file.name}: ${error instanceof Error ? error.message : 'Import failed'}`);
    }
    onProgress(imported + failures.length, supported.length);
  }
  // Object URLs are ephemeral; regenerate from IndexedDB after each import and on startup.
  const local = await readLocalFiles();
  useMusic
    .getState()
    .setLibrary([
      ...useMusic.getState().tracks.filter((track) => !track.demo && !track.local),
      ...local,
    ]);
  return { imported, failures };
}
