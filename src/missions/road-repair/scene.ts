import * as THREE from 'three';
import { pose } from './domain/dump-truck.ts';
import type { Tuning } from './domain/dump-truck.ts';
import { BARRIER_X, roadPose } from './domain/road.ts';
import type { RoadState } from './domain/road.ts';
import { smooth } from './domain/excavator.ts';
import { createShapes } from '../../runtime/geometry.ts';
import { createExcavatorVisual, createRollerVisual, createCarVisual } from './vehicles.ts';

export function createScene(host: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor('#bde6eb');
  renderer.domElement.setAttribute('aria-label', '修路工地：拖曳挖斗、車斗或壓路機完成任務');
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-10, 10, 6, -6, 0.1, 100);
  camera.position.set(6, 8, 16);
  camera.lookAt(0, 0.4, 0);
  scene.add(new THREE.HemisphereLight('#ffffff', '#7c9b7c', 2.5));
  const sun = new THREE.DirectionalLight('#fff4dc', 3);
  sun.position.set(-5, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 0.5, far: 40 });
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const shapes = createShapes();
  const { box, cylinder, material } = shapes;

  box(scene, [70, 0.5, 70], [0, -0.5, 0], '#99c98a');
  box(scene, [35, 0.15, 5.9], [0, -0.13, 0], '#73828a');
  for (const z of [-3.15, 3.15]) box(scene, [35, 0.24, 0.35], [0, -0.05, z], '#e2ddc9');
  for (let x = -16; x < 17; x += 3) {
    box(scene, [1.25, 0.015, 0.1], [x, -0.045, 0], '#e6dfba');
  }
  // A few simple landmarks keep the scene readable without external assets.
  for (const [x, z, scale] of [[-8, -6, 1], [5, -6, 1.2], [9, -4, 0.8], [-9, 5, 0.85]]) {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    cylinder(tree, 0.16, 1.4, [0, 0.5, 0], '#9b7954', 7);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), material('#559866'));
    crown.position.y = 1.9;
    tree.add(crown);
    scene.add(tree);
  }
  for (const x of [-4, 0, 3.5]) {
    box(scene, [2.2, 2, 1.7], [x, 0.85, -10], x === 0 ? '#f0d7a1' : '#c8d7c2');
    box(scene, [2.4, 0.24, 1.9], [x, 1.96, -10], '#dfaa81');
    box(scene, [0.5, 0.75, 0.03], [x, 1.08, -9.13], '#83b7bf');
  }
  const pit = cylinder(scene, 1.75, 0.06, [2.25, -0.005, 0], '#434c50');
  pit.scale.z = 0.77;
  const fill = cylinder(scene, 1.67, 0.16, [2.25, 0.06, 0], '#bb945f');
  const repairedRoad = box(scene, [4.05, 0.06, 3.05], [2.25, 0.015, 0], '#63757e');
  const fillStones: THREE.Mesh[] = [];
  for (let i = 0; i < 16; i++) {
    const angle = i * 2.399;
    const radius = 0.3 + (i % 5) * 0.25;
    const stone = box(scene, [0.24, 0.12, 0.2], [2.25 + Math.cos(angle) * radius, 0.17, Math.sin(angle) * radius * 0.77], '#c9a574');
    stone.rotation.y = angle;
    fillStones.push(stone);
  }
  for (const [x, z] of [[4.9, -1.7], [4.9, 1.7], [-6.5, -1.7]]) {
    cylinder(scene, 0.28, 0.12, [x, 0.01, z], '#e2dac9', 4);
    const cone = new THREE.Group();
    cone.name = 'traffic-cone';
    cone.position.set(x, 0.065, z);
    scene.add(cone);
    // A hollow shell with an annular lip and inner wall, open at the top.
    const profiles = [
      { points: [[0.21, 0], [0.075, 0.63]], color: '#ee9550' },
      { points: [[0.075, 0.63], [0.048, 0.63]], color: '#f5ad68' },
      { points: [[0.048, 0.63], [0.183, 0]], color: '#81492e' },
      { points: [[0.1596, 0.24], [0.136, 0.35]], color: '#fff0d0' },
    ];
    for (const { points, color } of profiles) {
      const shell = new THREE.Mesh(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), 24), material(color));
      shell.castShadow = shell.receiveShadow = true;
      cone.add(shell);
    }
  }

  const truck = new THREE.Group();
  truck.name = 'dump-truck';
  scene.add(truck);
  box(truck, [4.7, 0.42, 1.65], [-0.85, 0.78, 0], '#28587c');
  box(truck, [1.55, 1.55, 1.55], [-2.2, 1.62, 0], '#3c98be');
  box(truck, [1.65, 0.15, 1.68], [-2.2, 2.43, 0], '#70b7d0');
  for (const z of [-0.79, 0.79]) {
    box(truck, [0.92, 0.79, 0.035], [-2.05, 1.87, z], '#b6e0e1');
    box(truck, [0.24, 0.07, 0.07], [-1.75, 1.3, z], '#ecdfbb');
  }
  box(truck, [0.035, 0.72, 1.22], [-2.99, 1.95, 0], '#b6e0e1');
  box(truck, [0.2, 0.18, 1.76], [-3.03, 0.95, 0], '#e1dfd0');
  for (const z of [-0.55, 0.55]) box(truck, [0.05, 0.24, 0.29], [-3.03, 1.3, z], '#fff1b1');
  const wheels: THREE.Group[] = [];
  for (const x of [-2.1, 0.1]) {
    cylinder(truck, 0.1, 2.24, [x, 0.48, 0], '#60727a').rotation.x = Math.PI / 2;
    for (const z of [-1.12, 1.12]) wheels.push(shapes.wheel(truck, x, z));
  }
  const bed = new THREE.Group();
  bed.position.set(1.25, 1.6, 0);
  truck.add(bed);
  box(bed, [2.8, 0.24, 1.65], [-1.3, -0.2, 0], '#e89b3c');
  for (const z of [-0.76, 0.76]) {
    box(bed, [2.8, 0.72, 0.16], [-1.3, 0.15, z], '#eda943');
    for (const x of [-2.5, -1.7, -0.9, -0.1]) {
      box(bed, [0.075, 0.69, 0.04], [x, 0.15, z + Math.sign(z) * 0.09], '#ffd17a');
    }
  }
  box(bed, [0.2, 0.72, 1.65], [-2.62, 0.15, 0], '#eda943');
  const cargo = box(bed, [2.4, 0.23, 1.35], [-1.3, 0.08, 0], '#bc956b');
  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.9, 2.25),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  );
  hitbox.position.set(-1.7, 0.05, 0);
  bed.add(hitbox);
  const hint = new THREE.Group();
  hint.position.set(-0.6, 3.7, 0.6);
  scene.add(hint);
  for (const y of [0, 0.43]) {
    for (const sign of [-1, 1]) {
      const mark = box(hint, [0.5, 0.13, 0.12], [sign * 0.16, y, 0], '#fff4c4');
      mark.rotation.z = -sign * 0.65;
    }
  }
  const gravel: THREE.Mesh[] = [];
  for (let i = 0; i < 12; i++) gravel.push(box(scene, [0.16, 0.15, 0.15], [0, 0, 0], '#c3a077'));
  const excavator = createExcavatorVisual(shapes);
  scene.add(excavator.root, ...excavator.rocks, excavator.halo, ...excavator.trail, ...excavator.discarded);
  const roller = createRollerVisual(shapes);
  scene.add(roller.root);
  const car = createCarVisual(shapes);
  scene.add(car.root);
  const barriers = BARRIER_X.map(x => {
    const root = new THREE.Group();
    root.position.x = x;
    for (const z of [-1, 1]) {
      box(root, [0.4, 0.12, 0.55], [0, 0.03, z], '#61716b');
      box(root, [0.14, 1.2, 0.14], [0, 0.65, z], '#e0c074');
    }
    box(root, [0.17, 0.4, 2.8], [0, 0.95, 0], '#f3c463');
    for (const z of [-1.1, -0.55, 0, 0.55, 1.1]) box(root, [0.19, 0.4, 0.22], [0, 0.95, z], '#f6f1d5');
    scene.add(root);
    return root;
  });
  const confetti: THREE.Mesh[] = [];
  for (let i = 0; i < 18; i++) {
    confetti.push(box(scene, [0.12, 0.12, 0.08], [0, 0, 0], ['#f0b950', '#68b3ba', '#f49a7d'][i % 3]));
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    const viewHeight = Math.max(10.5, 16 / aspect);
    camera.left = -viewHeight * aspect / 2;
    camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
  resize.observe(host);
  function setRay(clientX: number, clientY: number) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set((clientX - bounds.left) / bounds.width * 2 - 1, -(clientY - bounds.top) / bounds.height * 2 + 1);
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
  }
  return {
    canvas: renderer.domElement,
    hit(clientX: number, clientY: number, state: RoadState) {
      setRay(clientX, clientY);
      const target = state.phase === 'excavator' ? excavator.hitbox : state.phase === 'dump-truck' ? hitbox : state.phase === 'roller' ? roller.hitbox : undefined;
      return !!target && raycaster.intersectObject(target).length > 0;
    },
    onPlane(clientX: number, clientY: number, height: number) {
      setRay(clientX, clientY);
      const point = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -height), new THREE.Vector3());
      return point ? { x: point.x, y: point.y, z: point.z } : undefined;
    },
    render(state: RoadState, tuning: Tuning, time: number) {
      const current = pose(state.truck, tuning);
      const road = roadPose(state, tuning);
      const celebrating = state.phase === 'complete' || (state.phase === 'traffic' && state.elapsed >= 3.9);
      const excavatorOffset = state.excavator.action === 'entering' ? -9 * (1 - smooth(state.excavator.elapsed / 0.9)) : -10 * road.departure;
      excavator.root.scale.setScalar(1);
      excavator.root.position.z = 0;
      excavator.root.position.y = 0;
      excavator.render(state.excavator, state.phase === 'excavator', excavatorOffset, time, state.access === 'working');
      truck.visible = state.phase === 'dump-truck';
      truck.scale.setScalar(1);
      truck.position.set(current.x - (state.truck.phase === 'complete' ? 10 * road.departure : 0), 0, 0);
      bed.rotation.z = -current.tilt;
      for (const wheel of wheels) wheel.rotation.z = -(truck.position.x + 9) / 0.48;
      pit.visible = road.flatten < 1;
      fill.visible = road.fill > 0 && road.flatten < 1;
      fill.scale.set(Math.max(0.01, road.fill), 1 - road.compact * 0.9, Math.max(0.01, road.fill) * 0.77);
      repairedRoad.visible = road.flatten > 0;
      repairedRoad.scale.x = Math.max(0.01, road.flatten);
      for (let i = 0; i < fillStones.length; i++) {
        fillStones[i].visible = road.fill > (i + 1) / 17 && road.flatten < 1;
        fillStones[i].scale.y = 1 - road.compact * 0.9;
        fillStones[i].position.y = 0.17 - road.compact * 0.13;
      }
      cargo.visible = current.fill < 0.95;
      cargo.scale.y = Math.max(0.01, 1 - current.fill);
      hint.visible = state.phase === 'dump-truck' && state.access === 'working' && current.hint;
      hint.position.y = 3.45 + Math.sin(time * 3) * 0.13;
      hint.scale.setScalar(1 + Math.sin(time * 3) * 0.04);
      gravel.forEach((stone, i) => {
        stone.visible = state.phase === 'dump-truck' && state.truck.phase === 'dumping' && current.fill > 0 && current.fill < 1;
        const t = (time * 1.8 + i / gravel.length) % 1;
        stone.position.set(0.25 + t * 2.2, 1.55 * (1 - t * t), Math.sin(i * 5) * 0.37);
        stone.rotation.set(time * 4 + i, i, time * 3);
      });
      confetti.forEach((piece, i) => {
        piece.visible = celebrating;
        const t = (time * 0.28 + i / confetti.length) % 1;
        piece.position.set(1.8 + Math.sin(i * 8) * 2.4, 4.8 - t * 4.5, Math.cos(i * 3) * 1.3);
        piece.rotation.set(time + i, time, i);
        piece.scale.setScalar(Math.sin(t * Math.PI));
      });
      roller.root.visible = state.phase === 'roller';
      roller.root.scale.setScalar(1);
      roller.root.position.y = roller.root.position.z = 0;
      roller.render(road.rollerX - (state.roller.action === 'complete' ? 10 * road.departure : 0), state.roller.passes, state.access === 'working' && ['ready', 'dragging'].includes(state.roller.action), time);
      const trafficTime = state.phase === 'complete' ? 4.8 : state.phase === 'traffic' ? state.elapsed : 0;
      barriers.forEach((barrier, index) => { barrier.position.z = road.barrierZ[index]; });
      car.root.visible = trafficTime >= 0.85 && trafficTime < 3.9;
      car.render(-10 + 20 * smooth((trafficTime - 0.85) / 3.0));
      if (celebrating) {
        const crew = [excavator.root, truck, roller.root];
        crew.forEach((vehicle, i) => {
          vehicle.visible = true;
          vehicle.scale.setScalar(0.55);
          vehicle.position.set([-1.8, 0.3, 4.2][i], Math.max(0, Math.sin(time * 4 + i)) * 0.12, -4.6);
        });
      }
      renderer.render(scene, camera);
    },
    dispose() {
      resize.disconnect();
      const geometries = new Set<THREE.BufferGeometry>();
      const usedMaterials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry);
          for (const value of Array.isArray(object.material) ? object.material : [object.material]) usedMaterials.add(value);
        }
      });
      geometries.forEach((value) => value.dispose());
      usedMaterials.forEach((value) => value.dispose());
      sun.shadow.dispose();
      shapes.disposeMaterials();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
