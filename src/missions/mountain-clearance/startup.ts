import { Context, Effect, Layer } from 'effect';
import { initializeScene, initializeSession } from '../../runtime/mission-lifecycle.ts';
import type { StartupDiagnostics } from '../../runtime/mission-startup.ts';
import type { createMountainScene } from './scene.ts';
import { createMountainSession } from './session.ts';
import { MountainAudio, MountainPersistence, mountainAudioLayer } from './services.ts';
import type { MountainAudioService } from './services.ts';
export { MountainPersistenceLive } from './services.ts';
export { createMountainAudio } from './session.ts';

/** Return the loop without running it; resources belong to the caller's mission scope. */
export function prepareMountainMission(options: {
  app: HTMLDivElement; dev: boolean; home: () => void; fresh: boolean;
}, scene: typeof createMountainScene, audio: () => MountainAudioService, diagnostics: StartupDiagnostics) {
  return Effect.gen(function* () {
    const persistence = yield* MountainPersistence;
    const session = yield* diagnostics.stage('prepare', initializeSession('mountain-clearance', 'prepare', Effect.sync(() => {
      const session = createMountainSession(options.app, options.dev, options.home, options.fresh, persistence);
      if (options.fresh) session.save();
      return session;
    })));
    const world = yield* diagnostics.stage('scene', initializeScene('mountain-clearance', scene(options.app.querySelector('.canvas-host')!)));
    const services = yield* diagnostics.stage('audio', Layer.build(mountainAudioLayer(audio)));
    return yield* diagnostics.stage('connect', initializeSession('mountain-clearance', 'connect', session.connect(world, Context.get(services, MountainAudio))));
  });
}
