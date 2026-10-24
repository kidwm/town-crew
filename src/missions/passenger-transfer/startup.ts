import { Context, Effect, Layer } from 'effect';
import { initializeScene, initializeSession } from '../../runtime/mission-lifecycle.ts';
import type { StartupDiagnostics } from '../../runtime/mission-startup.ts';
import type { createTransferScene } from './scene.ts';
import { createTransferSession } from './session.ts';
import { TransferAudio, TransferPersistence, transferAudioLayer } from './services.ts';
import type { TransferAudioService } from './services.ts';
export { TransferPersistenceLive } from './services.ts';
export { createTransferAudio } from './session.ts';

/** Return the loop without running it; resources belong to the caller's mission scope. */
export function prepareTransferMission(options: {
  app: HTMLDivElement; dev: boolean; home: () => void; fresh: boolean;
}, scene: typeof createTransferScene, audio: () => TransferAudioService, diagnostics: StartupDiagnostics) {
  return Effect.gen(function* () {
    const persistence = yield* TransferPersistence;
    const session = yield* diagnostics.stage('prepare', initializeSession('passenger-transfer', 'prepare', Effect.sync(() => {
      const session = createTransferSession(options.app, options.dev, options.home, options.fresh, persistence);
      if (options.fresh) session.save();
      return session;
    })));
    const world = yield* diagnostics.stage('scene', initializeScene('passenger-transfer', scene(options.app.querySelector('.canvas-host')!)));
    const services = yield* diagnostics.stage('audio', Layer.build(transferAudioLayer(audio)));
    return yield* diagnostics.stage('connect', initializeSession('passenger-transfer', 'connect', session.connect(world, Context.get(services, TransferAudio))));
  });
}
