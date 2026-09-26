import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARRY_HEIGHT, HOME, ROAD_CHUNKS, UNLOAD, advanceExcavator, createExcavator, grabBucket, moveBucket, releaseBucket, resumeExcavator, tapBucketTarget } from './excavator.ts';
import type { ExcavatorState } from './excavator.ts';
import { createRoad } from './road.ts';
import { restoreRoadSnapshot } from '../devtools.ts';
import { defaultTuning } from './dump-truck.ts';

function tick(state: ExcavatorState, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 120) state = advanceExcavator(state, 1 / 120);
  return state;
}
function pickup() {
  return tick(moveBucket(grabBucket(tick(createExcavator(), 1)), ROAD_CHUNKS[0]), 1);
}

test('one held drag lifts a piece and leaves the child in control until release over the truck', () => {
  let e = pickup();
  assert.equal(e.action, 'carrying-drag');
  assert.equal(e.bucket.y, CARRY_HEIGHT);
  e = tick(e, 4);
  assert.equal(e.cleared, 0);
  assert.equal(e.action, 'carrying-drag');
  e = moveBucket(e, UNLOAD);
  e = tick(e, 1);
  assert.equal(e.cleared, 0, 'hovering cannot silently finish the child’s delivery');
  e = tick(releaseBucket(e), 2);
  assert.equal(e.cleared, 1);
  assert.equal(e.action, 'ready');
  assert.deepEqual(e.bucket, HOME);
  assert.equal(tick(e, 3).cleared, 1, 'the next piece still needs a new gesture');
});

test('release and cancellation preserve the carried piece and allow a fresh drag', () => {
  let e = releaseBucket(pickup());
  const paused = e.bucket;
  e = tick(e, 5);
  assert.equal(e.action, 'carrying');
  assert.deepEqual(e.bucket, paused);
  assert.equal(e.cleared, 0);
  e = tick(moveBucket(grabBucket(e), UNLOAD), 1);
  e = tick(releaseBucket(e, true), 2);
  assert.equal(e.action, 'carrying');
  assert.equal(e.cleared, 0, 'cancellation over the bed is not a drop');
  e = tick(releaseBucket(moveBucket(grabBucket(e), UNLOAD)), 2);
  assert.equal(e.cleared, 1);
});

test('letting go during pickup finishes only the lift, then waits with the load', () => {
  let e = moveBucket(grabBucket(tick(createExcavator(), 1)), ROAD_CHUNKS[0]);
  while (e.action === 'dragging') e = advanceExcavator(e, 1 / 120);
  assert.equal(e.action, 'scooping');
  e = tick(releaseBucket(e), 3);
  assert.equal(e.action, 'carrying');
  assert.equal(e.cleared, 0);
  assert.equal(e.control, 'none');
});

test('a quick release accepts the intended destination and safely aligns above the truck', () => {
  let e = releaseBucket(moveBucket(pickup(), { ...UNLOAD, x: UNLOAD.x + 0.8, z: UNLOAD.z + 0.6 }));
  assert.equal(e.action, 'unloading');
  for (let i = 0; i < 55; i++) {
    e = advanceExcavator(e, 1 / 120);
    assert.ok(e.bucket.y >= CARRY_HEIGHT - 1e-8, 'align before lowering into the bed');
  }
  assert.equal(tick(e, 2).cleared, 1);
});

test('carrying stays above the cab and invalid targets cannot corrupt the arm', () => {
  const start = pickup();
  assert.deepEqual(moveBucket(start, { x: NaN, y: 1, z: 0 }), start);
  for (const x of [-2, 0, 4.3, 100]) for (const z of [-10, -2, 0, 10]) {
    const e = tick(moveBucket(start, { x, y: -100, z }), 1);
    assert.ok(e.bucket.y - 0.35 > 1.81);
    assert.equal(e.cleared, 0);
  }
});

test('tap destinations perform one pickup and one explicit delivery', () => {
  let e = tick(tapBucketTarget(tick(createExcavator(), 1)), 2);
  assert.equal(e.action, 'carrying');
  assert.equal(e.cleared, 0);
  e = tick(tapBucketTarget(e), 3);
  assert.equal(e.action, 'ready');
  assert.equal(e.cleared, 1);
});

test('reload retains loaded position, cancels pointer ownership and does not auto-deliver', () => {
  const e = tick(moveBucket(pickup(), UNLOAD), 1);
  const snapshot = { key: 'play', state: { ...createRoad(), access: 'working', excavator: e }, tuning: defaultTuning, targetStage: 'excavator' };
  const restored = restoreRoadSnapshot(snapshot, 'play')!.state.excavator;
  assert.equal(restored.action, 'carrying');
  assert.deepEqual(restored.bucket, e.bucket);
  assert.equal(restored.control, 'none');
  assert.equal(tick(restored, 5).cleared, 0);
  const unloading = releaseBucket(e);
  assert.equal(tick(resumeExcavator(unloading), 2).cleared, 1, 'an already committed delivery finishes once');
});

test('pre-manual-loading saves retain completed work and reset an unfinished automatic scoop', () => {
  const { control: _control, delivered: _delivered, carried: _carried, aimed: _aimed, ...legacy } = { ...pickup(), action: 'unloading' as const, cleared: 1 };
  const { version: _version, round: _round, ...road } = createRoad();
  const snapshot = { key: 'play', state: { ...road, access: 'working', excavator: legacy }, tuning: defaultTuning, targetStage: 'excavator' };
  const restored = restoreRoadSnapshot(snapshot, 'play')!.state.excavator;
  assert.equal(restored.cleared, 1);
  assert.deepEqual(restored.delivered, [0]);
  assert.equal(restored.action, 'ready');
  assert.deepEqual(restored.bucket, HOME);
});
