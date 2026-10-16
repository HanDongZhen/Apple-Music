import { useEffect, useRef, useState } from 'react';
import { ArrowDown, FileText, Languages, LoaderCircle, Music2, Upload } from 'lucide-react';
import type { LyricsDocument, Track } from '../types';
import { useMusic } from '../storage/store';
import { readLyrics, saveLyrics } from '../storage/db';
import { activeLine, parseLyrics } from './parser';
import { lyricTarget, springStep } from './tracking';
import { Glass } from '../glass/Glass';
import { IconButton } from '../components/ui';

export function LyricsView({ track }: { track: Track }) {
  const position = useMusic((state) => state.position);
  const duration = useMusic((state) => state.duration);
  const playing = useMusic((state) => state.status === 'playing');
  const translation = useMusic((state) => state.translation);
  const pronunciation = useMusic((state) => state.pronunciation);
  const [document, setDocument] = useState<LyricsDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [manual, setManual] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [clock, setClock] = useState(position);
  const viewport = useRef<HTMLDivElement>(null);
  const lines = useRef<Array<HTMLButtonElement | null>>([]);
  const input = useRef<HTMLInputElement>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const velocity = useRef(0);
  const current = document ? activeLine(document.lines, position) : -1;
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDocument(null);
    setManual(false);
    setShowReturn(false);
    velocity.current = 0;
    async function load() {
      try {
        let source: string | undefined;
        try {
          source = await readLyrics(track.id);
        } catch {
          /* Remote lyrics remain available without IndexedDB. */
        }
        if (!source && track.lyricsUrl) {
          const response = await fetch(track.lyricsUrl, { signal: controller.signal });
          if (!response.ok) throw new Error(`Lyrics could not load (${response.status}).`);
          source = await response.text();
        }
        if (!cancelled && source) {
          const doc = parseLyrics(source, duration || track.duration || Infinity);
          if (!doc.lines.length)
            throw new Error('No timed lyrics found. Use an LRC or rich JSON lyric file.');
          setDocument(doc);
        }
      } catch (reason) {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : 'Could not read lyrics.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout.current);
    };
  }, [track.id, track.lyricsUrl, track.duration, duration, revision]);
  useEffect(() => {
    if (!document?.lines.some((line) => line.words.length) || !playing) {
      setClock(position);
      return;
    }
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      setClock(position + Math.min((now - start) / 1000, 0.6));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [document, position, playing]);
  useEffect(() => {
    const container = viewport.current;
    const line = lines.current[Math.max(0, current)];
    if (!container || !line || manual) return;
    let frame: number;
    let previous = performance.now();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = () =>
      Math.min(
        container.scrollHeight - container.clientHeight,
        lyricTarget(line.offsetTop, line.offsetHeight, container.clientHeight),
      );
    if (reduced) {
      container.scrollTop = target();
      return;
    }
    const tick = (now: number) => {
      const distance = target();
      const state = springStep(
        container.scrollTop,
        velocity.current,
        distance,
        (now - previous) / 1000,
        80,
        20,
      );
      velocity.current = state.velocity;
      container.scrollTop = state.position;
      previous = now;
      if (Math.abs(distance - container.scrollTop) > 0.6 || Math.abs(velocity.current) > 0.6)
        frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [current, manual, document, translation, pronunciation]);
  const suspend = () => {
    setManual(true);
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setShowReturn(true), 1800);
  };
  const importControl = (
    <>
      <button className="button lyrics-import" onClick={() => input.current?.click()}>
        <Upload size={16} />
        Import lyrics
      </button>
      <input
        ref={input}
        type="file"
        tabIndex={-1}
        className="sr-only"
        accept=".lrc,.json,text/plain,application/json"
        aria-label="Import lyrics file"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          try {
            if (file.size > 2 * 1024 * 1024)
              throw new Error('Choose a lyric file smaller than 2 MB.');
            const text = await file.text();
            const parsed = parseLyrics(text, duration || Infinity);
            if (!parsed.lines.length) throw new Error('No timed lines found in this file.');
            await saveLyrics(track.id, text);
            setRevision((value) => value + 1);
            useMusic.getState().notify('Lyrics attached to this track.');
          } catch (reason) {
            useMusic
              .getState()
              .notify(reason instanceof Error ? reason.message : 'Could not import lyrics.');
          }
        }}
      />
    </>
  );
  return (
    <section className="lyrics-panel" aria-label="Synchronized lyrics">
      <div className="lyrics-heading">
        <span>
          <FileText size={15} />
          LYRICS
        </span>
        <IconButton
          label="Toggle lyric translations"
          aria-pressed={translation}
          onClick={() => useMusic.setState({ translation: !translation })}
        >
          <Languages size={20} />
        </IconButton>
      </div>
      {loading ? (
        <div className="lyrics-empty">
          <LoaderCircle className="spin" size={28} />
          <p>Finding the words…</p>
        </div>
      ) : document ? (
        <>
          <div
            className="lyrics-viewport"
            ref={viewport}
            tabIndex={0}
            aria-label="Lyric timeline; select a line to seek"
            onWheel={suspend}
            onTouchStart={suspend}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) suspend();
            }}
            onKeyDown={(event) => {
              if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key))
                suspend();
            }}
          >
            <div className="lyrics-lines">
              {current === -1 && (
                <div className="instrumental">
                  <Music2 size={22} />
                  <span className={playing ? 'lyric-dots playing' : 'lyric-dots'}>
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="sr-only">Instrumental introduction</span>
                </div>
              )}
              {document.lines.map((line, index) => {
                const distance = Math.abs(index - current);
                const active = index === current;
                return (
                  <button
                    ref={(node) => {
                      lines.current[index] = node;
                    }}
                    key={`${line.startTime}-${index}`}
                    className={`lyric-line ${active ? 'current' : ''} ${distance > 2 ? 'distant' : distance > 0 ? 'near' : ''}`}
                    aria-current={active ? 'true' : undefined}
                    aria-label={line.text ? `Seek to ${line.text}` : 'Seek to instrumental section'}
                    onClick={() => {
                      useMusic.getState().seek(line.startTime);
                      setManual(false);
                      setShowReturn(false);
                      velocity.current = 0;
                    }}
                  >
                    {line.text && !(active && position >= line.endTime) ? (
                      <span className="lyric-text">
                        {line.words.length
                          ? line.words.map((word, wordIndex) => (
                              <span
                                className="lyric-word"
                                key={wordIndex}
                                style={{
                                  opacity: active
                                    ? 0.35 +
                                      Math.max(
                                        0,
                                        Math.min(
                                          1,
                                          (clock - word.startTime) /
                                            Math.max(0.01, word.endTime - word.startTime),
                                        ),
                                      ) *
                                        0.65
                                    : undefined,
                                }}
                              >
                                {word.text}
                              </span>
                            ))
                          : line.text}
                      </span>
                    ) : (
                      <span className={playing && active ? 'lyric-dots playing' : 'lyric-dots'}>
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                    {translation && line.translation && !(active && position >= line.endTime) && (
                      <span className="lyric-translation">{line.translation}</span>
                    )}
                    {pronunciation &&
                      line.pronunciation &&
                      !(active && position >= line.endTime) && (
                        <span className="lyric-pronunciation">{line.pronunciation}</span>
                      )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="lyrics-footer">
            {showReturn && manual ? (
              <Glass material="lyrics-control">
                <button
                  className="return-lyrics"
                  onClick={() => {
                    setManual(false);
                    setShowReturn(false);
                    velocity.current = 0;
                  }}
                >
                  <ArrowDown size={15} />
                  Return to current lyrics
                </button>
              </Glass>
            ) : (
              <span>Tap a line to find your place.</span>
            )}
            {importControl}
          </div>
        </>
      ) : (
        <div className="lyrics-empty">
          <Music2 size={38} strokeWidth={1.1} />
          <h3>{error ? 'The words are out of reach' : 'Give this song its words.'}</h3>
          <p>{error || 'Add an LRC or timed JSON file for lyrics that move with your music.'}</p>
          {importControl}
          {error && (
            <button className="text-link" onClick={() => setRevision((value) => value + 1)}>
              Try again
            </button>
          )}
          <span className="fine-print">Line sync · Word sync · Translations</span>
        </div>
      )}
    </section>
  );
}
