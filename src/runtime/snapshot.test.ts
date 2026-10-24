import assert from 'node:assert/strict';
import test from 'node:test';
import { Result, Schema } from 'effect';
import { createSnapshotDecoder, fraction, restoreSnapshot } from './snapshot.ts';

const source = Schema.Struct({ work: Schema.Struct({ current: fraction }) });
test('snapshot boundaries preserve original keys for domain invariants before stripping unknown metadata', () => {
  const decode = createSnapshotDecoder(source, (value: unknown) => {
    const state = value as typeof source.Type;
    return Object.keys(state.work).length === 1 ? state : undefined;
  });
  const valid = decode({ work: { current: 0.4 }, extra: 'old metadata' }, 'test');
  assert.ok(Result.isSuccess(valid)); assert.deepEqual(valid.success, { work: { current: 0.4 } });
  const bad = decode({ work: { current: 0.4, future: 1 } }, 'test');
  assert.ok(Result.isFailure(bad)); assert.equal(bad.failure.stage, 'invariant'); assert.equal(bad.failure.key, 'test');
});
test('snapshot failures distinguish schema paths, resume defects and invalid normalized output', () => {
  let resumes = 0;
  const failure = new Error('resume failed');
  const decode = createSnapshotDecoder(source, () => { resumes++; throw failure; });
  const bad = decode({ work: { current: '0.4' } }, 'typed');
  assert.ok(Result.isFailure(bad)); assert.equal(bad.failure.stage, 'schema');
  assert.match(String(bad.failure.cause), /current/); assert.equal(resumes, 0);
  const defect = decode({ work: { current: 0.4 } }, 'defect');
  assert.ok(Result.isFailure(defect)); assert.equal(defect.failure.cause, failure); assert.equal(defect.failure.stage, 'resume');
  const normalized = createSnapshotDecoder(source, () => ({ work: { current: Infinity } }))({ work: { current: 0.4 } }, 'normalized');
  assert.ok(Result.isFailure(normalized)); assert.equal(normalized.failure.stage, 'resume');
  assert.equal(restoreSnapshot(decode, null, 'missing'), undefined); assert.equal(resumes, 1);
});
