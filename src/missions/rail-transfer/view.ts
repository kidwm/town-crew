import * as THREE from 'three';
export function createRailCamera() {
  const camera = new THREE.OrthographicCamera(-12, 12, 10, -10, 0.1, 250);
  camera.position.set(0, 34, 40); camera.lookAt(0, 0.8, 1.1);
  return camera;
}
export function resizeRailCamera(camera: THREE.OrthographicCamera, aspect: number) {
  const height = Math.max(17.8, 24.9 / aspect);
  camera.left = -height * aspect / 2; camera.right = height * aspect / 2; camera.top = height / 2; camera.bottom = -height / 2;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
}
