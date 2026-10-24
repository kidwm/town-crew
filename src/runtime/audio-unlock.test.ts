import assert from 'node:assert/strict';
import test from 'node:test';
import { AudioUnlockError, createAudioUnlocker } from './audio-unlock.ts';

const settled = () => new Promise<void>(resolve => { setImmediate(resolve); });

test('audio unlock begins synchronously, coalesces pending gestures and allows a later retry', async () => {
  const controller = new AbortController();
  let finish!: () => void, calls = 0;
  const unlock = createAudioUnlocker('road-repair', { unlock() { calls++; return new Promise<void>(resolve => { finish = resolve; }); } }, controller.signal);
  unlock(); assert.equal(calls, 1);
  unlock(); assert.equal(calls, 1);
  finish(); await settled(); unlock(); assert.equal(calls, 2);
  finish(); await settled(); controller.abort(); unlock(); assert.equal(calls, 2);
});

for (const kind of ['throw', 'reject'] as const) {
  test(`audio ${kind} is optional, retains its cause and reports once in development`, async t => {
    const original = new Error('audio unavailable'), controller = new AbortController();
    const logged = t.mock.method(console, 'warn', () => {});
    let calls = 0;
    const unlock = createAudioUnlocker('road-repair', { unlock() {
      calls++; if (kind === 'throw') throw original; return Promise.reject(original);
    } }, controller.signal, true);
    assert.doesNotThrow(unlock); await settled();
    assert.doesNotThrow(unlock); await settled();
    assert.equal(calls, 2); assert.equal(logged.mock.callCount(), 1);
    const error = logged.mock.calls[0].arguments[1] as AudioUnlockError;
    assert.ok(error instanceof AudioUnlockError);
    assert.equal(error.mission, 'road-repair'); assert.equal(error.cause, original);
    controller.abort();
  });
}

for (const when of ['during-unlock', 'while-pending'] as const) {
  test(`audio rejection after abort ${when} remains handled without stale diagnostics`, async t => {
    const controller = new AbortController(), logged = t.mock.method(console, 'warn', () => {});
    let reject!: (cause: unknown) => void, calls = 0;
    const unlock = createAudioUnlocker('road-repair', { unlock() {
      calls++;
      if (when === 'during-unlock') controller.abort();
      return new Promise<void>((_resolve, fail) => { reject = fail; });
    } }, controller.signal, true);
    unlock(); controller.abort(); reject(new Error('late rejection')); await settled(); unlock();
    assert.equal(calls, 1); assert.equal(logged.mock.callCount(), 0);
  });
}

test('production audio failure is quiet and a broken diagnostic cannot reject into gameplay', async t => {
  const controller = new AbortController(), audio = { unlock: () => Promise.reject(new Error('unavailable')) };
  const logged = t.mock.method(console, 'warn', () => { throw new Error('diagnostic failed'); });
  createAudioUnlocker('road-repair', audio, controller.signal)(); await settled();
  assert.equal(logged.mock.callCount(), 0);
  const unlock = createAudioUnlocker('road-repair', audio, controller.signal, true);
  assert.doesNotThrow(unlock); await settled(); assert.doesNotThrow(unlock); await settled();
  assert.equal(logged.mock.callCount(), 1); controller.abort();
});
