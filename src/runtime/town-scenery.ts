import * as THREE from 'three';
import type { Shapes } from './geometry.ts';

// Extracted from traffic-rescue: geometry, palette and proportions stay intact.
export function createTownTree(shapes: Shapes) {
  const root = new THREE.Group();
  shapes.cylinder(root, 0.14, 1.6, [0, 0.7, 0], '#ab9270', 8);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), shapes.material('#8bb18a'));
  crown.position.y = 2.5; root.add(crown); return root;
}
export function createTownHouse(shapes: Shapes, color = '#e4c79e', roof = '#c8917a') {
  const root = new THREE.Group(), { box } = shapes;
  box(root, [5.3, 3, 3], [0, 1.45, 0], color); box(root, [5.65, 0.24, 3.3], [0, 3.02, 0], roof);
  for (const x of [-1.6, 1.6]) {
    box(root, [1.1, 1.1, 0.08], [x, 1.9, 1.53], '#fff0d2');
    box(root, [0.89, 0.9, 0.08], [x, 1.9, 1.59], '#a9ceca');
  }
  box(root, [0.9, 1.75, 0.08], [0, 0.86, 1.55], '#8cafaa'); return root;
}
export function createTownBench(shapes: Shapes) {
  const root = new THREE.Group(), { box } = shapes;
  box(root, [3.1, 0.16, 0.78], [0, 0.48, 0], '#ba9e79');
  box(root, [3.1, 0.7, 0.1], [0, 0.9, -0.35], '#c9af85');
  for (const x of [-1.15, 1.15]) box(root, [0.12, 0.5, 0.65], [x, 0.23, 0], '#809889');
  return root;
}
