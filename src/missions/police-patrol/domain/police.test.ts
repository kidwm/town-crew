import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPolice, chooseRound, resumePolice, stages, jobs, grab, drive, release, advance, available, routes, pathPose, vehiclePose, inspectedPose, boardingRoute, inspectionWalk, vanDoorSide, direction, duration, inspectionKind, recoveryPose, crewStatus, CHECKPOINT } from './police.ts';
import type { PoliceState, Vehicle, Round } from './police.ts';
import { officerPose, inspectionCheckVisible, WANTED_CHECK_START } from './police.ts';
const round: Round = { layout: 0, color: 0, traffic: 'taxi-first' };
const tick = (s: PoliceState, seconds: number) => { for (let i = 0; i < seconds * 60; i++) s = advance(s, 1 / 60); return s; };
test('officer walks from standby before checking the wanted car and continuously escorts and boards', () => {
  for (const layout of [0, 1]) {
    const r = { ...round, layout }, s = createPolice('inspect', r, 'bike0', 2);
    const standby = officerPose({ ...s, checked: 1, elapsed: 4.4 });
    assert.deepEqual(officerPose(s), standby);
    assert.deepEqual(officerPose({ ...s, elapsed: 1.5 }), standby); // Wait until the car is parked.
    const walking = { ...s, elapsed: 2.2 }, midway = officerPose(walking);
    assert.ok(Math.abs(midway.x - standby.x) > 1);
    assert.deepEqual(officerPose(resumePolice(walking)!), midway);
    assert.equal(inspectionCheckVisible(walking), false);
    assert.equal(inspectionCheckVisible({ ...s, elapsed: WANTED_CHECK_START }), true);
    let previous = officerPose(s);
    for (let n = 1; n <= 720; n++) {
      const p = officerPose({ ...s, elapsed: n / 100 });
      assert.ok(Math.hypot(p.x - previous.x, p.z - previous.z, p.y - previous.y) < 0.07, `officer jumped at ${n / 100}`);
      previous = p;
    }
    for (const phase of ['van-arrival', 'van', 'door', 'boarding'] as const) {
      const next = officerPose(createPolice(phase, r));
      assert.ok(Math.hypot(next.x - previous.x, next.z - previous.z, next.y - previous.y) < 1e-8, `${phase} relocated the officer`);
      previous = next;
    }
    const boarding = createPolice('boarding', r);
    for (let n = 1; n <= 215; n++) {
      const p = officerPose({ ...boarding, elapsed: n / 100 });
      assert.ok(Math.hypot(p.x - previous.x, p.z - previous.z, p.y - previous.y) < 0.07, 'officer jumped while boarding');
      previous = p;
    }
  }
});
function finish(s: PoliceState, vehicle = available(s)[0]) { return tick(drive(grab(s, vehicle), 1), 24); }
for (const layout of [0, 1]) for (const selected of ['bike0', 'bike1'] as const) for (const traffic of ['taxi-first', 'freight-first'] as const) {
  test(`checkpoint ${layout}/${selected}/${traffic}: six gestures complete the inspection and transport`, () => {
    let s = tick(createPolice('intro', { ...round, layout, traffic }), 2);
    assert.equal(s.phase, 'setup');
    s = finish(s); assert.equal(s.phase, 'guard');
    assert.deepEqual(available(s), ['bike0', 'bike1']);
    s = finish(s, selected); assert.equal(s.phase, 'van'); assert.equal(s.selected, selected);
    assert.equal(s.work.guard, 1); assert.ok(resumePolice(s));
    for (const next of ['door', 'transport', 'tow', 'complete']) { s = finish(s); assert.equal(s.phase, next); assert.ok(resumePolice(s)); }
    assert.ok(jobs.every(j => s.work[j] === 1)); assert.equal(jobs.length, 6);
    assert.deepEqual(available(s), []); assert.deepEqual(resumePolice(s), s);
  });
}
test('new rounds alternate direction and change car colour even with a constant source', () => {
  let last = round;
  for (let i = 0; i < 40; i++) { const next = chooseRound(last, () => 0); assert.equal(next.layout, 1 - last.layout); assert.notEqual(next.color, last.color); assert.notEqual(next.traffic, last.traffic); last = next; }
});
test('all six gestures retain partial work on release, cancellation and reload', () => {
  for (const phase of ['setup', 'guard', 'van', 'door', 'transport', 'tow'] as const) {
    let s = createPolice(phase, round); s = tick(drive(grab(s, available(s)[0]), 0.55), 3);
    const work = { ...s.work }; s = resumePolice(s)!; assert.ok(s); assert.equal(s.action, 'ready');
    assert.deepEqual(tick(s, 5).work, work); assert.equal(s.active, null);
    assert.notEqual(finish(s).phase, phase);
  }
});
test('the chosen motorcycle owns a paused trip; taps do not lock a choice or open a door', () => {
  const start = createPolice('guard', round);
  assert.deepEqual(release(grab(start, 'bike1'), false), start);
  let s = tick(drive(grab(start, 'bike1'), 0.35), 2);
  s = resumePolice(s)!; assert.equal(s.selected, 'bike1'); assert.deepEqual(available(s), ['bike1']); assert.equal(grab(s, 'bike0'), s);
  const door = createPolice('door', round); assert.deepEqual(release(tick(grab(door, 'van'), 2), false), door);
  assert.equal(drive(door, NaN), door); assert.equal(advance(door, Infinity), door);
});
test('cancelled endpoint dwell cannot dispatch and old pointers cannot cross an automatic handoff', () => {
  let s = drive(grab(createPolice('guard', round), 'bike1'), 1);
  while (s.work.guard < 1) s = advance(s, 0.01);
  s = release(s, true); assert.equal(s.phase, 'guard'); s = resumePolice(s)!;
  s = tick(grab(s, 'bike1'), 0.5); assert.equal(s.phase, 'inspect'); assert.equal(drive(s, 1), s);
  s = tick(s, 18); assert.equal(s.phase, 'van'); assert.equal(drive(s, 1), s); assert.equal(grab(s, 'bike1'), s);
});
test('entry stages and automatic animation checkpoints resume exactly; versions 1 and 2 never migrate', () => {
  for (const phase of stages) {
    const s = createPolice(phase, round); assert.deepEqual(resumePolice(s), s, phase);
    if (duration(s)) { const partial = tick(s, duration(s) / 2); assert.deepEqual(resumePolice(partial), partial); }
  }
  for (const bad of [
    { ...createPolice(), version: 1 },
    { ...createPolice(), version: 2 },
    { ...createPolice('van'), checked: 1 },
    { ...createPolice('setup'), checked: 2 },
    { ...createPolice('inspect'), checked: 3 },
    { ...createPolice('complete'), selected: null },
    { ...createPolice('door'), work: { ...createPolice('door').work, escort: 0.5 } },
    { ...createPolice('setup'), selected: 'bike0' },
    { ...createPolice('guard'), action: 'dragging', active: 'bike1', selected: 'bike0' },
    { ...createPolice('van'), round: { ...round, layout: 3 } },
    { ...createPolice('intro'), action: 'ready' },
    { ...createPolice('setup'), work: { ...createPolice('setup').work, follow: 0 } },
    { ...createPolice('inspect'), elapsed: 8 },
  ]) assert.equal(resumePolice(bad), undefined);
});
test('both directions park the van sideways and board through the visible side door', () => {
  for (const layout of [0, 1]) {
    const r = { ...round, layout }, paths = routes(r), parked = pathPose(paths.arrive, 1);
    assert.deepEqual(paths.arrive.at(-1), paths.escort[0]);
    assert.equal(parked.yaw, pathPose(paths.escort, 0).yaw);
    assert.ok(Math.cos(parked.yaw) * vanDoorSide(r) > 0.99);
    assert.ok(paths.arrive.every(p => p.z === 4.3));
    assert.deepEqual(inspectionWalk(r).at(-1), boardingRoute(r)[0]);
    for (let i = 0; i <= 100; i++) {
      const p = pathPose(boardingRoute(r), i / 100);
      assert.ok(Math.abs(p.x + 0.58 * direction(r)) < 1e-7); assert.ok(p.z >= 4.55);
    }
  }
});
type Footprint = { x: number; z: number; yaw: number; length: number; width: number };
function overlaps(a: Footprint, b: Footprint) {
  const axes = [a, b].flatMap(p => [{ x: Math.cos(p.yaw), z: -Math.sin(p.yaw) }, { x: Math.sin(p.yaw), z: Math.cos(p.yaw) }]);
  const radius = (p: Footprint, n: { x: number; z: number }) => Math.abs(Math.cos(p.yaw) * n.x - Math.sin(p.yaw) * n.z) * p.length / 2 + Math.abs(Math.sin(p.yaw) * n.x + Math.cos(p.yaw) * n.z) * p.width / 2;
  return axes.every(n => Math.abs((a.x - b.x) * n.x + (a.z - b.z) * n.z) < radius(a, n) + radius(b, n));
}
test('whole vehicles and waiting passengers stay clear through both choices, directions and departures', () => {
  for (const layout of [0, 1]) for (const selected of ['bike0', 'bike1'] as const) for (const phase of ['bikes-arrival', 'guard', 'inspect', 'van-arrival', 'van', 'lead', 'transport', 'tow-arrival', 'tow', 'depart'] as const) {
    for (let step = 0; step <= 120; step++) {
      const s = createPolice(phase, { ...round, layout }, selected), t = step / 120;
      if (phase === 'guard') { s.selected = selected; s.work.guard = t; }
      if (phase === 'van') s.work.arrive = t;
      if (phase === 'tow') s.work.recover = t;
      if (phase === 'transport') s.work.escort = t;
      s.elapsed = duration(s) * t;
      const ids: Vehicle[] = ['police', 'bike0', 'bike1']; if (['van-arrival', 'van', 'lead', 'transport', 'tow-arrival', 'tow', 'depart'].includes(phase)) ids.push('van');
      if (['tow-arrival', 'tow', 'depart'].includes(phase)) ids.push('tow');
      const bodies: Footprint[] = ids.map(id => ({ ...vehiclePose(s, id), length: id === 'police' ? 3.44 : id === 'van' ? 4.72 : id === 'tow' ? 6.7 : 2.65, width: id === 'police' ? 2.02 : id === 'van' ? 2.34 : id === 'tow' ? 2.64 : 1.42 }));
      if (!['bikes-arrival', 'guard', 'depart'].includes(phase)) bodies.push({ ...inspectedPose(s), length: phase === 'inspect' ? 6.1 : 3.44, width: phase === 'inspect' ? 2.44 : 2.02 });
      for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) assert.ok(!overlaps(bodies[a], bodies[b]), `${layout}/${selected}/${phase}/${step}: ${a} crossed ${b}`);
      if (phase === 'van-arrival' || phase === 'van') for (const b of bodies) assert.ok(!overlaps(b, { ...boardingRoute(s.round)[0], yaw: 0, length: 0.6, width: 0.6 }), 'arriving van crossed waiting passenger');
    }
  }
});

test('the three inspections resume in sequence without repeating released vehicles', () => {
  for (const traffic of ['taxi-first', 'freight-first'] as const) {
    let s = createPolice('inspect', { ...round, traffic });
    const seen: string[] = [];
    for (let n = 0; n < 3; n++) {
      assert.equal(s.phase, 'inspect'); assert.equal(s.checked, n); seen.push(inspectionKind(s));
      s = tick(s, 2.2); s = resumePolice(s)!; assert.equal(s.checked, n);
      s = tick(s, duration(s) - s.elapsed + 0.02);
    }
    assert.deepEqual(seen, traffic === 'taxi-first' ? ['taxi', 'freight', 'wanted'] : ['freight', 'taxi', 'wanted']);
    assert.equal(s.phase, 'van-arrival'); assert.equal(s.checked, 2);
  }
});
test('four vehicle cards group van tasks and finish recovery only after the loaded truck leaves', () => {
  for (const phase of ['van-arrival', 'van', 'door', 'boarding', 'lead', 'transport'] as const) assert.deepEqual(crewStatus(createPolice(phase, round)), ['done', 'done', 'active', 'upcoming']);
  assert.deepEqual(crewStatus(createPolice('tow-load', round)), ['done', 'done', 'done', 'active']);
  assert.deepEqual(crewStatus(tick(createPolice('depart', round), 2.3)), ['done', 'done', 'done', 'done']);
});
test('recovery reverses into a clear ramp gap, raises the car and carries it continuously across reload', () => {
  for (const layout of [0, 1]) {
    const r = { ...round, layout }, d = direction(r), ready = createPolice('tow', r);
    const start = vehiclePose(ready, 'tow'), parked = vehiclePose({ ...ready, work: { ...ready.work, recover: 1 } }, 'tow');
    assert.ok((start.x - parked.x) * d > 2); assert.equal(start.yaw, parked.yaw);
    let prior = recoveryPose(createPolice('tow-load', r)).car;
    for (let step = 1; step < 580; step++) {
      const s = { ...createPolice('tow-load', r), elapsed: step / 100 }, pose = recoveryPose(s);
      assert.deepEqual(recoveryPose(resumePolice(s)!), pose);
      assert.ok(pose.car.y >= .07 && pose.car.pitch >= 0); assert.ok(Math.abs(pose.car.x - prior.x) < .04); assert.ok(Math.abs(pose.car.y - prior.y) < .04);
      prior = pose.car;
    }
    const loaded = createPolice('depart', r), p = recoveryPose(loaded);
    assert.ok(Math.abs(p.car.y - 1.1) < .001); assert.equal(p.car.pitch, 0); assert.equal(p.car.z, CHECKPOINT.z);
    const moving = recoveryPose(tick(loaded, 1)); assert.ok(Math.abs((moving.rig.x - moving.car.x) * d - 1.15) < 1e-6);
  }
});


test('crew arrivals resume mid-route and only unlock the next gesture after parking', () => {
  for (const layout of [0, 1]) for (const phase of ['bikes-arrival', 'van-arrival'] as const) {
    const initial = createPolice(phase, { ...round, layout });
    const ids: Vehicle[] = phase === 'bikes-arrival' ? ['bike0', 'bike1'] : ['van'];
    assert.deepEqual(available(initial), []);
    for (const id of ids) assert.equal(grab(initial, id), initial);
    const halfway = tick(initial, duration(initial) / 2), restored = resumePolice(halfway)!;
    assert.deepEqual(restored, halfway);
    for (const id of ids) assert.deepEqual(vehiclePose(restored, id), vehiclePose(halfway, id));
    assert.deepEqual(restored.work, initial.work); // Arrival adds no seventh manual task.
    const ready = tick(restored, duration(initial));
    assert.equal(ready.phase, phase === 'bikes-arrival' ? 'guard' : 'van');
    assert.deepEqual(available(ready), ids); assert.equal(ready.selected, initial.selected);
    for (const id of ids) {
      const end = vehiclePose({ ...initial, elapsed: duration(initial) }, id), start = vehiclePose(ready, id);
      assert.ok(Math.abs(end.x - start.x) < 1e-9); assert.equal(end.z, start.z); assert.equal(end.yaw, start.yaw);
    }
    assert.equal(drive(ready, 1), ready); // A held pointer from the prior task cannot drive the arriving crew.
  }
  assert.deepEqual(crewStatus(createPolice('bikes-arrival', round)), ['done', 'active', 'upcoming', 'upcoming']);
  const parked = createPolice('van', round); assert.deepEqual(resumePolice(parked), parked); // Complete current v3 saves keep their existing meaning.
});
