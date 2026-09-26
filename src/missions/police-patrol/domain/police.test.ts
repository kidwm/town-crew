import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPolice, chooseRound, resumePolice, stages, jobs, grab, drive, release, advance, available, routes, pathPose, guardRoute, suspectRoute, boardingRoute, vanDoorSide, side, entry } from './police.ts';
import type { PoliceState, Vehicle, Round } from './police.ts';
const round: Round = { layout: 0, color: 0, body: 'car', bag: 0 };
const tick = (s: PoliceState, seconds: number) => { for (let i = 0; i < seconds * 60; i++) s = advance(s, 1 / 60); return s; };
function finish(s: PoliceState, vehicle = available(s)[0]) { return tick(drive(grab(s, vehicle), 1), 20); }
for (let layout = 0; layout < 4; layout++) for (const first of ['bike0', 'bike1'] as const) {
  test(`layout ${layout}, ${first} first: cooperate, clear access, board, escort and restore`, () => {
    let s = createPolice('intro', { ...round, layout, body: layout % 2 ? 'van' : 'car' });
    s = tick(s, 4); assert.equal(s.phase, 'pursuit');
    s = finish(s); assert.equal(s.phase, 'bikes');
    s = finish(s, first); assert.equal(s.phase, 'bikes'); assert.deepEqual(s.order, [first]);
    s = resumePolice(s)!; assert.ok(s);
    s = finish(s); assert.equal(s.phase, 'clearance'); assert.equal(s.order.length, 2);
    assert.equal(grab(s, 'van'), s); // Nobody can drive the van before the police clears access.
    for (const next of ['van', 'door', 'lead', 'transport', 'complete']) { s = finish(s); assert.equal(s.phase, next); assert.ok(resumePolice(s)); }
    assert.ok(jobs.every(j => s.work[j] === 1)); assert.deepEqual(available(s), []);
    assert.deepEqual(resumePolice(s), s);
  });
}
test('new rounds change the route configuration even with a constant random source', () => {
  let last = round;
  for (let i = 0; i < 100; i++) { const next = chooseRound(last, () => 0); assert.notEqual(next.layout, last.layout); assert.notEqual(next.color, last.color); last = next; }
  const seen = new Set(Array.from({ length: 4 }, (_, i) => chooseRound(undefined, () => i / 4).layout)); assert.equal(seen.size, 4);
});
test('partial driving and a partial sliding door survive cancellation and reload without autonomous movement', () => {
  for (const phase of ['pursuit', 'bikes', 'clearance', 'van', 'door', 'lead', 'transport'] as const) {
    let s = tick(drive(grab(createPolice(phase, round), available(createPolice(phase, round))[0]), 0.55), 2);
    const work = { ...s.work }; s = release(s); assert.deepEqual(s.work, work);
    s = resumePolice(s)!; assert.ok(s); assert.equal(s.action, 'ready'); assert.deepEqual(tick(s, 5).work, work);
    s = finish(s); assert.notEqual(s.action, 'dragging');
  }
});
test('a tap, a wrong vehicle or invalid movement never advances work', () => {
  const initial = createPolice('pursuit', round);
  assert.equal(grab(initial, 'van'), initial);
  assert.deepEqual(release(tick(grab(initial, 'police'), 3), false), initial);
  const held = grab(initial, 'police'); assert.equal(drive(held, NaN), held); assert.equal(advance(held, Infinity), held);
  assert.equal(advance(initial, -1), initial);
});
test('cancelled docking can be resumed, and a committed bike cannot be reused by the old pointer', () => {
  let s = drive(grab(createPolice('bikes', round), 'bike1'), 1);
  while (s.work.bike1 < 1) s = advance(s, 0.01);
  s = release(s, true); assert.equal(s.order.length, 0); assert.ok(available(s).includes('bike1'));
  s = resumePolice(s)!; s = tick(grab(s, 'bike1'), 0.5); assert.deepEqual(s.order, ['bike1']);
  const before = s; s = drive(s, 1); assert.equal(s, before); assert.equal(grab(s, 'bike1'), s);
});
test('all development entries are consistent and snapshots reject impossible handoffs', () => {
  for (const phase of stages) assert.ok(resumePolice(createPolice(phase, round)), phase);
  assert.equal(resumePolice({ ...createPolice('complete', round), work: { ...createPolice('complete', round).work, arrive: 0 } }), undefined);
  assert.equal(resumePolice({ ...createPolice('bikes', round), order: ['bike0', 'bike0'] }), undefined);
  assert.equal(resumePolice({ ...createPolice('pursuit', round), active: 'van', action: 'dragging' }), undefined);
  assert.equal(resumePolice({ ...createPolice('door', round), work: { ...createPolice('door', round).work, escort: 0.4 } }), undefined);
  assert.equal(resumePolice({ ...createPolice('intro', round), action: 'ready' }), undefined);
  assert.equal(resumePolice({ ...createPolice('van', round), round: { ...round, layout: 9 } }), undefined);
  assert.equal(resumePolice({ ...createPolice('pursuit', round), work: { ...createPolice('pursuit', round).work, unknown: 1 } }), undefined);
  assert.equal(resumePolice(null), undefined);
});
test('four street-block configurations keep a camera-facing side door and a clear transport route', () => {
  for (let layout = 0; layout < 4; layout++) {
    const r = { ...round, layout }, paths = routes(r), s = side(r), e = entry(r);
    assert.deepEqual(paths.follow.at(-1), paths.yield[0]); assert.deepEqual(paths.bike0.at(-1), paths.lead[0]); assert.deepEqual(paths.arrive.at(-1), paths.escort[0]);
    assert.equal(paths.arrive[0].x, e * 13); assert.equal(paths.escort.at(-1)!.x, -e * 16);
    const parked = pathPose(paths.arrive, 1), departing = pathPose(paths.escort, 0);
    assert.equal(parked.z, 7); assert.equal(parked.yaw, departing.yaw);
    assert.ok(Math.cos(parked.yaw) * vanDoorSide(r) > 0.99, 'door must face the foreground');
    assert.ok(paths.arrive.every(p => p.z === parked.z), 'van must enter side-on');
    assert.ok(Math.abs(paths.yield.at(-1)!.x) > 4);
    assert.ok(Math.abs(guardRoute(r).at(-1)!.x) > 2.8);
    assert.equal(suspectRoute(r).at(-1)!.x, s * 5);
    for (let i = 0; i <= 200; i++) {
      const bike = pathPose(paths.lead, i / 200);
      assert.ok(Math.abs(bike.x) > 3.7 || Math.abs(bike.z - parked.z) > 2.4, `leader crossed parked van in ${layout} at ${i}`);
      const person = pathPose(boardingRoute(r), i / 200);
      if (Math.abs(person.x) < 2.5 && Math.abs(person.z - parked.z) < 1.2) {
        assert.ok(Math.abs(person.x - e * 0.58) < 0.01 && person.z > parked.z, 'boarding must enter through the visible door');
      }
    }
  }
});
// Separating-axis footprints catch vehicles cutting through block corners even
// when their centre points stay on the road. Dimensions include the body/mirrors.
function overlaps(p: { x: number; z: number; yaw: number }, length: number, width: number, x: number, z: number, depth: number) {
  const u = { x: Math.cos(p.yaw), z: -Math.sin(p.yaw) }, v = { x: -u.z, z: u.x };
  return [u, v, { x: 1, z: 0 }, { x: 0, z: 1 }].every(a => {
    const projected = Math.abs(u.x * a.x + u.z * a.z) * length / 2 + Math.abs(v.x * a.x + v.z * a.z) * width / 2;
    return Math.abs((p.x - x) * a.x + (p.z - z) * a.z) < projected + Math.abs(a.x) * 5.3 / 2 + Math.abs(a.z) * depth / 2;
  });
}
test('all four route plans keep whole vehicles outside the four building footprints', () => {
  for (let layout = 0; layout < 4; layout++) {
    const r = { ...round, layout }, paths = { ...routes(r), suspect: suspectRoute(r), guard: guardRoute(r), boarding: boardingRoute(r) };
    for (const [key, path] of Object.entries(paths)) for (let step = 0; step <= 250; step++) {
      const p = pathPose(path, step / 250), bike = ['bike0', 'bike1', 'lead', 'guard'].includes(key), van = ['arrive', 'escort', 'suspect'].includes(key);
      for (const x of [-6.3, 6.3]) for (const [z, depth] of [[-4.5, 2.4], [3.9, 1.95]]) {
        assert.ok(!overlaps(p, key === 'boarding' ? 0.45 : bike ? 2.5 : van ? 4.65 : 3.35, key === 'boarding' ? 0.45 : bike ? 1.35 : van ? 2.04 : 1.8, x, z, depth), `${layout}/${key}/${step} entered building ${x},${z}`);
      }
    }
  }
});
