import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createShapes } from '../../../runtime/geometry.ts';
import { createCar } from '../../../runtime/car.ts';
import { createTaxi } from '../../../runtime/taxi.ts';
import { createFlatbed } from '../../../runtime/construction-models.ts';
import { createPalletCargo } from '../../../runtime/pallet-cargo.ts';
import { createTowTruck } from '../../../runtime/tow-truck.ts';
import { createTrafficCone } from '../../../runtime/traffic-cone.ts';
import { createOfficer } from '../../../runtime/emergency-models.ts';
import { createDetectiveVan, createMotorcycle } from '../vehicles.ts';
import { createPoliceCamera, fitPoliceCamera, policeExitDistance, policeChoiceMarker } from '../view.ts';
import { createPolice, available, vehiclePose, inspectedPose, recoveryPose, officerPose, direction, duration, smooth, CHECKPOINT } from './police.ts';
import type { Vehicle } from './police.ts';

const shapes = createShapes(), police = createCar(shapes, true), van = createDetectiveVan(shapes), tow = createTowTruck(shapes);
const vehicles = { police, van, tow, bike0: createMotorcycle(shapes), bike1: createMotorcycle(shapes, true) };
const car = createCar(shapes), taxi = createTaxi(shapes), freight = createFlatbed(shapes, false), cone = createTrafficCone(shapes);
test('both motorcycle choice rings stay separate and within all six canvases, including reduced-motion arrows', () => {
  for (const [width, height] of [[1280, 800], [980, 800], [390, 844], [390, 619], [320, 568], [844, 390]]) for (const layout of [0, 1]) {
    const camera = createPoliceCamera(); fitPoliceCamera(camera, width, height);
    const state = createPolice('guard', { layout, color: 0, traffic: 'taxi-first' });
    const markers = (['bike0', 'bike1'] as const).map(id => policeChoiceMarker(camera, width, height, vehiclePose(state, id), direction(state.round)));
    assert.ok(markers[1].y - markers[0].y > markers[0].ry + markers[1].ry + 2.5, `${width}×${height}/${layout}: ring strokes overlap`);
    for (const p of markers) {
      assert.ok(p.x - p.rx - 26 > 0 && p.x + p.rx + 26 < width);
      assert.ok(p.y - p.ry > 90 && p.y + p.ry < height - 80, `${width}×${height}/${layout}: HUD clearance`);
    }
  }
});
for (const [id, x] of [[0, -.5], [1, 1]]) { const cargo = createPalletCargo(shapes, id); cargo.root.position.set(x, 1.23, 0); freight.root.add(cargo.root); }
function points(root: THREE.Object3D) {
  root.updateMatrixWorld(true); const result: THREE.Vector3[] = [];
  root.traverseVisible(o => {
    if (!(o instanceof THREE.Mesh) || o.material.opacity === 0) return;
    o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox!;
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) result.push(new THREE.Vector3(x, y, z).applyMatrix4(o.matrixWorld));
  });
  return result;
}
function position(root: THREE.Object3D, p: { x: number; z: number; yaw: number; y?: number; pitch?: number }) {
  root.position.set(p.x, p.y ?? .07, p.z); root.rotation.set(0, p.yaw, 0); root.rotateZ(p.pitch ?? 0);
}
function clear(a: THREE.Object3D, b: THREE.Object3D, label: string) {
  const p = new THREE.Box3().setFromPoints(points(a)), q = new THREE.Box3().setFromPoints(points(b));
  assert.ok(p.max.x <= q.min.x || q.max.x <= p.min.x || p.max.z <= q.min.z || q.max.z <= p.min.z, label);
}
test('officer approach and escort clear the actual wanted car, open doors and parked motorcycles in both layouts', () => {
  const officer = createOfficer(shapes), wanted = createCar(shapes, false, { openingDoors: true }), camera = createPoliceCamera();
  for (const layout of [0, 1]) for (const selected of ['bike0', 'bike1'] as const) {
    const s = createPolice('inspect', { layout, color: 0, traffic: 'taxi-first' }, selected, 2);
    for (const id of ['police', 'bike0', 'bike1'] as const) position(vehicles[id].root, vehiclePose(s, id));
    for (let n = 0; n <= 144; n++) {
      const t = n / 20, state = { ...s, elapsed: t }, p = officerPose(state);
      position(officer.root, { ...p, yaw: 0 }); officer.arm.rotation.z = p.arm;
      position(wanted.root, inspectedPose(state)); wanted.openDoors(smooth((t - 3.5) / .3) * (1 - smooth((t - 4.3) / .3)), direction(s.round));
      for (const obstacle of [wanted.root, ...['police', 'bike0', 'bike1'].map(id => vehicles[id as Vehicle].root)]) clear(officer.root, obstacle, `${layout}/${selected}/${t}: officer crossed ${obstacle.name || 'car'}`);
      for (const [width, height] of [[1280, 800], [980, 800], [390, 844], [390, 619], [320, 568], [844, 390]]) {
        fitPoliceCamera(camera, width, height);
        for (const point of points(officer.root)) {
          point.project(camera); const y = (1 - point.y) * height / 2;
          assert.ok(Math.abs(point.x) < 1 && y > 65 && y < height - 85, `${width}x${height}/${layout}/${t}: walking officer clipped or behind HUD`);
        }
      }
    }
  }
});
test('actual taxi, freight and recovery models clear parked crews and checkpoint cones', () => {
  for (const layout of [0, 1]) for (const selected of ['bike0', 'bike1'] as const) {
    const round = { layout, color: 0, traffic: 'taxi-first' as const }, d = direction(round);
    const s = createPolice('inspect', round, selected);
    for (const id of ['police', 'bike0', 'bike1'] as const) position(vehicles[id].root, vehiclePose(s, id));
    for (const moving of [taxi, freight, tow]) for (let n = 0; n <= 100; n++) {
      const p = moving === tow ? vehiclePose({ ...createPolice('tow', round, selected), work: { ...createPolice('tow', round, selected).work, recover: n / 100 } }, 'tow') : { ...inspectedPose({ ...s, elapsed: n / 100 * 4.4 }), yaw: (d === 1 ? 0 : Math.PI) + (moving === freight ? Math.PI : 0) };
      position(moving.root, p); tow.pose(0, false);
      for (const id of ['police', 'bike0', 'bike1'] as const) clear(moving.root, vehicles[id].root, `${layout}/${selected}/${moving.root.name} crossed ${id}`);
      for (const x of [-4.1, 4.1]) { cone.position.set(x, .07, -3.7); clear(moving.root, cone, `${moving.root.name} crossed a cone`); }
    }
    for (let n = 0; n <= 58; n++) {
      const load = { ...createPolice('tow-load', round, selected), elapsed: n / 10 }, p = recoveryPose(load);
      position(tow.root, p.rig); tow.pose(p.lowered, p.secured); position(car.root, p.car);
      for (const id of ['police', 'bike0', 'bike1'] as const) { clear(tow.root, vehicles[id].root, `lowered rig crossed ${id}`); clear(car.root, vehicles[id].root, `car on ramp crossed ${id}`); }
    }
  }
});
test('whole manual vehicles and fully opened doors fit desktop, portrait, narrow and short canvases', () => {
  const camera = createPoliceCamera();
  for (const [width, height] of [[1280, 800], [980, 800], [390, 844], [390, 619], [320, 568], [844, 390]]) {
    fitPoliceCamera(camera, width, height);
    for (const layout of [0, 1]) for (const phase of ['setup', 'guard', 'van', 'door', 'transport', 'tow'] as const) for (let n = 0; n <= 10; n++) {
      const s = createPolice(phase, { layout, color: 0, traffic: 'taxi-first' });
      const key = { setup: 'setup', guard: 'guard', van: 'arrive', door: 'door', transport: 'escort', tow: 'recover' }[phase];
      s.work[key as keyof typeof s.work] = n / 10;
      for (const id of available(s)) {
        if (phase === 'guard') s.selected = id as 'bike0' | 'bike1';
        const model = vehicles[id as Vehicle]; position(model.root, vehiclePose(s, id));
        van.open(s.work.door, direction(s.round)); tow.pose(0, false);
        for (const p of points(model.root)) {
          p.project(camera); const x = (p.x + 1) * width / 2, y = (1 - p.y) * height / 2;
          assert.ok(x > 0 && x < width && y > 65 && y < height - 85, `${width}x${height} ${layout}/${phase}/${id}/${n}: ${x.toFixed(1)},${y.toFixed(1)}`);
        }
      }
    }
    for (const layout of [0, 1]) for (let n = 0; n <= 58; n++) {
      const s = { ...createPolice('tow-load', { layout, color: 0, traffic: 'taxi-first' }), elapsed: n / 10 }, p = recoveryPose(s);
      position(tow.root, p.rig); tow.pose(p.lowered, p.secured); position(car.root, p.car);
      for (const point of [...points(tow.root), ...points(car.root)]) { point.project(camera); assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1, 'loaded rig clipped'); }
    }
  }
});
test('loaded car fits the original flatbed, stays attached, and fully leaves both sides', () => {
  for (const layout of [0, 1]) for (const exit of [14, 30, 50]) {
    const s = createPolice('depart', { layout, color: 0, traffic: 'taxi-first' });
    const p = recoveryPose(s, exit); position(car.root, { ...p.car, x: -1.15, z: 0, yaw: 0 });
    const bounds = new THREE.Box3().setFromPoints(points(car.root));
    assert.ok(bounds.min.x >= -3.25 && bounds.max.x <= .95, 'car extends outside bed');
    assert.ok(bounds.min.z >= -1.075 && bounds.max.z <= 1.075, 'tyres extend outside bed');
    const gone = recoveryPose({ ...s, elapsed: 2.2 }, exit); assert.ok((gone.car.x - gone.rig.x) * direction(s.round) < 0);
    assert.equal(gone.car.z, CHECKPOINT.z); assert.ok(Math.abs(gone.car.x) > exit - 2);
  }
});


test('arriving motorcycles and van start wholly offscreen and stop at their visible manual start without a jump', () => {
  const camera = createPoliceCamera(); van.open(0, 1);
  for (const [width, height] of [[1280, 800], [980, 800], [390, 844], [390, 619], [320, 568], [844, 390]]) {
    fitPoliceCamera(camera, width, height); const exit = policeExitDistance(camera);
    for (const layout of [0, 1]) for (const phase of ['bikes-arrival', 'van-arrival'] as const) {
      const s = createPolice(phase, { layout, color: 0, traffic: 'taxi-first' });
      const ids = phase === 'bikes-arrival' ? ['bike0', 'bike1'] as const : ['van'] as const;
      for (const id of ids) {
        const model = vehicles[id]; position(model.root, vehiclePose(s, id, exit));
        const initial = points(model.root).map(p => p.project(camera).x);
        assert.ok(layout === 0 ? Math.max(...initial) < -1 : Math.min(...initial) > 1, `${width}x${height}/${layout}/${id} appeared inside the frame`);
        for (let n = 1; n <= 40; n++) {
          position(model.root, vehiclePose({ ...s, elapsed: duration(s) * n / 40 }, id, exit));
          const projected = points(model.root).map(p => p.project(camera));
          for (const p of projected.filter(p => Math.abs(p.x) < 1)) {
            const y = (1 - p.y) * height / 2;
            assert.ok(y > 65 && y < height - 85, `${width}x${height}/${layout}/${id} entered behind HUD`);
          }
        }
        const parked = points(model.root);
        position(model.root, vehiclePose(createPolice(phase === 'bikes-arrival' ? 'guard' : 'van', s.round), id, exit));
        points(model.root).forEach((p, n) => assert.ok(p.distanceTo(parked[n]) < 1e-7, `${id} jumped at handoff`));
        for (const p of parked) { p.project(camera); assert.ok(Math.abs(p.x) < 1, `${id} was not fully visible when input unlocked`); }
      }
    }
  }
});
