import * as THREE from 'three';
import type { Shapes } from '../../runtime/geometry.ts';
import { pushPoint, PUSH_HEADING, mix, smooth } from './domain/mountain.ts';
import type { MountainState } from './domain/mountain.ts';

/** Retreat behind both soil strips before changing lanes or leaving the road. */
export function bulldozerPose(s: MountainState, exit: number) {
  const start = pushPoint(s.pushIndex, 0), back = { ...start, x: start.x - 0.5, z: start.z + 0.5 };
  let point = pushPoint(s.pushIndex, s.pushes[s.pushIndex]), heading = PUSH_HEADING;
  let lift = s.action === 'dragging' || s.motion === 'drive-finish' ? 0 : 0.7;
  const t = s.elapsed;
  if (s.phase === 'intro') {
    point = t < 0.95 ? { ...back, x: back.x - (1 - smooth(t / 0.95)) * exit } : mix(back, start, smooth((t - 0.95) / 0.35));
    heading = t < 0.95 ? 0 : PUSH_HEADING; lift = 1;
  } else if (s.motion === 'push-return') {
    const next = pushPoint(1, 0), nextBack = { ...next, x: next.x - 0.5, z: next.z + 0.5 };
    point = t < 0.7 ? mix(point, back, smooth(t / 0.7)) : t < 1.25 ? mix(back, nextBack, smooth((t - 0.7) / 0.55)) : mix(nextBack, next, smooth((t - 1.25) / 0.35));
    heading = t >= 0.7 && t < 1.25 ? 0 : PUSH_HEADING; lift = 1;
  } else if (s.phase === 'dozer-exit') {
    point = t < 0.9 ? mix(point, back, smooth(t / 0.9)) : { ...back, x: back.x - exit * smooth((t - 0.9) / 1.8) };
    heading = t < 0.9 ? PUSH_HEADING : Math.PI; lift = 1;
  }
  return { point, heading, lift };
}

/** A tracked dozer, with a broad blade and visible hydraulic lift arms. */
export function createBulldozer(shapes: Shapes) {
  const root = new THREE.Group(), { box, cylinder } = shapes;
  root.name = 'mountain-bulldozer';
  for (const z of [-0.82, 0.82]) {
    box(root, [3, 0.55, 0.48], [0, 0.35, z], '#39474b');
    for (let x = -1.1; x <= 1.2; x += 0.46) cylinder(root, 0.22, 0.51, [x, 0.36, z], '#8c998c', 12).rotation.x = Math.PI / 2;
    for (let x = -1.4; x < 1.5; x += 0.23) box(root, [0.08, 0.08, 0.5], [x, 0.65, z], '#6a7773');
  }
  box(root, [2.7, 0.48, 1.5], [0, 0.98, 0], '#e5a741');
  box(root, [1.35, 1.25, 1.45], [-0.55, 1.78, 0], '#edb84f');
  box(root, [1.53, 0.14, 1.65], [-0.55, 2.45, 0], '#ffda7e');
  for (const z of [-0.74, 0.74]) box(root, [1.02, 0.81, 0.04], [-0.55, 1.86, z], '#b6e0e1');
  box(root, [0.04, 0.81, 1.19], [0.14, 1.86, 0], '#b6e0e1');
  box(root, [0.93, 0.73, 1.3], [0.78, 1.37, 0], '#dba03d');
  for (const z of [-0.4, 0, 0.4]) box(root, [0.04, 0.37, 0.08], [1.26, 1.35, z], '#7d7b5f');
  cylinder(root, 0.09, 0.65, [0.9, 2, -0.36], '#65736a', 8);
  const blade = new THREE.Group(); blade.position.set(1.9, 0.68, 0); root.add(blade);
  const face = box(blade, [0.21, 1.05, 2.55], [0, 0, 0], '#e5ad4b'); face.rotation.z = 0.12;
  box(blade, [0.27, 0.14, 2.66], [0.07, -0.53, 0], '#e2dfbd');
  for (const z of [-1.22, 1.22]) box(blade, [0.48, 1.05, 0.1], [0.12, 0, z], '#f6ce79');
  const rods = [-0.8, 0.8].map(z => {
    const arm = box(root, [1.6, 0.18, 0.16], [1.07, 0.54, z], '#db9b3f');
    const piston = box(root, [1.23, 0.08, 0.09], [1.07, 0.95, z], '#dce0ce'); piston.rotation.z = -0.27;
    return { arm, piston };
  });
  const hit = shapes.hitbox(root, [4.4, 2.8, 2.8], [0.25, 1.35, 0]);
  return { root, hit, pose(lift: number) {
    blade.position.y = 0.68 + lift * 0.6;
    rods.forEach(({ arm, piston }) => { arm.rotation.z = lift * 0.3; piston.rotation.z = -0.27 + lift * 0.45; });
  } };
}
