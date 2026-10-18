import * as THREE from 'three';
import type { Shapes } from './geometry.ts';

/** Original house resident, including the seated/walking legs and waving arm. */
export function createResident(shapes: Shapes, index = 0, shirt = ['#dcaa7b', '#93b2a3', '#e9c26e', '#b2a0c2'][index % 4]) {
  const root = new THREE.Group(), { cylinder, box, material } = shapes;
  cylinder(root, 0.17, 0.54, [0, 0.52, 0], shirt, 10);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8), material('#e6b594')); head.position.y = 0.98; root.add(head);
  const legs = [-0.085, 0.085].map(x => {
    const leg = new THREE.Group(); leg.position.set(x, 0.3, 0); root.add(leg);
    box(leg, [0.12, 0.28, 0.16], [0, -0.14, 0], '#6f8a84'); return leg;
  });
  const arm = box(root, [0.12, 0.44, 0.12], [0.25, 0.65, 0], '#e6b594');
  return { root, arm, legs };
}
