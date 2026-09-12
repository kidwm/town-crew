import { Effect } from 'effect';
import { createAudio } from './runtime/audio.ts';
import { createScene } from './missions/road-repair/scene.ts';
import { createRoadSession } from './missions/road-repair/session.ts';
import { roadSounds } from './missions/road-repair/sounds.ts';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const dev = import.meta.env.DEV && new URLSearchParams(location.search).get('dev') === '1';
const session = createRoadSession(app, dev, import.meta.hot);
const lifetime = new AbortController();

// One scope owns the renderer, audio, listeners and frame loop. HMR releases
// that scope before the replacement starts its own game session.
const program = Effect.scoped(Effect.gen(function* () {
  const scene = yield* Effect.acquireRelease(
    Effect.try({ try: () => createScene(app.querySelector('.canvas-host')!), catch: cause => new Error('無法建立 3D 畫面', { cause }) }),
    value => Effect.sync(() => value.dispose()),
  );
  const audio = yield* Effect.acquireRelease(Effect.sync(() => createAudio(roadSounds)), value => Effect.promise(() => value.dispose()));
  yield* Effect.acquireRelease(Effect.sync(() => session.connect(scene, audio)), dispose => Effect.sync(dispose));
  yield* Effect.never;
}));

void Effect.runPromise(program, { signal: lifetime.signal }).catch((error: unknown) => {
  if (lifetime.signal.aborted) return;
  console.error(error);
  const message = document.createElement('p');
  message.className = 'loading';
  message.textContent = '畫面暫時無法啟動，請重新整理或使用支援 WebGL2 的瀏覽器。';
  app.querySelector('.loading')?.remove();
  app.querySelector('.world')!.append(message);
});

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => { session.save(); lifetime.abort(); });
}
