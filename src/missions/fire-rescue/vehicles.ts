import * as THREE from 'three';
import type { Shapes } from '../../runtime/geometry.ts';

import { chassis, link } from '../../runtime/emergency-models.ts';
export { createAmbulance, createStretcher, createPerson, link } from '../../runtime/emergency-models.ts';

export function createEngine(shapes: Shapes) {
  const vehicle = chassis(shapes, '#ce7967'), { box, cylinder } = shapes;
  vehicle.root.name = 'fire-engine';
  box(vehicle.root, [3.6, 1.4, 1.9], [-0.8, 1.62, 0], '#c97565');
  for (const z of [-0.98, 0.98]) {
    box(vehicle.root, [3.5, 0.19, 0.07], [-0.8, 1.16, z], '#f9e9bd');
    for (const x of [-1.85, -0.75, 0.35]) {
      box(vehicle.root, [0.98, 0.83, 0.08], [x, 1.8, z], '#bec8bd');
      for (let y = 1.46; y < 2.17; y += 0.15) box(vehicle.root, [0.91, 0.025, 0.09], [x, y, z], '#8ca29b');
      box(vehicle.root, [0.27, 0.07, 0.11], [x, 1.51, z], '#eee9d4');
    }
  }
  const reel = cylinder(vehicle.root, 0.48, 0.27, [-1.8, 2.45, 0], '#7d9690'); reel.rotation.x = Math.PI / 2;
  cylinder(vehicle.root, 0.32, 0.3, [-1.8, 2.45, 0], '#e6c88d').rotation.x = Math.PI / 2;
  for (const z of [-0.7, 0.7]) box(vehicle.root, [2.6, 0.08, 0.09], [-0.2, 2.38, z], '#e4dfca');
  const cannon = cylinder(vehicle.root, 0.12, 1, [0, 0, 0], '#567d82');
  const tip = new THREE.Vector3(0.7, 2.75, 0.1);
  return { ...vehicle, nozzle: new THREE.Vector3(), aim(target: THREE.Vector3) {
    const base = new THREE.Vector3(0.2, 2.35, 0);
    const direction = target.clone().sub(vehicle.root.position).sub(base).normalize();
    tip.copy(base).addScaledVector(direction, 0.75);
    link(cannon, base, tip); this.nozzle.copy(tip).add(vehicle.root.position);
  } };
}
export function createLadder(shapes: Shapes) {
  const vehicle = chassis(shapes, '#cd7666'), { box, cylinder } = shapes;
  vehicle.root.name = 'aerial-fire-truck';
  box(vehicle.root, [3.45, 0.7, 1.9], [-0.8, 1.32, 0], '#e5dbc1');
  for (const z of [-0.98, 0.98]) {
    box(vehicle.root, [3.4, 0.22, 0.07], [-0.8, 1.35, z], '#cc7c69');
    for (const x of [-1.9, -0.9, 0.1]) box(vehicle.root, [0.8, 0.48, 0.08], [x, 1.42, z], '#aebfb5');
  }
  cylinder(vehicle.root, 0.66, 0.25, [-0.7, 1.82, 0], '#7d9794');
  const supports = [-1.8, 1.05].flatMap(x => [-1, 1].map(side => {
    const root = new THREE.Group(); root.position.set(x, 0, side); vehicle.root.add(root);
    box(root, [0.21, 0.2, 0.9], [0, 0.7, 0], '#738d89');
    box(root, [0.16, 0.65, 0.16], [0, 0.35, side * 0.38], '#d5ae68');
    box(root, [0.6, 0.13, 0.55], [0, 0.06, side * 0.38], '#6e837a');
    return { root, side };
  }));
  const ladder = new THREE.Group(); vehicle.root.add(ladder);
  const rails = [-0.35, 0.35].map(x => box(ladder, [0.09, 1, 0.12], [x, 0, 0], '#f4e8c6'));
  const rungs = Array.from({ length: 32 }, () => box(ladder, [0.72, 0.065, 0.12], [0, 0, 0], '#a5bcb3'));
  const inset = box(ladder, [0.23, 1, 0.15], [0, 0, -0.13], '#b7c7bd');
  const basket = new THREE.Group(); basket.name = 'rescue-basket'; vehicle.root.add(basket);
  box(basket, [1.5, 0.15, 1.2], [0, 0.04, 0], '#e7d7aa');
  for (const x of [-0.7, 0.7]) for (const z of [-0.53, 0.53]) box(basket, [0.055, 0.93, 0.055], [x, 0.53, z], '#fff0d2');
  for (const y of [0.55, 0.97]) {
    for (const z of [-0.53, 0.53]) box(basket, [1.44, 0.075, 0.065], [0, y, z], '#f0e5c5');
    for (const x of [-0.7, 0.7]) box(basket, [0.065, 0.075, 1.06], [x, y, 0], '#f0e5c5');
  }
  box(basket, [1.25, 0.24, 0.07], [0, 0.23, 0.59], '#d48067');
  const nozzle = cylinder(basket, 0.1, 0.6, [0.48, 1.1, -0.44], '#69898b'); nozzle.rotation.x = Math.PI / 2;
  const basketHit = shapes.hitbox(basket, [1.95, 1.6, 1.7], [0, 0.6, 0]);
  return { ...vehicle, basket, basketHit, pose(endpoint: THREE.Vector3, deployed: number) {
    const local = endpoint.clone().sub(vehicle.root.position), pivot = new THREE.Vector3(-0.7, 1.92, 0);
    basket.position.copy(local);
    const end = local.clone().add(new THREE.Vector3(0, 0.18, 0.2)), length = pivot.distanceTo(end);
    ladder.position.copy(pivot).add(end).multiplyScalar(0.5);
    ladder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(pivot).normalize());
    rails.forEach(rail => { rail.scale.y = length; }); inset.scale.y = length * 0.5;
    const count = Math.min(rungs.length, Math.max(2, Math.ceil(length / 0.33)));
    rungs.forEach((rung, i) => { rung.visible = i < count; rung.position.y = -length / 2 + (i + 0.5) / count * length; });
    supports.forEach(({ root, side }) => { root.position.z = side * (0.85 + deployed * 0.52); root.position.y = (1 - deployed) * 0.6; root.scale.y = 0.3 + deployed * 0.7; });
  } };
}
export function createCat(shapes: Shapes) {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.29, 12, 8), shapes.material('#dcaa76')); body.position.y = 0.3; body.scale.set(0.7, 1, 1); root.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 8), shapes.material('#e5b985')); head.position.set(0, 0.67, 0.1); root.add(head);
  for (const x of [-0.14, 0.14]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.24, 4), shapes.material('#d7a173')); ear.position.set(x, 0.86, 0.1); root.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), shapes.material('#536d68')); eye.position.set(x * 0.58, 0.7, 0.3); root.add(eye);
    shapes.box(root, [0.12, 0.13, 0.2], [x, 0.08, 0.12], '#f3dbb2');
  }
  const tail = new THREE.Group(); tail.position.set(0.19, 0.2, -0.08); root.add(tail);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0.35, 0.1, -0.3), new THREE.Vector3(0.42, 0.5, -0.25)]);
  tail.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.055, 7, false), shapes.material('#c79668')));
  return { root, tail };
}
