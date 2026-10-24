import { Context, Effect, Layer } from 'effect';
import * as progress from '../../app/progress.ts';
import type { ProgressStore } from '../../app/progress.ts';
import { sessionStorageBoundary } from '../../runtime/storage.ts';
import type { StorageBoundary } from '../../runtime/storage.ts';
import type { createAudio } from '../../runtime/audio.ts';
import { closeMissionAudio } from '../../runtime/mission-lifecycle.ts';
import { createRoadDevelopment, restoreDevelopment, restoreRoadSnapshot, saveDevelopment } from './devtools.ts';
import type { RoadSnapshot } from './persistence.ts';
import { chooseRound, validRound } from './domain/round.ts';
import type { RoadRound } from './domain/round.ts';
import type { roadSounds } from './sounds.ts';

type Hot = NonNullable<ImportMeta['hot']>;
const roundKey = 'town-crew:road:last-round:v1';

/** The live instance is shared across visits; tests can supply entirely isolated stores. */
export function createRoadPersistence(
  store: ProgressStore = progress,
  storage: StorageBoundary = sessionStorageBoundary,
  development: ReturnType<typeof createRoadDevelopment> = createRoadDevelopment(storage),
) {
  let previousRound: RoadRound | undefined;
  function rememberRound(round: RoadRound) {
    previousRound = { ...round };
    storage.writeJson(roundKey, round);
  }
  return {
    load(dev: boolean, key: string, hot?: Hot) {
      return dev ? development.restoreDevelopment(key, hot) : restoreRoadSnapshot(store.loadProgress('road-repair'), 'play');
    },
    save(dev: boolean, snapshot: RoadSnapshot, hot?: Hot) {
      if (dev) development.saveDevelopment(snapshot, hot);
      else store.saveProgress('road-repair', snapshot);
    },
    rememberRound,
    newRound(previous?: RoadRound) {
      if (!previousRound) { const saved = storage.readJson(roundKey); if (validRound(saved)) previousRound = saved; }
      const round = chooseRound(previous ?? previousRound); rememberRound(round); return round;
    },
    markCompleted: () => store.markCompleted('road-repair'),
    isMuted: () => store.isMuted(),
    setMuted: (muted: boolean) => store.setMuted(muted),
  };
}
export const roadPersistence = createRoadPersistence(progress, sessionStorageBoundary, { restoreDevelopment, saveDevelopment });
export class RoadPersistence extends Context.Service<RoadPersistence, ReturnType<typeof createRoadPersistence>>()('town-crew/RoadPersistence') {}
export const RoadPersistenceLive = Layer.succeed(RoadPersistence, roadPersistence);

export type RoadAudioService = ReturnType<typeof createAudio<keyof typeof roadSounds>>;
export class RoadAudio extends Context.Service<RoadAudio, RoadAudioService>()('town-crew/RoadAudio') {}
/** The layer owns exactly one audio object per mission scope, including failed connects. */
export const roadAudioLayer = (make: () => RoadAudioService) => Layer.effect(RoadAudio,
  Effect.acquireRelease(Effect.sync(make), audio => closeMissionAudio('road-repair', audio)),
);
