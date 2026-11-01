import { Context, Effect, Layer } from 'effect';
import { initializeScene, initializeSession } from '../../runtime/mission-lifecycle.ts';
import type { StartupDiagnostics } from '../../runtime/mission-startup.ts';
import type { createRailScene } from './scene.ts';
import { createRailSession } from './session.ts';
import { RailAudio, RailPersistence, railAudioLayer } from './services.ts';
import type { RailAudioService } from './services.ts';
export { RailPersistenceLive } from './services.ts';
export { createRailAudio } from './session.ts';

/** Return the loop without running it; resources belong to the caller's mission scope. */
export function prepareRailMission(options: {
  app: HTMLDivElement; dev: boolean; home: () => void; fresh: boolean;
}, scene: typeof createRailScene, audio: () => RailAudioService, diagnostics: StartupDiagnostics) {
  return Effect.gen(function* () {
    const persistence = yield* RailPersistence;
    const session = yield* diagnostics.stage('prepare', initializeSession('rail-transfer', 'prepare', Effect.sync(() => {
      const session = createRailSession(options.app, options.dev, options.home, options.fresh, persistence);
      if (options.fresh) session.save();
      return session;
    })));
    const world = yield* diagnostics.stage('scene', initializeScene('rail-transfer', scene(options.app.querySelector('.canvas-host')!)));
    const services = yield* diagnostics.stage('audio', Layer.build(railAudioLayer(audio)));
    return yield* diagnostics.stage('connect', initializeSession('rail-transfer', 'connect', session.connect(world, Context.get(services, RailAudio))));
  });
}
