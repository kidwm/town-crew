import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'development.spec.mjs',
  // Reload and HMR repeatedly recreate WebGL contexts, especially on software renderers.
  timeout: 90_000,
  workers: 1,
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    viewport: { width: 1280, height: 800 },
    channel: process.env.PLAYWRIGHT_CHANNEL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
  },
});
