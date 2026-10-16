import { describe, expect, it } from 'vitest';
import { albumsOf, demoTracks, searchTracks } from '../src/library/catalog';
import { librarySchema } from '../src/types';
import { quality, time } from '../src/utils/format';
describe('library and source provenance', () => {
  it('searches Chinese and case-insensitive English with unicode normalization', () => {
    expect(searchTracks(demoTracks, '周杰伦 七里香')).toHaveLength(1);
    expect(searchTracks(demoTracks, 'MICHAEL heal')).toHaveLength(1);
    expect(searchTracks(demoTracks, 'ｌｅｔｔｉｎｇ')).toHaveLength(1);
  });
  it('does not combine albums with the same name but different artists', () => {
    expect(
      albumsOf([
        { ...demoTracks[0], album: 'Same' },
        { ...demoTracks[1], album: 'Same' },
      ]),
    ).toHaveLength(2);
  });
  it('validates source URLs and unique IDs', () => {
    expect(() =>
      librarySchema.parse({
        version: 1,
        tracks: [{ ...demoTracks[0], audioUrl: 'javascript:alert(1)' }],
      }),
    ).toThrow();
    expect(() =>
      librarySchema.parse({ version: 1, tracks: [demoTracks[0], demoTracks[0]] }),
    ).toThrow();
  });
  it('never labels previews or AAC as lossless', () => {
    expect(quality({ codec: 'FLAC', bitDepth: 24, sampleRate: 96000, demo: true })).toBe('Preview');
    expect(quality({ codec: 'AAC', bitDepth: 24, sampleRate: 96000 })).toBe('AAC');
    expect(quality({ codec: 'FLAC', bitDepth: 24, sampleRate: 96000 })).toBe('Hi-Res Lossless');
    expect(quality({ codec: 'FLAC', bitDepth: 16, sampleRate: 44100 })).toBe('Lossless');
    expect(time(Infinity)).toBe('0:00');
  });
});
