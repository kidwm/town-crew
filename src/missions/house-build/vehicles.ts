import * as THREE from 'three';
import type { Shapes } from '../../runtime/geometry.ts';

export function link(mesh: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  mesh.scale.y = a.distanceTo(b);
}
function chassis(shapes: Shapes, color: string, long = false) {
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
export function createDump(shapes: Shapes) {
  const vehicle = chassis(shapes, '#5a9caf');
  vehicle.root.name = 'house-gravel-truck';
  const bed = new THREE.Group(); bed.position.set(1.5, 1.25, 0); vehicle.root.add(bed);
  shapes.box(bed, [2.8, 0.2, 1.7], [-1.3, 0, 0], '#d79b46');
  for (const z of [-0.8, 0.8]) {
    shapes.box(bed, [2.8, 0.8, 0.14], [-1.3, 0.4, z], '#ecb75c');
    for (const x of [-2.4, -1.6, -0.8, 0]) shapes.box(bed, [0.08, 0.73, 0.06], [x, 0.4, z * 1.1], '#ffe0a3');
  }
  shapes.box(bed, [0.16, 0.8, 1.7], [-2.65, 0.4, 0], '#ecb75c');
  const cargo = shapes.box(bed, [2.4, 0.32, 1.44], [-1.25, 0.38, 0], '#b6a285');
  const hit = shapes.hitbox(bed, [2.9, 1.5, 2.2], [-1.3, 0.3, 0]);
  return { ...vehicle, bed, cargo, hit };
}
export function createMixer(shapes: Shapes) {
  const vehicle = chassis(shapes, '#dc9d77', true);
  vehicle.root.name = 'concrete-mixer';
  const holder = new THREE.Group(); holder.position.set(0.1, 1.97, 0); holder.rotation.z = -Math.PI / 2 + 0.16;
  vehicle.root.add(holder);
  const drum = new THREE.Group(); holder.add(drum);
  const profile = [[0.36, -1.35], [0.76, -0.85], [0.84, 0.4], [0.6, 0.95], [0.25, 1.3]];
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 20), shapes.material('#f4e9cb'));
  body.castShadow = true; drum.add(body);
  const radiusAt = (y: number) => {
    const next = profile.findIndex(([, py]) => py >= y);
    const [ar, ay] = profile[Math.max(0, next - 1)], [br, by] = profile[Math.max(0, next)];
    return ar + (br - ar) * ((y - ay) / Math.max(0.001, by - ay)) + 0.014;
  };
  for (let stripe = 0; stripe < 2; stripe++) {
    const vertices: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 48; i++) {
      const y = -1.2 + i / 48 * 2.4, angle = i / 48 * Math.PI * 1.5 + stripe * Math.PI, radius = radiusAt(y);
      for (const side of [-1, 1]) vertices.push(Math.cos(angle + side * 0.17) * radius, y, Math.sin(angle + side * 0.17) * radius);
      if (i < 48) { const k = i * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    drum.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#d7946f', roughness: 0.85, side: THREE.DoubleSide })));
  }
  shapes.box(vehicle.root, [0.6, 0.38, 0.85], [1.65, 1.8, 0], '#8baca7');
  return { ...vehicle, drum };
}
export function createFlatbed(shapes: Shapes) {
  const vehicle = chassis(shapes, '#719d8c', true);
  vehicle.root.name = 'flatbed-transporter';
  shapes.box(vehicle.root, [3.6, 0.26, 1.88], [0.35, 1.1, 0], '#cda276');
  for (const z of [-0.99, 0.99]) for (let x = -1.1; x < 2; x += 0.45) shapes.box(vehicle.root, [0.26, 0.17, 0.05], [x, 1.02, z], '#fff0ba');
  const cargo = [0, 1, 2].map(i => {
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
  for (const x of [-1.2, 1.2]) for (const z of [-1.04, 1.04]) shapes.wheel(root, x, z, 0.48);
  for (const x of [-1.3, 1.3]) {
    box(root, [0.22, 0.22, 3.5], [x, 0.65, 0], '#75897d');
    for (const z of [-1.65, 1.65]) {
      box(root, [0.16, 0.7, 0.16], [x, 0.35, z], '#d9ad58');
      box(root, [0.6, 0.12, 0.6], [x, 0.03, z], '#657b70');
    }
  }
  cylinder(root, 0.6, 0.38, [0.45, 1.24, 0], '#e8b45e');
  box(root, [1.05, 0.8, 1.35], [0.7, 1.7, 0], '#e7b55b');
  const boom = box(root, [0.37, 1, 0.4], [0, 0, 0], '#e7b24f');
  const inset = box(root, [0.18, 1, 0.2], [0, 0, 0], '#f7d998');
  const rope = cylinder(root, 0.025, 1, [0, 0, 0], '#566e68', 8);
  const hook = cylinder(root, 0.13, 0.25, [0, 0, 0], '#6c8172', 8);
  return { root, aim(load: THREE.Vector3, height: number) {
    const top = load.clone().sub(root.position).add(new THREE.Vector3(0, height + 0.85, 0));
    const pivot = new THREE.Vector3(0.4, 1.8, 0);
    const mid = pivot.clone().lerp(top, 0.56);
    link(boom, pivot, mid); link(inset, mid, top);
    const end = top.clone().add(new THREE.Vector3(0, -0.65, 0));
    link(rope, top, end); hook.position.copy(end);
  } };
}
