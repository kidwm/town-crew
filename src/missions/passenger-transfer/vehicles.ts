import * as THREE from 'three';
import type { Shapes } from '../../runtime/geometry.ts';
import type { Vehicle } from './domain/terminal.ts';

export const PALETTES = [
  { bus: '#86b3a4', coach: '#a0acc5', case: '#cd997d' },
  { bus: '#87acbd', coach: '#d3a28f', case: '#96b7a3' },
  { bus: '#b1b88d', coach: '#8bb4b3', case: '#b0a2c4' },
  { bus: '#b6a5bc', coach: '#d0b981', case: '#87adbd' },
];
export { createTaxi } from '../../runtime/taxi.ts';
/** Passenger bodies have open interiors and actual entry gaps; no truck chassis. */
export function createBus(shapes: Shapes, kind: Exclude<Vehicle, 'taxi'>) {
  const root = new THREE.Group(), { box, wheel, cylinder } = shapes;
  root.name = `transfer-${kind}`;
  const school = kind === 'school', coach = kind === 'coach';
  const length = coach ? 7.2 : school ? 6.4 : 6.6, width = coach ? 2.5 : school ? 2.35 : 2.4;
  const floor = coach ? 1.15 : 0.72, roof = coach ? 3.0 : school ? 2.65 : 2.55;
  const front = length / 2, rear = -front, doorX = coach ? 2.55 : school ? 1.5 : 2;
  const doorWidth = school ? 1 : coach ? 1.05 : 1.35, side = width / 2;
  const colored: THREE.Mesh[] = [];
  const body = (size: number[], p: number[]) => { const m = box(root, size, p, '#86b3a4'); colored.push(m); return m; };
  box(root, [length - 0.15, 0.22, width - 0.12], [0, 0.43, 0], '#586f74');
  box(root, [length - (school ? 1.2 : 0.12), 0.16, width - 0.12], [school ? -0.55 : 0, floor, 0], '#d5cbb0');
  const cabinFront = school ? front - 1.15 : front;
  body([cabinFront - rear, 0.16, width + 0.08], [(rear + cabinFront) / 2, roof, 0]);
  body([0.12, roof - 0.56, width], [rear + 0.05, (roof + 0.56) / 2, 0]);
  for (const z of [-side, side]) {
    // Three lower panels around the coach luggage aperture; passenger door stays a real gap.
    if (coach && z > 0) {
      body([2.08, 0.72, 0.1], [-2.55, 0.9, z]);
      body([1.685, 0.72, 0.1], [1.1825, 0.9, z]);
      box(root, [1.88, 0.06, 1.9], [-0.6, 0.59, 0], '#697c7a');
      box(root, [1.88, 0.54, 0.1], [-0.6, 0.87, -0.81], '#586f70');
    } else if (z < 0) body([cabinFront - rear - 0.12, floor - 0.35, 0.1], [(rear + cabinFront) / 2, (floor + 0.35) / 2, z]);
    const sections = z > 0 ? [[rear + 0.1, doorX - doorWidth / 2], [doorX + doorWidth / 2, cabinFront - 0.08]] : [[rear + 0.1, cabinFront - 0.08]];
    for (const [a, b] of sections) {
      if (b <= a) continue;
      body([b - a, 0.47, 0.1], [(a + b) / 2, floor + 0.28, z]);
      const count = Math.max(1, Math.round((b - a) / 0.95));
      for (let n = 0; n <= count; n++) body([0.075, roof - floor - 0.36, 0.11], [a + (b - a) * n / count, (roof + floor + 0.36) / 2, z]);
      for (let n = 0; n < count; n++) {
        const glass = box(root, [(b - a) / count - 0.07, roof - floor - 0.7, 0.035], [a + (b - a) * (n + 0.5) / count, (roof + floor + 0.55) / 2, z], '#b6d8d3');
        glass.material = new THREE.MeshStandardMaterial({ color: '#b6d8d3', transparent: true, opacity: 0.3, roughness: 0.3, depthWrite: false }); glass.castShadow = false;
      }
      box(root, [b - a, 0.11, 0.12], [(a + b) / 2, floor + 0.14, z + Math.sign(z) * 0.015], school ? '#667878' : '#f5e8c5');
    }
  }
  body([0.12, roof - floor - 0.25, width], [cabinFront - 0.04, (floor + roof) / 2, 0]);
  box(root, [0.035, 0.8, width - 0.2], [cabinFront + 0.03, roof - 0.58, 0], '#a8cbc8');
  box(root, [0.03, 0.66, width - 0.35], [rear - 0.02, roof - 0.61, 0], '#a0c4c2');
  if (school) {
    body([1.22, 0.45, width - 0.14], [front - 0.55, 1.05, 0]);
    box(root, [0.07, 0.35, 1.2], [front + 0.02, 0.92, 0], '#697e7e');
    for (const z of [-0.7, 0.7]) cylinder(root, 0.14, 0.06, [front + 0.07, 1.13, z], '#fff0be', 12).rotation.z = Math.PI / 2;
  }
  for (const end of [rear - 0.09, front + 0.09]) box(root, [0.14, 0.16, width + 0.06], [end, 0.47, 0], '#d2d4be');
  for (const z of [-0.83, 0.83]) {
    box(root, [0.06, 0.19, 0.3], [front + 0.08, 0.77, z], '#fff0c3');
    box(root, [0.06, 0.2, 0.25], [rear - 0.08, 0.88, z], '#d98e78');
    box(root, [0.18, 0.28, 0.12], [cabinFront - 0.3, roof - 0.65, z * 1.6], '#658382');
  }
  const wheels = [-length * 0.31, length * 0.31].flatMap(x => [-side - 0.04, side + 0.04].map(z => wheel(root, x, z, 0.43)));
  // Seats face the front, leaving an aisle to the door.
  for (const x of [-2.25, -1.05, 0.15]) for (const z of [-0.68, 0.68]) {
    box(root, [0.62, 0.13, 0.6], [x, floor + 0.33, z], '#8a9c92');
    box(root, [0.12, 0.62, 0.62], [x - 0.3, floor + 0.57, z], '#8a9c92');
  }
  box(root, [0.55, 0.14, 0.55], [cabinFront - 0.6, floor + 0.3, -0.6], '#718982');
  const steering = cylinder(root, 0.2, 0.04, [cabinFront - 0.38, floor + 0.65, -0.6], '#596f71', 12); steering.rotation.z = 0.5;
  // Folding door panels retract into the front jamb, exposing the entry and steps.
  const door = new THREE.Group(); door.position.set(doorX - doorWidth / 2, floor - 0.05, side + 0.04); root.add(door);
  for (const n of [0, 1]) {
    const panel = box(door, [doorWidth / 2 - 0.03, roof - floor - 0.13, 0.08], [doorWidth * (n / 2 + 0.25), (roof - floor - 0.13) / 2, 0], '#648784');
    box(door, [doorWidth / 2 - 0.12, 0.83, 0.09], [panel.position.x, roof - floor - 0.7, 0.01], '#bbd9d2');
  }
  for (const n of [0, 1]) box(root, [doorWidth - 0.1, 0.12, 0.3], [doorX, floor - 0.19 - n * 0.17, side - 0.15 + n * 0.25], '#cfceb4');
  const handle = box(door, [0.12, 0.25, 0.12], [doorWidth * 0.67, 0.85, 0.08], '#fff1c7');
  const luggageDoor = new THREE.Group(); luggageDoor.position.set(-0.6, 1.25, side + 0.02); root.add(luggageDoor); luggageDoor.visible = coach;
  const hatch = box(luggageDoor, [1.88, 0.64, 0.1], [0, -0.32, 0], '#86b3a4'); colored.push(hatch);
  box(luggageDoor, [0.3, 0.055, 0.12], [0, -0.52, 0.05], '#f8edcf');
  const stop = new THREE.Group(); stop.position.set(0.25, 1.3, -side); root.add(stop); stop.visible = school;
  const sign = cylinder(stop, 0.29, 0.06, [0, 0, -0.28], '#c98372', 8); sign.rotation.x = Math.PI / 2;
  box(stop, [0.32, 0.05, 0.08], [0, 0, -0.32], '#fff2d1');
  if (kind === 'bus') {
    box(root, [1.4, 0.24, 0.06], [0, roof + 0.02, side], '#f1e4bb');
    for (const x of [-0.35, 0, 0.35]) box(root, [0.15, 0.08, 0.08], [x, roof + 0.02, side + 0.03], '#668a7d');
  }
  if (coach) for (const z of [-side, side]) for (let n = 0; n < 3; n++) box(root, [0.55, 0.1, 0.04], [-1.5 + n * 0.68, 1.51 + n * 0.12, z + Math.sign(z) * 0.05], '#f8e8c9');
  const hit = shapes.hitbox(root, [length + 0.4, roof + 0.25, width + 0.5], [0, roof / 2, 0]);
  return { root, hit, doorHandle: new THREE.Vector3(doorX + 0.2, floor + 0.8, side + 0.15), pose(distance: number, _time: number, opening: number, color: string, luggageOpen = opening) {
    colored.forEach(m => { m.material = shapes.material(school ? '#e4be68' : color); });
    wheels.forEach(w => { w.rotation.z = -distance / 0.43; });
    door.scale.x = Math.max(0.12, 1 - opening * 0.88); handle.visible = opening < 0.95;
    luggageDoor.rotation.x = -luggageOpen * Math.PI * 0.49; stop.rotation.y = opening * -Math.PI / 2;
  } };
}
export function createSuitcase(shapes: Shapes) {
  const root = new THREE.Group(), { box, cylinder } = shapes;
  const body = box(root, [0.65, 0.75, 0.4], [0, 0.44, 0], '#cd997d');
  for (const x of [-0.23, 0.23]) cylinder(root, 0.07, 0.07, [x, 0.08, 0.1], '#5f7471', 8).rotation.x = Math.PI / 2;
  for (const x of [-0.14, 0.14]) box(root, [0.035, 0.24, 0.035], [x, 0.93, 0], '#8a9e94');
  box(root, [0.32, 0.055, 0.06], [0, 1.05, 0], '#627f7c');
  for (const x of [-0.21, 0.21]) box(root, [0.035, 0.59, 0.02], [x, 0.44, 0.21], '#e9c8a0');
  box(root, [0.19, 0.21, 0.025], [0.04, 0.54, 0.22], '#f3e6bf');
  return { root, hit: shapes.hitbox(root, [0.95, 1.25, 0.75], [0, 0.55, 0]), color(value: string) { body.material = shapes.material(value); } };
}
