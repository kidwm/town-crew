import { sessionStorageBoundary } from '../runtime/storage.ts';
import type { StorageBoundary } from '../runtime/storage.ts';

export function createDevelopmentStore(storage: StorageBoundary = sessionStorageBoundary) {
  const memory = new Map<string, unknown>();
  return {
    loadDevelopment(key: string): unknown {
      return memory.has(key) ? memory.get(key) : storage.readJson(key);
    },
    saveDevelopment(key: string, snapshot: unknown): void {
      const copy = structuredClone(snapshot);
      memory.set(key, copy);
      storage.writeJson(key, copy);
    },
  };
}
// The live store survives navigation/main.ts HMR; injected stores own isolated memory.
export type DevelopmentStore = ReturnType<typeof createDevelopmentStore>;
export const { loadDevelopment, saveDevelopment } = createDevelopmentStore();
