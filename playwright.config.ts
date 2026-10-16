import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
export default defineConfig({
  testDir: './e2e',
  testIgnore: 'pwa.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 40000,
  expect: { timeout: 7000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    colorScheme: 'dark',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      ...(existsSync('/usr/bin/chromium') ? { executablePath: '/usr/bin/chromium' } : {}),
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
});
