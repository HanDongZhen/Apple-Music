import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/storage/db', () => ({
  indexedStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
}));
import { useMusic } from '../src/storage/store';
import { demoTracks } from '../src/library/catalog';
beforeEach(() =>
  useMusic.setState({
    tracks: demoTracks,
    currentId: null,
    queue: [],
    sessionOrder: [],
    backStack: [],
    position: 0,
    duration: 100,
    desiredPlaying: false,
    request: 0,
    shuffle: false,
    repeat: 'off',
    favorites: [],
    history: {},
    playlists: [],
  }),
);
describe('queue and library persistence model', () => {
  it('plays a collection in order, consumes queue and returns to previous', () => {
    const state = useMusic.getState();
    const ids = demoTracks.slice(0, 3).map((track) => track.id);
    state.play(ids[0], ids);
    state.next();
    expect(useMusic.getState().currentId).toBe(ids[1]);
    expect(useMusic.getState().queue.map((entry) => entry.trackId)).toEqual([ids[2]]);
    state.previous();
    expect(useMusic.getState().currentId).toBe(ids[0]);
    expect(useMusic.getState().queue.map((entry) => entry.trackId)).toEqual(ids.slice(1));
  });
  it('supports duplicate queue entries and removes only the selected occurrence', () => {
    const id = demoTracks[0].id;
    useMusic.getState().enqueue(id);
    useMusic.getState().enqueue(id);
    const queue = useMusic.getState().queue;
    expect(queue[0].id).not.toBe(queue[1].id);
    useMusic.getState().removeQueue(queue[0].id);
    expect(useMusic.getState().queue).toEqual([queue[1]]);
  });
  it('reorders and rejects invalid moves without dropping songs', () => {
    demoTracks.slice(0, 3).forEach((track) => useMusic.getState().enqueue(track.id));
    const before = useMusic.getState().queue;
    useMusic.getState().reorderQueue(0, 2);
    expect(useMusic.getState().queue).toEqual([before[1], before[2], before[0]]);
    useMusic.getState().reorderQueue(-1, 2);
    expect(useMusic.getState().queue).toHaveLength(3);
  });
  it('repeats one only on ended, repeats all when exhausted', () => {
    const ids = demoTracks.slice(0, 2).map((track) => track.id);
    useMusic.getState().play(ids[0], ids);
    useMusic.setState({ repeat: 'one', position: 50 });
    useMusic.getState().next(true);
    expect(useMusic.getState().currentId).toBe(ids[0]);
    expect(useMusic.getState().position).toBe(0);
    useMusic.getState().next();
    expect(useMusic.getState().currentId).toBe(ids[1]);
    useMusic.setState({ repeat: 'all' });
    useMusic.getState().next(true);
    expect(useMusic.getState().currentId).toBe(ids[0]);
  });
  it('cleans stale queue entries after library changes', () => {
    useMusic.getState().play(demoTracks[0].id);
    useMusic.getState().setLibrary([demoTracks[0]]);
    expect(useMusic.getState().queue).toEqual([]);
  });
  it('records actual playback separately from selecting a song', () => {
    useMusic.getState().play(demoTracks[0].id);
    expect(useMusic.getState().history).toEqual({});
    useMusic.getState().recordPlay(demoTracks[0].id);
    useMusic.getState().recordPlay(demoTracks[0].id);
    expect(useMusic.getState().history[demoTracks[0].id].count).toBe(2);
  });
});
