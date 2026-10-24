import { Context, Effect, Layer } from 'effect';
import { initializeScene, initializeSession } from '../../runtime/mission-lifecycle.ts';
import type { StartupDiagnostics } from '../../runtime/mission-startup.ts';
import type { createFireScene } from './scene.ts';
import { createFireSession } from './session.ts';
import { FireAudio, FirePersistence, fireAudioLayer } from './services.ts';
import type { FireAudioService } from './services.ts';
export { FirePersistenceLive } from './services.ts';

/** Return the loop without running it; resources belong to the caller's mission scope. */
export function prepareFireMission(options: {
  app: HTMLDivElement; dev: boolean; home: () => void; fresh: boolean;
}, scene: typeof createFireScene, audio: () => FireAudioService, diagnostics: StartupDiagnostics) {
  return Effect.gen(function* () {
    const persistence = yield* FirePersistence;
    const session = yield* diagnostics.stage('prepare', initializeSession('fire-rescue', 'prepare', Effect.sync(() => {
      const session = createFireSession(options.app, options.dev, options.home, options.fresh, persistence);
      if (options.fresh) session.save();
      return session;
    })));
    const world = yield* diagnostics.stage('scene', initializeScene('fire-rescue', scene(options.app.querySelector('.canvas-host')!)));
    const services = yield* diagnostics.stage('audio', Layer.build(fireAudioLayer(audio)));
    return yield* diagnostics.stage('connect', initializeSession('fire-rescue', 'connect', session.connect(world, Context.get(services, FireAudio))));
  });
}
