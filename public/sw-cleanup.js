// Remove only the retired custom worker's caches once Workbox is active.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('town-crew:precache:'))
      .map(name => caches.delete(name)));
  })());
});
