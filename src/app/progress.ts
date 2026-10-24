import { sessionStorageBoundary, localStorageBoundary } from '../runtime/storage.ts';
import type { StorageBoundary } from '../runtime/storage.ts';
export type MissionId = 'road-repair' | 'house-build' | 'fire-rescue' | 'traffic-rescue' | 'police-patrol' | 'port-cargo' | 'mountain-clearance' | 'passenger-transfer';
/** Each store owns its memory; the app singleton survives navigation and main.ts HMR. */
export function createProgressStore(session: StorageBoundary = sessionStorageBoundary, local: StorageBoundary = localStorageBoundary) {
  const memory = new Map<string, unknown>();
  const key = (id: string) => `town-crew:play:v1:${id}`;

  function loadProgress(id: MissionId): unknown {
    if (memory.has(id)) return memory.get(id);
    return session.readJson(key(id));
  }
  function saveProgress(id: MissionId, snapshot: unknown) {
    memory.set(id, structuredClone(snapshot));
    session.writeJson(key(id), snapshot);
  }
  function clearProgress(id: MissionId) {
    // A null memory entry also masks an old save when storage is unavailable.
    memory.set(id, null);
    session.remove(key(id));
  }
  function isCompleted(id: MissionId) {
    return memory.get(`done:${id}`) === true || local.readText(key(`done:${id}`)) === 'true';
  }
  function markCompleted(id: MissionId) {
    memory.set(`done:${id}`, true);
    local.writeText(key(`done:${id}`), 'true');
  }
  function isMuted() {
    if (memory.has('muted')) return memory.get('muted') === true;
    return local.readText(key('muted')) === 'true';
  }
  function setMuted(value: boolean) {
    memory.set('muted', value);
    local.writeText(key('muted'), String(value));
  }
  return { loadProgress, saveProgress, clearProgress, isCompleted, markCompleted, isMuted, setMuted };
}
export type ProgressStore = ReturnType<typeof createProgressStore>;
export const { loadProgress, saveProgress, clearProgress, isCompleted, markCompleted, isMuted, setMuted } = createProgressStore();
