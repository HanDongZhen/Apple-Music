export function time(seconds = 0) {
  const n = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}
export function resolution(bitDepth?: number, sampleRate?: number) {
  return (
    [bitDepth ? `${bitDepth}-bit` : '', sampleRate ? `${sampleRate / 1000} kHz` : '']
      .filter(Boolean)
      .join(' / ') || 'Not available'
  );
}
export function quality(track: {
  codec?: string;
  bitDepth?: number;
  sampleRate?: number;
  demo?: boolean;
}) {
  if (track.demo) return 'Preview';
  if (/flac|pcm|alac|wav|apple lossless/i.test(track.codec ?? ''))
    return (track.bitDepth ?? 0) > 16 || (track.sampleRate ?? 0) > 48000
      ? 'Hi-Res Lossless'
      : 'Lossless';
  return track.codec?.toUpperCase() || 'Audio';
}
export const albumKey = (track: { albumArtist?: string; artist: string; album: string }) =>
  `${track.albumArtist || track.artist}::${track.album}`;
export const normalize = (s: string) => s.normalize('NFKC').toLocaleLowerCase();
