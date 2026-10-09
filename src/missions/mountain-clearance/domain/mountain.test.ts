import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMountain, stages, chooseRound, rocks, cargo, grab, drive, moveBucket, release, advance, resumeMountain, progress, BED, HOME, PIVOT, ARM_Z, SWEEP_Z, GUARDRAIL_Z } from './mountain.ts';
import type { MountainState, Round } from './mountain.ts';
import { reachable, elbow, BOOM, STICK } from '../../../runtime/excavator-arm.ts';
import { createShapes } from '../../../runtime/geometry.ts';
import { createDumpTruck } from '../../../runtime/dump-truck.ts';
import { createSweeper } from '../../../runtime/sweeper.ts';
import { createBulldozer, bulldozerPose } from '../vehicles.ts';

const tick = (s: MountainState, seconds: number) => { for (let i = 0; i < seconds * 50; i++) s = advance(s, 0.02); return s; };
const restored = (s: MountainState) => { const next = resumeMountain(JSON.parse(JSON.stringify(s))); assert.ok(next, `valid save: ${s.phase}/${s.motion}`); return next; };
const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
for (const pattern of ['spread', 'cluster'] as const) for (const layout of [0, 1] as const) for (const order of orders) {
  test(`${pattern}/${layout}: two pushes, child-selected rocks ${order}, hauling and sweeping reopen the road`, () => {
    const round: Round = { pattern, layout };
    let s = tick(createMountain('intro', round), 1.4); assert.equal(s.phase, 'push');
    s = tick(drive(grab(s), 1), 2.9); assert.equal(s.motion, 'push-return');
    s = tick(restored(s), 1.7); assert.equal(s.pushIndex, 1); assert.equal(s.action, 'ready');
    s = tick(release(drive(grab(s), 1)), 3); assert.equal(s.phase, 'dozer-exit');
    s = tick(restored(s), 7.2); assert.equal(s.phase, 'excavate'); assert.deepEqual(s.pushes, [1, 1]);
    for (const id of order) {
      s = tick(moveBucket(grab(s), rocks(round)[id]), 0.8); assert.equal(s.carried, id);
      s = tick(restored(s), 1.5); assert.equal(s.action, 'ready'); assert.ok(Math.hypot(s.bucket.x - HOME.x, s.bucket.y - 4.2, s.bucket.z - HOME.z) < 0.001);
      // Automatic pickup consumes the gesture; another input cannot select another rock.
      const lifted = s; assert.equal(drive(s, 1), lifted);
      s = release(moveBucket(grab(s), BED)); assert.equal(s.motion, 'unload');
      s = tick(restored(tick(s, 0.55)), 1.7);
      assert.deepEqual(s.delivered, order.slice(0, order.indexOf(id) + 1));
    }
    assert.equal(s.phase, 'excavator-exit'); s = tick(s, 2.6); assert.equal(s.phase, 'haul');
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
  for (const pattern of ['spread', 'cluster'] as const) for (const p of [...rocks({ pattern, layout: 0 }), BED, HOME]) for (const y of [0.85, 4.2]) {
    const target = { ...p, y }, end = reachable(target, PIVOT), joint = elbow(target, PIVOT);
    assert.ok(distance(end, target) < 0.001); assert.ok(Math.abs(distance(PIVOT, joint) - BOOM) < 0.001); assert.ok(Math.abs(distance(joint, end) - STICK) < 0.001);
  }
  assert.ok(cargo(2).y > cargo(0).y);
});
test('real bulldozer footprints clear rocks and guardrail throughout diagonal pushing, retreat, lane changes and departure in both layouts', () => {
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
    truck.root.position.set(2.4, 0.04, ARM_Z); const truckBounds = visibleBounds(truck.root);
    sweeper.root.position.set(0, 0.04, SWEEP_Z); const sweepBounds = visibleBounds(sweeper.root);
    assert.ok(!truckBounds.intersectsBox(sweepBounds)); assert.ok(sweepBounds.max.z < GUARDRAIL_Z);
    assert.ok(sweepBounds.min.z > 0.95); // The closed barriers and cones occupy the other lane.
  }
  shapes.disposeMaterials();
});
