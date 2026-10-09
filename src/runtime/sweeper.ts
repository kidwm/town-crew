import * as THREE from 'three';
import type { Shapes } from './geometry.ts';
import { chassis } from './emergency-models.ts';

/** Original traffic-rescue sweeper; geometry, brushes and palette are preserved. */
export function createSweeper(shapes: Shapes) {
  const vehicle = chassis(shapes, '#90b4a0'), { box, cylinder } = shapes;
  vehicle.root.name = 'street-sweeper';
  box(vehicle.root, [3.3, 1.55, 1.9], [-0.8, 1.6, 0], '#a9c3a3');
  box(vehicle.root, [3.5, 0.15, 2.03], [-0.8, 2.41, 0], '#f2e5bf');
  for (const z of [-0.98, 0.98]) {
    box(vehicle.root, [2.2, 0.65, 0.04], [-0.9, 1.69, z], '#799a89');
    for (let x = -1.8; x < 0.3; x += 0.3) box(vehicle.root, [0.07, 0.5, 0.06], [x, 1.69, z * 1.02], '#b7c9ad');
  }
  const brushes = [-1.35, 1.35].map(z => {
    const root = new THREE.Group(); root.position.set(0.9, 0.18, z); vehicle.root.add(root);
    cylinder(root, 0.72, 0.16, [0, 0, 0], '#6d8b7e');
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const bristle = box(root, [0.38, 0.13, 0.09], [Math.cos(a) * 0.66, -0.06, Math.sin(a) * 0.66], '#d8bc7c'); bristle.rotation.y = -a; }
    return root;
  });
  box(vehicle.root, [0.6, 0.2, 3.4], [0.9, 0.16, 0], '#6d8b7e');
  return { ...vehicle, brush(time: number, active: boolean) { brushes.forEach((b, i) => { b.rotation.y = active ? time * (i ? -8 : 8) : 0; }); } };
}
