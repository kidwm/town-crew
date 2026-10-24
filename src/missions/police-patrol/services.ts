import { Context, Effect, Layer } from 'effect';
import * as progress from '../../app/progress.ts';
import type { ProgressStore } from '../../app/progress.ts';
import { createDevelopmentStore, loadDevelopment, saveDevelopment } from '../../app/development.ts';
import type { DevelopmentStore } from '../../app/development.ts';
import { createMissionPersistence } from '../../app/mission-persistence.ts';
import { sessionStorageBoundary } from '../../runtime/storage.ts';
import type { StorageBoundary } from '../../runtime/storage.ts';
import { closeMissionAudio } from '../../runtime/mission-lifecycle.ts';
import { decodePoliceSnapshot } from './persistence.ts';
import { chooseRound, validRound } from './domain/police.ts';
import type { Round } from './domain/police.ts';
import type { createPoliceAudio } from './session.ts';

export function createPolicePersistence(
  store: ProgressStore = progress,
  storage: StorageBoundary = sessionStorageBoundary,
  development: DevelopmentStore = createDevelopmentStore(storage),
) {
  let previousRound: Round | undefined;
  const roundKey = 'town-crew:police:last-round:v1';
  function rememberRound(round: Round) {
    previousRound = { ...round }; storage.writeJson(roundKey, previousRound);
  }
  return {
    ...createMissionPersistence('police-patrol', decodePoliceSnapshot, store, development),
    rememberRound,
    newRound(previous?: Round) {
      if (!previousRound) { const saved = storage.readJson(roundKey); if (validRound(saved)) previousRound = saved; }
      const round = chooseRound(previous ?? previousRound); rememberRound(round); return round;
    },
  };
}
// Reused across visits/HMR; the audio Layer below is built within each mission scope.
export const policePersistence = createPolicePersistence(progress, sessionStorageBoundary, { loadDevelopment, saveDevelopment });
export class PolicePersistence extends Context.Service<PolicePersistence, ReturnType<typeof createPolicePersistence>>()('town-crew/PolicePersistence') {}
export const PolicePersistenceLive = Layer.succeed(PolicePersistence, policePersistence);
export type PoliceAudioService = ReturnType<typeof createPoliceAudio>;
export class PoliceAudio extends Context.Service<PoliceAudio, PoliceAudioService>()('town-crew/PoliceAudio') {}
export const policeAudioLayer = (make: () => PoliceAudioService) => Layer.effect(PoliceAudio,
  Effect.acquireRelease(Effect.sync(make), audio => closeMissionAudio('police-patrol', audio)),
);
