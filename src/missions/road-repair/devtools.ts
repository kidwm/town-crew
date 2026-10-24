import { Result } from 'effect';
import { sessionStorageBoundary, reportStorageFailure } from '../../runtime/storage.ts';
import { decodeRoadSnapshot } from './persistence.ts';
import type { StorageBoundary } from '../../runtime/storage.ts';
import type { RoadSnapshot } from './persistence.ts';
type ViteHotContext = NonNullable<ImportMeta['hot']>;

export function restoreRoadSnapshot(value: unknown, snapshotKey: string) {
  if (value == null) return;
  const result = decodeRoadSnapshot(value, snapshotKey);
  if (Result.isSuccess(result)) return result.success;
  reportStorageFailure(result.failure);
}

/** Injected stores keep their own development memory; the live facade is module-lived. */
export function createRoadDevelopment(storage: StorageBoundary = sessionStorageBoundary) {
  const memory = new Map<string, RoadSnapshot>();
  return {
    restoreDevelopment(snapshotKey: string, hot?: ViteHotContext) {
      return restoreRoadSnapshot(hot?.data.snapshot ?? memory.get(snapshotKey) ?? storage.readJson(snapshotKey), snapshotKey);
    },
    saveDevelopment(snapshot: RoadSnapshot, hot?: ViteHotContext) {
      const copy = structuredClone(snapshot);
      memory.set(snapshot.key, copy);
      if (hot) hot.data.snapshot = copy;
      storage.writeJson(snapshot.key, copy);
    },
  };
}
export const { restoreDevelopment, saveDevelopment } = createRoadDevelopment();
