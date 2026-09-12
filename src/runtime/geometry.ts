import * as THREE from 'three';

export function createShapes() {
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const material = (color: string) => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    return materials.get(color)!;
  };
  const box = (parent: THREE.Object3D, size: number[], xyz: number[], color: string) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material(color));
    mesh.position.set(xyz[0], xyz[1], xyz[2]);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const cylinder = (parent: THREE.Object3D, radius: number, height: number, xyz: number[], color: string, segments = 16) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material(color));
    mesh.position.set(xyz[0], xyz[1], xyz[2]);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const hitbox = (parent: THREE.Object3D, size: number[], xyz: number[]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
    mesh.position.set(xyz[0], xyz[1], xyz[2]);
    parent.add(mesh);
    return mesh;
  };
  const wheel = (parent: THREE.Object3D, x: number, z: number, radius = 0.48) => {
    const group = new THREE.Group();
    group.name = `wheel-${x}-${z}`;
    group.position.set(x, radius, z);
    cylinder(group, radius, 0.32, [0, 0, 0], '#303b43').rotation.x = Math.PI / 2;
    cylinder(group, radius * 0.52, 0.35, [0, 0, 0], '#bcc9c7').rotation.x = Math.PI / 2;
    box(group, [0.09, radius * 0.74, 0.37], [0, 0, 0], '#6a8389');
    parent.add(group);
    return group;
  };
  return { material, box, cylinder, hitbox, wheel };
}
export type Shapes = ReturnType<typeof createShapes>;
