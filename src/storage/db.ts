import { openDB } from 'idb';
import type { StateStorage } from 'zustand/middleware';
import type { Track } from '../types';

export interface StoredFile {
  track: Track;
  audio: Blob;
  artwork?: Blob;
}
const database = () =>
  openDB('mr-han-music', 1, {
    upgrade(db) {
      db.createObjectStore('state');
      db.createObjectStore('files');
      db.createObjectStore('lyrics');
    },
  });
const pending = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | undefined;
let warned = false;
function reportStorageFailure() {
  if (!warned) {
    warned = true;
    window.dispatchEvent(new CustomEvent('storage-error'));
  }
}
export async function flushStorage() {
  clearTimeout(timer);
  timer = undefined;
  const entries = [...pending.entries()];
  pending.clear();
  try {
    const db = await database();
    const tx = db.transaction('state', 'readwrite');
    for (const [key, value] of entries) await tx.store.put(value, key);
    await tx.done;
  } catch {
    reportStorageFailure();
  }
}
export const indexedStorage: StateStorage = {
  async getItem(key) {
    try {
      return (await (await database()).get('state', key)) ?? null;
    } catch {
      reportStorageFailure();
      return null;
    }
  },
  setItem(key, value) {
    pending.set(key, value);
    timer ??= setTimeout(() => {
      void flushStorage();
    }, 1000);
  },
  async removeItem(key) {
    pending.delete(key);
    await (await database()).delete('state', key);
  },
};
export async function saveLocalFile(id: string, file: StoredFile) {
  await (await database()).put('files', file, id);
}
const objectUrls: string[] = [];
export async function readLocalFiles(): Promise<Track[]> {
  const records: StoredFile[] = await (await database()).getAll('files');
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.length = 0;
  return records.map((record) => {
    const audioUrl = URL.createObjectURL(record.audio);
    objectUrls.push(audioUrl);
    const artworkUrl = record.artwork
      ? URL.createObjectURL(record.artwork)
      : record.track.artworkUrl;
    if (record.artwork) objectUrls.push(artworkUrl);
    return { ...record.track, audioUrl, artworkUrl };
  });
}
export async function saveLyrics(id: string, source: string) {
  await (await database()).put('lyrics', source, id);
}
export async function readLyrics(id: string): Promise<string | undefined> {
  return (await database()).get('lyrics', id);
}
