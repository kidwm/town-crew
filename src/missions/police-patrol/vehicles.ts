import * as THREE from 'three';
import type { Shapes } from '../../runtime/geometry.ts';
import { createOfficer, createPerson } from '../../runtime/emergency-models.ts';

export function createMotorcycle(shapes: Shapes, second = false) {
  const root = new THREE.Group(), lean = new THREE.Group(), { box, cylinder, wheel } = shapes; root.add(lean);
  root.name = second ? 'police-motorcycle-2' : 'police-motorcycle-1';
  const wheels = [-0.87, 0.87].map(x => wheel(root, x, 0, 0.38));
  box(lean, [1.8, 0.2, 0.35], [0, 0.51, 0], '#5c7479');
  const engine = cylinder(lean, 0.26, 0.48, [-0.04, 0.65, 0], '#839b9a', 8); engine.rotation.x = Math.PI / 2;
  for (const z of [-0.27, 0.27]) {
    const fork = cylinder(lean, 0.055, 0.77, [0.7, 0.69, z], '#adbbb3'); fork.rotation.z = -0.3;
    box(lean, [0.83, 0.08, 0.1], [-0.5, 0.39, z * 1.5], '#b8c3b8');
  }
  box(lean, [0.76, 0.31, 0.52], [0.17, 0.9, 0], '#eee8d5');
  box(lean, [0.79, 0.14, 0.5], [-0.46, 0.96, 0], '#5d7378');
  box(lean, [0.51, 0.62, 0.74], [0.63, 1.08, 0], '#eee8d5');
  box(lean, [0.54, 0.14, 0.78], [0.62, 0.98, 0], '#7195a4');
  box(lean, [0.08, 0.5, 0.69], [0.68, 1.64, 0], '#b7d8d5').rotation.z = -0.18;
  cylinder(lean, 0.18, 0.08, [0.94, 1.21, 0], '#fff0c4').rotation.z = Math.PI / 2;
  box(lean, [0.2, 0.08, 1.08], [0.36, 1.42, 0], '#5f7479');
  for (const z of [-0.52, 0.52]) {
    box(lean, [0.72, 0.47, 0.3], [-0.79, 0.79, z], '#eee8d5');
    box(lean, [0.73, 0.13, 0.32], [-0.79, 0.78, z], '#7195a4');
    box(lean, [0.18, 0.16, 0.04], [-0.77, 0.85, z * 1.31], '#e4bc68');
    box(lean, [0.19, 0.1, 0.15], [0.4, 1.57, z], '#718e8c');
  }
  const beacon = cylinder(lean, 0.1, 0.15, [-1.08, 1.3, 0], '#d58d7b');
  const rider = createOfficer(shapes); rider.root.position.set(-0.21, 0.88, 0); rider.root.rotation.y = Math.PI / 2; rider.root.scale.setScalar(0.77); lean.add(rider.root);
  // Helmet and visor retain the shared person's head and uniform silhouette.
  cylinder(rider.root, 0.265, 0.24, [0, 1.37, 0], '#eee8d5', 12);
  box(rider.root, [0.37, 0.14, 0.055], [0, 1.33, 0.235], '#8baeb3');
  box(rider.root, [0.16, 0.045, 0.05], [0, 1.51, 0.21], second ? '#d1ac66' : '#88b3a5');
  rider.arm.rotation.x = -1.1;
  const hit = shapes.hitbox(root, [2.65, 2.8, 1.55], [0, 1.1, 0]);
  return { root, hit, pose(distance: number, time: number, moving: boolean, waiting = false) {
    wheels.forEach(w => { w.rotation.z = -distance / 0.38; });
    lean.rotation.x = moving ? Math.sin(time * 2) * 0.04 : 0;
    beacon.material = shapes.material(Math.sin(time * 4) > 0 ? '#f4bea0' : '#d58d7b');
    rider.arm.rotation.z = waiting ? -1.45 : 0;
  } };
}

/** A passenger van with a long bonnet and continuous glazing, not a truck cab. */
export function createDetectiveVan(shapes: Shapes, police = true, color = '#627c8e') {
  const root = new THREE.Group(), { box, wheel } = shapes;
  root.name = police ? 'detective-passenger-van' : 'civilian-passenger-van';
  box(root, [4.5, 0.25, 1.82], [0, 0.5, 0], '#526c73');
  box(root, [4.5, 0.48, 1.82], [0, 0.8, 0], color);
  box(root, [0.98, 0.2, 1.77], [1.74, 1.05, 0], color);
  box(root, [3.42, 0.12, 1.86], [-0.5, 2.01, 0], color);
  box(root, [0.13, 0.94, 1.8], [-2.19, 1.49, 0], color);
  box(root, [0.09, 0.75, 1.63], [1.15, 1.57, 0], '#b0cfce').rotation.z = 0.15;
  const doors = [-1, 1].map(side => {
    box(root, [0.92, 0.79, 0.08], [0.65, 1.58, side * 0.91], color);
    box(root, [0.71, 0.52, 0.095], [0.65, 1.69, side * 0.915], '#b0cfce');
    box(root, [0.82, 0.77, 0.08], [-1.78, 1.57, side * 0.91], color);
    box(root, [0.62, 0.5, 0.095], [-1.78, 1.69, side * 0.915], '#9bbabd');
    const door = new THREE.Group(); door.position.set(-0.58, 0, side * 0.94); root.add(door);
    box(door, [1.63, 1.23, 0.09], [0, 1.37, 0], color);
    box(door, [1.37, 0.5, 0.11], [0, 1.69, 0], '#a4c6c9');
    box(door, [0.29, 0.055, 0.11], [0.54, 1.31, side * 0.06], '#dedeca');
    if (police) box(door, [0.18, 0.19, 0.12], [0.48, 1.1, side * 0.05], '#d9bc77');
    return { root: door, side };
  });
  box(root, [2.1, 0.09, 1.65], [-0.55, 1, 0], '#aebbb1');
  for (const x of [-1.47, -0.51]) box(root, [0.27, 0.64, 1.4], [x, 1.34, 0], '#71888b');
  for (const x of [-2.3, 2.3]) box(root, [0.1, 0.15, 1.82], [x, 0.61, 0], '#b7c4bd');
  for (const z of [-0.62, 0.62]) box(root, [0.08, 0.22, 0.43], [2.27, 0.91, z], '#f2dfb6');
  box(root, [0.07, 0.53, 1.48], [-2.27, 1.67, 0], '#a6c8c8');
  box(root, [0.08, 0.19, 0.57], [-2.29, 1.14, 0], '#e5ddbf');
  for (const z of [-0.77, 0.77]) box(root, [0.09, 0.4, 0.16], [-2.29, 1.25, z], '#d68d7c');
  const lights = [-0.4, 0.4].map(z => box(root, [0.08, 0.11, 0.23], [2.32, 0.8, z], '#86a5b5'));
  const wheels = [-1.44, 1.45].flatMap(x => [-0.98, 0.98].map(z => wheel(root, x, z, 0.36)));
  const hit = shapes.hitbox(root, [4.9, 2.4, 2.4], [0, 1, 0]);
  return { root, hit, open(amount: number, visibleSide = 1) {
    doors.forEach(d => { const t = d.side === visibleSide ? amount : 0; d.root.position.set(-0.58 - t * 1.43, 0, d.side * (0.94 + t * 0.14)); });
  }, pose(distance: number, time: number, on: boolean) {
    wheels.forEach(w => { w.rotation.z = -distance / 0.36; });
    lights.forEach((light, i) => { light.visible = police; light.material = shapes.material(on && Math.sin(time * 4 + i * Math.PI) > 0 ? '#efbd99' : '#7c9cab'); });
  } };
}
export function createSuspect(shapes: Shapes) {
  const person = createPerson(shapes), secondArm = new THREE.Group();
  const fixed = person.root.children.find(o => o instanceof THREE.Mesh && o.position.x === -0.27);
  if (fixed) { person.root.remove(fixed); fixed.position.set(0, -0.19, 0); secondArm.add(fixed); }
  secondArm.position.set(-0.27, 0.92, 0); person.root.add(secondArm);
  return { ...person, surrender(t: number) { person.arm.rotation.z = -2.3 * t; secondArm.rotation.z = 2.3 * t; } };
}
export function createBag(shapes: Shapes, color: string) {
  const root = new THREE.Group();
  shapes.box(root, [0.48, 0.46, 0.23], [0, 0.25, 0], color);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 6, 12, Math.PI), shapes.material('#866f58'));
  handle.position.y = 0.48; root.add(handle); return root;
}
