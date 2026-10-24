import assert from 'node:assert/strict';
import test from 'node:test';
import { createStorageBoundary, createStorageReporter, SnapshotDecodeError, SnapshotEncodeError, StorageUnavailable, type StorageFailure } from './storage.ts';

for (const operation of ['getter', 'get', 'set', 'remove'] as const) {
  test(`storage ${operation} failure is synchronous, optional and retains its cause`, () => {
    const original = new Error(operation), errors: StorageFailure[] = [];
    const fail = () => { throw original; };
    const fake = { getItem: operation === 'get' ? fail : () => null, setItem: operation === 'set' ? fail : () => {}, removeItem: operation === 'remove' ? fail : () => {} };
    const storage = createStorageBoundary('sessionStorage', operation === 'getter' ? fail : () => fake, error => errors.push(error));
    if (operation === 'set') storage.writeJson('snapshot', { phase: 'ready' });
    else if (operation === 'remove') storage.remove('snapshot');
    else assert.equal(storage.readJson('snapshot'), null);
    assert.equal(errors.length, 1); const error = errors[0];
    assert.ok(error instanceof StorageUnavailable); assert.equal(error.cause, original);
    assert.equal(error.key, 'snapshot'); assert.equal(error.area, 'sessionStorage');
    assert.equal(error.operation, operation === 'getter' ? 'get' : operation);
  });
}

test('JSON errors have their own tags and do not write corrupt replacements', () => {
  const errors: StorageFailure[] = [], data = new Map([['snapshot', '{invalid']]);
  const storage = createStorageBoundary('sessionStorage', () => ({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: key => { data.delete(key); } }), error => errors.push(error));
  assert.equal(storage.readJson('missing'), null); assert.equal(errors.length, 0);
  assert.equal(storage.readJson('snapshot'), null);
  assert.ok(errors[0] instanceof SnapshotDecodeError); assert.equal(errors[0].stage, 'json');
  assert.ok(errors[0].cause instanceof SyntaxError);
  const cycle: { self?: unknown } = {}; cycle.self = cycle;
  for (const value of [cycle, undefined, 1n]) storage.writeJson('snapshot', value);
  assert.ok(errors.slice(1).every(error => error instanceof SnapshotEncodeError));
  assert.equal(data.get('snapshot'), '{invalid');
  storage.writeJson('snapshot', { passes: 1 }); assert.deepEqual(storage.readJson('snapshot'), { passes: 1 });
  storage.writeText('muted', 'true'); assert.equal(storage.readText('muted'), 'true');
  storage.remove('snapshot'); assert.equal(storage.readJson('snapshot'), null);
});

test('storage diagnostics are once per boundary and cannot break persistence', () => {
  const errors: StorageFailure[] = [];
  const report = createStorageReporter(true, error => { errors.push(error); throw new Error('logging failed'); });
  const storage = createStorageBoundary('sessionStorage', () => { throw new Error('blocked'); }, report);
  for (let i = 0; i < 5; i++) { storage.readJson('snapshot'); storage.writeJson('snapshot', {}); storage.remove('snapshot'); }
  assert.equal(errors.length, 3);
  const quiet = createStorageReporter(false, error => errors.push(error));
  createStorageBoundary('localStorage', () => { throw new Error('blocked'); }, quiet).writeText('muted', 'true');
  assert.equal(errors.length, 3);
});

test('an injected reporter cannot turn optional storage or JSON errors into failures', () => {
  const errors: StorageFailure[] = [];
  const report = (error: StorageFailure) => { errors.push(error); throw new Error('reporter failed'); };
  const storage = createStorageBoundary('sessionStorage', () => { throw new Error('blocked'); }, report);
  assert.equal(storage.readText('snapshot'), null);
  assert.equal(storage.readJson('snapshot'), null);
  assert.doesNotThrow(() => storage.writeText('snapshot', 'value'));
  assert.doesNotThrow(() => storage.writeJson('snapshot', {}));
  assert.doesNotThrow(() => storage.remove('snapshot'));
  const json = createStorageBoundary('sessionStorage', () => ({ getItem: () => '{invalid', setItem() {}, removeItem() {} }), report);
  assert.equal(json.readJson('snapshot'), null);
  assert.doesNotThrow(() => json.writeJson('snapshot', 1n));
  assert.equal(errors.length, 7);
  assert.ok(errors[5] instanceof SnapshotDecodeError);
  assert.ok(errors[6] instanceof SnapshotEncodeError);
});
