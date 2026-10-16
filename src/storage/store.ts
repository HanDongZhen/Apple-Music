import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { indexedStorage } from './db';
import { demoTracks } from '../library/catalog';
import type { GlassQuality, PlaybackStatus, Playlist, QueueEntry, Theme, Track } from '../types';

type Repeat = 'off' | 'all' | 'one';
interface MusicState {
  tracks: Track[];
  libraryReady: boolean;
  currentId: string | null;
  queue: QueueEntry[];
  sessionOrder: string[];
  backStack: string[];
  position: number;
  duration: number;
  buffered: number;
  volume: number;
  desiredPlaying: boolean;
  status: PlaybackStatus;
  error: string | null;
  request: number;
  shuffle: boolean;
  repeat: Repeat;
  theme: Theme;
  glassQuality: GlassQuality;
  favorites: string[];
  history: Record<string, { count: number; lastPlayed: number }>;
  playlists: Playlist[];
  playerOpen: boolean;
  lyricsOpen: boolean;
  queueOpen: boolean;
  translation: boolean;
  pronunciation: boolean;
  toast: { id: number; message: string } | null;
  setLibrary: (tracks: Track[]) => void;
  play: (id: string, collection?: string[]) => void;
  toggle: () => void;
  next: (ended?: boolean) => void;
  previous: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  enqueue: (id: string, next?: boolean) => void;
  removeQueue: (entryId: string) => void;
  reorderQueue: (from: number, to: number) => void;
  favorite: (key: string) => void;
  recordPlay: (id: string) => void;
  notify: (message: string) => void;
  addPlaylist: (name: string, trackId?: string) => void;
  addToPlaylist: (playlistId: string, trackId: string) => void;
}
const entries = (ids: string[]) => ids.map((trackId) => ({ trackId, id: crypto.randomUUID() }));
export const useMusic = create<MusicState>()(
  persist(
    (set, get) => ({
      tracks: demoTracks,
      libraryReady: false,
      currentId: demoTracks[0].id,
      queue: [],
      sessionOrder: [],
      backStack: [],
      position: 0,
      duration: 0,
      buffered: 0,
      volume: 0.75,
      desiredPlaying: false,
      status: 'idle',
      error: null,
      request: 0,
      shuffle: false,
      repeat: 'off',
      theme: 'system',
      glassQuality: 'auto',
      favorites: [],
      history: {},
      playlists: [],
      playerOpen: false,
      lyricsOpen: false,
      queueOpen: false,
      translation: true,
      pronunciation: false,
      toast: null,
      setLibrary(tracks) {
        const next = tracks.length ? tracks : demoTracks;
        const ids = new Set(next.map((track) => track.id));
        set((state) => ({
          tracks: next,
          libraryReady: true,
          currentId:
            state.currentId && ids.has(state.currentId) ? state.currentId : (next[0]?.id ?? null),
          queue: state.queue.filter((entry) => ids.has(entry.trackId)),
          sessionOrder: state.sessionOrder.filter((id) => ids.has(id)),
          backStack: state.backStack.filter((id) => ids.has(id)),
        }));
      },
      play(id, collection) {
        const state = get();
        const order = collection ?? state.tracks.map((track) => track.id);
        const index = order.indexOf(id);
        set({
          currentId: id,
          queue: entries(
            state.shuffle ? order.filter((key) => key !== id) : order.slice(index + 1),
          ),
          sessionOrder: order,
          backStack:
            state.currentId && state.currentId !== id
              ? [...state.backStack, state.currentId].slice(-100)
              : state.backStack,
          position: 0,
          duration: 0,
          buffered: 0,
          error: null,
          desiredPlaying: true,
          request: state.request + 1,
        });
      },
      toggle() {
        const state = get();
        if (!state.currentId) return;
        set({ desiredPlaying: !state.desiredPlaying, error: null, request: state.request + 1 });
      },
      next(ended = false) {
        const state = get();
        if (ended && state.repeat === 'one') {
          set({ position: 0, desiredPlaying: true, request: state.request + 1 });
          return;
        }
        let queue = [...state.queue];
        if (!queue.length && state.repeat === 'all') queue = entries(state.sessionOrder);
        if (!queue.length) {
          set({ desiredPlaying: false, status: 'paused' });
          return;
        }
        const index = state.shuffle ? Math.floor(Math.random() * queue.length) : 0;
        const [entry] = queue.splice(index, 1);
        set({
          currentId: entry.trackId,
          queue,
          backStack: state.currentId
            ? [...state.backStack, state.currentId].slice(-100)
            : state.backStack,
          position: 0,
          duration: 0,
          buffered: 0,
          desiredPlaying: true,
          error: null,
          request: state.request + 1,
        });
      },
      previous() {
        const state = get();
        if (state.position > 3 || !state.backStack.length) {
          state.seek(0);
          return;
        }
        const back = [...state.backStack];
        const id = back.pop()!;
        set({
          currentId: id,
          backStack: back,
          queue: [...entries(state.currentId ? [state.currentId] : []), ...state.queue],
          position: 0,
          duration: 0,
          desiredPlaying: true,
          error: null,
          request: state.request + 1,
        });
      },
      seek(position) {
        const state = get();
        set({
          position: Math.max(0, Math.min(position, state.duration || Infinity)),
          request: state.request + 1,
        });
      },
      setVolume(volume) {
        set({ volume: Math.max(0, Math.min(1, volume)) });
      },
      enqueue(id, next = false) {
        set((state) => ({
          queue: next ? [...entries([id]), ...state.queue] : [...state.queue, ...entries([id])],
        }));
        get().notify(next ? 'Added to Play Next' : 'Added to the end of your queue');
      },
      removeQueue(id) {
        set((state) => ({ queue: state.queue.filter((entry) => entry.id !== id) }));
      },
      reorderQueue(from, to) {
        const queue = [...get().queue];
        if (from < 0 || to < 0 || from >= queue.length || to >= queue.length) return;
        const [item] = queue.splice(from, 1);
        queue.splice(to, 0, item);
        set({ queue });
      },
      favorite(key) {
        set((state) => ({
          favorites: state.favorites.includes(key)
            ? state.favorites.filter((id) => id !== key)
            : [...state.favorites, key],
        }));
      },
      recordPlay(id) {
        set((state) => ({
          history: {
            ...state.history,
            [id]: { count: (state.history[id]?.count ?? 0) + 1, lastPlayed: Date.now() },
          },
        }));
      },
      notify(message) {
        if (get().toast?.message === message) return;
        set({ toast: { id: Date.now(), message } });
      },
      addPlaylist(name, trackId) {
        const value = name.trim();
        if (!value) return;
        set((state) => ({
          playlists: [
            ...state.playlists,
            {
              id: crypto.randomUUID(),
              name: value,
              trackIds: trackId ? [trackId] : [],
              createdAt: Date.now(),
            },
          ],
        }));
        get().notify(`Created “${value}”`);
      },
      addToPlaylist(playlistId, trackId) {
        set((state) => ({
          playlists: state.playlists.map((playlist) =>
            playlist.id === playlistId
              ? { ...playlist, trackIds: [...new Set([...playlist.trackIds, trackId])] }
              : playlist,
          ),
        }));
        get().notify('Added to playlist');
      },
    }),
    {
      name: 'mr-han-player-v1',
      version: 1,
      storage: createJSONStorage(() => indexedStorage),
      partialize: (state) => ({
        currentId: state.currentId,
        queue: state.queue,
        sessionOrder: state.sessionOrder,
        backStack: state.backStack,
        position: state.position,
        volume: state.volume,
        shuffle: state.shuffle,
        repeat: state.repeat,
        theme: state.theme,
        glassQuality: state.glassQuality,
        favorites: state.favorites,
        history: state.history,
        playlists: state.playlists,
        translation: state.translation,
        pronunciation: state.pronunciation,
      }),
    },
  ),
);
