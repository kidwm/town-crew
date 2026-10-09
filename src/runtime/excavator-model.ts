import * as THREE from 'three';
import type { Shapes } from './geometry.ts';
import { BOOM, STICK, PIVOT, elbow } from './excavator-arm.ts';
import type { Point } from './excavator-arm.ts';

/** Original road excavator, including its fixed-length arm, bucket and grip. */
export function createExcavatorModel(shapes: Shapes) {
  const { box, cylinder } = shapes;
  const root = new THREE.Group();
  root.name = 'excavator';
  for (const z of [-0.85, 0.85]) {
    box(root, [2.9, 0.55, 0.48], [-4.8, 0.32, z], '#39474b');
    for (let x = -5.8; x <= -3.8; x += 0.5) {
      cylinder(root, 0.21, 0.51, [x, 0.34, z], '#8c998c', 12).rotation.x = Math.PI / 2;
    }
    for (let x = -6.1; x < -3.4; x += 0.23) box(root, [0.08, 0.08, 0.5], [x, 0.63, z], '#6a7773');
  }
  box(root, [2.6, 0.48, 1.6], [-4.8, 0.91, 0], '#e5a741');
  box(root, [1.25, 1.45, 1.4], [-5.35, 1.83, 0], '#edb84f');
  box(root, [1.4, 0.13, 1.55], [-5.35, 2.61, 0], '#ffda7e');
  for (const z of [-0.71, 0.71]) box(root, [0.86, 0.88, 0.04], [-5.25, 1.97, z], '#b6e0e1');
  box(root, [0.04, 0.88, 1.13], [-4.7, 1.97, 0], '#a0d2d9');
  box(root, [0.9, 0.95, 1.45], [-4.13, 1.46, 0], '#dba03d');
  const boom = box(root, [0.36, BOOM, 0.38], [0, 0, 0], '#efb54c');
  const stick = box(root, [0.27, STICK, 0.29], [0, 0, 0], '#efb54c');
  const piston = box(root, [0.1, 1, 0.1], [0, 0, 0], '#dde0d2');
  const joint = cylinder(root, 0.25, 0.48, [0, 0, 0], '#69766d');
  joint.rotation.x = Math.PI / 2;
  cylinder(root, 0.3, 0.53, [PIVOT.x, PIVOT.y, PIVOT.z], '#69766d').rotation.x = Math.PI / 2;
  const bucket = new THREE.Group();
  box(bucket, [0.9, 0.22, 0.95], [0.12, -0.24, 0], '#dd9335');
  box(bucket, [0.18, 0.68, 0.95], [-0.26, 0.02, 0], '#e6a242');
  for (const z of [-0.42, 0.42]) box(bucket, [0.82, 0.58, 0.13], [0.07, 0, z], '#f1b350');
  for (const z of [-0.3, 0, 0.3]) box(bucket, [0.32, 0.12, 0.14], [0.62, -0.27, z], '#f6d184');
  const hitbox = shapes.hitbox(bucket, [1.55, 1.5, 1.6], [0.1, 0, 0]);
  root.add(bucket);
  const vec = (p: Point) => new THREE.Vector3(p.x, p.y, p.z);
  const orient = (mesh: THREE.Mesh, from: Point, to: Point) => {
    const a = vec(from), b = vec(to);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  };
  return { root, bucket, hitbox, pose(bucketPoint: Point, tilt = 0) {
      const armElbow = elbow(bucketPoint);
      orient(boom, PIVOT, armElbow);
      orient(stick, armElbow, bucketPoint);
      joint.position.copy(vec(armElbow));
      const rodStart = { x: PIVOT.x + 0.15, y: PIVOT.y - 0.35, z: 0.25 };
      const rodEnd = { x: (PIVOT.x + armElbow.x) / 2, y: (PIVOT.y + armElbow.y) / 2, z: 0.25 };
      orient(piston, rodStart, rodEnd);
      piston.scale.y = vec(rodStart).distanceTo(vec(rodEnd));
      bucket.position.copy(vec(bucketPoint));
      bucket.rotation.z = tilt;
  } };
}
