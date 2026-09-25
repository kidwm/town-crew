import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceRoad, BARRIER_CLEAR_Z, BARRIER_X, createRoad, grabHauler, moveHauler, resumeRoad, roadPose, ROLLER_LEFT, ROLLER_RIGHT, HAUL_EXIT, HAUL_START, HAUL_Z, HAUL_SCALE } from './road.ts';
import type { EntryStage, RoadState } from './road.ts';
import { defaultTuning, pose as truckPose } from './dump-truck.ts';
import { smooth } from './excavator.ts';

// Conservative physical extents from the models, including the folded bucket,
// truck body, and front drum. Invisible picking volumes are not obstacles.
function footprint(state: RoadState) {
  const road = roadPose(state, defaultTuning);
  if (state.phase === 'haul-away') return { min: road.haulerX - 3.13 * HAUL_SCALE, max: road.haulerX + 1.5 * HAUL_SCALE, z: HAUL_Z + 1.3 * HAUL_SCALE };
  if (state.phase === 'excavator') {
    const offset = state.excavator.action === 'entering' ? -9 * (1 - smooth(state.excavator.elapsed / 0.9)) : -10 * road.departure;
    return { min: offset - 6.3, max: offset, z: 1.1 };
  }
  if (state.phase === 'dump-truck') {
    const x = truckPose(state.truck, defaultTuning).x - 10 * road.departure;
    return { min: x - 3.13, max: x + 1.5, z: 1.3 };
  }
  const x = road.rollerX - 10 * road.departure;
  return { min: x - 1.7, max: x + 1.95, z: 1.2 };
}
function assertClear(state: RoadState) {
  const vehicle = footprint(state);
  const gateZ = roadPose(state, defaultTuning).barrierZ;
  BARRIER_X.forEach((x, i) => {
    if (vehicle.min < x + 0.2 && vehicle.max > x - 0.2) {
      assert.ok(gateZ[i] - 1.4 > vehicle.z, `${state.phase}/${state.access} overlaps barrier ${i}`);
    }
  });
}

for (const stage of ['excavator', 'dump-truck', 'roller'] as EntryStage[]) {
  test(`${stage}: opens before movement, closes after parking, and clears the exit before departure`, () => {
    let state = createRoad(stage);
    const start = footprint(state);
    let steps = 0;
    while (state.access !== 'working' && steps++ < 600) {
      assertClear(state);
      if (state.access === 'opening-entry') assert.deepEqual(footprint(state), start);
      if (state.access === 'entering') assert.equal(roadPose(state, defaultTuning).barrierZ[0], BARRIER_CLEAR_Z);
      state = advanceRoad(state, 1 / 60);
    }
    assert.equal(state.access, 'working');
    assert.deepEqual(roadPose(state, defaultTuning).barrierZ, [0, 0]);
    assertClear(state);
    if (stage === 'excavator') state.excavator = { ...state.excavator, action: 'complete', cleared: 3 };
    if (stage === 'dump-truck') state.truck = { ...state.truck, phase: 'complete' };
    if (stage === 'roller') state.roller = { ...state.roller, action: 'complete', passes: 2 };
    const parked = footprint(state);
    let priorGates = roadPose(state, defaultTuning).barrierZ;
    steps = 0;
    while (state.phase === stage && steps++ < 600) {
      assertClear(state);
      if (state.access === 'opening-exit') assert.deepEqual(footprint(state), parked);
      if (state.access === 'leaving') assert.equal(roadPose(state, defaultTuning).barrierZ[0], BARRIER_CLEAR_Z);
      priorGates = roadPose(state, defaultTuning).barrierZ;
      state = advanceRoad(state, 1 / 60);
    }
    assert.notEqual(state.phase, stage);
    assert.deepEqual(roadPose(state, defaultTuning).barrierZ, priorGates, 'Gate must not snap shut during vehicle handoff');
  });
}

test('closed barriers leave room for the whole roller at both ends of its work range', () => {
  const state = createRoad('roller-return');
  for (let x = ROLLER_LEFT; x <= ROLLER_RIGHT; x += 0.05) {
    assertClear({ ...state, roller: { ...state.roller, x } });
  }
  assertClear({ ...state, roller: { ...state.roller, x: ROLLER_RIGHT } });
});

test('loaded cleanup truck keeps the exit clear through dragging, cancellation and automatic departure', () => {
  let state = grabHauler(createRoad('haul-away'));
  for (let x = HAUL_START; x > HAUL_EXIT; x -= 0.1) {
    state = moveHauler(state, x); assertClear(state);
    assert.equal(roadPose(resumeRoad(state), defaultTuning).barrierZ[0], BARRIER_CLEAR_Z);
  }
  state = moveHauler(state, HAUL_EXIT);
  for (let i = 0; i < 90 && state.phase === 'haul-away'; i++) { assertClear(state); state = advanceRoad(state, 1 / 60); }
  assert.equal(state.phase, 'dump-truck');
  assertClear(state);
  assert.equal(roadPose(state, defaultTuning).barrierZ[0], BARRIER_CLEAR_Z);
});

test('reload preserves gate animation; old snapshots restart an entrance safely', () => {
  const opening = advanceRoad(createRoad('dump-truck'), 0.2);
  assert.deepEqual(roadPose(resumeRoad(opening), defaultTuning), roadPose(opening, defaultTuning));
  const { access: _access, ...legacy } = createRoad('dump-truck');
  legacy.truck.elapsed = 0.4;
  const migrated = resumeRoad(legacy as RoadState);
  assert.equal(migrated.access, 'opening-entry');
  assert.equal(migrated.truck.elapsed, 0);
  assertClear(migrated);
  assert.deepEqual(roadPose(createRoad(), defaultTuning).barrierZ, [0, 0]);
});
