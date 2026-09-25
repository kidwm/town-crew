import * as THREE from 'three';
import type { Shapes } from './geometry.ts';

/** Original natural rock from the first road mission, retained for mountain scenes.
 * radius 0.57 = original boulder; 0.38 = original discarded rock. */
export function createBoulder(shapes: Shapes, radius = 0.57, variant = 0) {
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), shapes.material('#a49e86'));
  rock.name = 'natural-boulder';
  rock.rotation.set(0.2, variant * 0.8, 0.1);
  rock.castShadow = true;
  return rock;
}

/** Flat broken asphalt, distinct from the preserved natural boulder. */
export function createAsphaltChunk(shapes: Shapes, variant = 0) {
  const root = new THREE.Group(); root.name = 'broken-asphalt';
  const outline = new THREE.Shape();
  outline.moveTo(-0.62, -0.34);
  for (const [x, y] of [[-0.28, -0.48], [0.53, -0.32], [0.64, 0.12], [0.27, 0.44], [-0.53, 0.32]]) outline.lineTo(x, y);
  outline.closePath();
  const geometry = new THREE.ExtrudeGeometry(outline, { depth: 0.22, bevelEnabled: false });
  geometry.translate(0, 0, -0.11); geometry.rotateX(-Math.PI / 2);
  const slab = new THREE.Mesh(geometry, [shapes.material('#535f65'), shapes.material('#858a82')]);
  slab.castShadow = slab.receiveShadow = true; root.add(slab);
  for (const [x, z, turn] of [[-0.2, -0.1, 0.4], [0.1, 0.02, -0.25]]) {
    const crack = shapes.box(root, [0.4, 0.008, 0.025], [x, 0.115, z], '#303b43'); crack.rotation.y = turn;
  }
  for (let i = 0; i < 5; i++) shapes.box(root, [0.035, 0.012, 0.03], [-0.38 + i * 0.18, 0.114, Math.sin(i * 4 + variant) * 0.23], '#99a29b');
  root.rotation.y = variant * 0.45;
  return root;
}
