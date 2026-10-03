export function registerPwa() {
  // Development stays on Vite's network paths so HMR is never cached.
  if (!import.meta.env.PROD || !window.isSecureContext || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    }).catch((error: unknown) => {
      console.warn('小小城市隊離線快取暫時無法啟用。', error);
    });
  }, { once: true });
}
