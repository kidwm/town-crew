import * as THREE from 'three';

/** One pose for every task and mirrored configuration; only resize changes the frustum. */
export function createPoliceCamera() {
  const camera = new THREE.OrthographicCamera(-18, 18, 11, -11, 0.1, 300);
  camera.position.set(6, 42, 50); camera.lookAt(0, 0, 0.5);
  return camera;
}
export function fitPoliceCamera(camera: THREE.OrthographicCamera, width: number, height: number) {
  const aspect = width / height, span = Math.max(16, 18.5 / aspect, 11 * height / Math.max(140, height - 270));
  camera.left = -span * aspect / 2; camera.right = span * aspect / 2; camera.top = span / 2; camera.bottom = -span / 2;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
}

/** Keep the complete vehicle beyond the side edge before arrival and after departure. */
export const policeExitDistance = (camera: THREE.OrthographicCamera) => Math.max(14, camera.right + 5);

/** A non-interactive footprint under the bike, independent of its hit target. */
export function policeChoiceMarker(camera: THREE.OrthographicCamera, width: number, height: number, p: { x: number; z: number }, direction: number) {
  const project = (x: number, y: number, z: number) => { const v = new THREE.Vector3(x, y, z).project(camera); return { x: (v.x + 1) * width / 2, y: (1 - v.y) * height / 2 }; };
  const center = project(p.x, .08, p.z), grip = project(p.x, 1, p.z);
  const bounds = [-1.5, 1.5].flatMap(x => [-.6, .6].map(z => project(p.x + x, .08, p.z + z)));
  const rx = Math.max(18, ...bounds.map(b => Math.abs(b.x - center.x))), ry = Math.max(6, ...bounds.map(b => Math.abs(b.y - center.y)));
  const arrowX = center.x + direction * (rx + 5);
  return { ...center, rx, ry, grip, arrow: `M${arrowX} ${center.y}h${direction * 19}m${-direction * 6} -5l${direction * 6} 5l${-direction * 6} 5` };
}
