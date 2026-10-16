import type { LyricsDocument, LyricsLine } from '../types';
import { z } from 'zod';

const stamp = (minutes: string, seconds: string) => Number(minutes) * 60 + Number(seconds);
const wordSchema = z
  .object({
    startTime: z.number().nonnegative(),
    endTime: z.number().nonnegative(),
    text: z.string(),
  })
  .refine((word) => word.endTime >= word.startTime, 'Word ends before it starts');
const lineSchema = z
  .object({
    startTime: z.number().nonnegative(),
    endTime: z.number().nonnegative(),
    text: z.string(),
    translation: z.string().optional(),
    pronunciation: z.string().optional(),
    words: z.array(wordSchema).default([]),
  })
  .refine((line) => line.endTime >= line.startTime, 'Line ends before it starts');
const documentSchema = z.object({
  lines: z.array(lineSchema),
  title: z.string().optional(),
  artist: z.string().optional(),
  offset: z.number().default(0),
});

/** LRC, enhanced LRC and rich JSON use one normalized timeline. TTML can add an adapter. */
export function parseLyrics(source: string, duration = Infinity): LyricsDocument {
  if (source.trim().startsWith('{')) {
    const doc = documentSchema.parse(JSON.parse(source));
    return { ...doc, lines: doc.lines.sort((a, b) => a.startTime - b.startTime) };
  }
  const offset = Number(source.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000;
  const lines: LyricsLine[] = [];
  for (const raw of source.split(/\r?\n/)) {
    const times = [...raw.matchAll(/\[(\d{1,3}):(\d{2}(?:\.\d+)?)\]/g)];
    if (!times.length) continue;
    const content = raw.replace(/\[\d{1,3}:\d{2}(?:\.\d+)?\]/g, '').trim();
    const wordMatches = [...content.matchAll(/<(\d{1,3}):(\d{2}(?:\.\d+)?)>([^<]*)/g)];
    for (const timestamp of times) {
      const startTime = Math.max(0, stamp(timestamp[1], timestamp[2]) + offset);
      const words = wordMatches
        .filter((word) => word[3].length)
        .map((word, index) => ({
          startTime: Math.max(0, stamp(word[1], word[2]) + offset),
          endTime: wordMatches[index + 1]
            ? Math.max(0, stamp(wordMatches[index + 1][1], wordMatches[index + 1][2]) + offset)
            : Infinity,
          text: word[3],
        }));
      lines.push({
        startTime,
        endTime: Infinity,
        text: content.replace(/<\d{1,3}:\d{2}(?:\.\d+)?>/g, ''),
        words,
      });
    }
  }
  lines.sort((a, b) => a.startTime - b.startTime);
  // Same-time lines are commonly bilingual LRC. Preserve the alternate line as translation.
  const merged: LyricsLine[] = [];
  for (const line of lines) {
    const previous = merged.at(-1);
    if (previous && previous.startTime === line.startTime && previous.text && line.text)
      previous.translation = [previous.translation, line.text].filter(Boolean).join('\n');
    else merged.push(line);
  }
  merged.forEach((line, index) => {
    line.endTime = merged[index + 1]?.startTime ?? duration;
    for (const word of line.words) if (!Number.isFinite(word.endTime)) word.endTime = line.endTime;
  });
  return {
    lines: merged,
    offset,
    title: source.match(/\[ti:(.*?)\]/i)?.[1],
    artist: source.match(/\[ar:(.*?)\]/i)?.[1],
  };
}
export function activeLine(lines: LyricsLine[], position: number) {
  let low = 0,
    high = lines.length - 1,
    result = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].startTime <= position) {
      result = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  return result;
}
