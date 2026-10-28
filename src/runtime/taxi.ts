import * as THREE from 'three';
import type { Shapes } from './geometry.ts';
import { createCar } from './car.ts';

export function createTaxi(shapes: Shapes) {
  const car = createCar(shapes, false, { openingDoors: true }), { box } = shapes;
  car.root.name = 'transfer-taxi'; car.root.scale.setScalar(1.1);
  box(car.root, [0.55, 0.23, 0.42], [-0.15, 1.77, 0], '#fff1c2');
  for (const z of [-0.22, 0.22]) {
    box(car.root, [0.27, 0.07, 0.025], [-0.15, 1.79, z], '#668f83');
    for (let i = 0; i < 5; i++) box(car.root, [0.14, 0.09, 0.03], [-0.7 + i * 0.16, 0.61, Math.sign(z) * 0.73], i % 2 ? '#f8e7ac' : '#647f79');
  }
  box(car.root, [0.7, 0.23, 1.05], [-0.58, 0.63, 0], '#8d9e8f');
  return { root: car.root, hit: car.hit, doorHandle: new THREE.Vector3(-0.85, 0.96, 0.85),
    pose(distance: number, time: number, opening: number) { car.pose('#e5bd65', distance / 1.1, time, false, false); car.openDoors(opening, 1, true); },
  };
}
