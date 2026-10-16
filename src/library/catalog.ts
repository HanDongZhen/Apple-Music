import type { Track } from '../types';
import { albumKey, normalize } from '../utils/format';

// Metadata-only previews. Original decorative illustrations, not official album artwork.
export const demoTracks: Track[] = [
  {
    id: 'preview-qilixiang',
    title: '七里香',
    artist: '周杰伦',
    album: '七里香',
    year: 2004,
    artworkUrl: '/artwork/seven.svg',
  },
  {
    id: 'preview-heal',
    title: 'Heal the World',
    artist: 'Michael Jackson',
    album: 'Dangerous',
    year: 1991,
    artworkUrl: '/artwork/earth.svg',
  },
  {
    id: 'preview-jiangnan',
    title: '江南',
    artist: '林俊杰',
    album: '第二天堂',
    year: 2004,
    artworkUrl: '/artwork/rain.svg',
  },
  {
    id: 'preview-letting',
    title: 'Letting Go',
    artist: '蔡健雅',
    album: '说到爱',
    year: 2011,
    artworkUrl: '/artwork/bloom.svg',
  },
  {
    id: 'preview-stars',
    title: 'Counting Stars',
    artist: 'OneRepublic',
    album: 'Native',
    year: 2013,
    artworkUrl: '/artwork/stars.svg',
  },
  {
    id: 'preview-tide',
    title: '爱如潮水',
    artist: '张信哲',
    album: '心事',
    year: 1993,
    artworkUrl: '/artwork/tide.svg',
  },
].map((track) => ({ ...track, audioUrl: '', duration: 0, addedAt: 0, demo: true }));

export function searchTracks(tracks: Track[], query: string) {
  const terms = normalize(query).trim().split(/\s+/);
  return tracks.filter((track) =>
    terms.every((term) =>
      normalize(`${track.title} ${track.artist} ${track.album}`).includes(term),
    ),
  );
}
export function albumsOf(tracks: Track[]) {
  const groups = new Map<string, Track[]>();
  for (const track of tracks) {
    const key = albumKey(track);
    groups.set(key, [...(groups.get(key) ?? []), track]);
  }
  return [...groups.entries()].map(([id, songs]) => ({
    id,
    title: songs[0].album,
    artist: songs[0].albumArtist || songs[0].artist,
    artwork: songs[0].artworkUrl,
    tracks: songs.sort(
      (a, b) =>
        (a.discNumber ?? 1) - (b.discNumber ?? 1) || (a.trackNumber ?? 0) - (b.trackNumber ?? 0),
    ),
  }));
}
