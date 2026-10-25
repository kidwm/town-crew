import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTransit, chooseRound, resumeTransit, grab, drive, release, advance, moveLuggage, stages, available, currentVehicle, progress, coachHasLeft, luggageAboard } from './transit.ts';
import type { TransitState } from './transit.ts';
import { arrivalRoute, exitRoute, entranceRoute, entrancePose, finalEntrancePose, pathPose, passengerRoute, walkPose, holding, cargoTarget, dock, berth, doorLocal, ROAD, STATION, ENTRANCE, FINAL_ENTRANCE_SECONDS, MAIN_PLATFORM, HOLDING_BAYS, BAY_DIVIDER, platformOutline, loadingOutline, holdingOutline, finalVehicle, stowedLuggage } from './terminal.ts';
import type { Vehicle, Transfer, Round, Point } from './terminal.ts';
import { createShapes } from '../../../runtime/geometry.ts';
import { createBus, createTaxi, createSuitcase } from '../vehicles.ts';
import { createTransferCamera, resizeTransferCamera } from '../view.ts';
function auto(s: TransitState) { for (let n = 0; s.action === 'auto' && n < 300; n++) s = advance(s, 0.1); assert.notEqual(s.action, 'auto'); return s; }
function travel(s: TransitState, v = currentVehicle(s)) {
  s = drive(grab(s, v), 1); for (let n = 0; s.action === 'dragging' && n < 300; n++) s = advance(s, 0.1);
  assert.notEqual(s.action, 'dragging'); return s;
}
function door(s: TransitState) { return drive(grab(s, currentVehicle(s)), 1); }
for (const layout of [0, 1] as const) for (const companion of ['school', 'coach'] as const) for (const order of [['taxi', companion], [companion, 'taxi']] as Transfer[][]) {
  test(`complete transfer layout ${layout}, ${order.join(' then ')}, restoring every phase`, () => {
    let s = createTransit('intro', { layout, palette: 2, cast: 1, companion }), last = 0, loads = 0;
    function check() {
      assert.ok(progress(s) >= last); last = progress(s);
      const restored = resumeTransit(JSON.parse(JSON.stringify(s))); assert.ok(restored, s.phase); assert.deepEqual(restored, s);
    }
    s = auto(s); check(); s = travel(s); check(); s = door(s); check(); s = auto(s); check(); s = travel(s); check(); s = auto(s); check();
    assert.deepEqual(available(s), ['taxi', companion]);
    function load() {
      loads++; assert.equal(currentVehicle(s), 'coach'); assert.equal(s.phase, 'luggage'); check();
      s = moveLuggage(grab(s, 'coach'), cargoTarget(s.round), true); s = advance(s, 0.4); check();
    }
    for (const v of order) {
      s = travel(s, v); check(); assert.equal(s.selected, v);
      s = door(s); check(); if (v === 'coach') load(); s = auto(s); check(); s = travel(s); check(); s = auto(s); check();
      assert.equal(s.order.at(-1), v);
      assert.equal(coachHasLeft(s), s.order.includes('coach'));
    }
    assert.equal(s.phase, 'coach-arrival'); s = travel(s); s = door(s); check();
    if (finalVehicle(s.round) === 'coach') load();
    s = auto(s); check(); assert.equal(s.phase, 'coach-exit'); s = travel(s); s = auto(s); check();
    assert.equal(s.phase, 'complete'); assert.equal(progress(s), 1); assert.deepEqual(s.order, order); assert.deepEqual(available(s), []); assert.equal(loads, 1);
    assert.deepEqual(advance(s, 20), s);
  });
}
test('taps do not select a transfer vehicle; cancelled partial driving preserves the actual position', () => {
  const initial = createTransit('choose'); assert.equal(release(grab(initial, 'school'), false).phase, 'choose');
  let s = advance(drive(grab(initial, 'school'), 0.5), 0.5); assert.ok(s.travel > 0 && s.travel < 0.5);
  const fraction = s.travel; s = resumeTransit(s)!;
  assert.equal(s.phase, 'transfer-arrival'); assert.equal(s.selected, 'school'); assert.equal(s.action, 'ready'); assert.equal(s.travel, fraction); assert.equal(s.aim, 0);
  assert.equal(advance(s, 3).travel, fraction); assert.equal(travel(s).phase, 'transfer-door');
});
test('a resumed vehicle near the berth aligns automatically, while a tap or distant release cannot park it', () => {
  const initial = { ...createTransit('bus-arrival'), travel: 0.983 };
  assert.equal(release(grab(initial, 'bus'), false).phase, 'bus-arrival');
  assert.equal(advance(drive(grab(initial, 'bus'), 1), 0.01).phase, 'bus-door');
  const distant = advance(drive(grab(createTransit('bus-arrival'), 'bus'), 1), 0.1);
  assert.equal(release(distant, false).phase, 'bus-arrival'); assert.ok(distant.travel < 0.2);
});
test('each car door keeps partial work after release, cancellation and reload; stale moves cannot depart', () => {
  for (const phase of ['bus-door', 'transfer-door', 'coach-door'] as const) {
    let s = createTransit(phase); const vehicle = currentVehicle(s);
    s = drive(grab(s, vehicle), 0.38); s = release(s, true); s = resumeTransit(s)!;
    assert.equal(s.doors[vehicle], 0.38); assert.equal(s.phase, phase); assert.equal(s.action, 'ready');
    s = door(s); const committed = s; assert.deepEqual(drive(s, 1), committed);
    s = auto(s); assert.equal(s.action, 'ready'); assert.deepEqual(drive(s, 1), s);
  }
});
test('luggage needs a committed dwell or valid release; interruption retains position and clears dwell', () => {
  let s = grab(createTransit('luggage'), 'coach');
  const moved = { x: 0, y: 0.6, z: 2.1 };
  s = moveLuggage(s, moved, true); s = advance(s, 0.2); const restored = resumeTransit(s)!;
  assert.deepEqual(restored.luggage, moved); assert.equal(restored.elapsed, 0); assert.equal(restored.action, 'ready');
  s = moveLuggage(grab(restored, 'coach'), moved, false); s = advance(s, 0.8); assert.equal(s.phase, 'luggage');
  s = release(s, false); assert.equal(s.phase, 'luggage');
  s = release(moveLuggage(grab(s, 'coach'), moved, true), true); assert.equal(s.phase, 'luggage');
  s = release(moveLuggage(grab(s, 'coach'), moved, true), false); assert.equal(s.phase, 'loading');
  s = advance(s, 0.5); const saved = resumeTransit(s)!; assert.equal(saved.elapsed, 0.5); assert.equal(saved.phase, 'loading');
  s = auto(saved); assert.equal(s.phase, 'coach-exit'); assert.deepEqual(s.luggage, cargoTarget(s.round));
});
test('a held pointer cannot start boarding, the next transfer or the luggage drag', () => {
  let s = travel(createTransit('bus-arrival')); assert.equal(s.phase, 'bus-door'); assert.deepEqual(drive(s, 1), s);
  s = door(s); s = auto(s); assert.deepEqual(drive(s, 1), s);
  s = auto(travel(s)); s = auto(travel(auto(door(travel(s, 'taxi'))))); assert.equal(s.phase, 'choose');
  assert.deepEqual(drive(s, 1), s); assert.deepEqual(release(s, false), s);
  s = door(createTransit('coach-door')); assert.equal(s.phase, 'luggage'); assert.deepEqual(moveLuggage(s, cargoTarget(s.round), true), s);
});
test('development entries and all automatic animation clocks resume without rerolling', () => {
  for (const companion of ['school', 'coach'] as const) for (const phase of stages) {
    const s = createTransit(phase, { layout: 1, palette: 3, cast: 2, companion });
    assert.deepEqual(resumeTransit(s), s, phase);
    if (s.action === 'auto') { const partial = advance(s, 0.31); assert.deepEqual(resumeTransit(partial), partial, phase); }
  }
});
test('new rounds always change layout and palette, while restore keeps the same round', () => {
  for (const layout of [0, 1] as const) for (const n of [0, 0.3, 0.99]) {
    const previous: Round = { layout, palette: 2, cast: 1 }, round = chooseRound(previous, () => n);
    assert.notEqual(round.layout, layout); assert.notEqual(round.palette, 2); assert.deepEqual(resumeTransit(createTransit('luggage', round))!.round, round);
  }
});
test('fresh rounds can pair either large vehicle with the taxi and keep the choice through restore', () => {
  for (const [random, expected] of [[0, 'school'], [0.99, 'coach']] as const) {
    const round = chooseRound(undefined, () => random); assert.equal(round.companion, expected);
    const state = createTransit('choose', round), restored = resumeTransit(state)!;
    assert.deepEqual(available(restored), ['taxi', expected]); assert.equal(restored.round.companion, expected);
    assert.equal(finalVehicle(restored.round), expected === 'school' ? 'coach' : 'school');
  }
});
test('stowed luggage stays wholly inside the coach compartment throughout both exit routes', () => {
  const shapes = createShapes(), suitcase = createSuitcase(shapes); suitcase.root.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  suitcase.root.children.filter(child => child !== suitcase.hit).forEach(child => bounds.expandByObject(child));
  const corners = [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y => [bounds.min.z, bounds.max.z].map(z => new THREE.Vector3(x, y, z))));
  for (const layout of [0, 1] as const) for (let n = 0; n <= 300; n++) {
    const pose = pathPose(exitRoute({ layout, palette: 0, cast: 0 }, 'coach'), n / 300), bag = stowedLuggage(pose);
    const bagTransform = new THREE.Matrix4().compose(new THREE.Vector3(bag.x, bag.y, bag.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(bag.tilt, bag.yaw, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
    const coachInverse = new THREE.Matrix4().compose(new THREE.Vector3(pose.x, 0.06, pose.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw), new THREE.Vector3(1, 1, 1)).invert();
    for (const corner of corners) {
      const p = corner.clone().applyMatrix4(bagTransform).applyMatrix4(coachInverse);
      assert.ok(p.x > -1.54 && p.x < 0.34 && p.y > 0.59 && p.y < 1.25 && p.z > -0.81 && p.z < 1.25, `layout ${layout}, fraction ${n / 300}: ${p.toArray()}`);
    }
  }
  for (const companion of ['school', 'coach'] as const) {
    const s = createTransit(companion === 'coach' ? 'transfer-exit' : 'coach-exit', { layout: 0, palette: 0, cast: 0, companion });
    if (companion === 'coach') s.selected = 'coach';
    assert.ok(luggageAboard(s)); assert.ok(luggageAboard(resumeTransit(s)!));
  }
  suitcase.root.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); shapes.disposeMaterials();
});
test('malformed or contradictory snapshots are rejected', () => {
  const changes = [
    { version: 5 }, { round: { layout: 4, palette: 0, cast: 0 } }, { round: { layout: 0, palette: 0, cast: 0, companion: 'bus' } }, { phase: 'unknown' }, { action: 'auto' }, { order: ['taxi', 'taxi'] }, { order: ['coach'] }, { order: [] },
    { selected: 'school' }, { elapsed: -1 }, { elapsed: 4 }, { travel: NaN }, { aim: 9 }, { doors: { bus: 0, taxi: 0, school: 0, coach: 0.4 } }, { luggage: { x: Infinity, y: 0.5, z: 3 } },
  ];
  for (const change of changes) assert.equal(resumeTransit({ ...createTransit('luggage'), ...change }), undefined, JSON.stringify(change));
  assert.equal(resumeTransit({ ...createTransit('boarding'), order: ['taxi'] }), undefined);
  assert.equal(resumeTransit({ ...createTransit('complete'), order: ['taxi'] }), undefined);
});

interface Rectangle { x: number; z: number; hx: number; hz: number; yaw: number }
function rectanglePoints(r: Rectangle): Point[] {
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => ({ x: r.x + x * r.hx * Math.cos(r.yaw) + z * r.hz * Math.sin(r.yaw), z: r.z - x * r.hx * Math.sin(r.yaw) + z * r.hz * Math.cos(r.yaw) }));
}
function overlap(a: Point[], b: Point[]) {
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length], x = q.z - p.z, z = p.x - q.x;
    const ap = a.map(p => p.x * x + p.z * z), bp = b.map(p => p.x * x + p.z * z);
    if (Math.max(...ap) <= Math.min(...bp) || Math.max(...bp) <= Math.min(...ap)) return false;
  }
  return true;
}
function inside(p: Point, polygon: Point[]) {
  const crosses = polygon.map((a, i) => { const b = polygon[(i + 1) % polygon.length]; return (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x); });
  return crosses.every(v => v >= -1e-9) || crosses.every(v => v <= 1e-9);
}
test('whole vehicles clear both platforms, the station and waiting vehicles on entrance, approach and departure', () => {
  const shapes = createShapes(), models = { taxi: createTaxi(shapes), school: createBus(shapes, 'school'), coach: createBus(shapes, 'coach'), bus: createBus(shapes, 'bus') };
  const bounds = Object.fromEntries(Object.entries(models).map(([v, model]) => { model.root.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(model.root); return [v, { hx: Math.max(Math.abs(box.max.x), Math.abs(box.min.x)), hz: Math.max(Math.abs(box.max.z), Math.abs(box.min.z)) }]; })) as Record<Vehicle, { hx: number; hz: number }>;
  for (const layout of [0, 1] as const) for (const companion of ['school', 'coach'] as const) for (const vehicle of ['taxi', 'school', 'bus', 'coach'] as const) {
    const round: Round = { layout, palette: 0, cast: 0, companion }, d = dock(round);
    const paved = [loadingOutline(), holdingOutline()].map(polygon => polygon.map(p => ({ ...p, x: p.x + d.x })));
    const obstacles = [rectanglePoints({ ...STATION, hx: 3.6, hz: 1.5, yaw: 0 }), platformOutline().map(p => ({ ...p, x: p.x + d.x })), rectanglePoints({ x: d.x + (BAY_DIVIDER.left + BAY_DIVIDER.right) / 2, z: (BAY_DIVIDER.back + BAY_DIVIDER.front) / 2, hx: (BAY_DIVIDER.right - BAY_DIVIDER.left) / 2, hz: (BAY_DIVIDER.front - BAY_DIVIDER.back) / 2, yaw: 0 })];
    if (vehicle === 'taxi' || vehicle === companion) { const other = vehicle === 'taxi' ? companion : 'taxi'; obstacles.push(rectanglePoints({ ...holding(round, other), ...bounds[other], yaw: 0 })); }
    const paths = [arrivalRoute(round, vehicle), exitRoute(round, vehicle)];
    if (vehicle !== 'bus') paths.push(entranceRoute(round, vehicle));
    for (const [leg, path] of paths.entries()) for (let n = 0; n <= 300; n++) {
      const p = pathPose(path, n / 300), body = { ...p, ...bounds[vehicle] };
      const footprint = rectanglePoints(body);
      for (const obstacle of obstacles) assert.ok(!overlap(footprint, obstacle), `${vehicle}, layout ${layout}, leg ${leg}, fraction ${n / 300}: ${JSON.stringify(p)}`);
      for (const corner of footprint) assert.ok(corner.z >= ROAD.back && corner.z <= ROAD.front || paved.some(polygon => inside(corner, polygon)), `off pavement: ${vehicle}, layout ${layout}, leg ${leg}, fraction ${n / 300}: ${JSON.stringify(corner)}`);
      assert.ok(Math.abs(p.yaw) <= Math.PI / 3 + 1e-9, 'all vehicles merge diagonally without a U-turn');
      if (n) assert.ok(p.x >= pathPose(path, (n - 1) / 300).x, 'station traffic always moves left to right');
    }
  }
  Object.values(models).forEach(m => m.root.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); })); shapes.disposeMaterials();
});
test('both loading bays and rear waiting spaces lie completely outside the one-way through lane', () => {
  for (const layout of [0, 1] as const) {
    const round: Round = { layout, palette: 0, cast: 0 }, taxi = berth(round, 'taxi'), bus = berth(round, 'bus');
    assert.ok(Math.abs(taxi.x - bus.x) > 7); assert.ok(taxi.z > ROAD.front + 1);
    const parked = pathPose(arrivalRoute(round, 'taxi'), 1); assert.equal(parked.x, taxi.x); assert.equal(parked.z, taxi.z); assert.equal(parked.yaw, 0);
    const exit = exitRoute(round, 'taxi');
    for (const vehicle of ['bus', 'school', 'coach'] as const) assert.equal(exit.at(-1)!.z, exitRoute(round, vehicle).at(-1)!.z);
    for (let n = 0; n <= 300; n++) {
      const p = pathPose(exit, n / 300);
      assert.ok(p.z >= ROAD.outbound - 1e-9, 'the taxi merges smoothly into the one-way lane');
      if (p.x >= exit.at(-2)!.x) { assert.ok(Math.abs(p.z - ROAD.outbound) < 1e-9); assert.ok(Math.abs(p.yaw) < 1e-9); }
    }
    const route = passengerRoute(round, 'taxi', 0);
    assert.ok(route.slice(0, 4).every(p => p.z >= MAIN_PLATFORM.curbZ));
    const gap = MAIN_PLATFORM.curbZ - (taxi.z + doorLocal.taxi.z);
    assert.ok(gap > 0.2 && gap <= 0.6, 'the platform must stay close to the actual rear passenger door');
    assert.equal(route.at(-1)!.z, taxi.z + 0.38);
    for (const v of ['bus', 'school', 'coach'] as const) { const p = berth(round, v); assert.ok(p.z - 1.5 > ROAD.front); assert.ok(p.z + 1.5 < MAIN_PLATFORM.curbZ); }
    for (const v of ['school', 'coach'] as const) { const p = holding(round, v); assert.ok(p.z + 1.6 < ROAD.back); assert.ok(p.z - 1.6 > HOLDING_BAYS.back); }
  }
});
test('every passenger stays on the continuous platform until their boarding step', () => {
  for (const layout of [0, 1] as const) {
    const round: Round = { layout, palette: 0, cast: 0 }, d = dock(round);
    const main = platformOutline().map(p => ({ ...p, x: p.x + d.x }));
    for (const vehicle of ['bus', 'taxi', 'school', 'coach'] as const) for (const id of vehicle === 'bus' ? [0, 1, 2, 3, 4, 5] : vehicle === 'taxi' ? [0, 1] : vehicle === 'school' ? [2, 3] : [4, 5]) {
      const path = passengerRoute(round, vehicle, id);
      for (let n = 0; n <= 200; n++) {
        const p = walkPose(path, n / 200);
        if (Math.abs(p.y - 0.16) < 1e-6) assert.ok(inside(p, main), `${vehicle}, passenger ${id}, layout ${layout}, fraction ${n / 200}`);
      }
    }
  }
});
test('the one-way through lane is wide enough for every unchanged vehicle model', () => {
  assert.ok(Math.abs((ROAD.back + ROAD.front) / 2 - ROAD.centre) < 1e-9);
  assert.ok(Math.abs(ROAD.front - ROAD.centre - (ROAD.centre - ROAD.back)) < 1e-9);
  assert.equal(ROAD.outbound, ROAD.centre);
  assert.ok(ROAD.front - ROAD.back >= 5);
});
test('both cars drive into view before choice opens; entrance clocks resume without enabling input', () => {
  const s = createTransit('transfer-entrance'); assert.deepEqual(available(s), []); assert.equal(grab(s, 'taxi'), s);
  const partial = advance(s, 2.2); assert.deepEqual(resumeTransit(partial), partial);
  for (const v of ['taxi', 'school'] as const) {
    const first = entrancePose(s.round, v, 0), last = entrancePose(s.round, v, ENTRANCE.duration);
    assert.ok(Math.hypot(first.x - last.x, first.z - last.z) > 10); assert.ok(Math.abs(last.x - holding(s.round, v).x) < 1e-9); assert.ok(Math.abs(last.z - holding(s.round, v).z) < 1e-9);
    const seconds = v === 'school' ? 1.5 : 4.2, moving = entrancePose(s.round, v, seconds);
    assert.ok(moving.distance > 0); assert.ok(Math.hypot(moving.x - last.x, moving.z - last.z) > 0.1); assert.equal(moving.visible, true);
  }
  const chosen = auto(partial); assert.equal(chosen.phase, 'choose'); assert.deepEqual(available(chosen), ['taxi', 'school']);
});
test('staggered taxi and either companion never overlap on their shared one-way approach', () => {
  for (const layout of [0, 1] as const) for (const companion of ['school', 'coach'] as const) for (const edge of [26, 40]) {
    const round: Round = { layout, palette: 0, cast: 0, companion };
    for (let n = 0; n <= 400; n++) {
      const elapsed = ENTRANCE.duration * n / 400, taxi = entrancePose(round, 'taxi', elapsed, edge), other = entrancePose(round, companion, elapsed, edge);
      if (taxi.visible && other.visible) assert.ok(!overlap(rectanglePoints({ ...taxi, hx: 1.98, hz: 1.13 }), rectanglePoints({ ...other, hx: companion === 'school' ? 3.41 : 3.81, hz: 1.61 })), `layout ${layout}, companion ${companion}, time ${elapsed}`);
    }
  }
});
test('obsolete transit versions and missing companion are rejected without migration', () => {
  for (const phase of ['choose', 'transfer-door', 'coach-arrival', 'complete'] as const) {
    const current = createTransit(phase);
    if (phase === 'transfer-door') current.doors.taxi = 0.4;
    assert.deepEqual(resumeTransit(current), current);
    for (const version of [1, 2, 3]) assert.equal(resumeTransit({ ...current, version }), undefined);
    const { companion, ...round } = current.round;
    assert.equal(resumeTransit({ ...current, round }), undefined);
  }
});

test('the remaining large vehicle enters after the pair leaves and resumes its clock before child input', () => {
  for (const companion of ['school', 'coach'] as const) for (const last of ['taxi', companion] as const) {
    const first = last === 'taxi' ? companion : 'taxi';
    const departing = { ...createTransit('transfer-departure', { layout: 0, palette: 0, cast: 0, companion }), selected: last, order: [first] as Transfer[] };
    assert.deepEqual(available(departing), []);
    const entrance = advance(departing, 2); assert.equal(entrance.phase, 'coach-entrance'); assert.deepEqual(entrance.order, [first, last]);
    const final = finalVehicle(entrance.round), partial = advance(entrance, 1.3); assert.deepEqual(resumeTransit(partial), partial); assert.equal(grab(partial, final), partial);
    const start = finalEntrancePose(partial.round, 0), moving = finalEntrancePose(partial.round, partial.elapsed), end = finalEntrancePose(partial.round, FINAL_ENTRANCE_SECONDS);
    assert.ok(start.x < moving.x && moving.x < end.x); assert.ok(Math.abs(end.x - arrivalRoute(partial.round, final)[0].x) < 1e-9); assert.ok(Math.abs(end.yaw) < 1e-9);
    const ready = auto(partial); assert.equal(ready.phase, 'coach-arrival'); assert.equal(ready.travel, 0); assert.deepEqual(available(ready), [final]);
    assert.ok(progress(entrance) >= progress(departing)); assert.ok(progress(ready) >= progress(partial));
  }
});
test('the compact fixed view keeps whole approaches visible and makes the taxi large enough on phones', () => {
  const shapes = createShapes(), models = { taxi: createTaxi(shapes), school: createBus(shapes, 'school'), coach: createBus(shapes, 'coach'), bus: createBus(shapes, 'bus') };
  for (const [width, height] of [[390, 620], [390, 844], [743, 549], [980, 720], [1280, 800], [844, 390]]) {
    const camera = createTransferCamera(); resizeTransferCamera(camera, width / height);
    for (const layout of [0, 1] as const) for (const vehicle of ['taxi', 'school', 'bus', 'coach'] as const) {
      const model = models[vehicle]; model.root.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(model.root);
      const path = arrivalRoute({ layout, palette: 0, cast: 0 }, vehicle);
      for (let n = 0; n <= 150; n++) {
        const p = pathPose(path, n / 150), transform = new THREE.Matrix4().compose(new THREE.Vector3(p.x, 0.06, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw), new THREE.Vector3(1, 1, 1));
        const corners = [b.min.x, b.max.x].flatMap(x => [b.min.y, b.max.y].flatMap(y => [b.min.z, b.max.z].map(z => new THREE.Vector3(x, y, z).applyMatrix4(transform).project(camera))));
        for (const q of corners) assert.ok(Math.abs(q.x) < 0.95 && Math.abs(q.y) < 0.95, `${width}×${height}, ${vehicle}, layout ${layout}, fraction ${n / 150}`);
        if (vehicle === 'taxi' && width === 390 && n === 0) assert.ok((Math.max(...corners.map(q => q.x)) - Math.min(...corners.map(q => q.x))) * width / 2 >= 48);
      }
    }
  }
  Object.values(models).forEach(m => m.root.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); })); shapes.disposeMaterials();
});
