import * as THREE from 'three';
import type { Shapes } from '../../runtime/geometry.ts';
import { createCat, createDog } from '../../runtime/pets.ts';
import type { HouseState } from './domain/house.ts';

/** Keep the original house residents; vary the family and add shared pets. */
export function createResidents(shapes: Shapes, parent: THREE.Group) {
  const { cylinder, box, material } = shapes;
  const families = [[1, 1, 0.65], [1, 0.65, 0.5], [1, 1, 0.65, 0.5]];
  const residents = [0, 1, 2, 3].map(i => {
    const root = new THREE.Group(); root.name = `house-resident-${i}`; parent.add(root);
    cylinder(root, 0.17, 0.54, [0, 0.52, 0], ['#dcaa7b', '#93b2a3', '#e9c26e', '#b2a0c2'][i], 10);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8), material('#e6b594')); head.position.y = 0.98; root.add(head);
    for (const x of [-0.085, 0.085]) box(root, [0.12, 0.28, 0.16], [x, 0.16, 0], '#6f8a84');
    const arm = box(root, [0.12, 0.44, 0.12], [0.25, 0.65, 0], '#e6b594');
    return { root, arm };
  });
  const cat = createCat(shapes), dog = createDog(shapes);
  cat.root.name = 'house-cat'; cat.root.scale.setScalar(0.8); dog.root.scale.setScalar(0.85);
  for (const pet of [cat, dog]) { pet.root.position.set(3.7, 0, 2.65); parent.add(pet.root); }
  return { update(s: HouseState, time: number) {
    const family = families[s.round.family];
    residents.forEach(({ root, arm }, i) => {
      root.visible = s.phase === 'complete' && i < family.length;
      root.scale.setScalar(family[i] ?? 1);
      root.position.set(1.1 + i * 0.65, Math.max(0, Math.sin(time * 3 + i)) * 0.06, 2.55);
      arm.rotation.z = -0.6 + Math.sin(time * 4 + i) * 0.6;
    });
    cat.root.visible = s.phase === 'complete' && s.round.pet === 'cat';
    dog.root.visible = s.phase === 'complete' && s.round.pet === 'dog';
    cat.tail.rotation.y = Math.sin(time * 2) * 0.35; dog.tail.rotation.z = Math.sin(time * 6) * 0.5;
  } };
}
