import { z } from 'zod';

const safeUrl = z
  .string()
  .refine(
    (value) => !value || /^(https?:\/\/|\/(?!\/)|blob:)/i.test(value),
    'Use an absolute http(s) URL or a root-relative path',
  );
export const trackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().default('Unknown Artist'),
  album: z.string().default('Unknown Album'),
  albumArtist: z.string().optional(),
  year: z.number().optional(),
  genre: z.string().optional(),
  trackNumber: z.number().optional(),
  discNumber: z.number().optional(),
  duration: z.number().nonnegative().default(0),
  audioUrl: safeUrl.default(''),
  artworkUrl: safeUrl.default('/artwork/placeholder.svg'),
  lyricsUrl: safeUrl.optional(),
  codec: z.string().optional(),
  bitDepth: z.number().optional(),
  sampleRate: z.number().optional(),
  bitrate: z.number().optional(),
  channels: z.number().optional(),
  fileSize: z.number().optional(),
  addedAt: z.number().default(0),
  demo: z.boolean().optional(),
  local: z.boolean().optional(),
});
export type Track = z.infer<typeof trackSchema>;
export const librarySchema = z
  .object({ version: z.literal(1), tracks: z.array(trackSchema) })
  .superRefine((library, context) => {
    if (new Set(library.tracks.map((track) => track.id)).size !== library.tracks.length)
      context.addIssue({ code: 'custom', message: 'Track IDs must be unique', path: ['tracks'] });
  });
export interface LyricsWord {
  startTime: number;
  endTime: number;
  text: string;
}
export interface LyricsLine {
  startTime: number;
  endTime: number;
  text: string;
  translation?: string;
  pronunciation?: string;
  words: LyricsWord[];
}
export interface LyricsDocument {
  lines: LyricsLine[];
  title?: string;
  artist?: string;
  offset: number;
}
export interface QueueEntry {
  id: string;
  trackId: string;
}
export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error';
export type Theme = 'system' | 'light' | 'dark';
export type GlassQuality = 'auto' | 'high' | 'balanced' | 'reduced';
