import { useEffect } from 'react';
import { NativeAudioEngine } from '../audio/engine';
import { useMusic } from '../storage/store';
import { readLocalFiles, flushStorage } from '../storage/db';
import { librarySchema } from '../types';

export function Runtime() {
  const theme = useMusic((state) => state.theme);
  const glassQuality = useMusic((state) => state.glassQuality);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const effective = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = effective;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', effective === 'dark' ? '#101112' : '#f8f8fa');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      document.documentElement.dataset.quality =
        glassQuality === 'auto'
          ? reduced.matches || navigator.hardwareConcurrency <= 4
            ? 'reduced'
            : 'balanced'
          : glassQuality;
    };
    apply();
    reduced.addEventListener('change', apply);
    return () => reduced.removeEventListener('change', apply);
  }, [glassQuality]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          document.documentElement.style.setProperty(
            '--scroll-light',
            `${Math.min(40, 8 + window.scrollY * 0.012)}%`,
          );
          frame = 0;
        });
    };
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const engine = new NativeAudioEngine();
    async function load() {
      if (!useMusic.persist.hasHydrated())
        await new Promise<void>((resolve) => {
          const unsubscribe = useMusic.persist.onFinishHydration(() => {
            unsubscribe();
            resolve();
          });
        });
      const results = await Promise.allSettled([
        fetch(import.meta.env.VITE_LIBRARY_URL || '/library.json', {
          signal: controller.signal,
        }).then(async (response) => {
          if (!response.ok) throw new Error(`Library request failed (${response.status})`);
          return librarySchema.parse(await response.json()).tracks;
        }),
        readLocalFiles(),
      ]);
      if (disposed) return;
      const remote = results[0].status === 'fulfilled' ? results[0].value : [];
      const local = results[1].status === 'fulfilled' ? results[1].value : [];
      useMusic.getState().setLibrary([...remote, ...local]);
      if (results[0].status === 'rejected')
        useMusic
          .getState()
          .notify(
            'Your remote library could not load. Local music is still available. Check the library URL and access settings.',
          );
      else if (results[1].status === 'rejected')
        useMusic
          .getState()
          .notify('Browser storage is unavailable. Imported files and settings may not persist.');
    }
    void load();
    const flush = () => {
      if (document.hidden) void flushStorage();
    };
    const storageError = () =>
      useMusic
        .getState()
        .notify('Browser storage is unavailable or full. Changes may not survive a refresh.');
    const offline = () =>
      useMusic
        .getState()
        .notify('You’re offline. Music imported on this device is still available.');
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('storage-error', storageError);
    window.addEventListener('offline', offline);
    if (import.meta.env.PROD && 'serviceWorker' in navigator)
      void navigator.serviceWorker
        .register('/sw.js')
        .catch(() =>
          useMusic.getState().notify('Offline app caching is unavailable in this browser.'),
        );
    return () => {
      disposed = true;
      controller.abort();
      engine.destroy();
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('storage-error', storageError);
      window.removeEventListener('offline', offline);
    };
  }, []);
  return null;
}
