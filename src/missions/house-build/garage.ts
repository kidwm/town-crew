import * as THREE from 'three';
import type { Shapes } from '../../runtime/geometry.ts';
import { ROOF_COLORS } from './domain/house.ts';
import type { HouseState } from './domain/house.ts';
import { HOUSE_PALETTES } from './domain/round.ts';
import { GARAGE, garageBuild } from './domain/arrival.ts';

export function createGarage(shapes: Shapes, parent: THREE.Group) {
  const { box, material } = shapes, root = new THREE.Group(); root.name = 'house-garage';
  root.position.set(GARAGE.x, 0, GARAGE.z); parent.add(root);
  const gravel = box(root, [GARAGE.width, 0.08, GARAGE.depth], [0, -0.015, 0], '#b0a285');
  const slab = box(root, [GARAGE.width, GARAGE.floor, GARAGE.depth], [0, GARAGE.floor / 2, 0], '#c5cdbf');
  const walls = [new THREE.Group(), new THREE.Group()];
  const tinted: THREE.Mesh[] = [], trims: THREE.Mesh[] = [];
  walls.forEach(wall => { wall.position.y = GARAGE.floor; root.add(wall); });
  tinted.push(box(walls[0], [0.16, 2.08, GARAGE.depth], [-1.87, 1.04, 0], '#ead0a4'));
  tinted.push(box(walls[1], [GARAGE.width - 0.2, 2.08, 0.16], [0, 1.04, -1.87], '#ead0a4'));
  // The house-facing side has a low wall and pillars, keeping passengers
  // visible while preserving a clear, covered single-car bay.
  tinted.push(box(walls[1], [0.16, 0.55, GARAGE.depth], [1.87, 0.275, 0], '#ead0a4'));
  for (const x of [-1.87, 1.87]) for (const z of [-1.87, 1.87]) trims.push(box(walls[x < 0 ? 0 : 1], [0.18, 2.08, 0.18], [x, 1.04, z], '#fff0d2'));
  const roof = new THREE.Group(); root.add(roof);
  const lid = box(roof, [4.16, 0.16, 4.06], [0, GARAGE.height - 0.08, 0], ROOF_COLORS[0]);
  trims.push(box(roof, [4.18, 0.1, 0.1], [0, GARAGE.height - 0.14, 2.04], '#fff0d2'));
  const apron = box(parent, [4, 0.035, 3], [GARAGE.x, -0.01, 3.55], '#d5cbb2');
  const walk = box(parent, [11.6, 0.04, 0.82], [-1.8, 0.015, 2.75], '#e9ddbe');
  let appearance = '';
  return { update(s: HouseState) {
    const build = garageBuild(s), key = `${s.round.palette}/${s.color}`;
    if (appearance !== key) {
      appearance = key;
      tinted.forEach(mesh => { mesh.material = material(HOUSE_PALETTES[s.round.palette].lower); });
      trims.forEach(mesh => { mesh.material = material(HOUSE_PALETTES[s.round.palette].trim); });
      lid.material = material(ROOF_COLORS[s.color]);
    }
    gravel.visible = build.gravel > 0; gravel.scale.z = Math.max(0.001, build.gravel);
    slab.visible = build.slab > 0; slab.scale.z = Math.max(0.001, build.slab);
    walls.forEach((wall, i) => { wall.visible = build.walls[i] > 0; wall.scale.y = Math.max(0.001, build.walls[i]); });
    roof.visible = build.roof > 0; roof.position.y = (1 - build.roof) * 0.6;
    apron.visible = walk.visible = build.slab === 1;
  } };
}
