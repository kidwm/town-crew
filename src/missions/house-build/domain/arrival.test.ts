import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHouse, resumeHouse, advance, grab, leavingDuration, PARTS } from './house.ts';
import { DEFAULT_ROUND, siteX } from './round.ts';
import { ARRIVAL, GARAGE, SITE_FINISH_SECONDS, FAMILY_CAR_SCALE, arrivalCar, arrivalDoors, arrivingResident, arrivingPet, garageBuild } from './arrival.ts';

test('arrival resumes its precise clock, preserves the round and cannot be dragged or replay a completed home', () => {
  const round = { ...DEFAULT_ROUND, family: 2 as const, pet: 'dog' as const, layout: 1 as const };
  for (const elapsed of [0.5, 2.8, 4.3, 5.2, 7.6, 9.8]) {
    const state = { ...createHouse('decorate', round), elapsed };
    const restored = resumeHouse(JSON.parse(JSON.stringify(state)))!;
    assert.deepEqual(restored, state); assert.deepEqual(grab(restored), restored);
    assert.deepEqual(advance(restored, 0.02), advance(state, 0.02));
    assert.deepEqual(resumeHouse({ ...state, version: 4 }), state);
  }
  assert.equal(resumeHouse({ ...createHouse('decorate'), elapsed: ARRIVAL.duration }), undefined);
  for (const version of [1, 2, 3, 4, 5]) {
    const complete = resumeHouse({ ...createHouse('complete', round), version })!;
    assert.equal(advance(complete, 0.1).phase, 'complete');
    if (version >= 3) assert.deepEqual(complete.round, round);
  }
});

test('the whole turning car clears garage walls in both layouts and stops before anyone exits', () => {
  const parked = arrivalCar(ARRIVAL.parked);
  assert.deepEqual(arrivalCar(10), parked); assert.equal(parked.yaw, Math.PI / 2);
  assert.equal(arrivalDoors(ARRIVAL.parked), 0); assert.equal(arrivalDoors(6.4), 0);
  // Sample the actual body perimeter, not only its centre, against the garage
  // side/back walls and house. Opening width must accommodate the whole turn.
  for (const layout of [0, 1] as const) for (let step = 0; step <= 380; step++) {
    const p = arrivalCar(step / 100), round = { ...DEFAULT_ROUND, layout };
    for (let edge = 0; edge < 4; edge++) for (let i = 0; i <= 20; i++) {
      const a = i / 20 * 2 - 1;
      const x = (edge < 2 ? (edge ? -1 : 1) * 1.7 : a * 1.7) * FAMILY_CAR_SCALE;
      const z = (edge >= 2 ? (edge === 3 ? -1 : 1) * 0.98 : a * 0.98) * FAMILY_CAR_SCALE;
      const worldX = siteX(round, p.x + x * Math.cos(p.yaw) + z * Math.sin(p.yaw));
      const localX = siteX(round, worldX), worldZ = p.z - x * Math.sin(p.yaw) + z * Math.cos(p.yaw);
      if (worldZ < GARAGE.z + 1.95) {
        assert.ok(localX > GARAGE.x - 1.76 && localX < GARAGE.x + 1.76, `wall at ${step / 100}`);
        assert.ok(worldZ > GARAGE.z - 1.76, 'back wall');
      }
    }
  }
});

test('family and pets leave through the garage opening before walking across to the front door', () => {
  for (let i = 0; i < 4; i++) {
    assert.equal(arrivingResident(ARRIVAL.parked, i).seated, true);
    assert.equal(arrivingResident(ARRIVAL.duration, i).home, true);
    assert.ok(Math.abs(arrivingResident(ARRIVAL.duration, i).x - (1.1 + i * 0.65)) < 1e-9);
    for (let t = ARRIVAL.walk; t < ARRIVAL.duration; t += 0.02) {
      const p = arrivingResident(t, i);
      if (p.x > GARAGE.x + 1.6) assert.ok(p.z >= 2.5, 'walk in front of the garage side wall');
      assert.ok(p.z > -1.3, 'do not exit through the back wall');
      if (p.x > -0.6) assert.ok(p.z > 2.1, 'stay in front of the main house');
    }
  }
  const pet = arrivingPet(ARRIVAL.duration);
  assert.equal(pet.x, 3.7); assert.equal(pet.z, 2.65);
});

test('garage additions stay still during the main work and vehicle departures', () => {
  assert.deepEqual(garageBuild(createHouse()), { gravel: 0, slab: 0, walls: [0, 0], roof: 0 });
  assert.equal(garageBuild({ ...createHouse(), action: 'working', gravel: 0.9, elapsed: 1.8 }).gravel, 0);
  assert.equal(garageBuild({ ...createHouse('concrete'), action: 'dragging', pours: [1, 0.5, 1] }).slab, 0);
  for (const placed of [0, 1, 2]) {
    const first = { ...createHouse('crane-one'), placed, action: 'placing' as const, elapsed: 1.2 };
    assert.deepEqual(garageBuild(first).walls, [0, 0]); assert.equal(garageBuild(first).roof, 0);
  }
  assert.equal(garageBuild({ ...createHouse('crane-two'), placed: 5, action: 'placing', elapsed: 1.2 }).roof, 0);
  assert.deepEqual(garageBuild(createHouse('complete')), { gravel: 1, slab: 1, walls: [1, 1], roof: 1 });
  for (const part of PARTS) assert.ok(part.lift > GARAGE.height + 0.4, 'suspended part clears garage roof');
  assert.ok(-4.2 + 1.65 + 0.3 < GARAGE.z - GARAGE.depth / 2, 'extended crane legs clear the garage');
});

const handoffs = [
  { phase: 'gravel', next: 'concrete', placed: 0, before: [0, 0, 0, 0], after: [1, 0, 0, 0] },
  { phase: 'concrete', next: 'delivery-one', placed: 0, before: [1, 0, 0, 0], after: [1, 1, 0, 0] },
  { phase: 'crane-one', next: 'delivery-two', placed: 3, before: [1, 1, 0, 0], after: [1, 1, 1, 0] },
  { phase: 'crane-two', next: 'decorate', placed: 6, before: [1, 1, 1, 0], after: [1, 1, 1, 1] },
] as const;
for (const { phase, next, placed, before, after } of handoffs)
test(`${phase}: the departing vehicle leaves before garage work, then the next arrival begins; reload preserves the gap`, () => {
  const build = (values: readonly number[]) => ({ gravel: values[0], slab: values[1], walls: [values[2], values[2]], roof: values[3] });
  const s = { ...createHouse(phase), placed, gravel: 1, pours: phase === 'gravel' ? [0, 0, 0] : [1, 1, 1], action: 'leaving' as const };
  assert.deepEqual(garageBuild(s), build(before));
  const leaving = advance({ ...s, elapsed: leavingDuration(s) - 0.05 }, 0.02);
  assert.equal(leaving.action, 'leaving'); assert.deepEqual(garageBuild(leaving), build(before));
  const start = advance(leaving, 0.04);
  assert.equal(start.phase, phase); assert.equal(start.action, 'finishing'); assert.equal(start.elapsed, 0);
  assert.deepEqual(garageBuild(start), build(before));
  const halfway = { ...start, elapsed: SITE_FINISH_SECONDS / 2 };
  assert.deepEqual(garageBuild(halfway), build(before.map((v, i) => (v + after[i]) / 2)));
  const restored = resumeHouse(JSON.parse(JSON.stringify(halfway)))!;
  assert.deepEqual(restored, halfway); assert.equal(grab(restored), restored);
  assert.deepEqual(advance(restored, 0.02), advance(halfway, 0.02));
  const done = advance({ ...restored, elapsed: SITE_FINISH_SECONDS - 0.01 }, 0.02);
  assert.equal(done.phase, next); assert.equal(done.elapsed, 0);
  assert.equal(done.action, next === 'decorate' ? 'ready' : 'entering');
  assert.deepEqual(garageBuild(done), build(after));
  assert.equal(resumeHouse({ ...halfway, elapsed: SITE_FINISH_SECONDS }), undefined);
  assert.equal(resumeHouse({ ...halfway, version: 4 }), undefined);
  assert.equal(resumeHouse({ ...halfway, gravel: 0.5 }), undefined);
  assert.equal(resumeHouse({ ...halfway, placed: placed + 1 }), undefined);
});
