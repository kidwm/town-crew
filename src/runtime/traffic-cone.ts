import * as THREE from 'three';
import type { Shapes } from './geometry.ts';

/** The original road-repair cone: square foot, tapered hollow shell and open lip. */
export function createTrafficCone(shapes: Shapes) {
  const root = new THREE.Group(); root.name = 'traffic-cone';
  shapes.cylinder(root, 0.28, 0.12, [0, 0.01, 0], '#e2dac9', 4);
  const cone = new THREE.Group(); cone.position.y = 0.065; root.add(cone);
  const profiles = [
    { points: [[0.21, 0], [0.075, 0.63]], color: '#ee9550' },
    { points: [[0.075, 0.63], [0.048, 0.63]], color: '#f5ad68' },
    { points: [[0.048, 0.63], [0.183, 0]], color: '#81492e' },
    { points: [[0.1596, 0.24], [0.136, 0.35]], color: '#fff0d0' },
  ];
  for (const { points, color } of profiles) {
    const shell = new THREE.Mesh(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), 24), shapes.material(color));
    shell.castShadow = shell.receiveShadow = true; cone.add(shell);
  }
  return root;
}
