import { describe, expect, it } from 'vitest';
import { activeLine, parseLyrics } from '../src/lyrics/parser';
import { lyricTarget, springStep } from '../src/lyrics/tracking';

describe('LRC normalization', () => {
  it('sorts, expands repeated timestamps and honors millisecond offsets', () => {
    const doc = parseLyrics(
      '[ti:Test]\n[offset:-500]\n[00:20.00]Late\n[00:01.50][00:10.00]Again',
      30,
    );
    expect(doc.title).toBe('Test');
    expect(doc.lines.map((line) => [line.startTime, line.endTime, line.text])).toEqual([
      [1, 9.5, 'Again'],
      [9.5, 19.5, 'Again'],
      [19.5, 30, 'Late'],
    ]);
    expect(activeLine(doc.lines, 0)).toBe(-1);
    expect(activeLine(doc.lines, 9.5)).toBe(1);
  });
  it('keeps instrumental markers and merges bilingual timestamps', () => {
    const doc = parseLyrics('[00:00.00]\n[00:05.00]Hello\n[00:05.00]你好\n[00:12.00]', 25);
    expect(doc.lines).toHaveLength(3);
    expect(doc.lines[1].translation).toBe('你好');
    expect(doc.lines[2].text).toBe('');
  });
  it('normalizes enhanced word timing without inventing lyrics', () => {
    const doc = parseLyrics('[00:05.00]<00:05.00>Hello <00:06.50>world<00:08.00>\n[00:10.00]Next');
    expect(doc.lines[0].text).toBe('Hello world');
    expect(doc.lines[0].words).toEqual([
      { startTime: 5, endTime: 6.5, text: 'Hello ' },
      { startTime: 6.5, endTime: 8, text: 'world' },
    ]);
  });
  it('accepts rich timing and rejects invalid times', () => {
    expect(
      parseLyrics(
        JSON.stringify({
          lines: [{ startTime: 1, endTime: 4, text: 'Test', translation: '测试' }],
        }),
      ).lines[0].words,
    ).toEqual([]);
    expect(() => parseLyrics('{"lines":[{"startTime":4,"endTime":1,"text":"bad"}]}')).toThrow();
  });
  it('converges at 60 and 120 Hz with continuous velocity', () => {
    for (const fps of [60, 120]) {
      let p = 0,
        v = 0;
      for (let n = 0; n < fps * 3; n++) {
        const step = springStep(p, v, 400, 1 / fps);
        p = step.position;
        v = step.velocity;
      }
      expect(p).toBeCloseTo(400, 1);
      expect(Math.abs(v)).toBeLessThan(0.1);
    }
    expect(lyricTarget(500, 50, 600)).toBe(297);
  });
});
