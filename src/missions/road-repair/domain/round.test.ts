import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAMAGE_PATTERNS, DEFAULT_ROUND, chooseRound, haulDirection, roadDamage, rollerDirection, siteX } from './round.ts';
import type { RoadRound } from './round.ts';
import { createRoad, advanceRoad, grabHauler, moveHauler, grabRoller, moveRoller, HAUL_EXIT, ROLLER_LEFT, ROLLER_RIGHT } from './road.ts';
import type { RoadState } from './road.ts';
import { HOME, UNLOAD, advanceExcavator, createExcavator, grabBucket, moveBucket, releaseBucket, tapBucketTarget, reachable } from './excavator.ts';
import { defaultTuning, input } from './dump-truck.ts';
import { restoreRoadSnapshot } from '../devtools.ts';

const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
const restore = (state: unknown) => restoreRoadSnapshot({ key: 'play', state, tuning: defaultTuning, targetStage: 'excavator' }, 'play')?.state;
function until(state: RoadState, done: (s: RoadState) => boolean) {
  for (let i = 0; i < 1200; i++) {
    if (done(state)) return state;
    state = advanceRoad(state, 1 / 60);
  }
  assert.fail(`Stalled: ${JSON.stringify(state)}`);
}

test('new rounds always change damage and side, with all variants reachable', () => {
  const chosen = new Set<string>();
  for (const sample of [0, 0.4, 0.99]) for (const side of [0, 0.99]) {
    const samples = [sample, side];
    chosen.add(JSON.stringify(chooseRound(undefined, () => samples.shift()!)));
  }
  assert.equal(chosen.size, 6);
  for (const pattern of DAMAGE_PATTERNS) for (const layout of [0, 1] as const) {
    for (const sample of [0, 0.5, 0.999, 1, -1, NaN]) {
      const next = chooseRound({ pattern, layout }, () => sample);
      assert.notEqual(next.pattern, pattern);
      assert.notEqual(next.layout, layout);
      assert.ok(DAMAGE_PATTERNS.includes(next.pattern));
    }
  }
});

for (const pattern of DAMAGE_PATTERNS) for (const layout of [0, 1] as const) {
  const round: RoadRound = { pattern, layout }, chunks = roadDamage(round).chunks;
  test(`${pattern}/${layout}: every pickup order survives reload and completes the same workload`, () => {
    for (const order of orders) {
      let state = until(createRoad('excavator', round), s => s.access === 'working');
      for (let slot = 0; slot < 3; slot++) {
        const id = order[slot];
        // Alternate tap and drag so both input paths target the chosen piece.
        state = { ...state, excavator: slot % 2 ? tapBucketTarget(state.excavator, chunks, id) : moveBucket(grabBucket(state.excavator), chunks[id], chunks) };
        state = until(state, s => ['carrying', 'carrying-drag'].includes(s.excavator.action));
        assert.equal(state.excavator.carried, id, `intended ${id} in ${order}`);
        assert.deepEqual(state.excavator.delivered, order.slice(0, slot));
        state = restore(state)!;
        assert.deepEqual(state.round, round);
        assert.equal(state.excavator.action, 'carrying');
        assert.equal(advanceRoad(state, 5).excavator.cleared, slot);
        state = { ...state, excavator: releaseBucket(moveBucket(grabBucket(state.excavator), UNLOAD, chunks)) };
        state = until(state, s => s.excavator.cleared === slot + 1);
        state = restore(state)!;
        assert.deepEqual(state.excavator.delivered, order.slice(0, slot + 1));
        state = until(state, s => s.excavator.action === (slot === 2 ? 'complete' : 'ready'));
      }
      state = until(state, s => s.phase === 'haul-away');
      state = moveHauler(grabHauler(state), HAUL_EXIT);
      state = until(state, s => s.phase === 'dump-truck' && s.access === 'working');
      state = { ...state, truck: input(input(state.truck, { type: 'grab' }, defaultTuning), { type: 'drag', upwardPx: 140 }, defaultTuning) };
      state = until(state, s => s.phase === 'roller' && s.access === 'working');
      state = { ...state, roller: moveRoller(grabRoller(state.roller), ROLLER_RIGHT) };
      state = until(state, s => s.roller.action === 'ready');
      state = { ...state, roller: moveRoller(grabRoller(state.roller), ROLLER_LEFT) };
      state = until(state, s => s.phase === 'complete');
      assert.equal(state.roller.passes, 2);
      assert.deepEqual(restore(state)?.round, round);
    }
  });
  test(`${pattern}/${layout}: pickup positions are reachable and route hints follow world direction`, () => {
    for (const chunk of chunks) {
      const target = { ...chunk, y: HOME.y };
      const actual = reachable(target);
      assert.ok(Math.hypot(actual.x - target.x, actual.y - target.y, actual.z - target.z) < 0.15);
    }
    assert.equal(haulDirection(round), siteX(round, HAUL_EXIT) < siteX(round, 0) ? 'left' : 'right');
    assert.equal(rollerDirection(round, 0), siteX(round, ROLLER_RIGHT) > siteX(round, ROLLER_LEFT) ? 'right' : 'left');
    assert.notEqual(rollerDirection(round, 0), rollerDirection(round, 1));
  });
}

test('old manual-carry saves retain their load and migrate to the original worksite', () => {
  const { version: _version, round: _round, ...old } = createRoad();
  const { delivered: _delivered, carried: _carried, aimed: _aimed, ...excavator } = old.excavator;
  const state = restore({ ...old, access: 'working', excavator: { ...excavator, action: 'carrying-drag', control: 'pointer', cleared: 1, bucket: UNLOAD, target: UNLOAD } })!;
  assert.deepEqual(state.round, DEFAULT_ROUND);
  assert.deepEqual(state.excavator.delivered, [0]);
  assert.equal(state.excavator.carried, 1);
  assert.equal(state.excavator.action, 'carrying');
  assert.equal(advanceRoad(state, 5).excavator.cleared, 1);
});

test('dragging across nearer pieces waits for the chosen destination; release accepts that piece', () => {
  const chunks = roadDamage({ pattern: 'split', layout: 0 }).chunks;
  let e = grabBucket(advanceExcavator(createExcavator(), 1, chunks));
  for (let x = HOME.x; x <= chunks[2].x; x += 0.04) {
    e = advanceExcavator(moveBucket(e, { x, y: HOME.y, z: chunks[2].z }, chunks), 0.25, chunks);
    assert.equal(e.action, 'dragging', 'moving past a nearer piece does not choose it');
  }
  e = releaseBucket(moveBucket(e, chunks[2], chunks), false, chunks);
  for (let t = 0; t < 2; t += 1 / 60) e = advanceExcavator(e, 1 / 60, chunks);
  assert.equal(e.action, 'carrying'); assert.equal(e.carried, 2);
  const cancel = releaseBucket(moveBucket(grabBucket(advanceExcavator(createExcavator(), 1, chunks)), chunks[2], chunks), true, chunks);
  assert.equal(advanceExcavator(cancel, 2, chunks).carried, null);
});

test('malformed round and piece identities are rejected instead of duplicating or losing cargo', () => {
  const state = createRoad();
  for (const round of [null, { pattern: 'unknown', layout: 0 }, { pattern: 'split', layout: 2 }]) assert.equal(restore({ ...state, round }), undefined);
  for (const e of [
    { cleared: 2, delivered: [1, 1] }, { cleared: 1, delivered: [3] }, { cleared: 1, delivered: [] },
    { action: 'carrying', carried: null }, { action: 'carrying', carried: 1, cleared: 1, delivered: [1] },
    { carried: 2 }, { action: 'complete', cleared: 0 },
  ]) assert.equal(restore({ ...state, excavator: { ...state.excavator, ...e } }), undefined);
  assert.equal(restore({ ...state, version: 2 }), undefined);
});
