import { defineConfig } from '@playwright/test';

const deployedURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['road.spec.mjs', 'house.spec.mjs', 'dump-grip.spec.mjs'],
  timeout: process.env.CI ? 240_000 : 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: deployedURL ?? 'http://127.0.0.1:4173',
    channel: process.env.PLAYWRIGHT_CHANNEL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-mouse', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'tablet-touch', use: { viewport: { width: 1024, height: 768 }, hasTouch: true } },
  ],
  webServer: deployedURL ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
