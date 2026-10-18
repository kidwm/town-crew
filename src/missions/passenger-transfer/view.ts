import * as THREE from 'three';

/** One fixed view exposes the roadside waiting spaces and both loading bays. */
export function createTransferCamera() {
  const camera = new THREE.OrthographicCamera(-14, 14, 10, -10, 0.1, 250);
  camera.position.set(4, 36.5, 45); camera.lookAt(-0.5, 1.5, -1.5);
  return camera;
}
export function resizeTransferCamera(camera: THREE.OrthographicCamera, aspect: number) {
  const height = Math.max(20, 29.5 / aspect);
  camera.left = -height * aspect / 2; camera.right = height * aspect / 2;
  camera.top = height / 2; camera.bottom = -height / 2;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
}
