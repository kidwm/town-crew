import * as THREE from 'three';
import type { Shapes } from './geometry.ts';
import { chassis } from './emergency-models.ts';

export function createTowTruck(shapes: Shapes) {
  const vehicle = chassis(shapes, '#e4b45d'), { box, cylinder } = shapes;
  vehicle.root.name = 'flatbed-tow-truck';
  const bed = new THREE.Group(); bed.position.set(0.85, 0.94, 0); vehicle.root.add(bed);
  box(bed, [4.2, 0.18, 2.15], [-2, 0, 0], '#879e98');
  for (const z of [-1.04, 1.04]) box(bed, [4.25, 0.12, 0.1], [-2, 0.14, z], '#e8cb83');
  for (let x = -3.7; x < 0; x += 0.45) box(bed, [0.04, 0.025, 1.88], [x, 0.11, 0], '#bcc6ae');
  const ramp = box(bed, [1.25, 0.1, 2.1], [-4.7, 0, 0], '#a7b4a2');
  cylinder(bed, 0.22, 0.75, [-0.2, 0.37, 0], '#6b8585').rotation.x = Math.PI / 2;
  const straps = [-2.8, -0.9].map(x => box(bed, [0.15, 0.08, 2.18], [x, 0.16, 0], '#e9c875'));
  return { ...vehicle, bed, pose(lowered: number, secured: boolean) { bed.rotation.z = lowered * 0.19; ramp.visible = lowered > 0.05; straps.forEach(s => { s.visible = secured; }); } };
}
