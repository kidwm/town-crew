import * as THREE from 'three';
import type { Shapes } from '../../runtime/geometry.ts';
import { chassis, link } from '../../runtime/emergency-models.ts';
import { LIFT_AXLE_X, LIFT_HEIGHT } from './domain/towing.ts';

export { createCar } from '../../runtime/car.ts';
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
/** A pair of tyre cradles, used both as the draggable tool and the attached lift. */
export function createWheelYoke(shapes: Shapes) {
  const root = new THREE.Group(), { box } = shapes;
  root.name = 'wheel-lift-yoke';
  box(root, [0.16, 0.14, 2.05], [0, 0, 0], '#e5bc70');
  for (const z of [-0.82, 0.82]) {
    for (const x of [-0.26, 0.26]) box(root, [0.12, 0.2, 0.52], [x, 0.08, z], '#e5bc70');
    box(root, [0.64, 0.1, 0.45], [0, -0.02, z], '#829c96');
  }
  return root;
}
export function createWheelLiftTruck(shapes: Shapes) {
  const vehicle = chassis(shapes, '#e4b45d'), { box, cylinder } = shapes;
  vehicle.root.name = 'wheel-lift-tow-truck';
  // Same cab as the flatbed; a low equipment body leaves the boom visible.
  box(vehicle.root, [3.3, 0.65, 1.8], [-0.8, 1.16, 0], '#dfb971');
  for (const z of [-0.94, 0.94]) {
    box(vehicle.root, [2.8, 0.45, 0.06], [-0.8, 1.18, z], '#f0d698');
    for (const x of [-1.7, -0.6, 0.45]) box(vehicle.root, [0.3, 0.06, 0.07], [x, 1.26, z], '#809991');
  }
  const boom = box(vehicle.root, [0.35, 1, 0.4], [0, 0, 0], '#e1b461');
  const ram = cylinder(vehicle.root, 0.09, 1, [0, 0, 0], '#a8bab1');
  const arm = box(vehicle.root, [0.19, 1, 0.22], [0, 0, 0], '#78938f');
  const ropes = [-0.82, 0.82].map(() => cylinder(vehicle.root, 0.035, 1, [0, 0, 0], '#617b78'));
  const yoke = createWheelYoke(shapes); vehicle.root.add(yoke);
  return { ...vehicle, pose(raised: number, attached: boolean) {
    const tip = new THREE.Vector3(-3.15, 2.65 + raised * 0.25, 0), axle = new THREE.Vector3(LIFT_AXLE_X, 0.11 + raised * LIFT_HEIGHT, 0);
    link(boom, new THREE.Vector3(-0.75, 1.45, 0), tip);
    link(ram, new THREE.Vector3(-2, 1.3, 0), new THREE.Vector3(-2.5, 2.35 + raised * 0.2, 0));
    arm.visible = yoke.visible = attached;
    link(arm, new THREE.Vector3(-2.5, 0.75, 0), axle);
    yoke.position.copy(axle);
    ropes.forEach((rope, i) => { rope.visible = attached; link(rope, tip, axle.clone().add(new THREE.Vector3(0, 0.1, i ? 0.82 : -0.82))); });
  } };
}
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
