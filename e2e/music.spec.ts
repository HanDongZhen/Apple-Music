import { expect, test, type Page } from '@playwright/test';

import { fixtureWav } from './fixtures';

test('a missing remote source reports an error and another imported track still plays', async ({
  page,
}) => {
  await page.route('**/library.json', (route) =>
    route.fulfill({
      json: {
        version: 1,
        tracks: [
          {
            id: 'missing-source',
            title: 'Missing source',
            artist: 'QA',
            album: 'Reliability',
            audioUrl: '/missing.mp3',
            artworkUrl: '/artwork/placeholder.svg',
            codec: 'MP3',
          },
        ],
      },
    }),
  );
  await page.route('**/missing.mp3', (route) => route.fulfill({ status: 404, body: 'Not found' }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open Now Playing', exact: true })).toContainText(
    'Missing source',
  );
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(/unavailable|could not/i);
  await importTrack(page, 'Recovery Test.wav');
  await page.getByRole('link', { name: 'Songs', exact: true }).first().click();
  await page.getByRole('button', { name: 'Play Recovery Test by Unknown Artist' }).click();
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
});

async function importTrack(page: Page, name = 'Quiet Test.wav') {
  await page
    .locator('input[type=file][accept*=".wav"]')
    .first()
    .setInputFiles({ name, mimeType: 'audio/wav', buffer: fixtureWav() });
  await expect(page.getByRole('status')).toContainText('1 track imported');
}
test('demo, routes, bilingual search, favorites, queue, playlist and theme', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Less noise.*More music/ })).toBeVisible();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Audio source not configured.');
  await page.getByRole('link', { name: 'Search your music' }).click();
  await page.getByRole('textbox', { name: 'Search songs, artists and albums' }).fill('周杰伦');
  await expect(page.getByRole('button', { name: 'Play 七里香 by 周杰伦' })).toBeVisible();
  await page.getByRole('button', { name: 'Favorite 七里香', exact: true }).click();
  await page.getByRole('button', { name: 'More for 七里香' }).click();
  await page.getByRole('button', { name: 'Play Next', exact: true }).click();
  await page.getByRole('button', { name: 'Open queue', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Playing Next' })).toContainText('七里香');
  await page.getByRole('button', { name: 'Close Playing Next', exact: true }).last().click();
  await page.getByRole('button', { name: 'More for 七里香' }).click();
  await page.getByRole('button', { name: 'Add to Playlist', exact: true }).click();
  await page.getByLabel('New playlist', { exact: true }).fill('Late evenings');
  await page.getByRole('button', { name: 'Create playlist', exact: true }).click();
  await page.getByRole('link', { name: 'Playlists', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Late evenings 1 songs' })).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('link', { name: 'Favorites', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play 七里香 by 周杰伦' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('original WAV import → native playback → synchronized lyrics → persisted position', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await importTrack(page);
  await page.getByRole('link', { name: 'Songs', exact: true }).first().click();
  await page.getByRole('button', { name: 'Play Quiet Test by Unknown Artist' }).click();
  const audio = page.locator('audio[data-native-player]');
  await expect.poll(() => audio.evaluate((node) => (node as HTMLAudioElement).paused)).toBe(false);
  await expect
    .poll(() => audio.evaluate((node) => (node as HTMLAudioElement).currentTime))
    .toBeGreaterThan(0.1);
  await page.getByRole('button', { name: 'Open lyrics', exact: true }).click();
  await page.getByLabel('Import lyrics file').setInputFiles({
    name: 'quiet.lrc',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      '[00:00.00]A quiet room\n[00:00.00]安静的房间\n[00:05.00]A little room to breathe\n[00:10.00]Every sound, a little closer\n[00:15.00]\n[00:20.00]Home in the music',
    ),
  });
  await expect(
    page.getByRole('button', { name: 'Seek to A quiet room', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Seek to Every sound, a little closer' }).click();
  await expect
    .poll(() => audio.evaluate((node) => (node as HTMLAudioElement).currentTime))
    .toBeGreaterThanOrEqual(10);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect.poll(() => audio.evaluate((node) => (node as HTMLAudioElement).paused)).toBe(true);
  await page.locator('.lyrics-viewport').hover();
  await page.mouse.wheel(0, 180);
  await expect(page.getByRole('button', { name: 'Return to current lyrics' })).toBeVisible();
  await page.getByRole('button', { name: 'Return to current lyrics' }).click();
  await page.getByRole('button', { name: 'Minimize player', exact: true }).click();
  await page.waitForTimeout(1300);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open Now Playing', exact: true })).toContainText(
    'Quiet Test',
  );
  await expect
    .poll(() => audio.evaluate((node) => (node as HTMLAudioElement).currentTime))
    .toBeGreaterThanOrEqual(10);
  expect(await audio.evaluate((node) => (node as HTMLAudioElement).paused)).toBe(true);
  await page.getByRole('button', { name: 'Open lyrics', exact: true }).click();
  await expect(page.getByText('安静的房间')).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile navigation, player gestures, lyrics, responsive layouts and reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open Now Playing', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Now Playing' })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle lyrics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Give this song its words.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/mobile-lyrics-empty.png' });
  await page.getByRole('button', { name: 'Show Playing Next' }).click();
  await expect(page.getByRole('dialog', { name: 'Playing Next' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Minimize player', exact: true }).click();
  for (const size of [
    { width: 320, height: 740 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
    { width: 2560, height: 1440 },
  ]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-quality', 'reduced');
});
