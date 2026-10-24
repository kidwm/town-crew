import { Data, Effect } from 'effect';

export type StorageArea = 'sessionStorage' | 'localStorage';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export class StorageUnavailable extends Data.TaggedError('StorageUnavailable')<{
  readonly area: StorageArea; readonly key: string; readonly operation: 'get' | 'set' | 'remove'; readonly cause: unknown;
}> {}
export class SnapshotDecodeError extends Data.TaggedError('SnapshotDecodeError')<{
  readonly key: string; readonly stage: 'json' | 'schema' | 'invariant' | 'resume'; readonly cause: unknown;
}> {}
export class SnapshotEncodeError extends Data.TaggedError('SnapshotEncodeError')<{
  readonly key: string; readonly cause: unknown;
}> {}
export type StorageFailure = StorageUnavailable | SnapshotDecodeError | SnapshotEncodeError;

export function createStorageReporter(enabled: boolean, log = (error: StorageFailure) => console.warn('Optional storage failed', error)) {
  const reported = new Set<string>();
  return (error: StorageFailure) => {
    const id = `${error._tag}:${error.key}:${error instanceof StorageUnavailable ? `${error.area}:${error.operation}` : error instanceof SnapshotDecodeError ? error.stage : 'encode'}`;
    if (!enabled || reported.has(id)) return;
    reported.add(id);
    try { log(error); } catch { /* Diagnostics must not interrupt optional persistence. */ }
  };
}
export const reportStorageFailure = createStorageReporter(import.meta.env?.DEV ?? false);

/** Fully synchronous boundary; callers own memory fallback and snapshot policy. */
export function createStorageBoundary(area: StorageArea, getStorage: () => StorageLike = () => globalThis[area], report = reportStorageFailure) {
  function recover<A>(effect: Effect.Effect<A, StorageFailure>, fallback: A): A {
    return Effect.runSync(effect.pipe(Effect.catch(error => Effect.sync(() => {
      try { report(error); } catch { /* Injected diagnostics are optional too. */ }
      return fallback;
    }))));
  }
  function access<A>(key: string, operation: StorageUnavailable['operation'], use: (storage: StorageLike) => A) {
    // Acquire inside try: browser storage getters can throw before getItem/setItem.
    return Effect.try({ try: () => use(getStorage()), catch: cause => new StorageUnavailable({ area, key, operation, cause }) });
  }
  return {
    readText(key: string): string | null { return recover(access(key, 'get', storage => storage.getItem(key)), null); },
    writeText(key: string, value: string): void { recover(access(key, 'set', storage => storage.setItem(key, value)), undefined); },
    remove(key: string): void { recover(access(key, 'remove', storage => storage.removeItem(key)), undefined); },
    readJson(key: string): unknown {
      return recover(access(key, 'get', storage => storage.getItem(key)).pipe(Effect.flatMap(raw => raw === null ? Effect.succeed(null)
        : Effect.try({ try: () => JSON.parse(raw) as unknown, catch: cause => new SnapshotDecodeError({ key, stage: 'json', cause }) }))), null);
    },
    writeJson(key: string, value: unknown): void {
      const encode = Effect.try({ try: () => {
        const raw = JSON.stringify(value);
        if (raw === undefined) throw new TypeError('Snapshot is not JSON serializable');
        return raw;
      }, catch: cause => new SnapshotEncodeError({ key, cause }) });
      recover(encode.pipe(Effect.flatMap(raw => access(key, 'set', storage => storage.setItem(key, raw)))), undefined);
    },
  };
}

export type StorageBoundary = ReturnType<typeof createStorageBoundary>;

export const sessionStorageBoundary = createStorageBoundary('sessionStorage');
export const localStorageBoundary = createStorageBoundary('localStorage');
