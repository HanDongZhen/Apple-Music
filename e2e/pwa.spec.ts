import { test, expect } from '@playwright/test';
import { fixtureWav } from './fixtures';

test('production shell boots offline, imports and plays a local WAV without caching music', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  const cached = await page.evaluate(async () => {
    const cache = await caches.open(
      (await caches.keys()).find((name) => name.startsWith('mr-han-shell-'))!,
    );
    return (await cache.keys()).map((request) => request.url);
  });
  expect(cached.some((url) => /\/assets\/.*\.js$/.test(url))).toBe(true);
  expect(cached.some((url) => /\.(wav|flac|mp3|m4a)$/.test(url))).toBe(false);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Less noise.*More music/ })).toBeVisible();
  await page
    .locator('input[type=file][accept*=".wav"]')
    .first()
    .setInputFiles({ name: 'Offline original.wav', mimeType: 'audio/wav', buffer: fixtureWav() });
  await expect(page.getByRole('status')).toContainText('1 track imported');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator('audio[data-native-player]')
        .evaluate((element) => (element as HTMLAudioElement).paused),
    )
    .toBe(false);
  await expect
    .poll(() =>
      page
        .locator('audio[data-native-player]')
        .evaluate((element) => (element as HTMLAudioElement).currentTime),
    )
    .toBeGreaterThan(0.1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open Now Playing', exact: true })).toContainText(
    'Offline original',
  );
  expect(errors).toEqual([]);
});
