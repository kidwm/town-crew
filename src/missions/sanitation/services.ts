import { Context, Effect, Layer } from 'effect';
import * as progress from '../../app/progress.ts';
import type { ProgressStore } from '../../app/progress.ts';
import { createDevelopmentStore, loadDevelopment, saveDevelopment } from '../../app/development.ts';
import type { DevelopmentStore } from '../../app/development.ts';
import { createMissionPersistence } from '../../app/mission-persistence.ts';
import { sessionStorageBoundary } from '../../runtime/storage.ts';
import type { StorageBoundary } from '../../runtime/storage.ts';
import { closeMissionAudio } from '../../runtime/mission-lifecycle.ts';
import { decodeSanitationSnapshot } from './persistence.ts';
import { chooseRound, validRound } from './domain/sanitation.ts';
import type { Round } from './domain/sanitation.ts';
import type { createSanitationAudio } from './session.ts';

export function createSanitationPersistence(
  store: ProgressStore = progress,
  storage: StorageBoundary = sessionStorageBoundary,
  development: DevelopmentStore = createDevelopmentStore(storage),
) {
  let previousRound: Round | undefined;
  const roundKey = 'town-crew:sanitation:last-round:v2';
  function rememberRound(round: Round) {
    previousRound = { ...round, cargo: [...round.cargo] }; storage.writeJson(roundKey, previousRound);
  }
  return {
    ...createMissionPersistence('sanitation', decodeSanitationSnapshot, store, development),
    rememberRound,
    newRound(previous?: Round) {
      if (!previousRound) { const saved = storage.readJson(roundKey); if (validRound(saved)) previousRound = saved; }
      const round = chooseRound(previous ?? previousRound); rememberRound(round); return round;
    },
  };
}
// Reused across visits/HMR; the audio Layer below is built within each mission scope.
export const sanitationPersistence = createSanitationPersistence(progress, sessionStorageBoundary, { loadDevelopment, saveDevelopment });
export class SanitationPersistence extends Context.Service<SanitationPersistence, ReturnType<typeof createSanitationPersistence>>()('town-crew/SanitationPersistence') {}
export const SanitationPersistenceLive = Layer.succeed(SanitationPersistence, sanitationPersistence);
export type SanitationAudioService = ReturnType<typeof createSanitationAudio>;
export class SanitationAudio extends Context.Service<SanitationAudio, SanitationAudioService>()('town-crew/SanitationAudio') {}
export const sanitationAudioLayer = (make: () => SanitationAudioService) => Layer.effect(SanitationAudio,
  Effect.acquireRelease(Effect.sync(make), audio => closeMissionAudio('sanitation', audio)),
);
