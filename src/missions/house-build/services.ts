import { Context, Effect, Layer } from 'effect';
import * as progress from '../../app/progress.ts';
import type { ProgressStore } from '../../app/progress.ts';
import { createDevelopmentStore, loadDevelopment, saveDevelopment } from '../../app/development.ts';
import type { DevelopmentStore } from '../../app/development.ts';
import { createMissionPersistence } from '../../app/mission-persistence.ts';
import { sessionStorageBoundary } from '../../runtime/storage.ts';
import type { StorageBoundary } from '../../runtime/storage.ts';
import { closeMissionAudio } from '../../runtime/mission-lifecycle.ts';
import { decodeHouseSnapshot } from './persistence.ts';
import { chooseRound, validRound } from './domain/round.ts';
import type { HouseRound } from './domain/round.ts';
import type { createAudio } from '../../runtime/audio.ts';
import type { houseSounds } from './session.ts';

export function createHousePersistence(
  store: ProgressStore = progress,
  storage: StorageBoundary = sessionStorageBoundary,
  development: DevelopmentStore = createDevelopmentStore(storage),
) {
  let previousRound: HouseRound | undefined;
  const roundKey = 'town-crew:house:last-round:v1';
  function rememberRound(round: HouseRound) {
    previousRound = { ...round }; storage.writeJson(roundKey, previousRound);
  }
  return {
    ...createMissionPersistence('house-build', decodeHouseSnapshot, store, development),
    rememberRound,
    newRound(previous?: HouseRound) {
      if (!previousRound) { const saved = storage.readJson(roundKey); if (validRound(saved)) previousRound = saved; }
      const round = chooseRound(previous ?? previousRound); rememberRound(round); return round;
    },
  };
}
// Reused across visits/HMR; the audio Layer below is built within each mission scope.
export const housePersistence = createHousePersistence(progress, sessionStorageBoundary, { loadDevelopment, saveDevelopment });
export class HousePersistence extends Context.Service<HousePersistence, ReturnType<typeof createHousePersistence>>()('town-crew/HousePersistence') {}
export const HousePersistenceLive = Layer.succeed(HousePersistence, housePersistence);
export type HouseAudioService = ReturnType<typeof createAudio<keyof typeof houseSounds>>;
export class HouseAudio extends Context.Service<HouseAudio, HouseAudioService>()('town-crew/HouseAudio') {}
export const houseAudioLayer = (make: () => HouseAudioService) => Layer.effect(HouseAudio,
  Effect.acquireRelease(Effect.sync(make), audio => closeMissionAudio('house-build', audio)),
);
