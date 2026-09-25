import * as THREE from 'three';
import type { Shapes } from './geometry.ts';
import { createBedGrip } from './bed-grip.ts';

// Original road-repair truck; the cleanup variant only changes paint.
export function createDumpTruck(shapes: Shapes, cleanup = false) {
  const { box, cylinder } = shapes;
  const colors = cleanup
    ? { chassis: '#4b6864', cab: '#74a28b', roof: '#a8c5a4', bed: '#ad7761', floor: '#976551', trim: '#dbad87' }
    : { chassis: '#28587c', cab: '#3c98be', roof: '#70b7d0', bed: '#eda943', floor: '#e89b3c', trim: '#ffd17a' };
  const truck = new THREE.Group();
  truck.name = 'dump-truck';
  box(truck, [4.7, 0.42, 1.65], [-0.85, 0.78, 0], colors.chassis);
  box(truck, [1.55, 1.55, 1.55], [-2.2, 1.62, 0], colors.cab);
  box(truck, [1.65, 0.15, 1.68], [-2.2, 2.43, 0], colors.roof);
  for (const z of [-0.79, 0.79]) {
    box(truck, [0.92, 0.79, 0.035], [-2.05, 1.87, z], '#b6e0e1');
    box(truck, [0.24, 0.07, 0.07], [-1.75, 1.3, z], '#ecdfbb');
  }
  box(truck, [0.035, 0.72, 1.22], [-2.99, 1.95, 0], '#b6e0e1');
  box(truck, [0.2, 0.18, 1.76], [-3.03, 0.95, 0], '#e1dfd0');
  for (const z of [-0.55, 0.55]) box(truck, [0.05, 0.24, 0.29], [-3.03, 1.3, z], '#fff1b1');
  const wheels: THREE.Group[] = [];
  for (const x of [-2.1, 0.1]) {
    cylinder(truck, 0.1, 2.24, [x, 0.48, 0], '#60727a').rotation.x = Math.PI / 2;
    for (const z of [-1.12, 1.12]) wheels.push(shapes.wheel(truck, x, z));
  }
  const bed = new THREE.Group();
  bed.position.set(1.25, 1.6, 0);
  truck.add(bed);
  box(bed, [2.8, 0.24, 1.65], [-1.3, -0.2, 0], colors.floor);
  for (const z of [-0.76, 0.76]) {
    box(bed, [2.8, 0.72, 0.16], [-1.3, 0.15, z], colors.bed);
    for (const x of [-2.5, -1.7, -0.9, -0.1]) {
      box(bed, [0.075, 0.69, 0.04], [x, 0.15, z + Math.sign(z) * 0.09], colors.trim);
    }
  }
  box(bed, [0.2, 0.72, 1.65], [-2.62, 0.15, 0], colors.bed);
  const cargo = box(bed, [2.4, 0.23, 1.35], [-1.3, 0.08, 0], '#bc956b');
  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.9, 2.25),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  );
  hitbox.position.set(-1.7, 0.05, 0);
  bed.add(hitbox);
  const bedGrip = createBedGrip(bed, [-2.62, 0.51, 0.85]);
  const driveHitbox = shapes.hitbox(truck, [4.9, 2.9, 2.7], [-0.85, 1.45, 0]);
  return { root: truck, bed, cargo, hitbox, driveHitbox, bedGrip, roll(x: number) {
    for (const wheel of wheels) wheel.rotation.z = -x / 0.48;
  } };
}
