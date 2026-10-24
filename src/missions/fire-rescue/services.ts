import { Context, Effect, Layer } from 'effect';
import * as progress from '../../app/progress.ts';
import type { ProgressStore } from '../../app/progress.ts';
import { createDevelopmentStore, loadDevelopment, saveDevelopment } from '../../app/development.ts';
import type { DevelopmentStore } from '../../app/development.ts';
import { createMissionPersistence } from '../../app/mission-persistence.ts';
import { sessionStorageBoundary } from '../../runtime/storage.ts';
import type { StorageBoundary } from '../../runtime/storage.ts';
import { closeMissionAudio } from '../../runtime/mission-lifecycle.ts';
import { decodeFireSnapshot } from './persistence.ts';
import type { createFireAudio } from './sounds.ts';

export function createFirePersistence(
  store: ProgressStore = progress,
  storage: StorageBoundary = sessionStorageBoundary,
  development: DevelopmentStore = createDevelopmentStore(storage),
) {
  return {
    ...createMissionPersistence('fire-rescue', decodeFireSnapshot, store, development),
  };
}
// Reused across visits/HMR; the audio Layer below is built within each mission scope.
export const firePersistence = createFirePersistence(progress, sessionStorageBoundary, { loadDevelopment, saveDevelopment });
export class FirePersistence extends Context.Service<FirePersistence, ReturnType<typeof createFirePersistence>>()('town-crew/FirePersistence') {}
export const FirePersistenceLive = Layer.succeed(FirePersistence, firePersistence);
export type FireAudioService = ReturnType<typeof createFireAudio>;
export class FireAudio extends Context.Service<FireAudio, FireAudioService>()('town-crew/FireAudio') {}
export const fireAudioLayer = (make: () => FireAudioService) => Layer.effect(FireAudio,
  Effect.acquireRelease(Effect.sync(make), audio => closeMissionAudio('fire-rescue', audio)),
);
