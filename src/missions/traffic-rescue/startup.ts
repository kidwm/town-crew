import { Context, Effect, Layer } from 'effect';
import { initializeScene, initializeSession } from '../../runtime/mission-lifecycle.ts';
import type { StartupDiagnostics } from '../../runtime/mission-startup.ts';
import type { createTrafficScene } from './scene.ts';
import { createTrafficSession } from './session.ts';
import { TrafficAudio, TrafficPersistence, trafficAudioLayer } from './services.ts';
import type { TrafficAudioService } from './services.ts';
export { TrafficPersistenceLive } from './services.ts';
export { createTrafficAudio } from './session.ts';

/** Return the loop without running it; resources belong to the caller's mission scope. */
export function prepareTrafficMission(options: {
  app: HTMLDivElement; dev: boolean; home: () => void; fresh: boolean;
}, scene: typeof createTrafficScene, audio: () => TrafficAudioService, diagnostics: StartupDiagnostics) {
  return Effect.gen(function* () {
    const persistence = yield* TrafficPersistence;
    const session = yield* diagnostics.stage('prepare', initializeSession('traffic-rescue', 'prepare', Effect.sync(() => {
      const session = createTrafficSession(options.app, options.dev, options.home, options.fresh, persistence);
      if (options.fresh) session.save();
      return session;
    })));
    const world = yield* diagnostics.stage('scene', initializeScene('traffic-rescue', scene(options.app.querySelector('.canvas-host')!)));
    const services = yield* diagnostics.stage('audio', Layer.build(trafficAudioLayer(audio)));
    return yield* diagnostics.stage('connect', initializeSession('traffic-rescue', 'connect', session.connect(world, Context.get(services, TrafficAudio))));
  });
}
