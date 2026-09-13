import * as THREE from 'three';
import type { Shapes } from '../../runtime/geometry.ts';

export function link(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  mesh.scale.y = a.distanceTo(b);
}
function chassis(shapes: Shapes, color: string) {
  const { box, wheel } = shapes, root = new THREE.Group();
  box(root, [5.5, 0.35, 1.9], [0, 0.78, 0], '#526c73');
  box(root, [1.6, 1.65, 1.85], [1.85, 1.65, 0], color);
  box(root, [1.73, 0.16, 2.02], [1.85, 2.53, 0], '#fff0d5');
  box(root, [0.04, 0.8, 1.62], [2.68, 1.95, 0], '#b5dee1');
  for (const z of [-0.96, 0.96]) {
    box(root, [1.1, 0.8, 0.045], [1.86, 1.95, z], '#acd5d9');
    box(root, [1.6, 0.17, 0.045], [1.85, 1.25, z], '#fff0d5');
    box(root, [0.26, 0.07, 0.08], [1.3, 1.48, z], '#eee5cb');
    box(root, [0.24, 0.28, 0.17], [2.35, 1.95, z * 1.14], '#617a7e');
  }
  box(root, [0.14, 0.2, 2.0], [2.78, 0.96, 0], '#e7dec8');
  for (const z of [-0.63, 0.63]) box(root, [0.07, 0.22, 0.35], [2.7, 1.32, z], '#fff6c7');
  box(root, [0.06, 0.37, 0.75], [2.7, 1.22, 0], '#778e8b');
  const lights = [-0.56, 0.56].map(z => box(root, [0.47, 0.21, 0.48], [1.85, 2.73, z], '#dc8673'));
  const wheels = [-1.9, 1.9].flatMap(x => [-1.13, 1.13].map(z => wheel(root, x, z, 0.48)));
  const hit = shapes.hitbox(root, [5.8, 3, 2.7], [0, 1.35, 0]);
  return { root, hit, roll(distance: number) { wheels.forEach(w => { w.rotation.z = -distance / 0.48; }); }, beacon(time: number, on: boolean) {
    lights.forEach((light, i) => { light.material = shapes.material(on && Math.sin(time * 4 + i * Math.PI) > 0 ? '#ffe1a4' : '#d88d7b'); });
  } };
}
export function createEngine(shapes: Shapes) {
  const vehicle = chassis(shapes, '#ce7967'), { box, cylinder } = shapes;
  vehicle.root.name = 'fire-engine';
  box(vehicle.root, [3.6, 1.4, 1.9], [-0.8, 1.62, 0], '#c97565');
  for (const z of [-0.98, 0.98]) {
    box(vehicle.root, [3.5, 0.19, 0.07], [-0.8, 1.16, z], '#f9e9bd');
    for (const x of [-1.85, -0.75, 0.35]) {
      box(vehicle.root, [0.98, 0.83, 0.08], [x, 1.8, z], '#bec8bd');
      for (let y = 1.46; y < 2.17; y += 0.15) box(vehicle.root, [0.91, 0.025, 0.09], [x, y, z], '#8ca29b');
      box(vehicle.root, [0.27, 0.07, 0.11], [x, 1.51, z], '#eee9d4');
    }
  }
  const reel = cylinder(vehicle.root, 0.48, 0.27, [-1.8, 2.45, 0], '#7d9690'); reel.rotation.x = Math.PI / 2;
  cylinder(vehicle.root, 0.32, 0.3, [-1.8, 2.45, 0], '#e6c88d').rotation.x = Math.PI / 2;
  for (const z of [-0.7, 0.7]) box(vehicle.root, [2.6, 0.08, 0.09], [-0.2, 2.38, z], '#e4dfca');
  const cannon = cylinder(vehicle.root, 0.12, 1, [0, 0, 0], '#567d82');
  const tip = new THREE.Vector3(0.7, 2.75, 0.1);
  return { ...vehicle, nozzle: new THREE.Vector3(), aim(target: THREE.Vector3) {
    const base = new THREE.Vector3(0.2, 2.35, 0);
    const direction = target.clone().sub(vehicle.root.position).sub(base).normalize();
    tip.copy(base).addScaledVector(direction, 0.75);
    link(cannon, base, tip); this.nozzle.copy(tip).add(vehicle.root.position);
  } };
}
export function createLadder(shapes: Shapes) {
  const vehicle = chassis(shapes, '#cd7666'), { box, cylinder } = shapes;
  vehicle.root.name = 'aerial-fire-truck';
  box(vehicle.root, [3.45, 0.7, 1.9], [-0.8, 1.32, 0], '#e5dbc1');
  for (const z of [-0.98, 0.98]) {
    box(vehicle.root, [3.4, 0.22, 0.07], [-0.8, 1.35, z], '#cc7c69');
    for (const x of [-1.9, -0.9, 0.1]) box(vehicle.root, [0.8, 0.48, 0.08], [x, 1.42, z], '#aebfb5');
  }
  cylinder(vehicle.root, 0.66, 0.25, [-0.7, 1.82, 0], '#7d9794');
  const supports = [-1.8, 1.05].flatMap(x => [-1, 1].map(side => {
    const root = new THREE.Group(); root.position.set(x, 0, side); vehicle.root.add(root);
    box(root, [0.21, 0.2, 0.9], [0, 0.7, 0], '#738d89');
    box(root, [0.16, 0.65, 0.16], [0, 0.35, side * 0.38], '#d5ae68');
    box(root, [0.6, 0.13, 0.55], [0, 0.06, side * 0.38], '#6e837a');
    return { root, side };
  }));
  const ladder = new THREE.Group(); vehicle.root.add(ladder);
  const rails = [-0.35, 0.35].map(x => box(ladder, [0.09, 1, 0.12], [x, 0, 0], '#f4e8c6'));
  const rungs = Array.from({ length: 32 }, () => box(ladder, [0.72, 0.065, 0.12], [0, 0, 0], '#a5bcb3'));
  const inset = box(ladder, [0.23, 1, 0.15], [0, 0, -0.13], '#b7c7bd');
  const basket = new THREE.Group(); basket.name = 'rescue-basket'; vehicle.root.add(basket);
  box(basket, [1.5, 0.15, 1.2], [0, 0.04, 0], '#e7d7aa');
  for (const x of [-0.7, 0.7]) for (const z of [-0.53, 0.53]) box(basket, [0.055, 0.93, 0.055], [x, 0.53, z], '#fff0d2');
  for (const y of [0.55, 0.97]) {
    for (const z of [-0.53, 0.53]) box(basket, [1.44, 0.075, 0.065], [0, y, z], '#f0e5c5');
    for (const x of [-0.7, 0.7]) box(basket, [0.065, 0.075, 1.06], [x, y, 0], '#f0e5c5');
  }
  box(basket, [1.25, 0.24, 0.07], [0, 0.23, 0.59], '#d48067');
  const nozzle = cylinder(basket, 0.1, 0.6, [0.48, 1.1, -0.44], '#69898b'); nozzle.rotation.x = Math.PI / 2;
  const basketHit = shapes.hitbox(basket, [1.95, 1.6, 1.7], [0, 0.6, 0]);
  return { ...vehicle, basket, basketHit, pose(endpoint: THREE.Vector3, deployed: number) {
    const local = endpoint.clone().sub(vehicle.root.position), pivot = new THREE.Vector3(-0.7, 1.92, 0);
    basket.position.copy(local);
    const end = local.clone().add(new THREE.Vector3(0, 0.18, 0.2)), length = pivot.distanceTo(end);
    ladder.position.copy(pivot).add(end).multiplyScalar(0.5);
    ladder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(pivot).normalize());
    rails.forEach(rail => { rail.scale.y = length; }); inset.scale.y = length * 0.5;
    const count = Math.min(rungs.length, Math.max(2, Math.ceil(length / 0.33)));
    rungs.forEach((rung, i) => { rung.visible = i < count; rung.position.y = -length / 2 + (i + 0.5) / count * length; });
    supports.forEach(({ root, side }) => { root.position.z = side * (0.85 + deployed * 0.52); root.position.y = (1 - deployed) * 0.6; root.scale.y = 0.3 + deployed * 0.7; });
  } };
}
export function createAmbulance(shapes: Shapes) {
  const vehicle = chassis(shapes, '#f3ecd8'), { box } = shapes;
  vehicle.root.name = 'ambulance';
  // Open rear compartment: the stretcher enters through the doors, with no
  // solid box behind them. Side walls, roof and floor enclose the cabin.
  box(vehicle.root, [3.55, 0.13, 1.98], [-0.72, 2.65, 0], '#f5eedc');
  box(vehicle.root, [3.55, 0.1, 1.98], [-0.72, 0.96, 0], '#afbfb3');
  box(vehicle.root, [0.12, 1.65, 1.98], [0.99, 1.81, 0], '#f5eedc');
  for (const z of [-0.94, 0.94]) box(vehicle.root, [3.55, 1.7, 0.1], [-0.72, 1.81, z], '#f5eedc');
  for (const z of [-1.01, 1.01]) {
    box(vehicle.root, [3.55, 0.35, 0.045], [-0.72, 1.32, z], '#85b4a3');
    box(vehicle.root, [0.85, 0.65, 0.05], [-1.4, 2.2, z], '#c0dcda');
    box(vehicle.root, [0.18, 0.6, 0.07], [0.2, 2.07, z], '#86b3a4');
    box(vehicle.root, [0.6, 0.18, 0.07], [0.2, 2.07, z], '#86b3a4');
  }
  const doors = [-1, 1].map(side => {
    const root = new THREE.Group(); root.position.set(-2.53, 1.12, side * 0.98); vehicle.root.add(root);
    box(root, [0.12, 1.55, 0.97], [0, 0.65, -side * 0.48], '#f3eddb');
    box(root, [0.14, 0.63, 0.69], [0, 0.97, -side * 0.5], '#b2d6d6');
    box(root, [0.15, 0.29, 0.96], [0, 0.16, -side * 0.48], '#85b4a3');
    return { root, side };
  });
  return { ...vehicle, open(amount: number) { doors.forEach(({ root, side }) => { root.rotation.y = -side * amount * 1.65; }); } };
}
export function createStretcher(shapes: Shapes) {
  const root = new THREE.Group(), { box, cylinder } = shapes;
  root.name = 'ambulance-stretcher';
  box(root, [1.85, 0.13, 0.82], [0, 0, 0], '#7b9691');
  box(root, [1.75, 0.17, 0.74], [0, 0.14, 0], '#e4bb7c');
  box(root, [0.4, 0.18, 0.67], [-0.65, 0.27, 0], '#fff1d8');
  for (const z of [-0.46, 0.46]) {
    box(root, [1.95, 0.055, 0.05], [0, 0.3, z], '#c7d8c9');
    for (const x of [-0.6, 0.6]) { box(root, [0.06, 0.52, 0.06], [x, -0.3, z], '#a3b9af'); cylinder(root, 0.11, 0.1, [x, -0.55, z], '#627a74').rotation.x = Math.PI / 2; }
  }
  const blanket = box(root, [1.1, 0.2, 0.71], [0.13, 0.35, 0], '#8cb9ad');
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), shapes.material('#e5bc91')); head.position.set(-0.64, 0.48, 0); root.add(head);
  const hit = shapes.hitbox(root, [2.3, 1.4, 1.35], [0, 0, 0]);
  return { root, hit, occupied(value: boolean) { blanket.visible = head.visible = value; } };
}
export function createPerson(shapes: Shapes, uniform = false) {
  const root = new THREE.Group(), { box, cylinder } = shapes;
  for (const x of [-0.11, 0.11]) box(root, [0.17, 0.39, 0.2], [x, 0.23, 0], '#627d7b');
  cylinder(root, 0.23, 0.55, [0, 0.72, 0], uniform ? '#d3a968' : '#8fb4ae', 10);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), shapes.material('#e7bd92')); head.position.y = 1.15; root.add(head);
  const hat = cylinder(root, 0.24, 0.12, [0, 1.35, 0], uniform ? '#efd27d' : '#806f59', 12);
  if (uniform) { box(root, [0.45, 0.1, 0.45], [0, 0.68, 0], '#f1e5ad'); cylinder(root, 0.3, 0.05, [0, 1.31, 0.025], '#efd27d', 12); }
  else hat.scale.y = 0.65;
  const arm = new THREE.Group(); arm.position.set(0.25, 0.92, 0); root.add(arm);
  box(arm, [0.14, 0.38, 0.15], [0, -0.14, 0], uniform ? '#d3a968' : '#8fb4ae');
  box(root, [0.14, 0.38, 0.15], [-0.27, 0.73, 0], uniform ? '#d3a968' : '#8fb4ae');
  return { root, arm };
}
export function createCat(shapes: Shapes) {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.29, 12, 8), shapes.material('#dcaa76')); body.position.y = 0.3; body.scale.set(0.7, 1, 1); root.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 8), shapes.material('#e5b985')); head.position.set(0, 0.67, 0.1); root.add(head);
  for (const x of [-0.14, 0.14]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.24, 4), shapes.material('#d7a173')); ear.position.set(x, 0.86, 0.1); root.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), shapes.material('#536d68')); eye.position.set(x * 0.58, 0.7, 0.3); root.add(eye);
    shapes.box(root, [0.12, 0.13, 0.2], [x, 0.08, 0.12], '#f3dbb2');
  }
  const tail = new THREE.Group(); tail.position.set(0.19, 0.2, -0.08); root.add(tail);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0.35, 0.1, -0.3), new THREE.Vector3(0.42, 0.5, -0.25)]);
  tail.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.055, 7, false), shapes.material('#c79668')));
  return { root, tail };
}
