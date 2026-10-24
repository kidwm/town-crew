import { Context, Effect, Layer } from 'effect';
import { initializeScene, initializeSession } from '../../runtime/mission-lifecycle.ts';
import type { StartupDiagnostics } from '../../runtime/mission-startup.ts';
import type { createScene } from './scene.ts';
import { createRoadSession } from './session.ts';
import { RoadAudio, RoadPersistence, roadAudioLayer } from './services.ts';
import type { RoadAudioService } from './services.ts';
export { RoadPersistenceLive } from './services.ts';

/** Startup ends at connected controls; the caller waits on the returned loop in the same scope. */
export function prepareRoadMission(options: {
  app: HTMLDivElement; dev: boolean; hot?: NonNullable<ImportMeta['hot']>; home: () => void; fresh: boolean;
}, scene: typeof createScene, audio: () => RoadAudioService, diagnostics: StartupDiagnostics) {
  return Effect.gen(function* () {
    const persistence = yield* RoadPersistence;
    const session = yield* diagnostics.stage('prepare', initializeSession('road-repair', 'prepare', Effect.sync(() => {
      const session = createRoadSession(options.app, options.dev, options.hot, options.home, options.fresh, persistence);
      if (options.fresh) session.save();
      return session;
    })));
    const world = yield* diagnostics.stage('scene', initializeScene('road-repair', scene(options.app.querySelector('.canvas-host')!)));
    const services = yield* diagnostics.stage('audio', Layer.build(roadAudioLayer(audio)));
    return yield* diagnostics.stage('connect', initializeSession('road-repair', 'connect', session.connect(world, Context.get(services, RoadAudio))));
  });
}
