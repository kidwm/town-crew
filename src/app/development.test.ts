import assert from 'node:assert/strict';
import test from 'node:test';
import { loadDevelopment, saveDevelopment } from './development.ts';

test('development snapshots retain copied memory after denied storage and keep query keys separate', t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const disk = new Map<string, string>([['dev:stale', '{"phase":"old"}']]);
  let denied = false;
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() {
    if (denied) throw new Error('storage getter denied');
    return { getItem: (key: string) => disk.get(key) ?? null, setItem: (key: string, value: string) => disk.set(key, value) };
  } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'sessionStorage', previous); else Reflect.deleteProperty(globalThis, 'sessionStorage'); });
  assert.deepEqual(loadDevelopment('dev:stale'), { phase: 'old' });
  denied = true;
  const state = { phase: 'working', cargo: [1] };
  saveDevelopment('dev:stale', state); state.cargo.push(2);
  assert.deepEqual(loadDevelopment('dev:stale'), { phase: 'working', cargo: [1] });
  assert.equal(loadDevelopment('dev:other-query'), null);
  denied = false;
  assert.deepEqual(loadDevelopment('dev:stale'), { phase: 'working', cargo: [1] });
  assert.equal(disk.get('dev:stale'), '{"phase":"old"}');
  saveDevelopment('dev:stale', { phase: 'new-round' });
  assert.equal(disk.get('dev:stale'), '{"phase":"new-round"}');
});
