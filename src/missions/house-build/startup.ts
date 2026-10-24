import { Context, Effect, Layer } from 'effect';
import { initializeScene, initializeSession } from '../../runtime/mission-lifecycle.ts';
import type { StartupDiagnostics } from '../../runtime/mission-startup.ts';
import type { createHouseScene } from './scene.ts';
import { createHouseSession } from './session.ts';
import { HouseAudio, HousePersistence, houseAudioLayer } from './services.ts';
import type { HouseAudioService } from './services.ts';
export { HousePersistenceLive } from './services.ts';
export { houseSounds } from './session.ts';

/** Return the loop without running it; resources belong to the caller's mission scope. */
export function prepareHouseMission(options: {
  app: HTMLDivElement; dev: boolean; home: () => void; fresh: boolean;
}, scene: typeof createHouseScene, audio: () => HouseAudioService, diagnostics: StartupDiagnostics) {
  return Effect.gen(function* () {
    const persistence = yield* HousePersistence;
    const session = yield* diagnostics.stage('prepare', initializeSession('house-build', 'prepare', Effect.sync(() => {
      const session = createHouseSession(options.app, options.dev, options.home, options.fresh, persistence);
      if (options.fresh) session.save();
      return session;
    })));
    const world = yield* diagnostics.stage('scene', initializeScene('house-build', scene(options.app.querySelector('.canvas-host')!)));
    const services = yield* diagnostics.stage('audio', Layer.build(houseAudioLayer(audio)));
    return yield* diagnostics.stage('connect', initializeSession('house-build', 'connect', session.connect(world, Context.get(services, HouseAudio))));
  });
}
