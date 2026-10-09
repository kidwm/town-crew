import { defineConfig } from '@playwright/test';

const deployedURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['road.spec.mjs', 'house.spec.mjs', 'dump-grip.spec.mjs', 'crane-assist.spec.mjs', 'fire.spec.mjs', 'traffic.spec.mjs', 'concrete.spec.mjs', 'police.spec.mjs', 'port.spec.mjs', 'mountain.spec.mjs', 'pwa.spec.mjs'],
  timeout: process.env.CI ? 240_000 : 120_000,
  expect: { timeout: 15_000 },
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: deployedURL ?? 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-mouse', use: { channel: process.env.PLAYWRIGHT_CHANNEL, viewport: { width: 1280, height: 800 } } },
    { name: 'tablet-touch', use: { channel: process.env.PLAYWRIGHT_CHANNEL, viewport: { width: 1024, height: 768 }, hasTouch: true } },
    { name: 'safari-webkit', testMatch: 'pwa.spec.mjs', use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
  webServer: deployedURL ? undefined : {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
