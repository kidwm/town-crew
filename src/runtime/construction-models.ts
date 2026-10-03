import * as THREE from 'three';
import type { Shapes } from './geometry.ts';

// Original house-building vehicles; mission rules stay with each mission.
export function link(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  mesh.scale.y = a.distanceTo(b);
}
export function createConstructionChassis(shapes: Shapes, color: string, long = false) {
  const { box, wheel } = shapes;
  const root = new THREE.Group();
  box(root, [long ? 5.8 : 4.7, 0.36, 1.65], [-0.55, 0.78, 0], '#4b6772');
  box(root, [1.5, 1.45, 1.55], [-2.1, 1.63, 0], color);
  box(root, [1.65, 0.14, 1.72], [-2.1, 2.39, 0], '#f1ddaa');
  for (const z of [-0.8, 0.8]) {
    box(root, [0.92, 0.76, 0.035], [-2.05, 1.85, z], '#b1d9dc');
    box(root, [0.24, 0.07, 0.08], [-1.75, 1.33, z], '#f5e7c1');
    box(root, [0.22, 0.24, 0.13], [-2.7, 1.75, z * 1.15], '#4b6772');
  }
  box(root, [0.035, 0.76, 1.25], [-2.86, 1.85, 0], '#b1d9dc');
  box(root, [0.14, 0.17, 1.8], [-2.96, 0.95, 0], '#e8e1cc');
  for (const z of [-0.54, 0.54]) box(root, [0.07, 0.23, 0.32], [-2.91, 1.25, z], '#fff1bb');
  const wheels = [-2.1, 0.4, ...(long ? [1.5] : [])].flatMap(x => [-1.03, 1.03].map(z => wheel(root, x, z, 0.46)));
  return { root, wheels, roll(x: number) { wheels.forEach(wheel => { wheel.rotation.z = -x / 0.46; }); } };
}
export function createFlatbed(shapes: Shapes, withPanels = true) {
  const vehicle = createConstructionChassis(shapes, '#719d8c', true);
  vehicle.root.name = 'flatbed-transporter';
  shapes.box(vehicle.root, [3.6, 0.26, 1.88], [0.35, 1.1, 0], '#cda276');
  for (const z of [-0.99, 0.99]) for (let x = -1.1; x < 2; x += 0.45) shapes.box(vehicle.root, [0.26, 0.17, 0.05], [x, 1.02, z], '#fff0ba');
  const cargo = (withPanels ? [0, 1, 2] : []).map(i => {
    const group = new THREE.Group(); group.position.set(0.25, 1.3 + i * 0.28, 0);
    shapes.box(group, [2.85, 0.22, 1.65], [0, 0, 0], i === 2 ? '#b9c1b6' : '#efdbb5');
    for (const x of [-0.75, 0.75]) shapes.box(group, [0.12, 0.24, 1.7], [x, 0, 0], '#b69f7b');
    vehicle.root.add(group); return group;
  });
  const hit = shapes.hitbox(vehicle.root, [6.3, 2.8, 2.5], [-0.45, 1.3, 0]);
  return { ...vehicle, cargo, hit };
}
export function createCrane(shapes: Shapes) {
  const { box, cylinder } = shapes;
  const root = new THREE.Group(); root.name = 'mobile-crane'; root.position.set(-4.7, 0, -3.8);
  box(root, [3.9, 0.45, 1.75], [0, 0.8, 0], '#d7a14a');
  box(root, [1.2, 1.35, 1.65], [-1.25, 1.6, 0], '#edbf68');
  for (const z of [-0.84, 0.84]) box(root, [0.84, 0.74, 0.035], [-1.3, 1.8, z], '#afd6d6');
  const wheels = [-1.2, 1.2].flatMap(x => [-1.04, 1.04].map(z => shapes.wheel(root, x, z, 0.48)));
  const supports: { beam: THREE.Mesh; legs: THREE.Group[] }[] = [];
  for (const x of [-1.3, 1.3]) {
    const beam = box(root, [0.22, 0.22, 3.5], [x, 0.65, 0], '#75897d');
    const legs = [-1.65, 1.65].map(z => {
      const leg = new THREE.Group(); leg.position.set(x, 0, z); root.add(leg);
      box(leg, [0.16, 0.7, 0.16], [0, 0.35, 0], '#d9ad58');
      box(leg, [0.6, 0.12, 0.6], [0, 0.03, 0], '#657b70');
      return leg;
    });
    supports.push({ beam, legs });
  }
  cylinder(root, 0.6, 0.38, [0.45, 1.24, 0], '#e8b45e');
  box(root, [1.05, 0.8, 1.35], [0.7, 1.7, 0], '#e7b55b');
  const boom = box(root, [0.37, 1, 0.4], [0, 0, 0], '#e7b24f');
  const inset = box(root, [0.18, 1, 0.2], [0, 0, 0], '#f7d998');
  const rope = cylinder(root, 0.025, 1, [0, 0, 0], '#566e68', 8);
  const hook = cylinder(root, 0.13, 0.25, [0, 0, 0], '#6c8172', 8);
  return { root, hook,
    retract(progress: number) {
      for (const { beam, legs } of supports) {
        beam.scale.z = 1 - progress * 0.5;
        legs.forEach((leg, i) => {
          leg.position.z = (i === 0 ? -1 : 1) * (1.65 - progress * 0.85);
          leg.position.y = progress * 0.55; leg.scale.y = 1 - progress * 0.85;
        });
      }
    },
    roll(distance: number) { wheels.forEach(wheel => { wheel.rotation.z = -distance / 0.48; }); },
    aim(load: THREE.Vector3, height: number) {
    const top = load.clone().sub(root.position).add(new THREE.Vector3(0, height + 0.85, 0));
    const pivot = new THREE.Vector3(0.4, 1.8, 0);
    const mid = pivot.clone().lerp(top, 0.56);
    link(boom, pivot, mid); link(inset, mid, top);
    const end = top.clone().add(new THREE.Vector3(0, -0.65, 0));
    link(rope, top, end); hook.position.copy(end);
  } };
}
