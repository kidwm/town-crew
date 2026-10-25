import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import * as THREE from 'three';
import { Element, browser, renderer } from './lifecycle.ts';

export const framingSizes = [[1280, 800], [390, 844], [1024, 768], [844, 390]] as const;

/** Capture the real scene and resize callback; only WebGL and browser APIs are replaced. */
export function framingHarness(t: TestContext) {
  browser(t);
  const host = new Element(), { fake, canvas } = renderer();
  let resize = () => {}, scene: THREE.Scene, camera: THREE.OrthographicCamera;
  let fixedPose: number[] | undefined;
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) { resize = callback; }
    observe() {} disconnect() {} unobserve() {}
  } as unknown as typeof ResizeObserver;
  Object.assign(fake, {
    setSize(width: number, height: number) { canvas.clientWidth = width; canvas.clientHeight = height; },
    render(value: THREE.Scene, view: THREE.OrthographicCamera) {
      scene = value; camera = view; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      const pose = [...camera.position.toArray(), ...camera.quaternion.toArray()];
      if (fixedPose) assert.deepEqual(pose, fixedPose, 'mission progress must not move or rotate the camera');
      else fixedPose = pose;
    },
  });
  return {
    host: host as unknown as HTMLElement,
    make: () => fake as unknown as THREE.WebGLRenderer,
    resize(width: number, height: number) { host.clientWidth = width; host.clientHeight = height; resize(); },
    camera: () => camera,
    bounds(name: string) {
      const root = scene.getObjectByName(name);
      assert.ok(root, `missing model: ${name}`);
      const points: THREE.Vector3[] = [];
      root.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) if (!ancestor.visible) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        if (materials.every(m => !m.visible || m.opacity === 0 || !m.colorWrite)) return;
        object.geometry.computeBoundingBox();
        const bounds = object.geometry.boundingBox!;
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
          points.push(new THREE.Vector3(x, y, z).applyMatrix4(object.matrixWorld).project(camera));
        }
      });
      assert.ok(points.length, `model is not visible: ${name}`);
      return new THREE.Box3().setFromPoints(points);
    },
    visible(name: string, margin = 0.02) {
      const bounds = this.bounds(name);
      assert.ok(bounds.min.x >= -1 + margin && bounds.max.x <= 1 - margin && bounds.min.y >= -1 + margin && bounds.max.y <= 1 - margin,
        `${name} outside frame: ${JSON.stringify({ min: bounds.min.toArray(), max: bounds.max.toArray() })}`);
    },
  };
}
