import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOOM, STICK, PIVOT, HOME, ROCKS, elbow, reachable, grabBucket, moveBucket, releaseBucket } from './excavator.ts';
import { advanceRoad, createRoad, grabRoller, moveRoller, releaseRoller, resumeRoad, roadPose, ROLLER_LEFT, ROLLER_RIGHT } from './road.ts';
import type { RoadState } from './road.ts';
import { input, defaultTuning } from './dump-truck.ts';

function until(state: RoadState, predicate: (s: RoadState) => boolean): RoadState {
  for (let i = 0; i < 1200; i++) {
    if (predicate(state)) return state;
    state = advanceRoad(state, 1 / 60);
  }
  assert.fail(`Mission stalled: ${JSON.stringify(state)}`);
}
const distance = (a: typeof HOME, b: typeof HOME) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test('IK preserves both arm lengths throughout the work area and unreachable targets', () => {
  for (const x of [-5, -2, 0, 2, 4.3, 30]) {
    for (const z of [-1.65, 0, 1.65]) {
      const target = reachable({ x, y: 0.85, z });
      const joint = elbow(target);
      assert.ok(Math.abs(distance(joint, PIVOT) - BOOM) < 1e-8);
      assert.ok(Math.abs(distance(joint, target) - STICK) < 1e-8);
      assert.ok(joint.y >= Math.min(PIVOT.y, target.y));
    }
  }
});

test('missed or cancelled bucket drags softly return without clearing a rock', () => {
  let state = until(createRoad(), s => s.excavator.action === 'ready');
  state = { ...state, excavator: moveBucket(grabBucket(state.excavator), { x: -2, y: 0.85, z: -1.65 }) };
  state = advanceRoad(state, 0.15);
  state = { ...state, excavator: releaseBucket(state.excavator) };
  state = until(state, s => s.excavator.action === 'ready');
  assert.equal(state.excavator.cleared, 0);
  assert.deepEqual(state.excavator.bucket, HOME);
});

test('roller can pause mid-pass; only opposite full traversals complete compaction', () => {
  let state = until(createRoad('roller'), s => s.roller.action === 'ready');
  let roller = moveRoller(grabRoller(state.roller), 2);
  roller = releaseRoller(roller);
  assert.equal(roller.x, 2);
  assert.equal(roller.passes, 0);
  roller = moveRoller(grabRoller(roller), ROLLER_LEFT);
  assert.equal(roller.passes, 0);
  roller = moveRoller(roller, ROLLER_RIGHT + 100);
  state = until({ ...state, roller }, s => s.roller.action === 'ready');
  assert.equal(state.roller.passes, 1);
  roller = moveRoller(grabRoller(state.roller), ROLLER_RIGHT + 100);
  assert.equal(roller.passes, 1);
  roller = moveRoller(roller, ROLLER_LEFT - 100);
  assert.equal(roller.passes, 2);
  assert.equal(roller.x, ROLLER_LEFT);
});

test('whole road mission reaches traffic and completion, then restarts cleanly', () => {
  let state = until(createRoad(), s => s.excavator.action === 'ready');
  for (let rock = 0; rock < 3; rock++) {
    state = { ...state, excavator: moveBucket(grabBucket(state.excavator), { ...ROCKS[rock], y: HOME.y }) };
    state = until(state, s => s.excavator.cleared === rock + 1);
    assert.equal(state.phase, 'excavator');
    state = until(state, s => s.excavator.action === (rock === 2 ? 'complete' : 'ready'));
  }
  state = until(state, s => s.phase === 'dump-truck' && s.truck.phase === 'ready');
  state = { ...state, truck: input(input(state.truck, { type: 'grab' }, defaultTuning), { type: 'drag', upwardPx: 60 }, defaultTuning) };
  state = until(state, s => s.phase === 'roller' && s.roller.action === 'ready');
  assert.equal(roadPose(state, defaultTuning).fill, 1);
  state = { ...state, roller: moveRoller(grabRoller(state.roller), ROLLER_RIGHT) };
  state = until(state, s => s.roller.action === 'ready');
  state = { ...state, roller: moveRoller(grabRoller(state.roller), ROLLER_LEFT) };
  state = until(state, s => s.phase === 'traffic');
  assert.equal(roadPose(state, defaultTuning).flatten, 1);
  state = until(state, s => s.phase === 'complete');
  assert.equal(roadPose(state, defaultTuning).progress, 1);
  state = createRoad();
  assert.equal(state.excavator.cleared, 0);
  assert.equal(state.roller.passes, 0);
  assert.equal(state.phase, 'excavator');
  assert.equal(roadPose(state, defaultTuning).fill, 0);
});

test('development snapshots recover every kind of in-flight pointer drag', () => {
  let state = until(createRoad(), s => s.excavator.action === 'ready');
  state = resumeRoad({ ...state, excavator: grabBucket(state.excavator) });
  assert.equal(until(state, s => s.excavator.action === 'ready').excavator.cleared, 0);
  state = until(createRoad('dump-truck'), s => s.truck.phase === 'ready');
  const tuning = { ...defaultTuning, dragThreshold: 100 };
  state = { ...state, truck: input(input(state.truck, { type: 'grab' }, tuning), { type: 'drag', upwardPx: 50 }, tuning) };
  state = resumeRoad(state, tuning);
  assert.equal(state.truck.phase, 'resetting');
  assert.equal(state.truck.fromTilt, 0.31);
  state = until(createRoad('roller-return'), s => s.roller.action === 'ready');
  state = resumeRoad({ ...state, roller: moveRoller(grabRoller(state.roller), 2) });
  assert.equal(state.roller.action, 'ready');
  assert.equal(state.roller.passes, 1);
  assert.equal(state.roller.x, 2);
});

test('development stage entry reconstructs the road consistently', () => {
  assert.equal(createRoad('dump-truck').excavator.cleared, 3);
  const back = createRoad('roller-return');
  assert.equal(back.roller.x, ROLLER_RIGHT);
  assert.equal(back.roller.passes, 1);
  assert.equal(roadPose(back, defaultTuning).fill, 1);
  assert.equal(roadPose(createRoad('complete'), defaultTuning).flatten, 1);
});
