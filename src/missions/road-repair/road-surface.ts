import * as THREE from 'three';
import type { Shapes } from '../../runtime/geometry.ts';
import type { RoadDamage } from './domain/round.ts';

/** One matching opening, base and finished patch for this round's damage. */
export function createRepairSurface(shapes: Shapes, damage: RoadDamage) {
  const root = new THREE.Group();
  const center = { x: 2.25, z: 0 };
  const outline = (offset = false) => new THREE.Shape(damage.outline.map(([x, z]) => new THREE.Vector2(x - (offset ? center.x : 0), -z)));
  const road = new THREE.Shape([[-17.5, -2.95], [17.5, -2.95], [17.5, 2.95], [-17.5, 2.95]].map(([x, y]) => new THREE.Vector2(x, y)));
  road.holes.push(new THREE.Path(outline().getPoints()));
  function mesh(shape: THREE.Shape, thickness: number, y: number, color: string, centered = true) {
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geometry.translate(0, 0, -thickness / 2); geometry.rotateX(-Math.PI / 2);
    const result = new THREE.Mesh(geometry, shapes.material(color));
    result.position.set(centered ? center.x : 0, y, 0);
    result.receiveShadow = true; root.add(result);
    return result;
  }
  mesh(road, 0.15, -0.13, '#73828a', false);
  const pit = mesh(outline(true), 0.02, -0.13, '#434c50');
  const fill = mesh(outline(true), 0.16, -0.02, '#bb945f');
  const asphalt = mesh(outline(true), 0.04, 0.08, '#626e74');
  const repairedRoad = mesh(outline(true), 0.01, -0.05, '#63757e');
  const fillStones = Array.from({ length: 16 }, (_, i) => {
    const chunk = damage.chunks[i % 3], angle = i * 2.399, radius = 0.15 + (i % 4) * 0.11;
    const stone = shapes.box(root, [0.24, 0.12, 0.2], [chunk.x + Math.cos(angle) * radius, 0.17, chunk.z + Math.sin(angle) * radius], '#c9a574');
    stone.rotation.y = angle;
    return stone;
  });
  return { root, pit, fill, asphalt, repairedRoad, fillStones };
}
