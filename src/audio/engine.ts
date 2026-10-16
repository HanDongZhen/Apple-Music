import { useMusic } from '../storage/store';
import type { Track } from '../types';

export const mimeFor = (track: Track) => {
  const ext = track.audioUrl.split('?')[0].split('.').pop()?.toLowerCase();
  const codec = (track.codec || ext || '').toLowerCase();
  if (/flac/.test(codec)) return 'audio/flac';
  if (/pcm|wav/.test(codec)) return 'audio/wav';
  if (/alac|aac|m4a/.test(codec)) return 'audio/mp4';
  if (/mpeg|mp3/.test(codec)) return 'audio/mpeg';
  if (/opus|vorbis|ogg/.test(codec)) return 'audio/ogg';
  return '';
};
export function mediaError(code?: number) {
  return (
    {
      1: 'Playback was interrupted. Try again.',
      2: 'The audio could not be loaded. Check your connection and library access.',
      3: 'This file could not be decoded. Its codec or resolution may not be supported by this browser.',
      4: 'Audio unavailable or unsupported. Check the file URL and browser codec support.',
    }[code ?? 0] || 'Playback could not start. Please try again.'
  );
}

/** A single native decoder. No AudioContext, DSP, gain stage, resampling or transcoding. */
export class NativeAudioEngine {
  readonly audio: HTMLAudioElement;
  private preload: HTMLAudioElement;
  private source = '';
  private selectedId: string | null = null;
  private generation = 0;
  private lastRequest = -1;
  private targetPosition = 0;
  private trackedPlay = false;
  private unsubscribe: (() => void) | undefined;
  private handlers: Array<[string, EventListener]> = [];
  constructor(audio = new Audio()) {
    this.audio = audio;
    this.audio.preload = 'metadata';
    this.audio.hidden = true;
    this.audio.dataset.nativePlayer = 'true';
    document.body.append(this.audio);
    this.preload = new Audio();
    this.preload.preload = 'metadata';
    this.listen('loadedmetadata', () => {
      if (Number.isFinite(audio.duration)) useMusic.setState({ duration: audio.duration });
      this.applyPosition();
      this.updatePositionState();
    });
    this.listen('durationchange', () => {
      if (Number.isFinite(audio.duration)) useMusic.setState({ duration: audio.duration });
    });
    this.listen('timeupdate', () => {
      useMusic.setState({ position: audio.currentTime });
      this.updatePositionState();
      if (
        !this.trackedPlay &&
        !audio.paused &&
        audio.currentTime >= Math.min(5, audio.duration / 2)
      ) {
        const id = useMusic.getState().currentId;
        if (id) useMusic.getState().recordPlay(id);
        this.trackedPlay = true;
      }
    });
    this.listen('progress', () => {
      let buffered = 0;
      for (let i = 0; i < audio.buffered.length; i++)
        if (audio.buffered.start(i) <= audio.currentTime + 0.5) buffered = audio.buffered.end(i);
      useMusic.setState({ buffered });
    });
    this.listen('playing', () => {
      useMusic.setState({ status: 'playing', error: null, desiredPlaying: true });
      this.mediaState('playing');
    });
    this.listen('pause', () => {
      if (!audio.ended) useMusic.setState({ status: 'paused' });
      this.mediaState('paused');
    });
    for (const event of ['waiting', 'stalled', 'seeking'])
      this.listen(event, () => {
        if (useMusic.getState().desiredPlaying) useMusic.setState({ status: 'buffering' });
      });
    this.listen('canplay', () => {
      if (!useMusic.getState().desiredPlaying) useMusic.setState({ status: 'paused' });
    });
    this.listen('seeked', () => {
      useMusic.setState({ status: audio.paused ? 'paused' : 'playing' });
    });
    this.listen('ended', () => useMusic.getState().next(true));
    this.listen('error', () => {
      if (this.source) this.fail(mediaError(audio.error?.code));
    });
    this.unsubscribe = useMusic.subscribe(() => this.sync());
    this.installMediaSession();
    this.sync();
  }
  private listen(name: string, fn: EventListener) {
    this.audio.addEventListener(name, fn);
    this.handlers.push([name, fn]);
  }
  private mediaState(state: MediaSessionPlaybackState) {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = state;
  }
  private fail(message: string) {
    if (useMusic.getState().error === message && useMusic.getState().status === 'error') return;
    useMusic.setState({ status: 'error', error: message, desiredPlaying: false });
    useMusic.getState().notify(message);
  }
  private applyPosition() {
    if (this.audio.readyState > 0 && Number.isFinite(this.audio.duration)) {
      this.audio.currentTime = Math.max(0, Math.min(this.targetPosition, this.audio.duration));
    }
  }
  private sync() {
    const state = useMusic.getState();
    this.audio.volume = state.volume;
    if (!state.libraryReady || !useMusic.persist.hasHydrated()) return;
    const track = state.tracks.find((item) => item.id === state.currentId);
    const url = track?.audioUrl || '';
    if (this.source !== url || this.selectedId !== state.currentId) {
      this.selectedId = state.currentId;
      this.generation++;
      this.source = url;
      this.lastRequest = -1;
      this.trackedPlay = false;
      this.targetPosition = state.position;
      this.audio.pause();
      if (url) {
        this.audio.src = url;
        this.audio.load();
      } else {
        this.audio.removeAttribute('src');
        this.audio.load();
      }
      if (track && 'mediaSession' in navigator && 'MediaMetadata' in window)
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: track.album,
          artwork: [{ src: track.artworkUrl }],
        });
    }
    if (state.request === this.lastRequest) return;
    this.lastRequest = state.request;
    this.targetPosition = state.position;
    if (state.position === 0 && this.audio.currentTime > 0) this.trackedPlay = false;
    this.applyPosition();
    if (!state.desiredPlaying) {
      this.audio.pause();
      return;
    }
    if (!url) {
      this.fail('Audio source not configured. Import your music to start listening.');
      return;
    }
    const mime = track ? mimeFor(track) : '';
    if (mime && !this.audio.canPlayType(mime)) {
      this.fail(
        `This browser does not advertise support for ${track?.codec || mime}. Try another browser; your original file is unchanged.`,
      );
      return;
    }
    if (this.audio.error) this.audio.load();
    useMusic.setState({ status: 'loading' });
    const generation = this.generation;
    void this.audio.play().catch((error: unknown) => {
      if (
        generation !== this.generation ||
        (error instanceof DOMException && error.name === 'AbortError')
      )
        return;
      this.fail(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'Your browser needs a tap on Play to start audio.'
          : mediaError(this.audio.error?.code),
      );
    });
    const next = state.tracks.find((item) => item.id === state.queue[0]?.trackId);
    // Only the next source's metadata, never the whole library. Gapless depends on the decoder.
    if (next?.audioUrl && next.audioUrl !== this.preload.getAttribute('src'))
      this.preload.src = next.audioUrl;
    else if (!next?.audioUrl) this.preload.removeAttribute('src');
  }
  private updatePositionState() {
    if (
      !('mediaSession' in navigator) ||
      !navigator.mediaSession.setPositionState ||
      !Number.isFinite(this.audio.duration) ||
      this.audio.duration <= 0
    )
      return;
    try {
      navigator.mediaSession.setPositionState({
        duration: this.audio.duration,
        playbackRate: 1,
        position: Math.min(this.audio.currentTime, this.audio.duration),
      });
    } catch {
      /* Some browsers expose a partial implementation. */
    }
  }
  private installMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
      play: () => {
        useMusic.setState((state) => ({ desiredPlaying: true, request: state.request + 1 }));
      },
      pause: () => {
        useMusic.setState((state) => ({ desiredPlaying: false, request: state.request + 1 }));
      },
      previoustrack: () => useMusic.getState().previous(),
      nexttrack: () => useMusic.getState().next(),
      seekto: (details) => useMusic.getState().seek(details.seekTime ?? 0),
      seekbackward: (details) =>
        useMusic.getState().seek(this.audio.currentTime - (details.seekOffset || 10)),
      seekforward: (details) =>
        useMusic.getState().seek(this.audio.currentTime + (details.seekOffset || 10)),
    };
    for (const [action, handler] of Object.entries(handlers))
      try {
        navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler);
      } catch {
        /* Unsupported OS action. */
      }
  }
  destroy() {
    this.unsubscribe?.();
    this.generation++;
    this.audio.pause();
    this.preload.removeAttribute('src');
    this.preload.load();
    for (const [name, fn] of this.handlers) this.audio.removeEventListener(name, fn);
    this.audio.removeAttribute('src');
    this.audio.load();
    this.audio.remove();
    if ('mediaSession' in navigator)
      for (const action of [
        'play',
        'pause',
        'previoustrack',
        'nexttrack',
        'seekto',
        'seekbackward',
        'seekforward',
      ] as const)
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          /* Optional action. */
        }
  }
}
