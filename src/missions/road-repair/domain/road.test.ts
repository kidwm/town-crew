import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOOM, STICK, PIVOT, HOME, UNLOAD, ROAD_CHUNKS, advanceExcavator, createExcavator, elbow, reachable, grabBucket, moveBucket, releaseBucket } from './excavator.ts';
import { advanceRoad, createRoad, grabHauler, moveHauler, releaseHauler, grabRoller, moveRoller, releaseRoller, resumeRoad, roadPose, ROLLER_LEFT, ROLLER_RIGHT, HAUL_START, HAUL_EXIT } from './road.ts';
import type { RoadState } from './road.ts';
import { input, defaultTuning } from './dump-truck.ts';
import { restoreRoadSnapshot } from '../devtools.ts';

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

test('missed or cancelled bucket drags pause without clearing a rock', () => {
  let state = until(createRoad(), s => s.excavator.action === 'ready');
  state = { ...state, excavator: moveBucket(grabBucket(state.excavator), { x: -2, y: 0.85, z: -1.65 }) };
  state = advanceRoad(state, 0.15);
  const paused = state.excavator.bucket;
  state = { ...state, excavator: releaseBucket(state.excavator) };
  state = until(state, s => s.excavator.action === 'ready');
  assert.equal(state.excavator.cleared, 0);
  assert.deepEqual(state.excavator.bucket, paused);
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
    state = { ...state, excavator: moveBucket(grabBucket(state.excavator), { ...ROAD_CHUNKS[rock], y: HOME.y }) };
    state = until(state, s => s.excavator.action === 'carrying-drag');
    state = advanceRoad(state, 2);
    assert.equal(state.excavator.cleared, rock, 'pickup alone must not load the truck');
    state = { ...state, excavator: releaseBucket(moveBucket(state.excavator, UNLOAD)) };
    state = until(state, s => s.excavator.cleared === rock + 1);
    assert.equal(state.phase, 'excavator');
    state = until(state, s => s.excavator.action === (rock === 2 ? 'complete' : 'ready'));
  }
  state = until(state, s => s.phase === 'haul-away');
  assert.equal(state.excavator.cleared, 3);
  assert.equal(roadPose(state, defaultTuning).fill, 0);
  state = moveHauler(grabHauler(state), HAUL_EXIT);
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
  const hauling = createRoad('haul-away');
  assert.equal(hauling.excavator.cleared, 3);
  assert.equal(hauling.hauler.action, 'ready');
  assert.equal(roadPose(hauling, defaultTuning).fill, 0);
  assert.equal(createRoad('dump-truck').excavator.cleared, 3);
  const back = createRoad('roller-return');
  assert.equal(back.roller.x, ROLLER_RIGHT);
  assert.equal(back.roller.passes, 1);
  assert.equal(roadPose(back, defaultTuning).fill, 1);
  assert.equal(roadPose(createRoad('complete'), defaultTuning).flatten, 1);
});

test('cleanup waits for all chunks, pauses on release, and hands off only after the loaded truck exits', () => {
  const initial = createRoad();
  assert.deepEqual(moveHauler(grabHauler(initial), HAUL_EXIT), initial);
  let state = createRoad('haul-away');
  assert.equal(advanceRoad(state, 10).phase, 'haul-away');
  assert.deepEqual(releaseHauler(grabHauler(state)).hauler, state.hauler, 'a tap cannot advance');
  state = moveHauler(grabHauler(state), HAUL_START + 10);
  assert.equal(state.hauler.x, HAUL_START);
  state = moveHauler(state, -1);
  state = resumeRoad(releaseHauler(state));
  assert.equal(state.hauler.x, -1);
  assert.equal(state.hauler.action, 'ready');
  assert.equal(advanceRoad(state, 10).phase, 'haul-away');
  state = moveHauler(grabHauler(state), HAUL_EXIT);
  assert.equal(state.hauler.action, 'leaving');
  assert.equal(advanceRoad(releaseHauler(state), 0.8).phase, 'haul-away');
  state = until(resumeRoad(state), s => s.phase === 'dump-truck');
  assert.equal(state.hauler.action, 'complete');
  assert.equal(state.access, 'entering');
  assert.equal(createRoad().hauler.x, HAUL_START);
});

test('the empty bucket returns above the cleanup cab rather than crossing through it', () => {
  for (let elapsed = 0; elapsed < 0.55; elapsed += 1 / 120) {
    const e = advanceExcavator({ ...createExcavator(), action: 'returning', from: UNLOAD, bucket: UNLOAD, cleared: 1 }, elapsed);
    const b = e.bucket;
    // Cab/roof world bounds from the original truck at 0.72 scale, and the
    // bucket's full width (including teeth), not just its attachment point.
    if (b.x + 0.78 > -0.38 && b.x - 0.35 < 0.81 && b.z - 0.48 < -1.395 && b.z + 0.48 > -2.605) {
      assert.ok(b.y - 0.35 > 1.81, `Bucket crossed cab at ${elapsed}s`);
    }
  }
});

test('legacy rubble piles migrate to cargo; new saves cannot skip loading or revive departed cargo', () => {
  const restore = (state: unknown) => restoreRoadSnapshot({ key: 'play', state, tuning: defaultTuning, targetStage: 'excavator' }, 'play');
  const { hauler: _h, ...legacy } = createRoad();
  legacy.access = 'working';
  legacy.excavator = { ...legacy.excavator, action: 'unloading', elapsed: 0.4, cleared: 1 };
  const migrated = restore(legacy)!.state;
  assert.equal(migrated.excavator.cleared, 1);
  assert.equal(migrated.excavator.action, 'ready');
  assert.deepEqual(migrated.excavator.bucket, HOME);
  assert.equal(migrated.hauler.action, 'ready');
  const { hauler: _done, ...finished } = createRoad('complete');
  assert.equal(restore(finished)!.state.hauler.action, 'complete');
  assert.equal(restore(finished)!.state.phase, 'complete');
  const halfway = moveHauler(grabHauler(createRoad('haul-away')), 0);
  assert.equal(restore(halfway)!.state.hauler.action, 'ready');
  assert.equal(restore(halfway)!.state.hauler.x, 0);
  halfway.excavator.cleared = 2;
  assert.equal(restore(halfway), undefined);
  const next = createRoad('dump-truck'); next.hauler.action = 'ready';
  assert.equal(restore(next), undefined);
});
