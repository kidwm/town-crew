import * as THREE from 'three';
export function createSanitationCamera() {
  const camera = new THREE.OrthographicCamera(-13, 13, 9, -9, 0.1, 250);
  camera.position.set(-14, 22, 34); camera.lookAt(0, 0.7, 0.5); return camera;
}
export function resizeSanitationCamera(camera: THREE.OrthographicCamera, aspect: number) {
  const height = Math.max(14.5, 18.5 / aspect);
  camera.left = -height * aspect / 2 + 0.4; camera.right = height * aspect / 2 + 0.4; camera.top = height / 2; camera.bottom = -height / 2;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
}
