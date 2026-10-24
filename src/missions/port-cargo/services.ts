import { Context, Effect, Layer } from 'effect';
import * as progress from '../../app/progress.ts';
import type { ProgressStore } from '../../app/progress.ts';
import { createDevelopmentStore, loadDevelopment, saveDevelopment } from '../../app/development.ts';
import type { DevelopmentStore } from '../../app/development.ts';
import { createMissionPersistence } from '../../app/mission-persistence.ts';
import { sessionStorageBoundary } from '../../runtime/storage.ts';
import type { StorageBoundary } from '../../runtime/storage.ts';
import { closeMissionAudio } from '../../runtime/mission-lifecycle.ts';
import { decodePortSnapshot } from './persistence.ts';
import { chooseRound, readRound } from './domain/port.ts';
import type { Round } from './domain/port.ts';
import type { createPortAudio } from './session.ts';

export function createPortPersistence(
  store: ProgressStore = progress,
  storage: StorageBoundary = sessionStorageBoundary,
  development: DevelopmentStore = createDevelopmentStore(storage),
) {
  let previousRound: Round | undefined;
  const roundKey = 'town-crew:port:last-round:v1';
  function rememberRound(round: Round) {
    previousRound = { ...round }; storage.writeJson(roundKey, previousRound);
  }
  return {
    ...createMissionPersistence('port-cargo', decodePortSnapshot, store, development),
    rememberRound,
    newRound(previous?: Round) {
      if (!previousRound) { const saved = readRound(storage.readJson(roundKey)); if (saved) previousRound = saved; }
      const round = chooseRound(previous ?? previousRound); rememberRound(round); return round;
    },
  };
}
// Reused across visits/HMR; the audio Layer below is built within each mission scope.
export const portPersistence = createPortPersistence(progress, sessionStorageBoundary, { loadDevelopment, saveDevelopment });
export class PortPersistence extends Context.Service<PortPersistence, ReturnType<typeof createPortPersistence>>()('town-crew/PortPersistence') {}
export const PortPersistenceLive = Layer.succeed(PortPersistence, portPersistence);
export type PortAudioService = ReturnType<typeof createPortAudio>;
export class PortAudio extends Context.Service<PortAudio, PortAudioService>()('town-crew/PortAudio') {}
export const portAudioLayer = (make: () => PortAudioService) => Layer.effect(PortAudio,
  Effect.acquireRelease(Effect.sync(make), audio => closeMissionAudio('port-cargo', audio)),
);
