import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMountain, stages, chooseRound, rocks, cargo, grab, drive, moveLoader, moveBucket, release, advance, resumeMountain, progress, BED, HOME, PIVOT, ARM_Z, SWEEP_Z, GUARDRAIL_Z, soilPoint } from './mountain.ts';
import type { MountainState, Round } from './mountain.ts';
import { reachable, elbow, BOOM, STICK } from '../../../runtime/excavator-arm.ts';
import { createShapes } from '../../../runtime/geometry.ts';
import { createDumpTruck } from '../../../runtime/dump-truck.ts';
import { createRoadBarrier } from '../../../runtime/road-barrier.ts';
import { createTrafficCone } from '../../../runtime/traffic-cone.ts';
import { createSweeper } from '../../../runtime/sweeper.ts';
import { createBulldozer, bulldozerPose, createLoader, createSoilPile } from '../vehicles.ts';

import { loaderPose, loaderRoute, loaderHome, loaderReturnRoute, loaderReturnSeconds, routeLength, soilRemaining, soilInTruck, SCOOP_SECONDS, PARK_SECONDS, TIP_SECONDS, RETURN_SECONDS, LOADER_DOCK } from './loader.ts';
import { HAUL_START, pushPoint, BARRIER_X, CONE_X } from './site.ts';

const tick = (s: MountainState, seconds: number) => { for (let i = 0; i < seconds * 50; i++) s = advance(s, 0.02); return s; };
const until = (s: MountainState, reached: (s: MountainState) => boolean) => { for (let i = 0; i < 2000 && !reached(s); i++) s = advance(s, 0.02); assert.ok(reached(s), `timed out at ${s.phase}/${s.motion}`); return s; };
const restored = (s: MountainState) => { const next = resumeMountain(JSON.parse(JSON.stringify(s))); assert.ok(next, `valid save: ${s.phase}/${s.motion}`); return next; };
const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
for (const pattern of ['spread', 'cluster'] as const) for (const layout of [0, 1] as const) for (const order of orders) for (const soilOrder of [[0, 1], [1, 0]] as const) {
  test(`${pattern}/${layout}: two pushes, soil ${soilOrder}, child-selected rocks ${order}, hauling and sweeping reopen the road`, () => {
    const round: Round = { pattern, layout };
    let s = tick(createMountain('intro', round), 1.4); assert.equal(s.phase, 'push');
    s = tick(drive(grab(s), 1), 2.9); assert.equal(s.motion, 'push-return');
    s = tick(restored(s), 1.7); assert.equal(s.pushIndex, 1); assert.equal(s.action, 'ready');
    s = tick(release(drive(grab(s), 1)), 3); assert.equal(s.phase, 'dozer-exit');
    s = until(restored(s), s => s.phase === 'excavate'); assert.deepEqual(s.pushes, [1, 1]); assert.equal(soilInTruck(s), 0);
    for (const id of order) {
      s = tick(moveBucket(grab(s), rocks(round)[id]), 0.8); assert.equal(s.carried, id);
      s = tick(restored(s), 1.5); assert.equal(s.action, 'ready'); assert.ok(Math.hypot(s.bucket.x - HOME.x, s.bucket.y - 4.2, s.bucket.z - HOME.z) < 0.001);
      // Automatic pickup consumes the gesture; another input cannot select another rock.
      const lifted = s; assert.equal(drive(s, 1), lifted);
      s = release(moveBucket(grab(s), BED)); assert.equal(s.motion, 'unload');
      s = tick(restored(tick(s, 0.55)), 1.7);
      assert.deepEqual(s.delivered, order.slice(0, order.indexOf(id) + 1));
    }
    assert.equal(s.phase, 'excavator-exit'); s = until(restored(s), s => s.phase === 'load-soil');
    for (const id of soilOrder) {
      s = until(release(moveLoader(grab(s), id, 1)), s => s.loaderCarrying && s.action === 'ready');
      s = restored(s); assert.equal(s.loaderSelected, id); assert.equal(soilRemaining(s, id), 0);
      s = until(release(moveLoader(grab(s), id, 1)), s => s.loaderDocked && s.action === 'ready');
      assert.equal(loaderPose(s).lift, 0.12); assert.equal(soilInTruck(s), s.soilLoaded.length / 2);
      s = until(release(moveLoader(grab(restored(s)), id, 1)), s => s.motion === 'loader-return');
      assert.deepEqual(s.soilLoaded, soilOrder.slice(0, soilOrder.indexOf(id) + 1));
      s = until(restored(s), s => s.action === 'ready' || s.phase === 'loader-exit');
    }
    s = until(s, s => s.phase === 'haul'); assert.equal(soilInTruck(s), 1);
    s = tick(release(drive(grab(s), 1)), 3.5); assert.equal(s.phase, 'truck-exit');
    s = tick(restored(s), 4.4); assert.equal(s.phase, 'sweep');
    s = tick(release(drive(grab(s), 1)), 5); assert.equal(s.phase, 'sweeper-exit');
    s = tick(restored(s), 8.5); assert.equal(s.phase, 'complete'); assert.equal(progress(s), 1);
    assert.deepEqual(restored(s).round, round); assert.equal(tick(s, 10), s);
  });
}
test('every development stage produces a valid independent save and later work cannot happen early', () => {
  for (const stage of stages) { const s = createMountain(stage, { pattern: 'cluster', layout: 1 }); assert.deepEqual(restored(s).round, s.round); if (s.action === 'auto') assert.equal(grab(s), s); }
  const s = createMountain('intro'); assert.equal(moveBucket(s, BED), s); assert.equal(drive(s, 1), s);
});
test('new rounds change the main rock distribution while layout is chosen independently', () => {
  let previous: Round = { pattern: 'spread', layout: 0 };
  for (const random of [() => 0, () => 0.99]) for (let i = 0; i < 8; i++) { const next = chooseRound(previous, random); assert.notEqual(next.pattern, previous.pattern); assert.equal(next.layout, random() < 0.5 ? 0 : 1); previous = next; }
});
test('cancelled or released partial driving retains pushed soil, cargo and cleaned road across reload', () => {
  for (const phase of ['push', 'haul', 'sweep'] as const) {
    let s = tick(drive(grab(createMountain(phase)), 0.55), 1.1);
    const progressBefore = progress(s); s = restored(release(s, true)); assert.equal(s.action, 'ready'); assert.equal(progress(s), progressBefore);
    assert.equal(progress(tick(s, 2)), progressBefore);
    const next = tick(drive(grab(s), 0), 0.6);
    if (phase !== 'haul') assert.equal(progress(next), progressBefore);
    else { assert.ok(next.haul < s.haul); assert.deepEqual(next.delivered, [0, 1, 2]); }
    const tap = release(grab(s)); assert.equal(tap.phase, phase); assert.equal(tap.action, 'ready');
  }
});
test('brief passes and cancellation do not pick a rock; valid early release picks only the chosen rock', () => {
  const s = createMountain('excavate');
  let moving = tick(moveBucket(grab(s), rocks(s.round)[2]), 0.12);
  assert.equal(moving.carried, null); moving = restored(release(moving, true)); assert.equal(moving.carried, null); assert.equal(moving.dwell, 0);
  moving = release(moveBucket(grab(moving), rocks(s.round)[1])); assert.equal(moving.carried, 1); assert.equal(moving.motion, 'lift');
  const held = moving; assert.equal(grab(held), held); assert.equal(moveBucket(held, BED), held);
  moving = tick(restored(tick(moving, 0.45)), 1); assert.equal(moving.action, 'ready'); assert.equal(moving.bucket.y, 4.2);
  const cancelled = restored(release(tick(moveBucket(grab(moving), { x: 0, y: 4.2, z: -2 }), 0.3), true));
  assert.equal(cancelled.carried, 1); assert.deepEqual(cancelled.delivered, []); assert.deepEqual(tick(cancelled, 2).bucket, cancelled.bucket);
});
test('cancelled endpoint dwell cannot finish hauling or sweep work after reload', () => {
  for (const phase of ['haul', 'sweep'] as const) {
    let s = drive(grab(createMountain(phase)), 1);
    for (let i = 0; i < 300 && (phase === 'haul' ? s.haul : s.swept) < 1; i++) s = advance(s, 0.02);
    assert.equal(s.phase, phase); s = restored(release(s, true)); assert.equal(tick(s, 2).phase, phase);
    s = tick(grab(s), 0.5); assert.notEqual(s.phase, phase);
  }
});
test('malformed and contradictory saves cannot skip work, duplicate stones or resume invalid motion', () => {
  for (const s of [null, {}, { ...createMountain('complete'), delivered: [] }, { ...createMountain('haul'), pushes: [1, 0] }, { ...createMountain('excavate'), delivered: [1, 1] }, { ...createMountain('push'), pushIndex: 1 }, { ...createMountain('sweep'), carried: 1 }, { ...createMountain('haul'), motion: 'lift', action: 'auto' }, { ...createMountain('excavate'), bucket: { x: NaN, y: 1, z: 0 } }, { ...createMountain('excavate'), action: 'auto', motion: 'return', delivered: [] }]) assert.equal(resumeMountain(s), undefined);
  const s = createMountain('push'); assert.equal(drive(grab(s), NaN).desired, 0); assert.equal(advance(s, NaN), s);
});
test('every rock and truck target preserves the original fixed arm lengths, including carried heights', () => {
  const distance = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  for (const pattern of ['spread', 'cluster'] as const) for (const p of [...rocks({ pattern, layout: 0 }), BED, HOME, cargo(0), cargo(1), cargo(2)]) for (const y of [0.85, 4.2]) {
    const target = { ...p, y }, end = reachable(target, PIVOT), joint = elbow(target, PIVOT);
    assert.ok(distance(end, target) < 0.001); assert.ok(Math.abs(distance(PIVOT, joint) - BOOM) < 0.001); assert.ok(Math.abs(distance(joint, end) - STICK) < 0.001);
  }
  for (const id of [0, 1, 2]) {
    const p = cargo(id); assert.equal(p.y, id === 2 ? 3.08 : 2.1);
    assert.ok(p.x - 0.57 > HAUL_START - 1.37 && p.x + 0.57 < HAUL_START + 1.35);
    for (let previous = 0; previous < id; previous++) assert.ok(distance(p, cargo(previous)) >= 1.14);
  }
});
test('both push lanes move horizontally so the fixed camera exposes the blade and moving soil from the side', () => {
  for (const id of [0, 1] as const) {
    const a = pushPoint(id, 0), b = pushPoint(id, 1);
    assert.equal(a.z, b.z); assert.ok(b.x - a.x > 5);
    const s = createMountain('push'); s.pushIndex = id;
    assert.equal(bulldozerPose(s, 22.4).heading, 0);
  }
});
test('loader returns beside the remaining pile and takes direct cleared-ground routes in either soil order', () => {
  for (const first of [0, 1] as const) {
    const second = (1 - first) as 0 | 1, initial = { ...createMountain('load-soil'), loaderSelected: second };
    const next: MountainState = { ...initial, soilLoaded: [first] };
    assert.ok(routeLength(loaderRoute(next)) < 1.5); assert.ok(routeLength(loaderRoute(next)) < routeLength(loaderRoute(initial)) * 0.6);
    assert.deepEqual(loaderReturnRoute(next).at(-1), loaderHome(next));
    const returned = loaderPose({ ...next, motion: 'loader-return', elapsed: RETURN_SECONDS }).point, waiting = loaderPose(next).point;
    assert.ok(Math.hypot(returned.x - waiting.x, returned.z - waiting.z) < 0.001);
    const loaded = loaderRoute({ ...next, loaderCarrying: true }); assert.equal(loaded.length, 2);
    assert.deepEqual(loaded.at(-1), LOADER_DOCK);
    const done: MountainState = { ...next, soilLoaded: [first, second], loaderSelected: null };
    assert.equal(loaderReturnSeconds(done), 1.4);
    assert.deepEqual(loaderPose({ ...done, motion: 'loader-return', elapsed: 1.4 }).point, LOADER_DOCK);
    assert.deepEqual(loaderPose({ ...done, phase: 'loader-exit', elapsed: 0 }).point, LOADER_DOCK);
  }
});
test('loader cancellation preserves partial approach, chosen pile and full bucket without consuming soil twice', () => {
  let s = tick(moveLoader(grab(createMountain('load-soil')), 1, 0.6), 0.15);
  const travel = s.loaderTravel; assert.ok(travel > 0 && travel < 0.6);
  s = restored(release(s, true)); assert.equal(s.loaderTravel, travel); assert.equal(s.loaderSelected, 1);
  assert.equal(tick(s, 2).loaderTravel, travel); assert.equal(soilRemaining(s, 1), 1);
  s = release(moveLoader(grab(s), 1, 1)); s = until(s, s => s.motion === 'loader-scoop');
  s = tick(s, 0.65); const fraction = 1 - soilRemaining(s, 1); assert.ok(fraction > 0 && fraction < 1);
  assert.equal(soilRemaining(restored(s), 1), 1 - fraction);
  s = until(restored(s), s => s.action === 'ready'); assert.equal(s.loaderCarrying, true); assert.equal(soilRemaining(s, 1), 0);
  assert.equal(moveLoader(s, 0, 1), s); // Still-held input cannot drive the next task.
  s = restored(release(tick(moveLoader(grab(s), 1, 0.5), 0.6), true));
  assert.equal(s.loaderCarrying, true); assert.deepEqual(s.soilLoaded, []); assert.equal(soilInTruck(s), 0);
  const paused = s.loaderTravel; assert.equal(tick(s, 2).loaderTravel, paused);
});
test('pouring transfers soil visibly once, resumes mid-pour and returns clear before accepting the next gesture', () => {
  let s = until(release(moveLoader(grab(createMountain('load-soil')), 0, 1)), s => s.loaderCarrying && s.action === 'ready');
  s = until(release(moveLoader(grab(s), 0, 1)), s => s.loaderDocked && s.action === 'ready');
  s = until(release(moveLoader(grab(s), 0, 1)), s => s.motion === 'loader-tip');
  s = tick(s, 1.7); assert.ok(soilInTruck(s) > 0 && soilInTruck(s) < 0.5);
  const pose = loaderPose(s); assert.equal(pose.lift, 1); assert.ok(pose.tilt < 0); assert.ok(pose.fill > 0 && pose.fill < 1);
  assert.deepEqual(loaderPose(restored(s)), pose);
  s = until(restored(s), s => s.motion === 'loader-return'); assert.deepEqual(s.soilLoaded, [0]); assert.equal(soilInTruck(s), 0.5);
  assert.equal(grab(s), s); s = until(restored(tick(s, 1)), s => s.action === 'ready');
  assert.deepEqual(s.soilLoaded, [0]); assert.equal(s.loaderSelected, null); assert.equal(s.loaderCarrying, false);
  assert.equal(soilRemaining(s, 0), 0); assert.equal(soilRemaining(s, 1), 1);
});
test('parking ends the driving gesture and waits for a separate upward lift, preserving partial lift across reload', () => {
  let s = until(release(moveLoader(grab(createMountain('load-soil')), 1, 1)), s => s.loaderCarrying && s.action === 'ready');
  s = until(release(moveLoader(grab(s), 1, 1)), s => s.loaderDocked && s.action === 'ready');
  assert.equal(s.loaderTravel, 0); assert.equal(loaderPose(s).lift, 0.12);
  assert.equal(moveLoader(s, 1, 1), s); assert.deepEqual(tick(restored(s), 20), restored(s));
  s = restored(release(tick(moveLoader(grab(s), 1, 0.5), 0.35), true));
  const raised = loaderPose(s); assert.ok(raised.lift > 0.12 && raised.lift < 1); assert.deepEqual(raised.point, LOADER_DOCK);
  assert.deepEqual(loaderPose(tick(s, 5)), raised); assert.equal(soilInTruck(s), 0);
  s = until(release(moveLoader(grab(s), 1, 1)), s => s.motion === 'loader-tip');
  assert.equal(loaderPose(s).lift, 1); assert.equal(soilInTruck(s), 0);
  s = until(restored(s), s => s.motion === 'loader-return'); assert.deepEqual(s.soilLoaded, [1]);
});
test('version-2 saves retain their original order and material while gaining the separate lift step', () => {
  for (const stage of stages) {
    const { loaderDocked, workOrder, ...old } = createMountain(stage, { layout: 1, pattern: 'spread' }, 'soil-first');
    const s = resumeMountain({ ...old, version: 2 }); assert.ok(s); assert.equal(s.workOrder, 'soil-first'); assert.equal(s.phase, stage);
    assert.deepEqual(s.delivered, old.delivered); assert.deepEqual(s.soilLoaded, old.soilLoaded);
  }
  const { loaderDocked, workOrder, ...old } = createMountain('load-soil', { layout: 0, pattern: 'cluster' }, 'soil-first');
  const full = resumeMountain({ ...old, version: 2, loaderSelected: 1, loaderCarrying: true, loaderTravel: 0.45 });
  assert.ok(full); assert.equal(full.loaderCarrying, true); assert.equal(full.loaderDocked, false); assert.equal(full.loaderTravel, 0.45);
  let continuing = resumeMountain({ ...old, version: 2, soilLoaded: [0], loaderSelected: 1, loaderCarrying: true, loaderTravel: 0.45 }); assert.ok(continuing);
  continuing = until(release(moveLoader(grab(continuing), 1, 1)), s => s.loaderDocked && s.action === 'ready');
  continuing = until(release(moveLoader(grab(continuing), 1, 1)), s => s.phase === 'excavate');
  assert.deepEqual(continuing.soilLoaded, [0, 1]); assert.deepEqual(continuing.delivered, []);
  const pouring = resumeMountain({ ...old, version: 2, action: 'auto', motion: 'loader-tip', loaderSelected: 0, loaderCarrying: true, loaderTravel: 1, elapsed: 2.7 });
  assert.ok(pouring); assert.equal(pouring.loaderDocked, true); assert.ok(Math.abs(pouring.elapsed - 1.7) < 0.001);
  assert.deepEqual(until(pouring, s => s.motion === 'loader-return').soilLoaded, [0]);
});
test('brief loader endpoint passes and cancellation never silently finish work after reload', () => {
  let s = tick(moveLoader(grab(createMountain('load-soil')), 0, 1), 0.18);
  assert.equal(s.loaderTravel, 0); assert.equal(s.motion, 'none');
  s = restored(release(s, true)); assert.equal(tick(s, 3).loaderCarrying, false);
  s = until(release(moveLoader(grab(s), 0, 1)), s => s.motion === 'loader-scoop');
  assert.equal(moveLoader(s, 1, 1), s);
});
test('passing the nearer pile does not commit it before choosing the farther pile', () => {
  let s = tick(moveLoader(grab(createMountain('load-soil')), 0, 1), 0.18);
  assert.equal(s.loaderTravel, 0); assert.equal(s.action, 'dragging');
  s = moveLoader(s, 1, 1); assert.equal(s.dwell, 0); assert.equal(s.loaderSelected, 1);
  s = tick(s, 0.45); assert.equal(s.motion, 'loader-finish'); assert.equal(s.loaderSelected, 1);
  s = until(s, s => s.loaderCarrying && s.action === 'ready'); assert.equal(s.loaderSelected, 1); assert.equal(soilRemaining(s, 0), 1);
});
test('legacy version-1 rounds retain their work, carrying rock and completion while earlier rounds gain the loader phase', () => {
  for (const phase of ['push', 'truck-arrival', 'excavate', 'haul', 'complete'] as const) {
    const current = createMountain(phase), { soilLoaded, loaderSelected, loaderTravel, loaderCarrying, ...legacy } = current;
    const old = { ...legacy, version: 1 }; const resumed = resumeMountain(old); assert.ok(resumed);
    assert.equal(resumed.version, 3); assert.equal(resumed.workOrder, 'soil-first'); assert.equal(resumed.phase, phase);
    assert.deepEqual(resumed.soilLoaded, ['excavate', 'haul', 'complete'].includes(phase) ? [0, 1] : []);
    assert.deepEqual(resumed.delivered, current.delivered);
  }
  const old = { ...createMountain('excavate'), version: 1, carried: 2, bucket: { x: -2, y: 4.2, z: -3 } };
  const resumed = resumeMountain(old); assert.ok(resumed); assert.equal(resumed.carried, 2); assert.deepEqual(resumed.bucket, old.bucket);
});
test('contradictory loader saves cannot duplicate soil, skip loads or carry soil outside the loader phase', () => {
  const ready = createMountain('load-soil');
  for (const invalid of [
    { ...ready, soilLoaded: [0, 0] }, { ...ready, loaderTravel: NaN }, { ...ready, loaderCarrying: true },
    { ...ready, workOrder: 'unknown' }, { ...ready, delivered: [] }, { ...ready, loaderDocked: true },
    { ...ready, loaderSelected: 0, soilLoaded: [0] }, { ...ready, soilLoaded: [0, 1] },
    { ...ready, loaderSelected: 1, loaderTravel: 0.5, action: 'auto', motion: 'loader-scoop' },
    { ...ready, loaderSelected: 1, loaderTravel: 1, action: 'auto', motion: 'loader-tip' },
    { ...createMountain('haul'), soilLoaded: [] }, { ...createMountain('haul'), loaderCarrying: true },
  ]) assert.equal(resumeMountain(invalid), undefined);
});
test('loader full body and raised bucket clear boulders, parked truck, other soil, barriers and guardrail in every configuration', () => {
  const shapes = createShapes(), loader = createLoader(shapes), truck = createDumpTruck(shapes, true), piles = [createSoilPile(shapes, 0), createSoilPile(shapes, 1)], site = new THREE.Group(); site.add(loader.root, truck.root, ...piles);
  const obstacles = BARRIER_X.flatMap((x, i) => { const barrier = createRoadBarrier(shapes), cone = createTrafficCone(shapes); barrier.position.set(x, 0, -0.55); cone.position.set(CONE_X[i], 0, 0.9); site.add(barrier, cone); return [barrier, cone]; });
  piles.forEach((pile, i) => { const p = soilPoint(i as 0 | 1); pile.position.set(p.x, 0, p.z); });
  const bounds = (root: THREE.Object3D) => { const boxes: THREE.Box3[] = []; root.traverse(o => { if (o instanceof THREE.Mesh && o.visible && !Array.isArray(o.material) && o.material.colorWrite) boxes.push(new THREE.Box3().setFromObject(o)); }); return boxes; };
  for (const layout of [0, 1] as const) for (const pattern of ['spread', 'cluster'] as const) for (const workOrder of ['rocks-first', 'soil-first'] as const) {
    const side = layout ? -1 : 1; site.scale.x = side; truck.root.position.set(HAUL_START, 0.04, ARM_Z); site.updateMatrixWorld(true);
    const obstacleBoxes = obstacles.flatMap(o => bounds(o)), truckBoxes = bounds(truck.root), pileBoxes = piles.map(pile => bounds(pile)), rockBoxes = (workOrder === 'rocks-first' ? [cargo(0), cargo(1), cargo(2)] : rocks({ layout, pattern })).map(p => new THREE.Box3(new THREE.Vector3(p.x * side - 0.57, p.y - 0.57, p.z - 0.57), new THREE.Vector3(p.x * side + 0.57, p.y + 0.57, p.z + 0.57)));
    for (const id of [0, 1] as const) for (const secondTrip of [false, true]) {
      const base: MountainState = { ...createMountain('load-soil', { layout, pattern }, workOrder), soilLoaded: secondTrip ? [(1 - id) as 0 | 1] : [], loaderSelected: id };
      const states: MountainState[] = [];
      for (const loaderCarrying of [false, true]) for (let n = 0; n <= 60; n++) states.push({ ...base, loaderCarrying, loaderTravel: n / 60 });
      for (let n = 0; n <= 60; n++) states.push({ ...base, loaderCarrying: true, loaderDocked: true, loaderTravel: n / 60 });
      for (const [motion, seconds] of [['loader-scoop', SCOOP_SECONDS], ['loader-park', PARK_SECONDS], ['loader-tip', TIP_SECONDS], ['loader-return', secondTrip ? 1.4 : RETURN_SECONDS]] as const) for (let n = 0; n <= 60; n++) states.push({ ...base, soilLoaded: motion === 'loader-return' ? [...base.soilLoaded, id] : base.soilLoaded, loaderCarrying: motion === 'loader-tip' || motion === 'loader-park', loaderDocked: motion === 'loader-tip', loaderTravel: motion === 'loader-tip' || motion === 'loader-park' ? 1 : 0, motion, elapsed: n / 60 * seconds });
      for (const phase of ['loader-arrival', 'loader-exit'] as const) for (let n = 0; n <= 30; n++) states.push({ ...createMountain(phase, { layout, pattern }, workOrder), elapsed: n / 30 * (phase === 'loader-arrival' ? 2 : 2.7) });
      for (const s of states) {
        const p = loaderPose(s); loader.root.position.set(p.point.x, 0.04, p.point.z); loader.root.rotation.y = p.heading; loader.pose(p.lift, p.tilt, p.fill, 0); site.updateMatrixWorld(true);
        for (const box of bounds(loader.root)) {
          const where = `${layout}/${pattern}/${id}/${secondTrip}/${s.loaderCarrying}/${s.phase}/${s.motion}/${s.loaderTravel}/${s.elapsed}`;
          assert.ok(box.max.z < GUARDRAIL_Z, `guardrail: ${where}`);
          assert.ok(rockBoxes.every(rock => !box.intersectsBox(rock)), `boulder: ${where}`);
          assert.ok(truckBoxes.every(truck => !box.intersectsBox(truck)), `truck: ${where}`);
          assert.ok(s.soilLoaded.includes((1 - id) as 0 | 1) || pileBoxes[1 - id].every(pile => !box.intersectsBox(pile)), `other soil: ${where}`);
          assert.ok(obstacleBoxes.every(obstacle => !box.intersectsBox(obstacle)), `barrier/cone: ${where}`);
        }
      }
    }
  }
  shapes.disposeMaterials();
});
test('real bulldozer footprints clear rocks and guardrail throughout side-on pushing, retreat, lane changes and departure in both layouts', () => {
  const shapes = createShapes(), dozer = createBulldozer(shapes), truck = createDumpTruck(shapes, true), sweeper = createSweeper(shapes);
  const site = new THREE.Group(); site.add(dozer.root, truck.root, sweeper.root);
  const visibleBounds = (root: THREE.Object3D) => {
    const bounds = new THREE.Box3(); site.updateMatrixWorld(true);
    root.traverse(o => { if (o instanceof THREE.Mesh && o.visible && !Array.isArray(o.material) && o.material.colorWrite) bounds.union(new THREE.Box3().setFromObject(o)); });
    return bounds;
  };
  for (const layout of [0, 1]) for (const pattern of ['spread', 'cluster'] as const) {
    const side = layout ? -1 : 1; site.scale.x = side;
    const poses: MountainState[] = [];
    for (const index of [0, 1] as const) for (let n = 0; n <= 20; n++) {
      const s = createMountain('push'); s.action = 'dragging'; s.pushIndex = index; s.pushes = index ? [1, n / 20] : [n / 20, 0]; poses.push(s);
    }
    for (const phase of ['intro', 'push', 'dozer-exit'] as const) for (let n = 0; n <= 40; n++) {
      const s = createMountain(phase); s.elapsed = n / 40 * (phase === 'intro' ? 1.3 : phase === 'push' ? 1.6 : 2.7);
      if (phase === 'push') { s.motion = 'push-return'; s.action = 'auto'; s.pushes = [1, 0]; } poses.push(s);
    }
    for (const s of poses) {
      const pose = bulldozerPose(s, 22.4); dozer.root.rotation.y = pose.heading; dozer.root.position.set(pose.point.x, 0.04, pose.point.z); dozer.pose(pose.lift);
      const bounds = visibleBounds(dozer.root); assert.ok(bounds.max.z < GUARDRAIL_Z, `${s.phase}/${s.elapsed}: guardrail clearance`);
      for (const p of rocks({ pattern, layout: layout as 0 | 1 })) { const rock = new THREE.Box3(new THREE.Vector3(p.x * side - 0.57, 0, p.z - 0.57), new THREE.Vector3(p.x * side + 0.57, 1.3, p.z + 0.57)); assert.ok(!bounds.intersectsBox(rock)); }
    }
    truck.root.position.set(HAUL_START, 0.04, ARM_Z); const truckBounds = visibleBounds(truck.root);
    sweeper.root.position.set(0, 0.04, SWEEP_Z); const sweepBounds = visibleBounds(sweeper.root);
    assert.ok(!truckBounds.intersectsBox(sweepBounds)); assert.ok(sweepBounds.max.z < GUARDRAIL_Z);
    assert.ok(sweepBounds.min.z > 0.95); // The closed barriers and cones occupy the other lane.
  }
  shapes.disposeMaterials();
});
