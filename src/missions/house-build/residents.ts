import * as THREE from 'three';
import type { Shapes } from '../../runtime/geometry.ts';
import { createCat, createDog } from '../../runtime/pets.ts';
import { createCar } from '../../runtime/car.ts';
import type { HouseState } from './domain/house.ts';
import { HOUSE_PALETTES } from './domain/round.ts';
import { ARRIVAL, FAMILIES, FAMILY_CAR_SCALE, arrivalCar, arrivalDoors, arrivalTime, arrivingResident, arrivingPet } from './domain/arrival.ts';

/** Keep the original house residents; vary the family and add shared pets. */
export function createResidents(shapes: Shapes, parent: THREE.Group) {
  const { cylinder, box, material } = shapes;
  const car = createCar(shapes, false, { openingDoors: true });
  car.root.name = 'house-family-car'; car.root.scale.setScalar(FAMILY_CAR_SCALE); parent.add(car.root);
  const residents = [0, 1, 2, 3].map(i => {
    const root = new THREE.Group(); root.name = `house-resident-${i}`; parent.add(root);
    cylinder(root, 0.17, 0.54, [0, 0.52, 0], ['#dcaa7b', '#93b2a3', '#e9c26e', '#b2a0c2'][i], 10);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8), material('#e6b594')); head.position.y = 0.98; root.add(head);
    const legs = [-0.085, 0.085].map(x => {
      const leg = new THREE.Group(); leg.position.set(x, 0.3, 0); root.add(leg);
      box(leg, [0.12, 0.28, 0.16], [0, -0.14, 0], '#6f8a84'); return leg;
    });
    const arm = box(root, [0.12, 0.44, 0.12], [0.25, 0.65, 0], '#e6b594');
    return { root, arm, legs };
  });
  const cat = createCat(shapes), dog = createDog(shapes);
  cat.root.name = 'house-cat'; cat.root.scale.setScalar(0.8); dog.root.scale.setScalar(0.85);
  for (const pet of [cat, dog]) { pet.root.position.set(3.7, 0, 2.65); parent.add(pet.root); }
  return { update(s: HouseState, time: number) {
    const family = FAMILIES[s.round.family], t = arrivalTime(s), pose = arrivalCar(t);
    car.root.visible = t >= 0; car.root.position.set(pose.x, pose.y, pose.z); car.root.rotation.y = pose.yaw;
    car.pose(HOUSE_PALETTES[s.round.palette].door, pose.distance / FAMILY_CAR_SCALE, time, false, false);
    car.openDoors(arrivalDoors(t)); car.headlights(t >= 0 && t < ARRIVAL.parked);
    residents.forEach(({ root, arm, legs }, i) => {
      const p = arrivingResident(t, i);
      root.visible = t >= 0 && i < family.length;
      root.scale.setScalar(family[i] ?? 1);
      root.position.set(p.x, p.y + (p.walking ? Math.abs(Math.sin(t * 9 + i)) * 0.035 : p.home ? Math.max(0, Math.sin(time * 3 + i)) * 0.04 : 0), p.z);
      root.rotation.y = p.yaw;
      arm.rotation.z = p.home ? -0.6 + Math.sin(time * 4 + i) * 0.6 : -0.1;
      arm.rotation.x = p.walking ? Math.sin(t * 9 + i) * 0.35 : 0;
      legs.forEach((leg, n) => { leg.rotation.x = p.seated ? -0.8 : p.walking ? Math.sin(t * 9 + i + n * Math.PI) * 0.5 : 0; });
    });
    const p = arrivingPet(t);
    for (const pet of [cat, dog]) { pet.root.position.set(p.x, p.y, p.z); pet.root.rotation.y = p.yaw; }
    cat.root.visible = t >= ARRIVAL.exit + 0.15 && s.round.pet === 'cat';
    dog.root.visible = t >= ARRIVAL.exit + 0.15 && s.round.pet === 'dog';
    cat.tail.rotation.y = Math.sin(time * 2) * 0.35; dog.tail.rotation.z = Math.sin(time * 6) * 0.5;
  } };
}
