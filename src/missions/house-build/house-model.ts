import * as THREE from 'three';
import type { Shapes } from '../../runtime/geometry.ts';
import { PARTS, ROOF_COLORS } from './domain/house.ts';
import type { HouseState } from './domain/house.ts';
import { HOUSE_PALETTES, ROOF_TYPES } from './domain/round.ts';

/** The original six house pieces, with coordinated roof/window and palette variants. */
export function createHouseParts(shapes: Shapes, parent: THREE.Group) {
  const { box, cylinder, material } = shapes;
  const windows: THREE.Mesh[] = [], windowGroups: THREE.Group[] = [], crossbars: THREE.Mesh[] = [];
  const tinted: { mesh: THREE.Mesh; role: keyof typeof HOUSE_PALETTES[0] }[] = [];
  const roofs: { group: THREE.Group; kind: string }[] = [], roofMeshes: THREE.Mesh[] = [];
  const ghostMaterial = new THREE.MeshBasicMaterial({ color: '#fff2bd', transparent: true, opacity: 0.23, depthWrite: false });
  function part(index: number, ghost = false) {
    const root = new THREE.Group(); root.name = `house-part-${index}${ghost ? '-ghost' : ''}`;
    const definition = PARTS[index];
    const paint = (parent: THREE.Object3D, size: number[], xyz: number[], role: keyof typeof HOUSE_PALETTES[0]) => {
      const mesh = box(parent, size, xyz, HOUSE_PALETTES[0][role]);
      if (!ghost) tinted.push({ mesh, role });
      return mesh;
    };
    function window(x: number, z: number, yaw: number, side = false) {
      const group = new THREE.Group(); group.position.set(x, 1.15, z); group.rotation.y = yaw; root.add(group);
      const width = side ? 0.85 : 0.98;
      paint(group, [width, 1.06, 0.12], [0, 0, 0.1], 'trim');
      const glass = box(group, [width - 0.21, 0.86, 0.14], [0, 0, 0.15], '#91b9ba');
      if (!ghost) windows.push(glass);
      if (!side) paint(group, [0.045, 0.88, 0.17], [0, 0, 0.2], 'trim');
      const bar = paint(group, [width - 0.19, 0.05, 0.17], [0, 0, 0.2], 'trim');
      crossbars.push(bar); windowGroups.push(group);
    }
    const front = definition.kind === 'front';
    if (definition.kind === 'front' || definition.kind === 'back') {
      const z = front ? 1.6 : -1.6, x = front ? -2 : 2, wall = index >= 3 ? 'upper' : 'lower';
      paint(root, [4.2, 2, 0.18], [0, 1, z], wall);
      paint(root, [0.18, 2, 3.2], [x, 1, 0], wall);
      paint(root, [4.3, 0.1, 0.25], [0, 1.96, z], 'trim');
      paint(root, [0.25, 0.1, 3.25], [x, 1.96, 0], 'trim');
      for (const wx of [-1.1, 1.1]) {
        if (index === 0 && wx < 0) {
          paint(root, [0.95, 1.66, 0.11], [wx, 0.84, z + 0.1], 'trim');
          paint(root, [0.75, 1.5, 0.13], [wx, 0.77, z + 0.17], 'door');
          cylinder(root, 0.045, 0.06, [wx + 0.24, 0.84, z + 0.26], '#fbe4a5', 10).rotation.x = Math.PI / 2;
        } else window(wx, z, front ? 0 : Math.PI);
      }
      for (const wz of [-0.85, 0.85]) window(x, wz, front ? -Math.PI / 2 : Math.PI / 2, true);
    } else if (definition.kind === 'floor') {
      box(root, [4.4, 0.22, 3.6], [0, 0.11, 0], '#d3d4bd');
      box(root, [4.45, 0.08, 3.65], [0, 0.21, 0], '#f9eccd');
    } else {
      for (const kind of ROOF_TYPES) {
        const group = new THREE.Group(); group.name = `roof-${kind}`; root.add(group); roofs.push({ group, kind });
        if (kind === 'flat') {
          box(group, [4.7, 0.2, 3.9], [0, 0.1, 0], ROOF_COLORS[0]);
          for (const z of [-1.87, 1.87]) box(group, [4.7, 0.2, 0.16], [0, 0.3, z], ROOF_COLORS[0]);
          for (const x of [-2.27, 2.27]) box(group, [0.16, 0.2, 3.6], [x, 0.3, 0], ROOF_COLORS[0]);
        } else {
          const outline = new THREE.Shape(); outline.moveTo(-2.35, 0);
          if (kind === 'gable') outline.lineTo(0, 1.2);
          else { outline.lineTo(-2.35, 0.3); outline.lineTo(2.35, 1.15); }
          outline.lineTo(2.35, 0); outline.closePath();
          const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: 3.9, bevelEnabled: false }), material(ROOF_COLORS[0]));
          roof.position.z = -1.95; roof.castShadow = roof.receiveShadow = true; group.add(roof);
          if (kind === 'gable') {
            for (const x of [-1, 1]) box(group, [2.7, 0.09, 4.05], [x * 1.18, 0.59, 0], ROOF_COLORS[0]).rotation.z = -x * 0.472;
          } else box(group, [4.85, 0.09, 4.05], [0, 0.73, 0], ROOF_COLORS[0]).rotation.z = Math.atan2(0.85, 4.7);
        }
        if (!ghost) group.traverse(object => { if (object instanceof THREE.Mesh) roofMeshes.push(object); });
      }
    }
    if (ghost) root.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.material = ghostMaterial; object.castShadow = object.receiveShadow = false;
      }
    });
    parent.add(root); return root;
  }
  const parts = PARTS.map((_, i) => part(i)), ghosts = PARTS.map((_, i) => part(i, true));
  let appearance = '';
  return { parts, ghosts, update(s: HouseState) {
    const key = `${s.round.roof}/${s.round.palette}/${s.color}/${s.phase === 'complete'}`;
    if (appearance === key) return;
    appearance = key;
    tinted.forEach(({ mesh, role }) => { mesh.material = material(HOUSE_PALETTES[s.round.palette][role]); });
    roofs.forEach(({ group, kind }) => { group.visible = s.round.roof === kind; });
    roofMeshes.forEach(mesh => { mesh.material = material(ROOF_COLORS[s.color]); });
    windows.forEach(mesh => { mesh.material = material(s.phase === 'complete' ? '#ffe4a0' : '#91b9ba'); });
    windowGroups.forEach(group => { group.scale.set(s.round.roof === 'shed' ? 1.2 : 1, s.round.roof === 'gable' ? 1 : 0.82, 1); });
    crossbars.forEach(mesh => { mesh.visible = s.round.roof === 'flat'; });
  } };
}
