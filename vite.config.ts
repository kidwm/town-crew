import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [VitePWA({
    // Keep the existing manifest, icons and production-only registration.
    manifest: false,
    injectRegister: false,
    registerType: 'prompt',
    devOptions: { enabled: false },
    workbox: {
      cacheId: 'town-crew',
      globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      globIgnores: ['**/sw-cleanup.js'],
      inlineWorkboxRuntime: true,
      navigateFallback: 'index.html',
      navigateFallbackAllowlist: [/^\/(?:index\.html)?(?:\?.*)?$/],
      // Workbox copies redirected precache responses before caching them.
      // Cloudflare Pages redirects /index.html to /, which Safari rejects raw.
      cleanupOutdatedCaches: true,
      importScripts: ['/sw-cleanup.js'],
      clientsClaim: true,
      // Finish the current game before a new worker takes over.
      skipWaiting: false,
    },
  })],
});
