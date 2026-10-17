import * as THREE from 'three';
import type { Shapes } from '../../runtime/geometry.ts';
import { pushPoint, PUSH_HEADING, mix, smooth } from './domain/mountain.ts';
import type { MountainState } from './domain/mountain.ts';
import { link } from '../../runtime/emergency-models.ts';
import { createBoulder } from '../../runtime/rocks.ts';

/** Retreat behind both soil strips before changing lanes or leaving the road. */
export function bulldozerPose(s: MountainState, exit: number) {
  const start = pushPoint(s.pushIndex, 0), back = { ...start, x: start.x - 0.5, z: start.z };
  let point = pushPoint(s.pushIndex, s.pushes[s.pushIndex]), heading = PUSH_HEADING;
  let lift = s.action === 'dragging' || s.motion === 'drive-finish' ? 0 : 0.7;
  const t = s.elapsed;
  if (s.phase === 'intro') {
    point = t < 0.95 ? { ...back, x: back.x - (1 - smooth(t / 0.95)) * exit } : mix(back, start, smooth((t - 0.95) / 0.35));
    heading = t < 0.95 ? 0 : PUSH_HEADING; lift = 1;
  } else if (s.motion === 'push-return') {
    const next = pushPoint(1, 0), nextBack = { ...next, x: next.x - 0.5, z: next.z };
    point = t < 0.7 ? mix(point, back, smooth(t / 0.7)) : t < 1.25 ? mix(back, nextBack, smooth((t - 0.7) / 0.55)) : mix(nextBack, next, smooth((t - 1.25) / 0.35));
    heading = t >= 0.7 && t < 1.25 ? -Math.PI / 2 : PUSH_HEADING; lift = 1;
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

/** Compact four-wheel skid loader: paired lift arms and an open, tilting bucket. */
export function createLoader(shapes: Shapes) {
  const root = new THREE.Group(), { box, cylinder } = shapes;
  root.name = 'mountain-skid-loader';
  box(root, [2.35, 0.52, 1.45], [-0.12, 0.72, 0], '#cd913e');
  box(root, [0.55, 1.08, 1.42], [-1, 1.25, 0], '#e4a54c');
  box(root, [0.08, 0.72, 1.12], [-1.3, 1.25, 0], '#475452');
  for (const z of [-0.4, 0, 0.4]) box(root, [0.1, 0.38, 0.08], [-1.35, 1.2, z], '#687269');
  box(root, [1.24, 1.22, 1.17], [-0.18, 1.52, 0], '#425757');
  box(root, [1.44, 0.14, 1.37], [-0.18, 2.2, 0], '#edbd6a');
  box(root, [0.045, 0.85, 0.96], [0.46, 1.58, 0], '#acd3d2');
  for (const z of [-0.6, 0.6]) {
    box(root, [1.03, 0.86, 0.035], [-0.18, 1.59, z], '#a6c8c4');
    for (const x of [-0.59, -0.27, 0.05, 0.36]) box(root, [0.04, 0.92, 0.045], [x, 1.6, z * 1.02], '#425757');
    box(root, [1.12, 0.04, 0.045], [-0.15, 1.59, z * 1.02], '#425757');
    box(root, [0.55, 0.1, 0.19], [0.55, 0.9, z], '#777e6c');
  }
  const wheels = [-0.78, 0.72].flatMap(x => [-0.87, 0.87].map(z => {
    const wheel = shapes.wheel(root, x, z, 0.49);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      const tread = box(wheel, [0.15, 0.08, 0.38], [Math.sin(angle) * 0.48, Math.cos(angle) * 0.48, 0], '#39423e'); tread.rotation.z = -angle;
    }
    return wheel;
  }));
  const boom = new THREE.Group(); boom.position.set(-0.85, 1.55, 0); root.add(boom);
  for (const z of [-0.74, 0.74]) {
    box(boom, [2.4, 0.2, 0.16], [1.2, 0, z], '#e4a54c');
    cylinder(boom, 0.13, 0.2, [0, 0, z], '#f2cd82', 12).rotation.x = Math.PI / 2;
  }
  const bucket = new THREE.Group(); bucket.name = 'loader-bucket'; bucket.position.x = 2.4; boom.add(bucket);
  box(bucket, [1.15, 0.09, 1.82], [0.38, 0, 0], '#cf9b52');
  box(bucket, [0.14, 0.66, 1.82], [-0.14, 0.3, 0], '#e2ae5c');
  const cheek = new THREE.Shape(); cheek.moveTo(-0.2, -0.03); cheek.lineTo(0.98, -0.03); cheek.lineTo(0.98, 0.1); cheek.lineTo(-0.2, 0.65); cheek.closePath();
  const geometry = new THREE.ExtrudeGeometry(cheek, { depth: 0.1, bevelEnabled: false });
  for (const z of [-0.91, 0.81]) { const side = new THREE.Mesh(geometry, shapes.material('#e5b567')); side.position.z = z; side.castShadow = side.receiveShadow = true; bucket.add(side); }
  box(bucket, [0.13, 0.1, 1.92], [0.94, 0.02, 0], '#e2dfbd');
  const lip = new THREE.Object3D(); lip.position.set(0.98, 0.08, 0); bucket.add(lip);
  const load = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68, 0), shapes.material('#bb9870'));
  load.position.set(0.3, 0.23, 0); bucket.add(load);
  const pistons = [-0.74, 0.74].map(z => ({ z, mesh: cylinder(root, 0.065, 1, [0, 0, z], '#dae0cb', 10) }));
  const hit = shapes.hitbox(root, [4.05, 3.25, 2.2], [0.4, 1.5, 0]);
  return { root, bucket, lip, hit, pose(lift: number, tilt: number, fill: number, travel: number) {
    const angle = -0.48 + 1.28 * lift; boom.rotation.z = angle; bucket.rotation.z = tilt - angle;
    load.visible = fill > 0.001; load.scale.set(0.9, 0.48 * fill, 1.02);
    pistons.forEach(({ z, mesh }) => link(mesh, new THREE.Vector3(-0.45, 0.95, z), new THREE.Vector3(-0.85 + Math.cos(angle) * 1.7, 1.55 + Math.sin(angle) * 1.7, z)));
    wheels.forEach(w => { w.rotation.z = -travel / 0.49; });
  } };
}

export function createSoilPile(shapes: Shapes, row: number) {
  const root = new THREE.Group();
  const mound = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), shapes.material('#bb9870'));
  mound.scale.set(1.15, 0.4, 0.9); mound.position.y = 0.16; root.add(mound);
  for (let i = 0; i < 8; i++) { const stone = createBoulder(shapes, 0.12 + (i % 3) * 0.035, row + i); stone.position.set(Math.sin(i * 4) * 0.8, 0.2 + (i % 2) * 0.1, Math.cos(i * 3) * 0.55); root.add(stone); }
  root.rotation.y = PUSH_HEADING - Math.PI / 2; return root;
}
