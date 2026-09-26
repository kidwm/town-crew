import * as THREE from 'three';
import type { Shapes } from './geometry.ts';

export function createCar(shapes: Shapes, police = false) {
  const root = new THREE.Group(), { box, wheel } = shapes;
  const panels = [box(root, [3.2, 0.5, 1.45], [0, 0.65, 0], '#d88973'), box(root, [1.6, 0.64, 1.35], [-0.2, 1.2, 0], '#d88973')];
  box(root, [0.06, 0.46, 1.19], [0.64, 1.26, 0], '#b9dedd');
  box(root, [0.06, 0.46, 1.19], [-1.03, 1.26, 0], '#b9dedd');
  for (const z of [-0.69, 0.69]) {
    box(root, [1.35, 0.39, 0.035], [-0.2, 1.26, z], '#b9dedd');
    box(root, [0.07, 0.48, 0.05], [-0.15, 1.23, z], '#f1e6c9');
    box(root, [0.23, 0.05, 0.06], [-0.35, 0.87, z * 1.08], '#f1e6c9');
    if (police) { box(root, [2.6, 0.22, 0.035], [0, 0.7, z * 1.08], '#67899a'); box(root, [0.32, 0.32, 0.045], [-0.3, 0.83, z * 1.09], '#e4bc68'); }
  }
  for (const x of [-1.62, 1.62]) box(root, [0.07, 0.16, 1.3], [x, 0.48, 0], '#dedcca');
  const lights = [-1, 1].flatMap(end => [-0.51, 0.51].map(z => box(root, [0.06, 0.19, 0.28], [end * 1.63, 0.75, z], '#f3d895')));
  const wheels = [-1.05, 1.05].flatMap(x => [-0.82, 0.82].map(z => wheel(root, x, z, 0.33)));
  const beacons = police ? [-0.35, 0.35].map((z, i) => box(root, [0.4, 0.17, 0.43], [-0.1, 1.65, z], i ? '#81a9bb' : '#d98c7c')) : [];
  const dent = box(root, [0.1, 0.16, 0.42], [1.67, 0.65, 0.3], '#8d9791');
  const hit = shapes.hitbox(root, [3.6, 1.9, 2.05], [0, 0.8, 0]);
  return { root, hit, pose(color: string, distance: number, time: number, hazard: boolean, damaged: boolean, frontGrounded = true) {
    panels.forEach(panel => { panel.material = shapes.material(police ? '#eee8d5' : color); });
    wheels.forEach((w, i) => { w.rotation.z = !frontGrounded && i >= 2 ? 0 : -distance / 0.33; });
    lights.forEach(light => { light.material = shapes.material(hazard && Math.sin(time * 5) > 0 ? '#ffe09b' : '#d7c5a1'); });
    beacons.forEach((light, i) => { light.material = shapes.material(Math.sin(time * 4 + i * Math.PI) > 0 ? '#f8c6a0' : i ? '#81a9bb' : '#d98c7c'); });
    dent.visible = damaged;
  } };
}
