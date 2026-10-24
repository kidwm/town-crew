import { Effect } from 'effect';
import { acquireRenderer, acquireScene } from '../../runtime/scene-lifecycle.ts';
import * as THREE from 'three';
import { createShapes } from '../../runtime/geometry.ts';
import { createBoulder } from '../../runtime/rocks.ts';
import { createDumpTruck } from '../../runtime/dump-truck.ts';
import { createExcavatorModel } from '../../runtime/excavator-model.ts';
import { createSweeper } from '../../runtime/sweeper.ts';
import { createCar } from '../../runtime/car.ts';
import { createPerson } from '../../runtime/emergency-models.ts';
import { createTownTree } from '../../runtime/town-scenery.ts';
import { createTrafficCone } from '../../runtime/traffic-cone.ts';
import { createRoadBarrier } from '../../runtime/road-barrier.ts';
import { createBulldozer, bulldozerPose, createLoader, createSoilPile } from './vehicles.ts';
import { stageOrder, rocks, cargo, smooth, mix, canGrab, PUSH_Z, PUSH_HEADING, pushPoint, soilPoint, ARM_Z, BED, CARRY_HEIGHT, HAUL_START, HAUL_END, SWEEP_START, SWEEP_END, SWEEP_Z, GUARDRAIL_Z, BARRIER_X, CONE_X } from './domain/mountain.ts';
import { loaderPose, soilRemaining, soilInTruck, POUR_START, POUR_END, LOADER_DOCK } from './domain/loader.ts';
import type { SoilId } from './domain/loader.ts';
import type { MountainState, Point } from './domain/mountain.ts';
import type { DragHint } from '../../runtime/drag-hint.ts';
interface Screen { x: number; y: number }

export const createMountainScene = (host: HTMLElement, makeRenderer = () => new THREE.WebGLRenderer({ antialias: true })) => Effect.gen(function* () {
  const renderer = yield* acquireRenderer(makeRenderer); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#d4e7e3');
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement; canvas.setAttribute('aria-label', '山路搶通：推土機集中土石、鏟裝機鏟土裝車、挖土機裝大石頭、砂石車清運、清掃車刷乾淨'); host.append(canvas);
  const scene = yield* acquireScene();
  const site = new THREE.Group(); scene.add(site);
  const camera = new THREE.OrthographicCamera(-14, 14, 9, -9, 0.1, 200); camera.position.set(8, 19, 30); camera.lookAt(0, 0.4, -0.8);
  scene.add(new THREE.HemisphereLight('#fff9e8', '#90a787', 2.4));
  const sun = new THREE.DirectionalLight('#fff1d7', 2.7);
  yield* Effect.addFinalizer(() => Effect.sync(() => sun.shadow.dispose()));
  sun.position.set(-8, 17, 10); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = 0.035;
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 24, bottom: -24, far: 60 }); scene.add(sun);
  const shapes = createShapes();
  yield* Effect.addFinalizer(() => Effect.sync(() => shapes.disposeMaterials()));
  const { box, material } = shapes;
  box(site, [150, 0.5, 150], [0, -0.42, 0], '#b6cc9b');
  const outline = new THREE.Shape();
  const vertices = [[-40, -4], [-12, -4], [-8, -2.7], [8, -2.7], [12, -4], [40, -4], [40, 1.7], [12, 1.7], [8, 6.8], [-8, 6.8], [-12, 1.7], [-40, 1.7]];
  vertices.forEach(([x, z], i) => i ? outline.lineTo(x, -z) : outline.moveTo(x, -z)); outline.closePath();
  const roadGeometry = new THREE.ShapeGeometry(outline); roadGeometry.rotateX(-Math.PI / 2);
  const road = new THREE.Mesh(roadGeometry, material('#a1a794')); road.position.y = 0.02; road.receiveShadow = true; site.add(road);
  // Excavator loads the original-size truck first, then leaves its rear clear for the loader.
  box(site, [16.3, 0.12, 3.35], [0.6, -0.04, -4.35], '#c8b895');
  for (let x = -35; x <= 35; x += 2.7) {
    const z = Math.abs(x) > 11 ? -1.2 : Math.abs(x) > 8 ? -0.4 : 0.35;
    box(site, [1.1, 0.02, 0.08], [x, 0.04, z], '#f4e9ca');
  }
  // Low faceted slopes frame the site without covering the arm, bed or pickup targets.
  for (const [x, z, sx, sy, sz] of [[-12, -12, 7, 3.8, 5], [-3, -13, 7.5, 4.6, 5], [7, -12, 7, 3.8, 4.7], [17, -14, 8, 5, 5]]) {
    const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), material('#8eaa80')); hill.position.set(x, 0.8, z); hill.scale.set(sx, sy, sz); hill.castShadow = hill.receiveShadow = true; site.add(hill);
    const face = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), material('#b0ad92')); face.position.set(x + 1, 0, z + 3); face.scale.set(sx * 0.58, sy * 0.5, sz * 0.6); face.receiveShadow = true; site.add(face);
  }
  for (const [x, z, scale] of [[-10, -8, 0.8], [10.5, -8.3, 0.85], [14, -8, 1], [-12, 8, 0.75], [12, 9, 0.8]]) {
    const tree = createTownTree(shapes); tree.position.set(x, 0, z); tree.scale.setScalar(scale); site.add(tree);
  }
  for (let x = -7; x <= 7; x += 1.75) {
    box(site, [0.12, 0.78, 0.12], [x, 0.35, GUARDRAIL_Z], '#899b8c');
    box(site, [1.8, 0.17, 0.1], [x + 0.7, 0.65, GUARDRAIL_Z], '#d5d6ba');
  }
  const barriers = BARRIER_X.map(x => { const root = createRoadBarrier(shapes); root.position.set(x, 0, -0.55); site.add(root); return root; });
  const cones = CONE_X.map(x => { const c = createTrafficCone(shapes); c.position.set(x, 0, 0.9); site.add(c); return c; });
  const dozer = createBulldozer(shapes), loader = createLoader(shapes), excavator = createExcavatorModel(shapes), truck = createDumpTruck(shapes, true), sweeper = createSweeper(shapes), car = createCar(shapes);
  [dozer.root, loader.root, excavator.root, truck.root, sweeper.root, car.root].forEach(v => site.add(v)); truck.cargo.visible = false;
  car.root.scale.setScalar(0.72);
  const workers = [createPerson(shapes, true), createPerson(shapes, true)]; workers.forEach((w, i) => { w.root.position.set(6.7 + i * 0.85, 0, -6.3); site.add(w.root); });
  const boulders = [0, 1, 2].map(i => { const b = createBoulder(shapes, 0.57, i); site.add(b); return b; });
  const soil = PUSH_Z.map((_, row) => { const root = createSoilPile(shapes, row); site.add(root); return root; });
  const residues = Array.from({ length: 24 }, (_, i) => {
    const root = new THREE.Group(); site.add(root); root.position.set(-2.8 + (i % 8) * 0.8 + Math.sin(i * 3) * 0.1, 0.04, 1.75 + Math.floor(i / 8) * 0.75 + Math.cos(i) * 0.12);
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.31, 7), material('#b69c76')); patch.rotation.x = -Math.PI / 2; patch.rotation.z = i * 0.7; patch.scale.set(1.2, 0.65, 1); patch.position.y = 0.015; root.add(patch);
    for (let j = 0; j < 3; j++) { const pebble = createBoulder(shapes, 0.065, i + j); pebble.position.set(j * 0.11 - 0.12, 0.045, Math.sin(i + j) * 0.12); root.add(pebble); }
    return root;
  });
  const dust = Array.from({ length: 12 }, (_, i) => { const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), material('#d5bd91')); site.add(puff); return puff; });
  const soilStream = Array.from({ length: 28 }, (_, i) => {
    const grain = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + i % 3 * 0.025, 0), material(i % 4 ? '#bb9870' : '#9f947d'));
    grain.castShadow = true; site.add(grain); return grain;
  });
  const confetti = Array.from({ length: 28 }, (_, i) => box(site, [0.13, 0.13, 0.05], [0, 0, 0], ['#edba63', '#8bb6a1', '#df9b81'][i % 3]));
  const resize = yield* Effect.acquireRelease(Effect.sync(() => new ResizeObserver(() => {
    const r = host.getBoundingClientRect(); if (!r.width || !r.height) return;
    const aspect = r.width / r.height, height = Math.max(18, 22 / aspect);
    camera.left = -height * aspect / 2; camera.right = height * aspect / 2; camera.top = height / 2; camera.bottom = -height / 2;
    camera.updateProjectionMatrix(); renderer.setSize(r.width, r.height);
  })), value => Effect.sync(() => value.disconnect()));
  resize.observe(host);
  let roundSide = 1;
  const exit = () => Math.max(19, camera.right + 8);
  function screen(p: Point): Screen {
    camera.updateMatrixWorld(true); const r = canvas.getBoundingClientRect(), v = new THREE.Vector3(p.x * roundSide, p.y, p.z).project(camera);
    return { x: (v.x + 1) * r.width / 2, y: (1 - v.y) * r.height / 2 };
  }
  const pushPose = (s: MountainState): Point => pushPoint(s.pushIndex, s.pushes[s.pushIndex]);
  function task(s: MountainState) {
    if (s.phase === 'load-soil') {
      const pose = loaderPose(s), id = s.loaderSelected ?? ([0, 1] as const).find(id => !s.soilLoaded.includes(id)) ?? 0;
      const from = screen({ ...pose.point, y: 1.1 });
      const to = s.loaderDocked ? { x: from.x, y: from.y - Math.min(130, Math.max(80, canvas.clientHeight * 0.18)) } : screen(s.loaderCarrying ? { ...LOADER_DOCK, y: 0.15 } : soilPoint(id));
      return { from, to, value: s.loaderTravel };
    }
    if (s.phase === 'excavate') {
      const remaining = rocks(s.round).map((p, i) => ({ p, i })).filter(v => !s.delivered.includes(v.i));
      remaining.sort((a, b) => Math.hypot(a.p.x - s.bucket.x, a.p.z - s.bucket.z) - Math.hypot(b.p.x - s.bucket.x, b.p.z - s.bucket.z));
      const to = s.carried !== null ? BED : remaining[0]?.p ?? BED;
      return { from: screen(s.bucket), to: screen(to), value: 0 };
    }
    if (s.phase === 'push') return { from: screen(pushPose(s)), to: screen(pushPoint(s.pushIndex, 1)), value: s.pushes[s.pushIndex] };
    if (s.phase === 'haul') return { from: screen({ x: HAUL_START + (HAUL_END - HAUL_START) * s.haul, y: 1.2, z: ARM_Z }), to: screen({ x: HAUL_END, y: 1.2, z: ARM_Z }), value: s.haul };
    return { from: screen({ x: SWEEP_START + (SWEEP_END - SWEEP_START) * s.swept, y: 1.2, z: SWEEP_Z }), to: screen({ x: SWEEP_END, y: 1.2, z: SWEEP_Z }), value: s.swept };
  }
  function goals(s: MountainState) {
    if (s.phase === 'load-soil' && s.action !== 'auto') return s.loaderCarrying ? [{ id: s.loaderDocked ? 'raise' : 'dock', point: task(s).to }] : ([0, 1] as const).flatMap(id => s.soilLoaded.includes(id) || s.loaderSelected !== null && s.loaderTravel > 0 && s.loaderSelected !== id ? [] : [{ id: `soil-${id}`, point: screen(soilPoint(id)) }]);
    if (s.phase !== 'excavate' || s.action === 'auto') return [];
    return s.carried !== null ? [{ id: 'bed', point: screen(BED) }] : rocks(s.round).flatMap((p, i) => s.delivered.includes(i) ? [] : [{ id: String(i), point: screen(p) }]);
  }
  const ray = new THREE.Raycaster();
  function setRay(x: number, y: number) {
    const r = canvas.getBoundingClientRect(); scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    ray.setFromCamera(new THREE.Vector2((x - r.x) / r.width * 2 - 1, 1 - (y - r.y) / r.height * 2), camera);
  }
  function hit(x: number, y: number, s: MountainState) {
    if (!canGrab(s)) return false; setRay(x, y);
    const mesh = s.phase === 'load-soil' ? loader.hit : s.phase === 'push' ? dozer.hit : s.phase === 'excavate' ? excavator.hitbox : s.phase === 'haul' ? truck.driveHitbox : sweeper.hit;
    const r = canvas.getBoundingClientRect(), from = task(s).from;
    return ray.intersectObject(mesh, true).length > 0 || Math.hypot(x - r.x - from.x, y - r.y - from.y) <= 48;
  }
  function driveTarget(s: MountainState, point: Screen) {
    const r = canvas.getBoundingClientRect(), finger = { x: point.x - r.x, y: point.y - r.y }, info = task(s);
    const start = s.phase === 'push' ? screen(pushPoint(s.pushIndex, 0)) : s.phase === 'haul' ? screen({ x: HAUL_START, y: 1.2, z: ARM_Z }) : screen({ x: SWEEP_START, y: 1.2, z: SWEEP_Z });
    if (Math.hypot(finger.x - info.to.x, finger.y - info.to.y) < 22) return 1;
    const dx = info.to.x - start.x, dy = info.to.y - start.y;
    return ((finger.x - start.x) * dx + (finger.y - start.y) * dy) / (dx * dx + dy * dy);
  }
  function bucketTarget(s: MountainState, point: Screen): Point {
    const r = canvas.getBoundingClientRect(), finger = { x: point.x - r.x, y: point.y - r.y };
    const candidates = s.carried !== null ? [BED] : rocks(s.round).filter((_, i) => !s.delivered.includes(i));
    const goal = candidates.map(p => ({ p, d: Math.hypot(screen(p).x - finger.x, screen(p).y - finger.y) })).sort((a, b) => a.d - b.d)[0];
    if (goal && goal.d < 32) return goal.p;
    setRay(point.x, point.y); const p = new THREE.Vector3();
    ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(s.carried === null ? 0.85 : CARRY_HEIGHT)), p);
    return { x: p.x * roundSide, y: p.y, z: p.z };
  }
  function loaderTarget(s: MountainState, point: Screen, raw: Screen) {
    const r = canvas.getBoundingClientRect(), finger = { x: point.x - r.x, y: point.y - r.y }, actual = { x: raw.x - r.x, y: raw.y - r.y };
    const remaining = ([0, 1] as const).filter(id => !s.soilLoaded.includes(id));
    const distance = (p: Screen) => Math.min(Math.hypot(p.x - finger.x, p.y - finger.y), Math.hypot(p.x - actual.x, p.y - actual.y));
    const id: SoilId = s.loaderSelected !== null && (s.loaderCarrying || s.loaderTravel > 0) ? s.loaderSelected : remaining.sort((a, b) => distance(screen(soilPoint(a))) - distance(screen(soilPoint(b))))[0] ?? 0;
    const startState = { ...s, loaderSelected: id, loaderTravel: 0 }, start = task(startState).from, goal = task(startState).to;
    if (distance(goal) < 25) return { id, desired: 1 };
    if (!s.loaderCarrying && s.loaderTravel === 0) return { id, desired: 0 };
    const dx = goal.x - start.x, dy = goal.y - start.y;
    return { id, desired: ((finger.x - start.x) * dx + (finger.y - start.y) * dy) / (dx * dx + dy * dy) };
  }
  return { canvas, screen, task, goals, hit, driveTarget, bucketTarget, loaderTarget,
    hint(s: MountainState): DragHint | undefined {
      if (!canGrab(s)) return;
      const t = task(s), dx = t.to.x - t.from.x, dy = t.to.y - t.from.y;
      return { from: t.from, to: t.to, direction: dy < 0 && Math.abs(dy) > Math.abs(dx) ? 'up' : dx < 0 ? 'left' : 'right', label: s.phase === 'load-soil' ? s.loaderDocked ? '向上拖曳，抬高鏟斗倒料' : s.loaderCarrying ? '拖鏟裝機到車斗後方停好' : '拖鏟裝機到任一土堆' : s.phase === 'excavate' ? s.carried !== null ? '拖挖斗到砂石車車斗' : '拖挖斗到任一大石頭' : s.phase === 'push' ? '拖推土機，把土石推到旁邊' : '按住車子，沿箭頭拖曳' };
    },
    render(s: MountainState, time: number) {
      roundSide = s.round.layout === 0 ? 1 : -1; site.scale.x = roundSide;
      const order = stageOrder(s.workOrder), index = order.indexOf(s.phase), at = (name: MountainState['phase']) => order.indexOf(name), t = s.elapsed;
      dozer.root.visible = index <= at('dozer-exit');
      const { point: p, heading, lift } = bulldozerPose(s, exit());
      dozer.root.position.set(p.x, 0.04, p.z); dozer.root.rotation.y = heading; dozer.pose(lift);
      loader.root.visible = index >= at('loader-arrival') && index <= at('loader-exit');
      const loading = loaderPose(s, exit());
      loader.root.position.set(loading.point.x, 0.04, loading.point.z); loader.root.rotation.y = loading.heading;
      loader.pose(loading.lift, loading.tilt, loading.fill, loading.point.x + loading.point.z + (s.motion === 'loader-scoop' ? t : 0));
      truck.root.visible = index >= at('truck-arrival') && index <= at('truck-exit');
      let truckX = HAUL_START;
      if (s.phase === 'truck-arrival') truckX += (1 - smooth(t / 2.2)) * exit();
      if (s.phase === 'haul') truckX += (HAUL_END - HAUL_START) * s.haul;
      if (s.phase === 'truck-exit') truckX = HAUL_END - (exit() + HAUL_END) * smooth(t / 2.2);
      truck.root.position.set(truckX, 0.04, ARM_Z); truck.roll(truckX); truck.bed.rotation.z = 0;
      const filled = soilInTruck(s); truck.cargo.visible = filled > 0;
      truck.cargo.scale.y = 0.25 + filled * 0.9; truck.cargo.position.y = 0.08 + filled * 0.25;
      excavator.root.visible = index >= at('excavator-arrival') && index <= at('excavator-exit');
      const offset = s.phase === 'excavator-arrival' ? -(1 - smooth(t / 2.2)) * exit() : s.phase === 'excavator-exit' ? -exit() * smooth(t / 2.5) : 0;
      excavator.root.position.set(offset, 0.04, ARM_Z);
      excavator.pose({ ...s.bucket, z: s.bucket.z - ARM_Z }, s.motion === 'unload' ? -0.28 - smooth((t - 0.85) / 0.2) * 0.8 : s.carried !== null ? -0.28 : 0);
      const source = rocks(s.round);
      boulders.forEach((b, i) => {
        const slot = s.delivered.indexOf(i); let point = source[i];
        b.visible = slot < 0 || truck.root.visible;
        if (slot >= 0) point = { ...cargo(slot), x: cargo(slot).x + truckX - HAUL_START };
        else if (s.carried === i && (s.motion !== 'lift' || t >= 0.3)) { point = { ...s.bucket, x: s.bucket.x + 0.12, y: s.bucket.y + 0.15 }; if (s.motion === 'unload' && t > 0.9) point = mix(point, cargo(s.delivered.length), smooth((t - 0.9) / 0.25)); }
        b.position.set(point.x, point.y + 0.04, point.z); b.rotation.set(0.2, i * 0.8, 0.1);
      });
      soil.forEach((mound, i) => {
        const point = soilPoint(i as SoilId, s.pushes[i]), remaining = soilRemaining(s, i as SoilId);
        mound.position.set(point.x, 0, point.z);
        mound.scale.set(1, remaining, 1); mound.visible = remaining > 0.001;
      });
      // Ground, bucket and truck exchange the same two soil loads during contact/pouring.
      loader.root.updateWorldMatrix(true, true);
      const lip = site.worldToLocal(loader.lip.getWorldPosition(new THREE.Vector3()));
      soilStream.forEach((grain, i) => {
        grain.visible = s.motion === 'loader-tip' && t >= POUR_START && t <= POUR_END;
        if (!grain.visible) return;
        const u = ((t - POUR_START) * 2.6 + i / soilStream.length) % 1;
        grain.position.set(lip.x + (Math.sin(i * 4) * 0.2 - 0.2) * u, lip.y + (2.1 - lip.y) * u * u, lip.z + (Math.cos(i * 3) * 0.16 - 0.1) * u);
        grain.rotation.set(t * 3 + i, i, t * 2); grain.scale.setScalar(0.65 + Math.sin(u * Math.PI) * 0.45);
      });
      residues.forEach(r => { r.visible = s.swept === 0 || r.position.x > SWEEP_START + (SWEEP_END - SWEEP_START) * s.swept + 0.9; });
      sweeper.root.visible = index >= at('sweeper-arrival') && index <= at('sweeper-exit');
      const sweepX = s.phase === 'sweeper-arrival' ? SWEEP_START - (1 - smooth(t / 2)) * exit() : s.phase === 'sweeper-exit' ? SWEEP_END + (exit() - SWEEP_END) * smooth(t / 2.2) : SWEEP_START + (SWEEP_END - SWEEP_START) * s.swept;
      sweeper.root.position.set(sweepX, 0.04, SWEEP_Z); sweeper.roll(sweepX); sweeper.brush(time, s.phase === 'sweep' && s.action !== 'ready'); sweeper.beacon(time, false);
      const reopened = s.phase === 'reopen' || s.phase === 'complete', opening = s.phase === 'complete' ? 1 : reopened ? smooth(t / 1) : 0;
      barriers.forEach(b => { b.position.z = -0.55 - opening * 6.6; }); cones.forEach(c => { c.visible = !reopened || t < 0.9; });
      const u = s.phase === 'complete' ? 1 : s.phase === 'reopen' ? smooth((t - 1.2) / 4.8) : 0;
      const carDistance = exit() + 10, carX = -10 + carDistance * u, carZ = Math.abs(carX) > 11 ? -1.2 : Math.abs(carX) > 8 ? -1.2 + (11 - Math.abs(carX)) * 0.5 : 0.3;
      car.root.position.set(carX, 0.04, carZ); car.root.rotation.y = Math.abs(carX) > 8 && Math.abs(carX) < 11 ? carX < 0 ? -Math.atan(0.5) : Math.atan(0.5) : 0; car.pose('#d99679', u * carDistance, time, false, false);
      workers.forEach((w, i) => { w.arm.rotation.z = reopened ? -2.1 + Math.sin(time * 3 + i) * 0.25 : -0.2; });
      dust.forEach((d, i) => {
        d.visible = (s.phase === 'push' || s.phase === 'sweep') && s.action !== 'ready'; const u = (time * 0.8 + i / 12) % 1;
        d.position.set(s.phase === 'push' ? p.x + Math.cos(PUSH_HEADING) * 2 + Math.sin(i * 4) * 0.6 : sweepX + 0.6, 0.25 + u * 0.55, s.phase === 'push' ? p.z - Math.sin(PUSH_HEADING) * 2 + Math.cos(i * 4) * 0.6 : SWEEP_Z + Math.sin(i * 3)); d.scale.setScalar(Math.sin(u * Math.PI));
      });
      confetti.forEach((c, i) => { c.visible = s.phase === 'complete'; const u = (time * 0.25 + i / 28) % 1; c.position.set(Math.sin(i * 5) * 7, 7 - u * 6, Math.cos(i * 7) * 4); c.rotation.set(time, i, time + i); c.scale.setScalar(Math.sin(u * Math.PI)); });
      renderer.render(scene, camera);
    },
  };
});

export type MountainScene = Effect.Success<ReturnType<typeof createMountainScene>>;
