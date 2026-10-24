import * as THREE from 'three';
import type { Shapes } from '../../runtime/geometry.ts';
import { chassis, link } from '../../runtime/emergency-models.ts';
import { createFlatbed } from '../../runtime/construction-models.ts';
import type { Item } from './domain/sanitation.ts';

/** Rear hopper is open: the bags enter real space before the plate pushes them inward. */
export function createGarbageTruck(shapes: Shapes) {
  const v = chassis(shapes, '#e9bc60'), { box, cylinder } = shapes;
  v.root.name = 'garbage-truck';
  box(v.root, [3.65, 0.16, 2.13], [-0.85, 1.05, 0], '#d9a955');
  box(v.root, [3.65, 0.16, 2.13], [-0.85, 3.02, 0], '#f5d68a');
  box(v.root, [0.16, 1.9, 2.13], [0.9, 2, 0], '#e4b55a');
  for (const z of [-1.02, 1.02]) {
    box(v.root, [3.65, 1.9, 0.13], [-0.85, 2, z], '#e8be68');
    box(v.root, [3.1, 0.2, 0.04], [-0.8, 1.55, z * 1.08], '#fff0ce');
    for (let x = -1.8; x < 0.4; x += 0.65) box(v.root, [0.06, 1.05, 0.05], [x, 2.15, z * 1.08], '#d4a252');
    box(v.root, [0.15, 0.8, 0.15], [-2.9, 1.55, z], '#647e7b');
  }
  // Low floor, side cheeks, upper arch: no opaque wall across the loading mouth.
  box(v.root, [0.85, 0.17, 2.12], [-3.02, 1.0, 0], '#b0a88e');
  for (const z of [-0.99, 0.99]) box(v.root, [0.85, 1.5, 0.16], [-3.02, 1.8, z], '#efc76e');
  box(v.root, [0.85, 0.18, 2.12], [-3.02, 2.6, 0], '#f3d484');
  const plate = box(v.root, [0.14, 1.2, 1.77], [-2.55, 1.75, 0], '#a3a995');
  const lift = new THREE.Group(); lift.position.set(-3.8, 0.12, 0); v.root.add(lift);
  box(lift, [0.8, 0.12, 1.1], [0, 0, 0], '#6e8882');
  for (const z of [-0.45, 0.45]) box(lift, [0.12, 0.45, 0.1], [0.23, 0.16, z], '#c7c9aa');
  const arms = [-0.72, 0.72].map(z => cylinder(v.root, 0.07, 1, [0, 0, z], '#879b91', 8));
  return { ...v, pose(raise: number, compact: number) {
    lift.position.set(-3.8 + raise * 0.15, 0.12 + raise * 2.3, 0);
    arms.forEach((arm, i) => link(arm, new THREE.Vector3(-2.8, 0.95, i ? 0.72 : -0.72), new THREE.Vector3(lift.position.x, lift.position.y, i ? 0.72 : -0.72)));
    plate.position.x = -2.55 + Math.sin(compact * Math.PI) * 1.2;
  } };
}

/** The original six-wheel flatbed is retained, with reversible loading-side boards. */
export function createRecyclingTruck(shapes: Shapes, palette: number) {
  const original = createFlatbed(shapes, false), root = new THREE.Group(); root.name = 'recycling-truck';
  original.root.rotation.y = Math.PI; root.add(original.root);
  const { box } = shapes, color = ['#719d8c', '#789faa', '#83a790', '#8d9f79'][palette];
  for (const z of [-0.95, 0.95]) {
    if (z < 0) box(root, [3.6, 0.9, 0.12], [-0.35, 1.65, z], color);
    for (const x of [-2.08, 1.35]) box(root, [0.12, 1.15, 0.13], [x, 1.73, z], '#d8c9a1');
  }
  for (const x of [-2.08, 1.35]) box(root, [0.13, 0.9, 1.9], [x, 1.65, 0], color);
  const side = new THREE.Group(); side.position.set(-0.35, 1.18, 0.98); root.add(side);
  box(side, [3.5, 0.75, 0.12], [0, 0.38, 0], color);
  // A raised recycling loop, readable through shape as well as colour.
  const emblem = new THREE.Group(); emblem.position.set(0, 0.42, 0.08); side.add(emblem);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.055, 5, 3), shapes.material('#f1ecd3')); emblem.add(loop);
  return { root, hit: original.hit, roll(distance: number) { original.roll(-distance); }, beacon(_time: number, _on: boolean) {}, pose(open: number) { side.rotation.x = open * 1.65; } };
}

/** Closed food-waste body, with an actual opening in its segmented roof. */
export function createFoodTruck(shapes: Shapes) {
  const v = chassis(shapes, '#a4b985'), { box, cylinder } = shapes; v.root.name = 'food-waste-truck';
  box(v.root, [3.4, 0.16, 2.02], [-0.8, 1.0, 0], '#b5c398');
  for (const z of [-0.97, 0.97]) box(v.root, [3.4, 1.65, 0.12], [-0.8, 1.85, z], '#b5c398');
  for (const x of [-2.44, 0.84]) box(v.root, [0.12, 1.65, 2.02], [x, 1.85, 0], '#b5c398');
  box(v.root, [1.1, 0.14, 2.02], [-1.95, 2.73, 0], '#d5ddb4');
  box(v.root, [1.25, 0.14, 2.02], [0.24, 2.73, 0], '#d5ddb4');
  box(v.root, [1.15, 0.14, 0.95], [-0.8, 2.73, -0.54], '#d5ddb4');
  box(v.root, [1.15, 0.14, 0.2], [-0.8, 2.73, 0.94], '#d5ddb4');
  const lid = new THREE.Group(); lid.position.set(-0.8, 2.81, -0.05); v.root.add(lid);
  box(lid, [1.15, 0.12, 0.9], [0, 0, 0.45], '#91a87c');
  box(lid, [0.3, 0.1, 0.12], [0, 0.1, 0.72], '#5e7b69');
  // Carrot and leaf icon on the collection body.
  const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.58, 5), shapes.material('#d99e68')); carrot.rotation.z = 2.65; carrot.position.set(-0.65, 1.95, 1.06); v.root.add(carrot);
  const leaf = box(v.root, [0.12, 0.32, 0.07], [-0.5, 2.26, 1.07], '#668c68'); leaf.rotation.z = -0.7;
  box(v.root, [2.8, 0.15, 0.06], [-0.8, 1.4, 1.06], '#f4e9c7');
  const lift = new THREE.Group(); v.root.add(lift); box(lift, [1.15, 0.13, 0.95], [0, 0, 0], '#6e8882');
  const arm = cylinder(v.root, 0.09, 1, [0, 0, 0], '#8d9d84', 8);
  return { ...v, pose(raise: number, open: number, stowed = false) {
    lift.rotation.x = stowed ? Math.PI / 2 : 0;
    lift.position.set(-0.7, stowed ? 1.45 : 0.12 + raise * 2.65, stowed ? 1.07 : 2.1 - raise * 1.05);
    link(arm, new THREE.Vector3(-0.7, 1.15, 1.0), new THREE.Vector3(-0.7, lift.position.y, lift.position.z));
    lid.rotation.x = -open * 1.85;
  } };
}
export function createBin(shapes: Shapes, food = false) {
  const root = new THREE.Group(), { box, cylinder } = shapes; root.name = food ? 'food-bin' : 'wheelie-bin';
  const color = food ? '#b3936a' : '#799d9a';
  // Open body around a visible interior; origin is the centre of the body.
  box(root, [0.95, 0.12, 0.88], [0, -0.46, 0], color);
  for (const z of [-0.42, 0.42]) box(root, [0.95, 0.95, 0.08], [0, 0, z], color);
  for (const x of [-0.44, 0.44]) box(root, [0.08, 0.95, 0.88], [x, 0, 0], color);
  for (const z of [-0.5, 0.5]) cylinder(root, 0.18, 0.13, [-0.33, -0.45, z], '#435f5a', 10).rotation.x = Math.PI / 2;
  box(root, [0.12, 0.1, 0.75], [-0.54, 0.35, 0], '#526f65');
  const lid = new THREE.Group(); lid.position.set(-0.48, 0.52, 0); root.add(lid); box(lid, [1.03, 0.12, 0.96], [0.5, 0, 0], food ? '#947854' : '#5b817e');
  const contents = new THREE.Group(); root.add(contents);
  for (let i = 0; i < 5; i++) {
    const bit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), shapes.material(food ? ['#dba372', '#9eb17e', '#efd3a0'][i % 3] : '#aeb9a4'));
    bit.position.set(Math.sin(i * 2.4) * 0.22, 0.26, Math.cos(i * 2.4) * 0.2); contents.add(bit);
  }
  if (food) {
    box(root, [0.42, 0.34, 0.03], [0.04, 0.06, 0.47], '#f1e3bc');
    const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.25, 5), shapes.material('#cf9365')); carrot.rotation.z = 2.7; carrot.position.set(0.05, 0.05, 0.5); root.add(carrot);
  }
  return { root, pose(open: number, empty: boolean) { lid.rotation.z = open * 2.2; contents.visible = !empty; } };
}
export function createCollectible(shapes: Shapes, item: Item) {
  const root = new THREE.Group(), { box, cylinder } = shapes; root.name = item;
  if (item.startsWith('bag')) {
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58, 1), shapes.material(item === 'bag-0' ? '#9ba8a1' : '#b5b7a0'));
    body.scale.set(0.88, 0.95, 0.85); body.castShadow = true; root.add(body);
    const tie = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.26, 5), shapes.material('#7c9389')); tie.position.y = 0.61; root.add(tie);
    cylinder(root, 0.12, 0.08, [0, 0.5, 0], '#e5d9ad', 8);
  } else if (item === 'cardboard') {
    for (let i = 0; i < 3; i++) box(root, [1.3, 0.22, 0.95], [0, i * 0.22 - 0.2, 0], i % 2 ? '#d7b282' : '#c9a273');
    for (const x of [-0.37, 0.37]) box(root, [0.07, 0.72, 1.0], [x, 0.04, 0], '#eee0ba');
  } else if (item === 'paper') {
    for (let i = 0; i < 5; i++) box(root, [1.25, 0.11, 0.9], [0, i * 0.11 - 0.22, 0], i % 2 ? '#e5e4d3' : '#f3efdb');
    for (const x of [-0.4, 0.4]) box(root, [0.07, 0.58, 0.95], [x, 0.03, 0], '#aa9c80');
    for (let i = 0; i < 4; i++) box(root, [0.45, 0.012, 0.035], [0, 0.29, i * 0.13 - 0.2], '#8d9c92');
  } else {
    box(root, [1.3, 0.12, 0.95], [0, -0.32, 0], '#8aa999');
    for (const z of [-0.46, 0.46]) { box(root, [1.3, 0.17, 0.08], [0, -0.16, z], '#739587'); box(root, [1.3, 0.1, 0.08], [0, 0.1, z], '#739587'); }
    for (const x of [-0.61, 0.61]) box(root, [0.08, 0.5, 0.95], [x, -0.07, 0], '#739587');
    for (const x of [-0.38, 0, 0.38]) for (const z of [-0.2, 0.2]) {
      if (item === 'cans') {
        cylinder(root, 0.15, 0.38, [x, -0.02, z], '#b6c6c0', 12); cylinder(root, 0.15, 0.035, [x, 0.19, z], '#e1e4d7', 12);
        const tab = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.014, 4, 8), shapes.material('#71867d')); tab.rotation.x = Math.PI / 2; tab.position.set(x, 0.215, z); root.add(tab);
        continue;
      }
      cylinder(root, 0.12, 0.46, [x, 0.02, z], '#b2d1c5', 8); cylinder(root, 0.065, 0.16, [x, 0.32, z], '#b2d1c5', 8); cylinder(root, 0.075, 0.06, [x, 0.42, z], '#e4d7a7', 8);
    }
  }
  return root;
}
