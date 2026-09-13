import * as THREE from 'three';

/** The raised end of a dump bed, shared by its hint and forgiving touch target. */
export function createBedGrip(bed: THREE.Object3D, position: [number, number, number]) {
  const anchor = new THREE.Object3D(); anchor.position.set(...position); bed.add(anchor);
  const farCorner = new THREE.Object3D(); farCorner.position.set(position[0], position[1], -position[2]); bed.add(farCorner);
  function project(camera: THREE.Camera, canvas: HTMLCanvasElement, corner = anchor) {
    const bounds = canvas.getBoundingClientRect();
    const point = corner.getWorldPosition(new THREE.Vector3()).project(camera);
    return { x: (point.x + 1) * bounds.width / 2, y: (1 - point.y) * bounds.height / 2 };
  }
  return {
    project,
    hit(clientX: number, clientY: number, camera: THREE.Camera, canvas: HTMLCanvasElement) {
      const bounds = canvas.getBoundingClientRect(), from = project(camera, canvas), to = project(camera, canvas, farCorner);
      const x = clientX - bounds.left, y = clientY - bounds.top, dx = to.x - from.x, dy = to.y - from.y;
      const t = Math.max(0, Math.min(1, ((x - from.x) * dx + (y - from.y) * dy) / (dx * dx + dy * dy || 1)));
      // Pad the whole front rim by 28 CSS pixels, including both corners.
      return Math.hypot(x - from.x - dx * t, y - from.y - dy * t) <= 28;
    },
  };
}
