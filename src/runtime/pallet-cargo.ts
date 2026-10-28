import * as THREE from 'three';
import type { Shapes } from './geometry.ts';

export function createPalletCargo(shapes: Shapes, id?: number) {
  const root = new THREE.Group(); root.name = id === undefined ? 'port-pallet-preview' : `port-pallet-${id}`;
  for (const x of [-0.47, 0, 0.47]) shapes.box(root, [0.17, 0.13, 1.35], [x, 0.08, 0], '#9b805c');
  for (const z of [-0.54, -0.27, 0, 0.27, 0.54]) shapes.box(root, [1.3, 0.08, 0.19], [0, 0.185, z], '#c7a879');
  const crate = shapes.box(root, [1.17, 0.95, 1.18], [0, 0.69, 0], id === undefined ? '#fff0c7' : id ? '#b1c8b7' : '#e1c49a');
  for (const x of [-0.41, 0.41]) for (const z of [-0.606, 0.606]) shapes.box(root, [0.09, 0.96, 0.035], [x, 0.69, z], '#efe0b5');
  // Large, distinct shapes identify the two supplies without relying on colour.
  for (const angle of id === undefined ? [] : [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
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
  return { root, hit, crate };
}
