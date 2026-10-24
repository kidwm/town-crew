import { Data, Effect, Fiber, Schedule } from 'effect';

export class PwaRegistrationError extends Data.TaggedError('PwaRegistrationError')<{
  readonly cause: unknown;
}> {}

/** At most three attempts; only TypeError and NetworkError qualify for retry. */
export const registerWithRetry = (register: () => Promise<unknown>) => Effect.tryPromise({
  try: register, catch: cause => new PwaRegistrationError({ cause }),
}).pipe(Effect.retry({
  times: 2, schedule: Schedule.exponential('1 second'),
  // Browsers can also use TypeError for permanent fetch/configuration failures; keep a hard cap.
  while: error => error.cause instanceof TypeError || error.cause instanceof DOMException && error.cause.name === 'NetworkError',
}), Effect.asVoid);

export function startPwaRegistration(register: () => Promise<unknown>,
  events: EventTarget = window, loaded = () => document.readyState === 'complete',
  report: (error: PwaRegistrationError) => void = error => console.warn('小小城市隊離線快取暫時無法啟用。', error),
) {
  const ready = Effect.callback<void>(resume => {
    if (loaded()) { resume(Effect.void); return; }
    const onLoad = () => resume(Effect.void);
    events.addEventListener('load', onLoad, { once: true });
    return Effect.sync(() => events.removeEventListener('load', onLoad));
  });
  const fiber = Effect.runFork(ready.pipe(Effect.andThen(registerWithRetry(register)), Effect.catchTag('PwaRegistrationError', error => Effect.sync(() => {
    try { report(error); } catch { /* Optional diagnostics must not create an unhandled rejection. */ }
  }))));
  const completed = Effect.runPromise(Fiber.await(fiber));
  function dispose() {
    events.removeEventListener('pagehide', onHide);
    return Promise.all([completed, Effect.runPromise(Fiber.interrupt(fiber))]).then(() => {});
  }
  function onHide() { void dispose(); }
  events.addEventListener('pagehide', onHide, { once: true });
  return dispose;
}

export function registerPwa() {
  // Development stays on Vite's network paths so HMR is never cached.
  if (!import.meta.env?.PROD || !window.isSecureContext || !('serviceWorker' in navigator)) return () => Promise.resolve();
  return startPwaRegistration(() => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
    scope: import.meta.env.BASE_URL, updateViaCache: 'none',
  }));
}
