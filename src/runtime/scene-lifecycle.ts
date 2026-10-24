import { Effect } from 'effect';
import * as THREE from 'three';
import { releaseAll } from './cleanup.ts';

/** Register ownership before renderer configuration or DOM attachment can fail. */
export const acquireRenderer = (create: () => THREE.WebGLRenderer) =>
  Effect.acquireRelease(Effect.sync(create), renderer => Effect.sync(() => releaseAll([
    () => renderer.dispose(), () => renderer.forceContextLoss(), () => renderer.domElement.remove(),
  ])));

/** Traverse at release time so partially built scenes are also reclaimed. */
export const acquireScene = () => Effect.acquireRelease(Effect.sync(() => new THREE.Scene()), scene => Effect.sync(() => {
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points)) return;
    resources.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) resources.add(material);
  });
  releaseAll(Array.from(resources, value => () => value.dispose()));
}));
