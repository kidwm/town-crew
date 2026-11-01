import { Context, Effect, Layer } from 'effect';
import * as progress from '../../app/progress.ts';
import type { ProgressStore } from '../../app/progress.ts';
import { createDevelopmentStore, loadDevelopment, saveDevelopment } from '../../app/development.ts';
import type { DevelopmentStore } from '../../app/development.ts';
import { createMissionPersistence } from '../../app/mission-persistence.ts';
import { sessionStorageBoundary } from '../../runtime/storage.ts';
import type { StorageBoundary } from '../../runtime/storage.ts';
import { closeMissionAudio } from '../../runtime/mission-lifecycle.ts';
import { decodeRailSnapshot } from './persistence.ts';
import { chooseRound, validRound } from './domain/rail.ts';
import type { Round } from './domain/rail.ts';
import type { createRailAudio } from './session.ts';

export function createRailPersistence(
  store: ProgressStore = progress,
  storage: StorageBoundary = sessionStorageBoundary,
  development: DevelopmentStore = createDevelopmentStore(storage),
) {
  let previousRound: Round | undefined;
  const roundKey = 'town-crew:rail:last-round:v1';
  function rememberRound(round: Round) {
    previousRound = { ...round }; storage.writeJson(roundKey, previousRound);
  }
  return {
    ...createMissionPersistence('rail-transfer', decodeRailSnapshot, store, development),
    rememberRound,
    newRound(previous?: Round) {
      if (!previousRound) { const saved = storage.readJson(roundKey); if (validRound(saved)) previousRound = saved; }
      const round = chooseRound(previous ?? previousRound); rememberRound(round); return round;
    },
  };
}
// Reused across visits/HMR; the audio Layer below is built within each mission scope.
export const railPersistence = createRailPersistence(progress, sessionStorageBoundary, { loadDevelopment, saveDevelopment });
export class RailPersistence extends Context.Service<RailPersistence, ReturnType<typeof createRailPersistence>>()('town-crew/RailPersistence') {}
export const RailPersistenceLive = Layer.succeed(RailPersistence, railPersistence);
export type RailAudioService = ReturnType<typeof createRailAudio>;
export class RailAudio extends Context.Service<RailAudio, RailAudioService>()('town-crew/RailAudio') {}
export const railAudioLayer = (make: () => RailAudioService) => Layer.effect(RailAudio,
  Effect.acquireRelease(Effect.sync(make), audio => closeMissionAudio('rail-transfer', audio)),
);
