import assert from 'node:assert/strict';
import test from 'node:test';
import { clearProgress, isCompleted, isMuted, loadProgress, markCompleted, saveProgress, setMuted } from './progress.ts';

test('progress memory survives storage denial, copies snapshots and masks failed removals', t => {
  const data = new Map<string, string>(), writes: string[] = [];
  let blocked = false;
  const storage = {
    getItem(key: string) { if (blocked) throw new Error('get denied'); return data.get(key) ?? null; },
    setItem(key: string, value: string) { if (blocked) throw new Error('set denied'); data.set(key, value); writes.push(key); },
    removeItem(key: string) { if (blocked) throw new Error('remove denied'); data.delete(key); },
  };
  const oldSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const oldLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  for (const name of ['sessionStorage', 'localStorage']) Object.defineProperty(globalThis, name, { configurable: true, get() { if (blocked) throw new Error('getter denied'); return storage; } });
  t.after(() => {
    for (const [name, old] of [['sessionStorage', oldSession], ['localStorage', oldLocal]] as const) {
      if (old) Object.defineProperty(globalThis, name, old); else Reflect.deleteProperty(globalThis, name);
    }
  });
  data.set('town-crew:play:v1:road-repair', '{invalid'); assert.equal(loadProgress('road-repair'), null);
  data.set('town-crew:play:v1:house-build', JSON.stringify({ old: true }));
  assert.deepEqual(loadProgress('house-build'), { old: true });
  blocked = true;
  const snapshot = { passes: 1 }; saveProgress('road-repair', snapshot); snapshot.passes = 2;
  assert.deepEqual(loadProgress('road-repair'), { passes: 1 });
  markCompleted('road-repair'); setMuted(true);
  assert.equal(isCompleted('road-repair'), true); assert.equal(isMuted(), true);
  clearProgress('house-build'); blocked = false;
  assert.equal(loadProgress('house-build'), null, 'a stale stored save cannot defeat the memory tombstone');
  assert.equal(data.has('town-crew:play:v1:house-build'), true);
  saveProgress('road-repair', { passes: 2 }); markCompleted('road-repair'); setMuted(false);
  assert.deepEqual(writes, ['town-crew:play:v1:road-repair', 'town-crew:play:v1:done:road-repair', 'town-crew:play:v1:muted']);
  clearProgress('road-repair'); assert.equal(loadProgress('road-repair'), null);
  assert.equal(isCompleted('road-repair'), true); assert.equal(isMuted(), false);
});
