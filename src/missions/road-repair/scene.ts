import { createTrafficCone } from '../../runtime/traffic-cone.ts';
import * as THREE from 'three';
import { pose } from './domain/dump-truck.ts';
import type { Tuning } from './domain/dump-truck.ts';
import { HAUL_EXIT, HAUL_Z, HAUL_SCALE, BARRIER_X, ROLLER_LEFT, ROLLER_RIGHT, roadPose } from './domain/road.ts';
import type { RoadState } from './domain/road.ts';
import { HOME, UNLOAD, hasBucketLoad, ROAD_CHUNKS, smooth } from './domain/excavator.ts';
import type { Point } from './domain/excavator.ts';
import { createShapes } from '../../runtime/geometry.ts';
import type { DragHint } from '../../runtime/drag-hint.ts';
import { createDumpTruck } from '../../runtime/dump-truck.ts';
import { createExcavatorVisual, createRollerVisual, createCarVisual } from './vehicles.ts';

export function createScene(host: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor('#bde6eb');
  renderer.domElement.setAttribute('aria-label', '修路工地：挖除舊路面、裝車清運、運料填補與壓平通車');
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
  // Leave a real opening for the repair, rather than covering intact asphalt
  // with a raised dark plate. The surrounding road and kerbs stay continuous.
  const repairLeft = 0.225, repairRight = 4.275;
  box(scene, [repairLeft + 17.5, 0.15, 5.9], [(repairLeft - 17.5) / 2, -0.13, 0], '#73828a');
  box(scene, [17.5 - repairRight, 0.15, 5.9], [(repairRight + 17.5) / 2, -0.13, 0], '#73828a');
  for (const z of [-2.2375, 2.2375]) box(scene, [4.05, 0.15, 1.425], [2.25, -0.13, z], '#73828a');
  for (const z of [-3.15, 3.15]) box(scene, [35, 0.24, 0.35], [0, -0.05, z], '#e2ddc9');
  const repairedMarkings: THREE.Mesh[] = [];
  for (let x = -16; x < 17; x += 3) {
    const marking = box(scene, [1.25, 0.015, 0.1], [x, -0.045, 0], '#e6dfba');
    if (x > repairLeft && x < repairRight) repairedMarkings.push(marking);
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
  const pit = box(scene, [4.05, 0.02, 3.05], [2.25, -0.13, 0], '#434c50');
  const fill = box(scene, [3.85, 0.16, 2.85], [2.25, -0.02, 0], '#bb945f');
  // A thin asphalt patch sits on the road, below its restored centre marking.
  const repairedRoad = box(scene, [4.05, 0.01, 3.05], [2.25, -0.05, 0], '#63757e');
  const asphalt = box(scene, [3.85, 0.04, 2.85], [2.25, 0.08, 0], '#626e74');
  const fillStones: THREE.Mesh[] = [];
  for (let i = 0; i < 16; i++) {
    const angle = i * 2.399;
    const radius = 0.3 + (i % 5) * 0.25;
    const stone = box(scene, [0.24, 0.12, 0.2], [2.25 + Math.cos(angle) * radius, 0.17, Math.sin(angle) * radius * 0.77], '#c9a574');
    stone.rotation.y = angle;
    fillStones.push(stone);
  }
  const siteEquipment = new THREE.Group(); scene.add(siteEquipment);
  for (const [x, z] of [[4.9, -1.7], [4.9, 1.7], [-6.5, -1.7]]) {
    const cone = createTrafficCone(shapes);
    cone.position.set(x, 0, z); siteEquipment.add(cone);
  }

  const delivery = createDumpTruck(shapes);
  const { root: truck, bed, cargo, hitbox, bedGrip } = delivery;
  scene.add(truck);
  const hauler = createDumpTruck(shapes, true);
  hauler.root.name = 'cleanup-truck';
  hauler.root.scale.setScalar(HAUL_SCALE); hauler.cargo.visible = false;
  scene.add(hauler.root);
  const gravel: THREE.Mesh[] = [];
  for (let i = 0; i < 12; i++) gravel.push(box(scene, [0.16, 0.15, 0.15], [0, 0, 0], '#c3a077'));
  const excavator = createExcavatorVisual(shapes);
  scene.add(excavator.root, ...excavator.chunks, excavator.halo);
  hauler.root.add(...excavator.loaded);
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
  function excavationControls(state: RoadState) {
    const bounds = renderer.domElement.getBoundingClientRect();
    const project = (p: Point) => {
      const v = new THREE.Vector3(p.x, p.y, p.z).project(camera);
      return { x: (v.x + 1) * bounds.width / 2, y: (1 - v.y) * bounds.height / 2 };
    };
    const loaded = hasBucketLoad(state.excavator);
    const b = state.excavator.bucket;
    const from = project({ ...b, x: b.x + 0.15, y: b.y - 0.1 });
    const target = loaded ? { ...UNLOAD, y: 1.45 } : { ...(ROAD_CHUNKS[state.excavator.cleared] ?? HOME), y: 0.11 };
    const to = project(target);
    const bedEdge = project({ ...target, x: target.x + 1 });
    const width = Math.max(88, Math.abs(bedEdge.x - to.x) * 2 + 24);
    return { bounds, from, to, gripSize: Math.max(64, Math.abs(project({ ...b, x: b.x + 1 }).x - project(b).x) + 22), width, height: Math.max(60, width * 0.55) };
  }
  function excavationTargetHit(clientX: number, clientY: number, state: RoadState) {
    const { bounds, to, width, height } = excavationControls(state);
    return ((clientX - bounds.left - to.x) / (width / 2)) ** 2 + ((clientY - bounds.top - to.y) / (height / 2)) ** 2 <= 1;
  }
  return {
    canvas: renderer.domElement,
    excavationControls,
    excavationTargetHit,
    dragHint(state: RoadState, tuning: Tuning): DragHint | undefined {
      if (state.access !== 'working') return;
      const bounds = renderer.domElement.getBoundingClientRect();
      const project = (x: number, y: number, z: number) => {
        const point = new THREE.Vector3(x, y, z).project(camera);
        return { x: (point.x + 1) * bounds.width / 2, y: (1 - point.y) * bounds.height / 2 };
      };
      if (state.phase === 'excavator' && ['ready', 'carrying'].includes(state.excavator.action)) {
        const { from, to } = excavationControls(state);
        return { from, to, direction: to.x >= from.x ? 'right' : 'left', label: hasBucketLoad(state.excavator) ? '拖到車斗，放開' : '拖過去，挖起來' };
      }
      if (state.phase === 'dump-truck' && state.truck.phase === 'ready') {
        const from = bedGrip.project(camera, renderer.domElement);
        return { from, to: { x: from.x, y: from.y - tuning.dragThreshold - 20 }, direction: 'up', label: '按住車斗前端，往上拉' };
      }
      if (state.phase === 'haul-away' && state.hauler.action === 'ready') {
        return { from: project(state.hauler.x - 0.6, 1.1, HAUL_Z), to: project(HAUL_EXIT - 0.6, 1.1, HAUL_Z), direction: 'left', label: '按住清運車，往左拖，把舊路面載走' };
      }
      if (state.phase === 'roller' && state.roller.action === 'ready') {
        const right = state.roller.passes === 0;
        return { from: project(state.roller.x, 1.2, 0), to: project(right ? ROLLER_RIGHT : ROLLER_LEFT, 1.2, 0), direction: right ? 'right' : 'left', label: right ? '按住車子，往右拖' : '按住車子，往左拖' };
      }
    },
    hit(clientX: number, clientY: number, state: RoadState) {
      if (state.phase === 'excavator') {
        const { bounds, from, gripSize } = excavationControls(state);
        if (Math.hypot(clientX - bounds.left - from.x, clientY - bounds.top - from.y) <= gripSize / 2) return true;
      }
      setRay(clientX, clientY);
      if (state.phase === 'dump-truck' && bedGrip.hit(clientX, clientY, camera, renderer.domElement)) return true;
      const target = state.phase === 'excavator' ? excavator.hitbox : state.phase === 'haul-away' ? hauler.driveHitbox : state.phase === 'dump-truck' ? hitbox : state.phase === 'roller' ? roller.hitbox : undefined;
      return !!target && raycaster.intersectObject(target).length > 0;
    },
    onPlane(clientX: number, clientY: number, height: number) {
      setRay(clientX, clientY);
      const point = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -height), new THREE.Vector3());
      return point ? { x: point.x, y: point.y, z: point.z } : undefined;
    },
    excavationAim(clientX: number, clientY: number, state: RoadState, aim: Point): Point {
      if (hasBucketLoad(state.excavator)) return excavationTargetHit(clientX, clientY, state) ? UNLOAD : aim;
      const chunk = ROAD_CHUNKS[state.excavator.cleared];
      if (!chunk) return aim;
      setRay(clientX, clientY);
      const surface = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(chunk.y + 0.11)), new THREE.Vector3());
      // A toddler aims at the flat broken surface, below the raised bucket.
      return surface && Math.hypot(surface.x - chunk.x, surface.z - chunk.z) < 0.9 ? { ...chunk, y: HOME.y } : aim;
    },
    render(state: RoadState, tuning: Tuning, time: number) {
      const current = pose(state.truck, tuning);
      const road = roadPose(state, tuning);
      const celebrating = state.phase === 'complete' || (state.phase === 'traffic' && state.elapsed >= 3.9);
      // Temporary equipment is cleared before the first car enters.
      siteEquipment.visible = state.phase !== 'traffic' && state.phase !== 'complete';
      const excavatorOffset = state.excavator.action === 'entering' ? -9 * (1 - smooth(state.excavator.elapsed / 0.9)) : -10 * road.departure;
      excavator.root.scale.setScalar(1);
      excavator.root.position.z = 0;
      excavator.root.position.y = 0;
      excavator.render(state.excavator, state.phase === 'excavator', excavatorOffset, time, state.access === 'working');
      truck.visible = state.phase === 'dump-truck';
      truck.scale.setScalar(1);
      truck.position.set(current.x - (state.truck.phase === 'complete' ? 10 * road.departure : 0), 0, 0);
      bed.rotation.z = -current.tilt;
      delivery.roll(truck.position.x + 9);
      hauler.root.visible = state.phase === 'excavator' || state.phase === 'haul-away';
      hauler.root.position.set(road.haulerX, 0, HAUL_Z); hauler.roll(road.haulerX / HAUL_SCALE);
      pit.visible = road.flatten < 1;
      fill.visible = road.fill > 0 && road.flatten < 1;
      fill.scale.set(Math.max(0.01, road.fill), 1 - road.compact * 0.9, Math.max(0.01, road.fill));
      // The truck fills the base, then a short spreading animation lays the
      // darker road material before the roller arrives to compact it.
      const paving = state.phase === 'dump-truck' && ['lowering', 'complete'].includes(state.truck.phase)
        ? state.truck.phase === 'complete' ? 1 : smooth(state.truck.elapsed / 0.7)
        : state.phase === 'roller' || state.phase === 'traffic' || state.phase === 'complete' ? 1 : 0;
      asphalt.visible = paving > 0 && road.flatten < 1;
      asphalt.scale.x = Math.max(0.001, paving);
      asphalt.position.y = fill.position.y + 0.08 * fill.scale.y + 0.02;
      repairedRoad.visible = road.flatten > 0;
      repairedRoad.scale.x = Math.max(0.01, road.flatten);
      repairedMarkings.forEach(marking => { marking.visible = road.flatten === 1; });
      for (let i = 0; i < fillStones.length; i++) {
        const paved = paving >= (i + 1) / 17;
        fillStones[i].visible = road.fill > (i + 1) / 17 && road.flatten < 1;
        fillStones[i].material = material(paved ? '#626e74' : '#c9a574');
        fillStones[i].scale.y = 1 - road.compact * 0.9;
        fillStones[i].position.y = (paved ? asphalt.position.y + 0.02 : fill.position.y + 0.08 * fill.scale.y) + 0.06 * fillStones[i].scale.y;
      }
      cargo.visible = current.fill < 0.95;
      cargo.scale.y = Math.max(0.01, 1 - current.fill);
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
      roller.render(road.rollerX - (state.roller.action === 'complete' ? 10 * road.departure : 0));
      const trafficTime = state.phase === 'complete' ? 4.8 : state.phase === 'traffic' ? state.elapsed : 0;
      barriers.forEach((barrier, index) => {
        barrier.position.z = road.barrierZ[index];
        barrier.visible = state.phase !== 'complete' && trafficTime < 0.85;
      });
      car.root.visible = trafficTime >= 0.85 && trafficTime < 3.9;
      car.render(-10 + 20 * smooth((trafficTime - 0.85) / 3.0));
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
