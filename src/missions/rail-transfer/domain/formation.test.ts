import assert from 'node:assert/strict';
import test from 'node:test';
import { Effect } from 'effect';
import * as THREE from 'three';
import { acquireScene } from '../../../runtime/scene-lifecycle.ts';
import { createShapes } from '../../../runtime/geometry.ts';
import { createTrain } from '../vehicles.ts';
import { carSegments, profiles, trainExtent, CAB_TIP } from './formation.ts';
import type { Train } from './rail.ts';

test('rail models contain 8/6/6/2 physical cars, a single inward cab and connected outward coaches', async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const scene = yield* acquireScene(), shapes = createShapes();
    yield* Effect.addFinalizer(() => Effect.sync(() => shapes.disposeMaterials()));
    for (const [kind, expected] of Object.entries({ 'high-speed': 8, regional: 6, metro: 6, tram: 2 }) as [Train, number][]) {
      const model = createTrain(shapes, kind); scene.add(model.root);
      assert.equal(model.root.children.filter(child => child.name.startsWith(`rail-${kind}-`)).length, expected);
      const extent = trainExtent(kind), cars = carSegments(kind);
      assert.ok(kind === 'tram' ? extent.front - extent.rear < 8 : extent.front - extent.rear > 24);
      assert.equal(cars[0].front, CAB_TIP);
      for (const [index, car] of cars.entries()) {
        if (index) assert.ok(Math.abs(cars[index - 1].rear - car.front - profiles[kind].gap) < 1e-8);
        const object = model.root.getObjectByName(index ? `rail-${kind}-car-${index}` : `rail-${kind}-cab`)!;
        assert.ok(object.children.some(child => child instanceof THREE.Mesh), 'each car is built, not only counted in metadata');
      }
      const door = profiles[kind].door, cab = cars[0];
      assert.ok(door - profiles[kind].doorWidth / 2 > cab.rear && door + profiles[kind].doorWidth / 2 < cab.front - profiles[kind].nose, 'boarding door fits behind the cab nose');
    }
  })));
});

test('high-speed nose has a long low tip and narrows in plan instead of a full-width wedge', async () => {
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const scene = yield* acquireScene(), shapes = createShapes();
    yield* Effect.addFinalizer(() => Effect.sync(() => shapes.disposeMaterials()));
    const model = createTrain(shapes, 'high-speed'); scene.add(model.root);
    const nose = model.root.getObjectByName('high-speed-leading-nose') as THREE.Mesh;
    const vertices = nose.geometry.getAttribute('position'), points = Array.from({ length: vertices.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(vertices, i));
    const front = Math.max(...points.map(p => p.x)), rear = Math.min(...points.map(p => p.x));
    assert.ok(front - rear > 2.2, 'nose is substantially longer than the original 0.8-unit wedge');
    const tip = points.filter(p => Math.abs(p.x - front) < 1e-5), shoulder = points.filter(p => Math.abs(p.x - rear) < 1e-5);
    assert.ok(Math.max(...tip.map(p => Math.abs(p.z))) < Math.max(...shoulder.map(p => Math.abs(p.z))) / 4);
    assert.ok(Math.max(...tip.map(p => p.y)) < profiles['high-speed'].floor + 0.3);
    assert.ok(Math.max(...shoulder.map(p => p.y)) - Math.max(...tip.map(p => p.y)) > 1);
    const glass = model.root.getObjectByName('high-speed-swept-windscreen') as THREE.Mesh;
    const glassPositions = glass.geometry.getAttribute('position'), indices = glass.geometry.index!;
    model.root.updateMatrixWorld(true);
    for (let triangle = 0; triangle < indices.count; triangle += 3) {
      const point = new THREE.Vector3();
      for (let n = 0; n < 3; n++) point.add(new THREE.Vector3().fromBufferAttribute(glassPositions, indices.getX(triangle + n)));
      point.divideScalar(3);
      const ray = new THREE.Raycaster(point.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, -1, 0));
      const surface = ray.intersectObject(nose)[0]; assert.ok(surface, 'windscreen stays over the nose surface');
      assert.ok(point.y - surface.point.y > 0.005 && point.y - surface.point.y < 0.09, 'glazing follows the nose without sinking into it or floating above it');
    }
  })));
});
