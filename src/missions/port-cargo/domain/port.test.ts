import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPort, chooseRound, resumePort, missionStages, available, distance, craneSource, craneTarget, forkHeight, pickupDuration, grab, drive, release, moveLoad, advance, progress, QUAY, forkPose, forkRoute, pickupRoute, quayFor, pathLength, mirror, ROAD_Z, FORK_OFFSET, LOADING_APPROACH, TRUCK_SLOTS, exitDistance } from './port.ts';
import type { PortState, Cargo, Point } from './port.ts';
function tick(s: PortState, seconds = 0.1) { for (let t = 0; t < seconds; t += 0.05) s = advance(s, 0.05); return s; }
function wait(s: PortState, predicate: (s: PortState) => boolean) {
  for (let i = 0; i < 1000 && !predicate(s); i++) s = advance(s, 0.05);
  assert.ok(predicate(s), `${s.phase}/${s.action} did not finish`); return s;
}
function driveToEnd(s: PortState, id?: Cargo) { return wait(drive(grab(s), 1, id), n => n.action !== 'dragging'); }
function cranePickup(s: PortState, id: Cargo) {
  return wait(wait(moveLoad(grab(s), craneSource(s, id), id), n => n.action === 'hoisting'), n => n.action === 'ready');
}
function unload(s: PortState, id: Cargo) { return cranePlace(s, id); }
function cranePlace(s: PortState, id: Cargo) { s = s.craneAttached ? s : cranePickup(s, id); return wait(moveLoad(grab(s, id), craneTarget(s)), n => n.action !== 'dragging'); }
function footprint(p: Point & { yaw?: number }, x0: number, x1: number, z0: number, z1: number): Point[] {
  const c = Math.cos(p.yaw ?? 0), s = Math.sin(p.yaw ?? 0);
  return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => ({ x: p.x + x * c + z * s, z: p.z - x * s + z * c }));
}
function intersects(a: Point[], b: Point[]) {
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length], axis = { x: p.z - q.z, z: q.x - p.x };
    const project = (points: Point[]) => points.map(v => v.x * axis.x + v.z * axis.z);
    const pa = project(a), pb = project(b);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}

test('empty hook chooses either remaining box and only a settled or valid release attaches it', () => {
  for (const direction of ['unload', 'load'] as const) {
    const base = createPort(direction === 'load' ? 'load-ship' : 'unload', { layout: 1, palette: 0, direction });
    let s = tick(moveLoad(grab(base), craneTarget(base)), 2);
    assert.equal(s.craneAttached, false); assert.deepEqual(s.loaded, []);
    s = release(s, true); const position = s.load;
    assert.deepEqual(resumePort(s)!.load, position);
    s = moveLoad(grab(s), craneSource(s, 0), 0);
    s = moveLoad(s, craneSource(s, 1), 1); assert.equal(s.selected, 1);
    s = wait(s, n => distance(n.load, craneSource(n, 1)) < 0.1);
    s = release(tick(s, 0.1), true); assert.equal(s.craneAttached, false);
    assert.equal(tick(resumePort(s)!, 1).craneAttached, false);
    s = release(moveLoad(grab(s), craneSource(s, 1), 1));
    assert.equal(s.action, 'hoisting'); assert.equal(s.craneAttached, true);
    s = tick(s, 0.2); assert.equal(s.lift, 0); assert.deepEqual(resumePort(s), s);
    s = wait(s, n => n.action === 'ready'); assert.equal(s.lift, 1);
    assert.equal(grab(s, 0), s); // A hanging box cannot be replaced by another choice.
    s = cranePlace(s, 1); s = wait(s, n => n.action === 'unhooking');
    assert.equal(s.craneAttached, false); assert.deepEqual(resumePort(s), s);
    assert.equal(grab(s), s); // Automatic detaching consumes the old gesture.
    s = wait(s, n => n.action === 'ready'); assert.deepEqual(available(s), [0]);
  }
});

test('previous crane saves keep suspended cargo and finish partial lifting without repeating pickup', () => {
  for (const direction of ['unload', 'load'] as const) {
    const base = createPort(direction === 'load' ? 'load-ship' : 'unload', { layout: 0, palette: 2, direction });
    const carried = cranePickup(base, 1), { craneAttached: _, ...legacy } = carried;
    assert.deepEqual(resumePort({ ...legacy, version: 2 }), carried);
    const partial = resumePort({ ...legacy, version: 2, action: 'dragging', lift: 0.35 })!;
    assert.equal(partial.action, 'hoisting'); assert.equal(partial.craneAttached, true);
    assert.equal(wait(partial, n => n.action === 'ready').selected, 1);
    assert.equal(resumePort({ ...base, craneAttached: true }), undefined);
    assert.equal(resumePort({ ...carried, craneAttached: false }), undefined);
    assert.equal(resumePort({ ...legacy, version: 2, lift: 0.3, elapsed: NaN }), undefined);
    assert.equal(resumePort({ ...base, version: 2, load: undefined }), undefined);
  }
});

test('both port layouts and both independent cargo orders finish with exactly two crane lifts and two fork trips', () => {
  for (const layout of [0, 1] as const) for (const craneOrder of [[0, 1], [1, 0]] as Cargo[][]) for (const forkOrder of [[0, 1], [1, 0]] as Cargo[][]) {
    let s = createPort('boat', { layout, palette: layout });
    s = driveToEnd(s); assert.equal(s.phase, 'truck'); s = driveToEnd(s); assert.equal(s.phase, 'unload');
    for (const id of craneOrder) {
      s = unload(s, id); assert.equal(s.action, 'lowering');
      assert.equal(grab(s, 1 - id as Cargo), s); // Assistance consumes the old gesture.
      s = wait(s, n => n.action === 'ready' || n.phase === 'crane-exit');
    }
    assert.deepEqual(s.unloaded, craneOrder); s = wait(s, n => n.phase === 'forklift');
    for (const id of forkOrder) {
      s = driveToEnd(s, id); assert.equal(s.action, 'picking');
      s = wait(s, n => n.action === 'ready'); assert.equal(s.carrying, true); assert.equal(s.selected, id);
      s = driveToEnd(s); assert.equal(s.action, 'loading');
      s = wait(s, n => n.action === 'ready' || n.phase === 'forklift-exit');
    }
    assert.deepEqual(s.loaded, forkOrder); s = wait(s, n => n.phase === 'transport');
    s = driveToEnd(s); s = wait(s, n => n.phase === 'complete'); assert.equal(progress(s), 1);
    assert.deepEqual(resumePort(s), s);
  }
});

test('empty taps and cancelled endpoint dwell cannot dock or choose a box', () => {
  let s = release(grab(createPort())); assert.equal(s.boat, 0); assert.equal(s.phase, 'boat');
  s = wait(drive(grab(s), 1), n => n.boat === 1); s = tick(s, 0.1);
  s = release(s, true); assert.equal(s.phase, 'boat'); assert.equal(s.action, 'ready');
  // Restoring a parked but uncommitted ship requires a fresh drag to finish.
  const restored = resumePort(s)!; assert.equal(restored.phase, 'boat');
  assert.equal(tick(restored, 2).phase, 'boat');
  assert.equal(tick(grab(restored), 0.5).phase, 'truck'); // The ship is already at its berth; a fresh hold resumes docking.
  assert.equal(driveToEnd(restored).phase, 'truck');
  s = release(grab(createPort('unload'))); assert.equal(s.selected, null); assert.equal(s.lift, 0); assert.deepEqual(s.unloaded, []);
});

test('reaching the hauling exit commits immediately and cannot leave an unreachable pending gesture', () => {
  let s = createPort('transport'); s.haul = 0.99;
  s = tick(drive(grab(s), 1), 0.05); assert.equal(s.phase, 'departure');
  assert.equal(release(s, true), s);
  const pending = { ...createPort('transport'), haul: 1 };
  assert.equal(resumePort(pending)!.phase, 'departure');
});

test('automatic departures clear the entire boat and all three vehicle bodies in both layouts and wide viewports', () => {
  // Fixed camera's horizontal axis: camera (7,13,20) looking at (0,.5,-1).
  const cos = 21 / Math.hypot(7, 21), sin = 7 / Math.hypot(7, 21);
  for (const halfWidth of [12.5, 16, 22, 32]) for (const direction of [-1, 1]) for (const z of [-6.2, -1, 3.2, 8.5]) {
    const centre = direction * exitDistance(halfWidth) * cos - z * sin;
    const footprint = 4.5 * cos + 1.75 * sin;
    assert.ok(direction < 0 ? centre + footprint < -halfWidth : centre - footprint > halfWidth);
  }
});

test('partial driving and suspended cargo survive interruption and reload without restoring input or dwell', () => {
  let s = tick(drive(grab(createPort()), 0.5), 0.7); assert.ok(s.boat > 0 && s.boat < 0.5);
  const boat = s.boat; s = resumePort(s)!; assert.equal(s.boat, boat); assert.equal(s.action, 'ready'); assert.equal(s.desired, null);
  s = tick(s, 1); assert.equal(s.boat, boat);
  s = tick(moveLoad(grab(cranePickup(createPort('unload'), 1)), { x: 2, z: -3 }), 0.9);
  const point = s.load; assert.equal(s.selected, 1); assert.equal(s.lift, 1);
  s = release(s, true); s = resumePort(s)!; assert.deepEqual(s.load, point); assert.equal(s.selected, 1);
  assert.deepEqual(tick(s, 1).load, point); assert.equal(s.elapsed, 0); assert.equal(s.aim, null);
  s = unload(s, 1); s = wait(s, n => n.action === 'ready'); assert.deepEqual(s.unloaded, [1]);
});

test('valid early release crosses before lowering; cancelled release retains the suspended load', () => {
  let s = moveLoad(grab(cranePickup(createPort('unload'), 0)), QUAY[0]);
  s = release(s); assert.equal(s.action, 'lowering'); assert.equal(s.lift, 1);
  s = tick(s, 0.4); assert.equal(s.action, 'lowering'); assert.deepEqual(resumePort(s), s); assert.deepEqual(s.unloaded, []);
  s = wait(s, n => n.action === 'ready'); assert.deepEqual(s.unloaded, [0]);
  s = release(moveLoad(grab(cranePickup(createPort('unload'), 1)), QUAY[0]), true);
  assert.equal(s.action, 'ready'); assert.deepEqual(s.unloaded, []); assert.equal(s.selected, 1);
});

test('pallet choice, low fork carrying, automatic loading and return clocks resume at the same instant', () => {
  let s = tick(drive(grab(createPort('forklift')), 0.7, 1), 0.5);
  s = resumePort(s)!; assert.equal(s.selected, 1); assert.ok(s.forkTravel > 0); assert.equal(s.action, 'ready');
  s = driveToEnd(s); s = tick(s, 0.2); assert.equal(s.action, 'picking');
  assert.deepEqual(resumePort(s), s); s = wait(s, n => n.action === 'ready'); assert.equal(s.carrying, true);
  s = tick(drive(grab(s), 0.45), 0.5); const pose = forkPose(s); s = resumePort(s)!;
  assert.equal(s.carrying, true); assert.deepEqual(forkPose(s), pose);
  s = driveToEnd(s); s = tick(s, 0.95); assert.equal(s.action, 'loading'); assert.deepEqual(resumePort(s), s);
  s = wait(s, n => n.action === 'returning'); assert.deepEqual(s.loaded, [1]); assert.deepEqual(resumePort(s), s);
  s = wait(s, n => n.action === 'ready'); assert.equal(s.selected, null); assert.deepEqual(s.loaded, [1]);
});

test('replay alternates cargo direction, independently selects either layout and retains a restored round', () => {
  let round = chooseRound(undefined, () => 0);
  const combinations = new Set<string>();
  for (let i = 0; i < 20; i++) { const next = chooseRound(round, () => i % 4 < 2 ? 0.1 : 0.9); assert.notEqual(next.direction, round.direction); assert.notEqual(next.palette, round.palette); combinations.add(`${next.direction}:${next.layout}`); round = next; }
  assert.equal(combinations.size, 4);
  assert.deepEqual(resumePort(createPort('forklift', round))!.round, round);
  for (const direction of ['load', 'unload'] as const) for (const phase of missionStages(direction)) assert.ok(resumePort(createPort(phase, { ...round, direction })), `${direction}:${phase}`);
});

test('malformed or contradictory snapshots cannot skip work, duplicate cargo or carry an already loaded pallet', () => {
  const base = createPort('forklift');
  for (const patch of [{ version: 4 }, { round: { layout: 3, palette: 0 } }, { unloaded: [0, 0] }, { loaded: [1], unloaded: [0] }, { boat: 0.5 }, { action: 'loading', selected: null }, { selected: 0, loaded: [0], carrying: true }, { selected: 0, action: 'picking', forkTravel: 0.5 }, { load: { x: 100, z: 0 } }, { elapsed: NaN }, { phase: 'complete', action: 'auto' }]) {
    assert.equal(resumePort({ ...base, ...patch }), undefined, JSON.stringify(patch));
  }
  assert.equal(resumePort(null), undefined); assert.equal(resumePort({}), undefined);
});

test('fork routes keep the complete body clear of the quay edge and truck, and raise before inserting a pallet', () => {
  for (const layout of [0, 1] as const) for (const id of [0, 1] as const) for (const slot of [0, 1]) {
    let s = createPort('forklift', { layout, palette: 0 });
    s.selected = id; s.carrying = true; s.loaded = slot ? [1 - id as Cargo] : [];
    for (let n = 0; n <= 100; n++) {
      s.forkTravel = n / 100; const p = forkPose(s);
      const north = p.z - Math.abs(Math.cos(p.yaw)) * 1.05 - Math.abs(Math.sin(p.yaw)) * 0.85;
      const south = p.z + Math.abs(Math.cos(p.yaw)) * 1.05 + Math.abs(Math.sin(p.yaw)) * 0.85;
      assert.ok(north > -3.6); assert.ok(south < ROAD_Z - 1.21);
      assert.equal(mirror(s.round, p).z, p.z);
    }
    s.forkTravel = 1; s.action = 'loading'; s.elapsed = 0.7;
    const before = forkPose(s); s.elapsed = 0.8; assert.equal(forkPose(s).z, before.z);
    s.elapsed = 1.4; const inserted = forkPose(s);
    assert.ok(inserted.z + 1.05 < ROAD_Z - 1.21);
    assert.ok(Math.abs(inserted.z + FORK_OFFSET - ROAD_Z) < 1e-6);
    assert.ok(Math.abs(inserted.z - before.z - LOADING_APPROACH) < 1e-6);
    assert.equal(inserted.x, TRUCK_SLOTS[slot].x);
  }
});

test('side pickup exposes the forks in either mirrored view and keeps both loading orders clear of the other pallet', () => {
  const cameraRight = { x: 21 / Math.hypot(7, 21), z: -7 / Math.hypot(7, 21) };
  for (const layout of [0, 1] as const) for (const order of [[0, 1], [1, 0]] as Cargo[][]) for (const id of [0, 1] as const) {
    const s = createPort('forklift', { layout, palette: 0 }); s.unloaded = order; s.selected = id; s.forkTravel = 1;
    const picked = forkPose(s), target = quayFor(s, id);
    const direction = { x: -Math.sin(picked.yaw) * (layout ? -1 : 1), z: -Math.cos(picked.yaw) };
    assert.ok(Math.abs(direction.x * cameraRight.x + direction.z * cameraRight.z) > 0.94, 'forks must read horizontally, rather than behind the cab');
    assert.ok(Math.hypot(picked.x - Math.sin(picked.yaw) * FORK_OFFSET - target.x, picked.z - Math.cos(picked.yaw) * FORK_OFFSET - target.z) < 1e-6);
    const lifted = forkPose({ ...s, carrying: true, forkTravel: 0 });
    assert.ok(Math.hypot(lifted.x - picked.x, lifted.z - picked.z, lifted.yaw - picked.yaw) < 1e-6, 'lifting cannot teleport or turn the pallet');
    const other = footprint(quayFor(s, 1 - id as Cargo), -0.675, 0.675, -0.675, 0.675);
    const people = [7.4, 8.25].map(x => footprint({ x, z: 5.5 }, -0.3, 0.3, -0.3, 0.3));
    for (const carrying of [false, true]) for (let n = 0; n <= 400; n++) {
      const pose = forkPose({ ...s, carrying, forkTravel: n / 400 });
      const parts = [footprint(pose, -0.85, 0.85, -1.05, 1.05), ...[-0.31, 0.31].map(x => footprint(pose, x - 0.055, x + 0.055, -2.9, -0.8))];
      if (carrying) parts.push(footprint(pose, -0.675, 0.675, -FORK_OFFSET - 0.675, -FORK_OFFSET + 0.675));
      for (const part of parts) {
        assert.ok(part.every(p => p.z > -3.55), 'whole forklift and forks stay on the quay');
        assert.ok(!intersects(part, other), 'the other pallet must stay clear');
        assert.ok(people.every(person => !intersects(part, person)), 'waiting people stay outside the work route');
      }
    }
  }
});

test('fork steering stays continuous while picking up, carrying, withdrawing and parking both pallets', () => {
  for (const id of [0, 1] as const) for (const slot of [0, 1]) {
    let s = createPort('forklift'); s.selected = id;
    for (const carrying of [false, true]) {
      s.carrying = carrying; s.loaded = slot ? [1 - id as Cargo] : []; let previous = forkPose({ ...s, forkTravel: 0 });
      for (let n = 1; n <= 1000; n++) {
        const p = forkPose({ ...s, forkTravel: n / 1000 });
        assert.ok(Math.abs(Math.atan2(Math.sin(p.yaw - previous.yaw), Math.cos(p.yaw - previous.yaw))) < 0.15); previous = p;
      }
    }
    s.loaded = slot ? [1 - id as Cargo, id] : [id]; s.action = 'returning'; s.carrying = false;
    let previous = forkPose({ ...s, elapsed: 0 });
    for (let n = 1; n <= 1000; n++) {
      const p = forkPose({ ...s, elapsed: n / 500 });
      assert.ok(Math.abs(Math.atan2(Math.sin(p.yaw - previous.yaw), Math.cos(p.yaw - previous.yaw))) < 0.15); previous = p;
    }
    assert.ok(Math.abs(previous.yaw) < 1e-6);
  }
});

test('each loaded pallet turns forward toward land immediately instead of reversing the pickup route', () => {
  for (const order of [[0, 1], [1, 0]] as Cargo[][]) for (const id of [0, 1] as const) for (const second of [false, true]) {
    const s = createPort('forklift'); s.unloaded = order; s.selected = id; s.carrying = true;
    if (second) s.loaded = [1 - id as Cargo];
    const start = forkPose(s), moved = forkPose({ ...s, forkTravel: 0.01 });
    const forward = (moved.x - start.x) * -Math.sin(start.yaw) + (moved.z - start.z) * -Math.cos(start.yaw);
    assert.ok(forward > 0, 'the first movement is forward, away from the pickup approach');
    assert.ok(moved.z > start.z, 'the turn heads toward the truck-side land');
    assert.ok(forkRoute(s).every(p => p.z >= start.z), 'the loaded route never backs toward the water');
  }
});

test('the second pickup uses the vacant first bay with a shorter side approach and retains that route across reload', () => {
  for (const layout of [0, 1] as const) for (const order of [[0, 1], [1, 0]] as Cargo[][]) for (const first of [0, 1] as const) {
    const second = 1 - first as Cargo, s = createPort('forklift', { layout, palette: 0 }); s.unloaded = order;
    const outsideLength = pathLength(pickupRoute(s, second));
    s.loaded = [first]; s.selected = first; s.action = 'returning';
    const remaining = footprint(quayFor(s, second), -0.675, 0.675, -0.675, 0.675);
    for (let n = 0; n <= 400; n++) {
      const pose = forkPose({ ...s, elapsed: n / 200 });
      const parts = [footprint(pose, -0.85, 0.85, -1.05, 1.05), ...[-0.31, 0.31].map(x => footprint(pose, x - 0.055, x + 0.055, -2.9, -0.8))];
      assert.ok(parts.every(part => !intersects(part, remaining)), 'returning parks between the bays without touching the remaining pallet');
    }
    const parked = forkPose({ ...s, elapsed: 2 }); s.action = 'ready'; s.selected = second;
    const route = pickupRoute(s, second); assert.ok(pathLength(route) < outsideLength * 0.7);
    const start = forkPose(s); assert.ok(Math.hypot(start.x - parked.x, start.z - parked.z, start.yaw - parked.yaw) < 1e-6);
    const picked = forkPose({ ...s, forkTravel: 1 }), vacant = quayFor(s, first), target = quayFor(s, second);
    assert.ok(Math.hypot(picked.x - vacant.x, picked.z - vacant.z) < 1e-6, 'forklift stands on the vacated bay to pick up the second pallet');
    assert.ok(Math.hypot(picked.x - Math.sin(picked.yaw) * FORK_OFFSET - target.x, picked.z - Math.cos(picked.yaw) * FORK_OFFSET - target.z) < 1e-6);
    for (const carrying of [false, true]) for (let n = 0; n <= 400; n++) {
      const pose = forkPose({ ...s, carrying, forkTravel: n / 400 });
      const parts = [footprint(pose, -0.85, 0.85, -1.05, 1.05), ...[-0.31, 0.31].map(x => footprint(pose, x - 0.055, x + 0.055, -2.9, -0.8))];
      if (carrying) parts.push(footprint(pose, -0.675, 0.675, -FORK_OFFSET - 0.675, -FORK_OFFSET + 0.675));
      assert.ok(parts.every(part => part.every(p => p.z > -3.55)), 'shortcut keeps the forklift, forks and cargo on the quay');
    }
    const partial = tick(drive(grab({ ...s, selected: null }), 0.5, second), 0.5);
    assert.deepEqual(forkPose(resumePort(partial)!), forkPose(partial));
  }
});

test('outgoing rounds let children independently choose truck unloading and ship loading in either layout', () => {
  for (const layout of [0, 1] as const) for (const forkOrder of [[0, 1], [1, 0]] as Cargo[][]) for (const craneOrder of [[0, 1], [1, 0]] as Cargo[][]) {
    let s = createPort('boat', { layout, palette: 2, direction: 'load' });
    s = driveToEnd(s); s = driveToEnd(s); assert.equal(s.phase, 'forklift');
    for (const id of forkOrder) {
      s = driveToEnd(s, id); assert.equal(s.action, 'picking');
      s = wait(s, n => n.action === 'ready'); assert.equal(s.carrying, true); assert.equal(s.selected, id);
      s = driveToEnd(s); assert.equal(s.action, 'loading');
      s = wait(s, n => n.action === 'ready' || n.phase === 'forklift-exit');
      assert.ok(resumePort(s));
    }
    assert.deepEqual(s.unloaded, forkOrder); assert.deepEqual(s.loaded, []);
    s = wait(s, n => n.phase === 'crane-ready'); assert.equal(grab(s, 0), s);
    s = wait(s, n => n.phase === 'load-ship');
    for (const id of craneOrder) {
      s = cranePlace(s, id); assert.equal(s.action, 'lowering');
      s = wait(s, n => n.action === 'ready' || n.phase === 'crane-exit');
    }
    assert.deepEqual(s.loaded, craneOrder); s = wait(s, n => n.phase === 'ship-transport');
    s = driveToEnd(s); assert.equal(s.phase, 'departure');
    s = wait(s, n => n.phase === 'complete'); assert.equal(progress(s), 1); assert.deepEqual(resumePort(s), s);
  }
});

test('outgoing truck pickup lifts before insertion, retreats before lowering and resumes every automatic instant', () => {
  for (const id of [0, 1] as const) {
    let s = createPort('forklift', { layout: 0, palette: 0, direction: 'load' }); s.selected = id; s.forkTravel = 1; s.action = 'picking';
    for (const elapsed of [0.3, 0.6, 0.9, 1.1, 1.3, 1.6, 1.85, 2.2]) {
      s.elapsed = elapsed; assert.deepEqual(resumePort(s), s);
      const p = forkPose(s); assert.ok(p.z + 1.05 < ROAD_Z - 1.21, 'vehicle body stays outside the truck');
      assert.equal(p.x, TRUCK_SLOTS[id].x);
    }
    s.elapsed = 0.6; const before = forkPose(s); assert.ok(forkHeight(s) >= 1.24 - 1e-6);
    s.elapsed = 1.1; assert.ok(Math.abs(forkPose(s).z + FORK_OFFSET - ROAD_Z) < 1e-6);
    s.elapsed = 1.85; assert.equal(forkPose(s).z, before.z); assert.ok(forkHeight(s) > 1.24);
    const carrying = wait({ ...s, elapsed: pickupDuration(s) - 0.05 }, n => n.action === 'ready');
    assert.ok(carrying.carrying); assert.ok(Math.abs(forkPose(carrying).yaw) < 1e-6); assert.ok(Math.abs(forkHeight(carrying) - 0.3) < 1e-6);
    const partial = tick(drive(grab(carrying), 0.5), 0.4); assert.deepEqual(forkPose(resumePort(partial)!), forkPose(partial));
  }
});

test('outgoing fork delivery avoids the first quay box and keeps the complete forklift, forks and load on land', () => {
  for (const id of [0, 1] as const) {
    const s = createPort('forklift', { layout: 1, palette: 1, direction: 'load' });
    s.unloaded = [1 - id as Cargo]; s.selected = id; s.carrying = true;
    const other = footprint(QUAY[0], -0.675, 0.675, -0.675, 0.675);
    for (const action of ['dragging', 'loading'] as const) for (let n = 0; n <= 400; n++) {
      const pose = forkPose({ ...s, action, forkTravel: action === 'loading' ? 1 : n / 400, elapsed: action === 'loading' ? n / 400 : 0 });
      const parts = [footprint(pose, -0.85, 0.85, -1.05, 1.05), ...[-0.31, 0.31].map(x => footprint(pose, x - 0.055, x + 0.055, -2.9, -0.8)), footprint(pose, -0.675, 0.675, -FORK_OFFSET - 0.675, -FORK_OFFSET + 0.675)];
      for (const part of parts) { assert.ok(part.every(p => p.z > -3.55)); assert.ok(!intersects(part, other), 'the other quay box stays clear'); }
    }
  }
});

test('outgoing steering remains continuous through truck approach, loaded travel and empty return', () => {
  for (const id of [0, 1] as const) for (const second of [false, true]) {
    const s = createPort('forklift', { layout: 0, palette: 0, direction: 'load' }); s.selected = id;
    if (second) s.unloaded = [1 - id as Cargo];
    for (const carrying of [false, true]) {
      let previous = forkPose({ ...s, carrying });
      for (let n = 1; n <= 1000; n++) {
        const pose = forkPose({ ...s, carrying, forkTravel: n / 1000 });
        assert.ok(Math.abs(Math.atan2(Math.sin(pose.yaw - previous.yaw), Math.cos(pose.yaw - previous.yaw))) < 0.15);
        previous = pose;
      }
    }
    s.unloaded.push(id); s.action = 'returning'; let previous = forkPose(s);
    for (let n = 1; n <= 1000; n++) {
      const pose = forkPose({ ...s, elapsed: n / 500 });
      assert.ok(Math.abs(Math.atan2(Math.sin(pose.yaw - previous.yaw), Math.cos(pose.yaw - previous.yaw))) < 0.15);
      previous = pose;
    }
    assert.ok(Math.abs(previous.yaw - Math.PI) < 1e-6);
  }
});

test('legacy snapshots retain incoming cargo progress; outgoing snapshots reject wrong phases and contradictory cargo ownership', () => {
  const base = createPort('forklift'); base.selected = 1; base.carrying = true; base.forkTravel = 0.3;
  const { direction: _, ...oldRound } = base.round;
  assert.deepEqual(resumePort({ ...base, version: 1, round: oldRound }), base);
  const outgoing = createPort('forklift', { layout: 1, palette: 2, direction: 'load' });
  for (const patch of [{ round: oldRound }, { phase: 'unload' }, { unloaded: [0], selected: 0, carrying: true }, { unloaded: [0, 1], action: 'ready' }, { loaded: [0] }, { version: 1 }]) assert.equal(resumePort({ ...outgoing, ...patch }), undefined);
  const crane = createPort('load-ship', outgoing.round);
  const suspended = tick(moveLoad(grab(cranePickup(crane, 1)), { x: 0, z: -3 }), 0.8);
  const resumed = resumePort(suspended)!; assert.equal(resumed.selected, 1); assert.deepEqual(resumed.load, suspended.load); assert.equal(resumed.lift, suspended.lift); assert.equal(resumed.action, 'ready');
  const lowering = release(moveLoad(grab(cranePickup(crane, 1)), craneTarget(crane))); assert.deepEqual(resumePort(lowering), lowering);
  const ship = { ...createPort('ship-transport', outgoing.round), haul: 1 };
  assert.equal(resumePort(ship)!.phase, 'departure');
});
