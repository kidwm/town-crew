import { Effect } from 'effect';
import { createAudio } from './runtime/audio.ts';
import { mountMenu } from './app/menu.ts';
import type { MissionId } from './app/progress.ts';
import { clearProgress } from './app/progress.ts';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const params = new URLSearchParams(location.search);
const dev = import.meta.env.DEV && params.get('dev') === '1';
let lifetime: AbortController | undefined;
let running: Promise<unknown> = import.meta.hot?.data.cleanup ?? Promise.resolve();
let revision = 0;
let disposeMenu: (() => void) | undefined;
let fromMenu = false;
const events = new AbortController();
function route(): MissionId | undefined {
  if (location.hash === '#menu') return;
  if (location.hash === '#house-build') return 'house-build';
  if (location.hash === '#road-repair') return 'road-repair';
  if (location.hash === '#fire-rescue') return 'fire-rescue';
  if (dev) return params.get('mission') === 'fire-rescue' ? 'fire-rescue' : params.get('mission') === 'house-build' ? 'house-build' : 'road-repair';
}
function home() { location.hash = 'menu'; }
async function show() {
  const current = ++revision;
  lifetime?.abort(); disposeMenu?.(); disposeMenu = undefined;
  await running;
  if (current !== revision) return;
  for (const key of Object.keys(app.dataset)) delete app.dataset[key];
  const mission = route();
  document.body.dataset.dev = String(dev && !!mission);
  if (!mission) {
    fromMenu = true;
    app.dataset.screen = 'menu';
    disposeMenu = mountMenu(app, id => { location.hash = id; });
    return;
  }
  const fresh = fromMenu; fromMenu = false;
  // The old scope has finished saving before a selection starts a new round.
  if (fresh) clearProgress(mission);
  app.dataset.screen = 'mission'; app.dataset.mission = mission;
  app.innerHTML = '<div class="loading" role="status">小小城市隊準備出發…</div>';
  lifetime = new AbortController();
  const signal = lifetime.signal;
  const program = Effect.scoped(Effect.gen(function* () {
    if (mission === 'road-repair') {
      const [{ createScene }, { createRoadSession }, { roadSounds }] = yield* Effect.promise(() => Promise.all([
        import('./missions/road-repair/scene.ts'), import('./missions/road-repair/session.ts'), import('./missions/road-repair/sounds.ts'),
      ]));
      const session = createRoadSession(app, dev, import.meta.hot, home, fresh);
      if (fresh) session.save();
      const scene = yield* Effect.acquireRelease(Effect.sync(() => createScene(app.querySelector('.canvas-host')!)), value => Effect.sync(() => value.dispose()));
      const audio = yield* Effect.acquireRelease(Effect.sync(() => createAudio(roadSounds)), value => Effect.promise(() => value.dispose()));
      yield* Effect.acquireRelease(Effect.sync(() => session.connect(scene, audio)), dispose => Effect.sync(dispose));
    } else if (mission === 'house-build') {
      const { createHouseScene } = yield* Effect.promise(() => import('./missions/house-build/scene.ts'));
      const { createHouseSession, houseSounds } = yield* Effect.promise(() => import('./missions/house-build/session.ts'));
      const session = createHouseSession(app, dev, home, fresh);
      if (fresh) session.save();
      const scene = yield* Effect.acquireRelease(Effect.sync(() => createHouseScene(app.querySelector('.canvas-host')!)), value => Effect.sync(() => value.dispose()));
      const audio = yield* Effect.acquireRelease(Effect.sync(() => createAudio(houseSounds)), value => Effect.promise(() => value.dispose()));
      yield* Effect.acquireRelease(Effect.sync(() => session.connect(scene, audio)), dispose => Effect.sync(dispose));
    } else {
      const [{ createFireScene }, { createFireSession }, { createFireAudio }] = yield* Effect.promise(() => Promise.all([
        import('./missions/fire-rescue/scene.ts'), import('./missions/fire-rescue/session.ts'), import('./missions/fire-rescue/sounds.ts'),
      ]));
      const session = createFireSession(app, dev, home, fresh);
      if (fresh) session.save();
      const scene = yield* Effect.acquireRelease(Effect.sync(() => createFireScene(app.querySelector('.canvas-host')!)), value => Effect.sync(() => value.dispose()));
      const audio = yield* Effect.acquireRelease(Effect.sync(createFireAudio), value => Effect.promise(() => value.dispose()));
      yield* Effect.acquireRelease(Effect.sync(() => session.connect(scene, audio)), dispose => Effect.sync(dispose));
    }
    yield* Effect.never;
  }));
  running = Effect.runPromise(program, { signal }).catch((error: unknown) => {
    if (signal.aborted) return;
    console.error(error);
    app.innerHTML = '<div class="loading" role="alert">畫面暫時無法啟動，請重新整理或使用支援 WebGL2 的瀏覽器。<p><button class="error-home">回到選關</button></p></div>';
    app.querySelector('.error-home')?.addEventListener('click', home, { signal: events.signal });
  });
}
window.addEventListener('hashchange', () => { void show(); }, { signal: events.signal });
void show();
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    revision++; events.abort(); disposeMenu?.(); lifetime?.abort();
    import.meta.hot!.data.cleanup = running;
  });
}
