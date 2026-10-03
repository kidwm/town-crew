import * as THREE from 'three';
import type { Shapes } from '../../runtime/geometry.ts';
import { createBedGrip } from '../../runtime/bed-grip.ts';
import { createConstructionChassis as chassis } from '../../runtime/construction-models.ts';
export { createFlatbed, createCrane, link } from '../../runtime/construction-models.ts';

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
  const grip = createBedGrip(bed, [-2.65, 0.8, 0.85]);
  return { ...vehicle, bed, cargo, hit, grip };
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
