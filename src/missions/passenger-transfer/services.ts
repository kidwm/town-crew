import { Context, Effect, Layer } from 'effect';
import * as progress from '../../app/progress.ts';
import type { ProgressStore } from '../../app/progress.ts';
import { createDevelopmentStore, loadDevelopment, saveDevelopment } from '../../app/development.ts';
import type { DevelopmentStore } from '../../app/development.ts';
import { createMissionPersistence } from '../../app/mission-persistence.ts';
import { sessionStorageBoundary } from '../../runtime/storage.ts';
import type { StorageBoundary } from '../../runtime/storage.ts';
import { closeMissionAudio } from '../../runtime/mission-lifecycle.ts';
import { decodeTransitSnapshot } from './persistence.ts';
import { chooseRound, validRound } from './domain/transit.ts';
import type { Round } from './domain/transit.ts';
import type { createTransferAudio } from './session.ts';

export function createTransferPersistence(
  store: ProgressStore = progress,
  storage: StorageBoundary = sessionStorageBoundary,
  development: DevelopmentStore = createDevelopmentStore(storage),
) {
  let previousRound: Round | undefined;
  const roundKey = 'town-crew:transfer:last-round:v1';
  function rememberRound(round: Round) {
    previousRound = { ...round }; storage.writeJson(roundKey, previousRound);
  }
  return {
    ...createMissionPersistence('passenger-transfer', decodeTransitSnapshot, store, development),
    rememberRound,
    newRound(previous?: Round) {
      if (!previousRound) { const saved = storage.readJson(roundKey); if (validRound(saved)) previousRound = saved; }
      const round = chooseRound(previous ?? previousRound); rememberRound(round); return round;
    },
  };
}
// Reused across visits/HMR; the audio Layer below is built within each mission scope.
export const transferPersistence = createTransferPersistence(progress, sessionStorageBoundary, { loadDevelopment, saveDevelopment });
export class TransferPersistence extends Context.Service<TransferPersistence, ReturnType<typeof createTransferPersistence>>()('town-crew/TransferPersistence') {}
export const TransferPersistenceLive = Layer.succeed(TransferPersistence, transferPersistence);
export type TransferAudioService = ReturnType<typeof createTransferAudio>;
export class TransferAudio extends Context.Service<TransferAudio, TransferAudioService>()('town-crew/TransferAudio') {}
export const transferAudioLayer = (make: () => TransferAudioService) => Layer.effect(TransferAudio,
  Effect.acquireRelease(Effect.sync(make), audio => closeMissionAudio('passenger-transfer', audio)),
);
