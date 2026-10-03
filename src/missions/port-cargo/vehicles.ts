import * as THREE from 'three';
import type { Shapes } from '../../runtime/geometry.ts';
import { createPerson } from '../../runtime/emergency-models.ts';

export const SHIP_COLORS = ['#77a9b2', '#89ac91', '#c8937f', '#859eaf'];
export function createCargoBoat(shapes: Shapes) {
  const root = new THREE.Group(); root.name = 'port-cargo-boat';
  const outline = new THREE.Shape(); outline.moveTo(-3.8, -1.6); outline.lineTo(2.6, -1.6);
  outline.lineTo(4.3, 0); outline.lineTo(2.6, 1.6); outline.lineTo(-3.8, 1.6); outline.closePath();
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: 0.65, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.14, bevelSegments: 1, steps: 1 }), shapes.material(SHIP_COLORS[0]));
  hull.rotation.x = -Math.PI / 2; hull.position.y = -0.18; hull.castShadow = hull.receiveShadow = true; root.add(hull);
  const deck = new THREE.Mesh(new THREE.ShapeGeometry(outline), shapes.material('#e4d5b3')); deck.rotation.x = -Math.PI / 2; deck.position.y = 0.6; deck.receiveShadow = true; root.add(deck);
  for (const z of [-1.55, 1.55]) {
    shapes.box(root, [6.3, 0.22, 0.12], [-0.55, 0.72, z], '#f0e5c8');
    for (const x of [-3.5, -1.5, 0.5, 2.5]) shapes.cylinder(root, 0.065, 0.43, [x, 0.9, z], '#e5d8b9', 6);
  }
  shapes.box(root, [1.75, 1.35, 2.3], [-2.75, 1.28, 0], '#f1e3c3');
  shapes.box(root, [1.9, 0.16, 2.45], [-2.75, 2.02, 0], '#c99573');
  for (const z of [-1.17, 1.17]) shapes.box(root, [1.25, 0.64, 0.035], [-2.75, 1.48, z], '#a7cecf');
  shapes.box(root, [0.035, 0.64, 1.65], [-1.86, 1.48, 0], '#a7cecf');
  shapes.cylinder(root, 0.15, 1.3, [-3.1, 2.5, 0], '#748b83', 8);
  shapes.box(root, [0.58, 0.32, 0.04], [-2.79, 3.05, 0], '#e6bc66');
  for (const x of [-3.2, 0, 2.4]) {
    const fender = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.085, 6, 12), shapes.material('#536c6b'));
    fender.position.set(x, 0.3, 1.73); root.add(fender);
  }
  const hit = shapes.hitbox(root, [8.3, 2.5, 3.5], [0.2, 0.8, 0]);
  return { root, hit, color(index: number) { hull.material = shapes.material(SHIP_COLORS[index]); } };
}
export function createPalletCargo(shapes: Shapes, id: number) {
  const root = new THREE.Group(); root.name = `port-pallet-${id}`;
  for (const x of [-0.47, 0, 0.47]) shapes.box(root, [0.17, 0.13, 1.35], [x, 0.08, 0], '#9b805c');
  for (const z of [-0.54, -0.27, 0, 0.27, 0.54]) shapes.box(root, [1.3, 0.08, 0.19], [0, 0.185, z], '#c7a879');
  shapes.box(root, [1.17, 0.95, 1.18], [0, 0.69, 0], id ? '#b1c8b7' : '#e1c49a');
  for (const x of [-0.41, 0.41]) for (const z of [-0.606, 0.606]) shapes.box(root, [0.09, 0.96, 0.035], [x, 0.69, z], '#efe0b5');
  // Large, distinct shapes identify the two supplies without relying on colour.
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const face = new THREE.Group(); face.rotation.y = angle; root.add(face);
    const z = 0.63;
    if (id === 0) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 6), shapes.material('#c98770')); fruit.position.set(0, 0.73, z); face.add(fruit);
      shapes.box(face, [0.06, 0.13, 0.05], [0, 0.97, z], '#8a795b');
      shapes.box(face, [0.18, 0.08, 0.05], [0.11, 0.94, z], '#82a17d').rotation.z = 0.4;
    } else {
      shapes.box(face, [0.25, 0.25, 0.06], [-0.12, 0.61, z], '#e0ad64');
      shapes.box(face, [0.25, 0.25, 0.06], [0.14, 0.61, z], '#82a9ae');
      shapes.box(face, [0.25, 0.25, 0.06], [0.01, 0.88, z], '#c98f77');
    }
  }
  const hit = shapes.hitbox(root, [1.65, 1.5, 1.65], [0, 0.72, 0]);
  return { root, hit };
}
export function createForklift(shapes: Shapes) {
  const root = new THREE.Group(); root.name = 'port-forklift';
  shapes.box(root, [1.45, 0.5, 1.95], [0, 0.57, 0.05], '#d79d72');
  shapes.box(root, [1.45, 0.66, 0.63], [0, 0.96, 0.77], '#e7b283');
  shapes.box(root, [0.73, 0.14, 0.64], [0, 0.86, 0.17], '#59716b');
  shapes.box(root, [0.73, 0.57, 0.14], [0, 1.16, 0.5], '#59716b');
  for (const x of [-0.64, 0.64]) for (const z of [-0.48, 0.68]) shapes.box(root, [0.07, 1.55, 0.07], [x, 1.59, z], '#5d7770');
  shapes.box(root, [1.47, 0.1, 1.53], [0, 2.37, 0.05], '#ebc48d');
  for (const x of [-0.5, 0.5]) shapes.box(root, [0.13, 2.18, 0.14], [x, 1.21, -0.65], '#556d67');
  const forks = new THREE.Group(); root.add(forks);
  shapes.box(forks, [1.17, 0.39, 0.13], [0, 0.23, -0.75], '#768c82');
  for (const x of [-0.31, 0.31]) {
    shapes.box(forks, [0.11, 0.5, 0.12], [x, 0.27, -0.8], '#82998d');
    shapes.box(forks, [0.11, 0.06, 2.1], [x, 0.06, -1.85], '#82998d');
  }
  const wheels = [-0.76, 0.76].flatMap(x => [-0.52, 0.66].map(z => {
    const wheel = shapes.wheel(root, 0, 0, 0.32); wheel.position.set(x, 0.32, z); wheel.rotation.y = Math.PI / 2; return wheel;
  }));
  const driver = createPerson(shapes, true); driver.root.scale.setScalar(0.53); driver.root.position.set(0, 0.82, 0.14); root.add(driver.root);
  const steering = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 6, 12), shapes.material('#567269')); steering.rotation.x = -0.5; steering.position.set(0, 1.1, -0.34); root.add(steering);
  const hit = shapes.hitbox(root, [2, 2.8, 2.7], [0, 1.2, -0.25]);
  return { root, hit, forks, pose(height: number, travel: number) { forks.position.y = height + 0.035; wheels.forEach(w => { w.rotation.z = travel / 0.32; }); } };
}
