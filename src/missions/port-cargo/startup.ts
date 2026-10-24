import { Context, Effect, Layer } from 'effect';
import { initializeScene, initializeSession } from '../../runtime/mission-lifecycle.ts';
import type { StartupDiagnostics } from '../../runtime/mission-startup.ts';
import type { createPortScene } from './scene.ts';
import { createPortSession } from './session.ts';
import { PortAudio, PortPersistence, portAudioLayer } from './services.ts';
import type { PortAudioService } from './services.ts';
export { PortPersistenceLive } from './services.ts';
export { createPortAudio } from './session.ts';

/** Return the loop without running it; resources belong to the caller's mission scope. */
export function preparePortMission(options: {
  app: HTMLDivElement; dev: boolean; home: () => void; fresh: boolean;
}, scene: typeof createPortScene, audio: () => PortAudioService, diagnostics: StartupDiagnostics) {
  return Effect.gen(function* () {
    const persistence = yield* PortPersistence;
    const session = yield* diagnostics.stage('prepare', initializeSession('port-cargo', 'prepare', Effect.sync(() => {
      const session = createPortSession(options.app, options.dev, options.home, options.fresh, persistence);
      if (options.fresh) session.save();
      return session;
    })));
    const world = yield* diagnostics.stage('scene', initializeScene('port-cargo', scene(options.app.querySelector('.canvas-host')!)));
    const services = yield* diagnostics.stage('audio', Layer.build(portAudioLayer(audio)));
    return yield* diagnostics.stage('connect', initializeSession('port-cargo', 'connect', session.connect(world, Context.get(services, PortAudio))));
  });
}
