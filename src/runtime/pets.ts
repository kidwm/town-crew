import * as THREE from 'three';
import type { Shapes } from './geometry.ts';

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

export function createDog(shapes: Shapes) {
  const root = new THREE.Group(); root.name = 'family-dog';
  const rounded = (size: number[], position: number[], color: string) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), shapes.material(color));
    mesh.scale.set(size[0], size[1], size[2]); mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true; root.add(mesh); return mesh;
  };
  rounded([0.25, 0.24, 0.4], [0, 0.35, -0.06], '#b58c67');
  rounded([0.23, 0.25, 0.24], [0, 0.64, 0.23], '#d5b38d');
  rounded([0.16, 0.1, 0.18], [0, 0.56, 0.44], '#f2dfb9');
  rounded([0.075, 0.065, 0.045], [0, 0.6, 0.59], '#536d68');
  for (const x of [-0.17, 0.17]) {
    rounded([0.09, 0.22, 0.12], [x * 1.3, 0.58, 0.19], '#856b54');
    rounded([0.025, 0.03, 0.025], [x * 0.68, 0.71, 0.43], '#536d68');
    for (const z of [-0.26, 0.2]) shapes.box(root, [0.13, 0.27, 0.16], [x, 0.135, z], '#d5b38d');
  }
  const collar = shapes.cylinder(root, 0.205, 0.075, [0, 0.49, 0.19], '#7daba1');
  collar.rotation.x = 0.25;
  const tail = new THREE.Group(); tail.position.set(0, 0.4, -0.37); root.add(tail);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 0.18, -0.15), new THREE.Vector3(0, 0.4, -0.2)]);
  tail.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.055, 7, false), shapes.material('#b58c67')));
  return { root, tail };
}
