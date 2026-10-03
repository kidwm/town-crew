// CACHE_PREFIX, CACHE_NAME and PRECACHE_PATHS are injected by build-pwa.mjs.
const precacheUrls = PRECACHE_PATHS.map(path => new URL(path, self.registration.scope).href);
const precacheSet = new Set(precacheUrls);
const appUrl = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(precacheUrls.map(url => new Request(url, { cache: 'reload' })));
  })());
  // Let existing games finish with their original HTML and lazy-loaded chunks.
  // A new worker activates after all tabs using the previous worker close.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' && url.href.startsWith(self.registration.scope)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      // Keep HTML and assets on the same build, including offline reloads.
      return await cache.match(appUrl, { ignoreVary: true }) ?? fetch(request);
    })());
    return;
  }

  if (precacheSet.has(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      // These are fixed same-origin build files. A server's Vary: Origin must
      // not turn a module request into a miss against its precached fetch.
      return await cache.match(request, { ignoreVary: true }) ?? fetch(request);
    })());
  }
});
