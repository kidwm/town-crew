import { Context, Effect, Layer } from 'effect';
import { initializeScene, initializeSession } from '../../runtime/mission-lifecycle.ts';
import type { StartupDiagnostics } from '../../runtime/mission-startup.ts';
import type { createPoliceScene } from './scene.ts';
import { createPoliceSession } from './session.ts';
import { PoliceAudio, PolicePersistence, policeAudioLayer } from './services.ts';
import type { PoliceAudioService } from './services.ts';
export { PolicePersistenceLive } from './services.ts';
export { createPoliceAudio } from './session.ts';

/** Return the loop without running it; resources belong to the caller's mission scope. */
export function preparePoliceMission(options: {
  app: HTMLDivElement; dev: boolean; home: () => void; fresh: boolean;
}, scene: typeof createPoliceScene, audio: () => PoliceAudioService, diagnostics: StartupDiagnostics) {
  return Effect.gen(function* () {
    const persistence = yield* PolicePersistence;
    const session = yield* diagnostics.stage('prepare', initializeSession('police-patrol', 'prepare', Effect.sync(() => {
      const session = createPoliceSession(options.app, options.dev, options.home, options.fresh, persistence);
      if (options.fresh) session.save();
      return session;
    })));
    const world = yield* diagnostics.stage('scene', initializeScene('police-patrol', scene(options.app.querySelector('.canvas-host')!)));
    const services = yield* diagnostics.stage('audio', Layer.build(policeAudioLayer(audio)));
    return yield* diagnostics.stage('connect', initializeSession('police-patrol', 'connect', session.connect(world, Context.get(services, PoliceAudio))));
  });
}
