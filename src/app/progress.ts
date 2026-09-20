export type MissionId = 'road-repair' | 'house-build' | 'fire-rescue' | 'traffic-rescue';
const memory = new Map<string, unknown>();
const key = (id: string) => `town-crew:play:v1:${id}`;

export function loadProgress(id: MissionId): unknown {
  if (memory.has(id)) return memory.get(id);
  try { return JSON.parse(sessionStorage.getItem(key(id)) ?? 'null'); } catch { return null; }
}
export function saveProgress(id: MissionId, snapshot: unknown) {
  memory.set(id, structuredClone(snapshot));
  try { sessionStorage.setItem(key(id), JSON.stringify(snapshot)); } catch { /* Play also works without storage. */ }
}
export function clearProgress(id: MissionId) {
  // A null memory entry also masks an old save when storage is unavailable.
  memory.set(id, null);
  try { sessionStorage.removeItem(key(id)); } catch { /* Starting over still works. */ }
}
export function isCompleted(id: MissionId) {
  try { return memory.get(`done:${id}`) === true || localStorage.getItem(key(`done:${id}`)) === 'true'; } catch { return memory.get(`done:${id}`) === true; }
}
export function markCompleted(id: MissionId) {
  memory.set(`done:${id}`, true);
  try { localStorage.setItem(key(`done:${id}`), 'true'); } catch { /* Optional badge. */ }
}
export function isMuted() {
  if (memory.has('muted')) return memory.get('muted') === true;
  try { return localStorage.getItem(key('muted')) === 'true'; } catch { return false; }
}
export function setMuted(value: boolean) {
  memory.set('muted', value);
  try { localStorage.setItem(key('muted'), String(value)); } catch { /* Optional preference. */ }
}
