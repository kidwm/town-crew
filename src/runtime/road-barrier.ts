import * as THREE from 'three';
import type { Shapes } from './geometry.ts';

/** Original road-repair movable barrier, with unchanged shape, paint and scale. */
export function createRoadBarrier(shapes: Shapes) {
  const root = new THREE.Group(), { box } = shapes;
  for (const z of [-1, 1]) {
    box(root, [0.4, 0.12, 0.55], [0, 0.03, z], '#61716b');
    box(root, [0.14, 1.2, 0.14], [0, 0.65, z], '#e0c074');
  }
  box(root, [0.17, 0.4, 2.8], [0, 0.95, 0], '#f3c463');
  for (const z of [-1.1, -0.55, 0, 0.55, 1.1]) box(root, [0.19, 0.4, 0.22], [0, 0.95, z], '#f6f1d5');
  return root;
}
