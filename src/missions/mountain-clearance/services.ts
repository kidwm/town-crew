import { Context, Effect, Layer } from 'effect';
import * as progress from '../../app/progress.ts';
import type { ProgressStore } from '../../app/progress.ts';
import { createDevelopmentStore, loadDevelopment, saveDevelopment } from '../../app/development.ts';
import type { DevelopmentStore } from '../../app/development.ts';
import { createMissionPersistence } from '../../app/mission-persistence.ts';
import { sessionStorageBoundary } from '../../runtime/storage.ts';
import type { StorageBoundary } from '../../runtime/storage.ts';
import { closeMissionAudio } from '../../runtime/mission-lifecycle.ts';
import { decodeMountainSnapshot } from './persistence.ts';
import { chooseRound, validRound } from './domain/mountain.ts';
import type { Round } from './domain/mountain.ts';
import type { createMountainAudio } from './session.ts';

export function createMountainPersistence(
  store: ProgressStore = progress,
  storage: StorageBoundary = sessionStorageBoundary,
  development: DevelopmentStore = createDevelopmentStore(storage),
) {
  let previousRound: Round | undefined;
  const roundKey = 'town-crew:mountain:last-round:v1';
  function rememberRound(round: Round) {
    previousRound = { ...round }; storage.writeJson(roundKey, previousRound);
  }
  return {
    ...createMissionPersistence('mountain-clearance', decodeMountainSnapshot, store, development),
    rememberRound,
    newRound(previous?: Round) {
      if (!previousRound) { const saved = storage.readJson(roundKey); if (validRound(saved)) previousRound = saved; }
      const round = chooseRound(previous ?? previousRound); rememberRound(round); return round;
    },
  };
}
// Reused across visits/HMR; the audio Layer below is built within each mission scope.
export const mountainPersistence = createMountainPersistence(progress, sessionStorageBoundary, { loadDevelopment, saveDevelopment });
export class MountainPersistence extends Context.Service<MountainPersistence, ReturnType<typeof createMountainPersistence>>()('town-crew/MountainPersistence') {}
export const MountainPersistenceLive = Layer.succeed(MountainPersistence, mountainPersistence);
export type MountainAudioService = ReturnType<typeof createMountainAudio>;
export class MountainAudio extends Context.Service<MountainAudio, MountainAudioService>()('town-crew/MountainAudio') {}
export const mountainAudioLayer = (make: () => MountainAudioService) => Layer.effect(MountainAudio,
  Effect.acquireRelease(Effect.sync(make), audio => closeMissionAudio('mountain-clearance', audio)),
);
