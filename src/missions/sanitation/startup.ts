import { Context, Effect, Layer } from 'effect';
import { initializeScene, initializeSession } from '../../runtime/mission-lifecycle.ts';
import type { StartupDiagnostics } from '../../runtime/mission-startup.ts';
import type { createSanitationScene } from './scene.ts';
import { createSanitationSession } from './session.ts';
import { SanitationAudio, SanitationPersistence, sanitationAudioLayer } from './services.ts';
import type { SanitationAudioService } from './services.ts';
export { SanitationPersistenceLive } from './services.ts';
export { createSanitationAudio } from './session.ts';

/** Return the loop without running it; resources belong to the caller's mission scope. */
export function prepareSanitationMission(options: {
  app: HTMLDivElement; dev: boolean; home: () => void; fresh: boolean;
}, scene: typeof createSanitationScene, audio: () => SanitationAudioService, diagnostics: StartupDiagnostics) {
  return Effect.gen(function* () {
    const persistence = yield* SanitationPersistence;
    const session = yield* diagnostics.stage('prepare', initializeSession('sanitation', 'prepare', Effect.sync(() => {
      const session = createSanitationSession(options.app, options.dev, options.home, options.fresh, persistence);
      if (options.fresh) session.save();
      return session;
    })));
    const world = yield* diagnostics.stage('scene', initializeScene('sanitation', scene(options.app.querySelector('.canvas-host')!)));
    const services = yield* diagnostics.stage('audio', Layer.build(sanitationAudioLayer(audio)));
    return yield* diagnostics.stage('connect', initializeSession('sanitation', 'connect', session.connect(world, Context.get(services, SanitationAudio))));
  });
}
