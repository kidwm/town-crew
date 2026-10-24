import type { MissionId, ProgressStore } from './progress.ts';
import type { DevelopmentStore } from './development.ts';
import { restoreSnapshot } from '../runtime/snapshot.ts';
import type { SnapshotDecoder } from '../runtime/snapshot.ts';

/** Shared storage boundary only; each mission owns its decoder and round-selection policy. */
export function createMissionPersistence<A>(mission: MissionId, decode: SnapshotDecoder<A>, store: ProgressStore, development: DevelopmentStore) {
  return {
    load(dev: boolean, key: string) {
      return restoreSnapshot(decode, dev ? development.loadDevelopment(key) : store.loadProgress(mission), dev ? key : `town-crew:play:v1:${mission}`);
    },
    save(dev: boolean, key: string, state: A) {
      if (dev) development.saveDevelopment(key, state);
      else store.saveProgress(mission, state);
    },
    markCompleted: () => store.markCompleted(mission),
    isMuted: () => store.isMuted(),
    setMuted: (muted: boolean) => store.setMuted(muted),
  };
}
