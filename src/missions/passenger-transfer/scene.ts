import { Effect } from 'effect';
import { acquireRenderer, acquireScene } from '../../runtime/scene-lifecycle.ts';
import * as THREE from 'three';
import { createShapes } from '../../runtime/geometry.ts';
import { createResident } from '../../runtime/resident.ts';
import { createPerson } from '../../runtime/emergency-models.ts';
import { createTownBench, createTownHouse, createTownTree } from '../../runtime/town-scenery.ts';
import { createBus, createTaxi, createSuitcase, PALETTES } from './vehicles.ts';
import { createTransferCamera, resizeTransferCamera } from './view.ts';
import { stages, available, currentVehicle, isDoor, driveRoute, isFinalVisit, coachHasLeft, luggageAboard } from './domain/transit.ts';
import type { TransitState, Stage, Vehicle, Transfer } from './domain/transit.ts';
import { dock, berth as vehicleBerth, waiting, suitcaseHome, cargoTarget, arrivalRoute, exitRoute, entrancePose, finalEntrancePose, pathPose, pathLength, passengerRoute, walkPose, seat, smooth, lerp, clamp, LENGTH, WIDTH, ROAD, STATION, TAXI_BAY, HOLDING_BAYS, BAY_DIVIDER, MAIN_PLATFORM, platformOutline, loadingOutline, holdingOutline, transferPair, finalVehicle, stowedLuggage } from './domain/terminal.ts';
import type { Point, Position } from './domain/terminal.ts';
import type { DragHint } from '../../runtime/drag-hint.ts';
interface Screen { x: number; y: number }
export const createTransferScene = (host: HTMLElement, makeRenderer = () => new THREE.WebGLRenderer({ antialias: true })) => Effect.gen(function* () {
  const renderer = yield* acquireRenderer(makeRenderer); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#dce8d6');
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement; canvas.setAttribute('aria-label', '乘客轉運站：拖車進站、開門接送與裝行李'); host.append(canvas);
  const scene = yield* acquireScene();
  const camera = createTransferCamera();
  scene.add(new THREE.HemisphereLight('#fff7df', '#a3b39a', 2.4));
  const sun = new THREE.DirectionalLight('#fff1d5', 2.6);
  yield* Effect.addFinalizer(() => Effect.sync(() => sun.shadow.dispose()));
  sun.position.set(-12, 24, 14); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = 0.035;
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 22, bottom: -22, far: 80 }); scene.add(sun);
  const shapes = createShapes();
  yield* Effect.addFinalizer(() => Effect.sync(() => shapes.disposeMaterials()));
  const { box, cylinder, material } = shapes;
  box(scene, [180, 0.35, 180], [0, -0.27, 0], '#bed2ac');
  box(scene, [100, 0.12, ROAD.front - ROAD.back], [0, -0.03, ROAD.centre], '#a4aaa0');
  const site = new THREE.Group(); scene.add(site);
  function surface(points: Point[], color: string, y = 0.03) {
    const shape = new THREE.Shape(); points.forEach((p, i) => i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z)); shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape); geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material(color)); mesh.position.y = y; mesh.receiveShadow = true; site.add(mesh); return mesh;
  }
  // Separate recessed bays join the single through lane; their footprint never enters the platform.
  surface(loadingOutline(), '#a4aaa0');
  surface(holdingOutline(), '#a4aaa0');
  for (const [a, b, z] of [[-55, -26, ROAD.front], [11, 55, ROAD.front], [-55, -29, ROAD.back], [-1, 55, ROAD.back]]) box(site, [b - a, 0.025, 0.07], [(a + b) / 2, 0.045, z], '#eee7cd');
  // One-way direction arrows replace the old centre divider.
  for (let x = -30; x < 32; x += 8) surface([{ x: x - 0.9, z: ROAD.centre - 0.15 }, { x: x + 0.2, z: ROAD.centre - 0.15 }, { x: x + 0.2, z: ROAD.centre - 0.55 }, { x: x + 1, z: ROAD.centre }, { x: x + 0.2, z: ROAD.centre + 0.55 }, { x: x + 0.2, z: ROAD.centre + 0.15 }, { x: x - 0.9, z: ROAD.centre + 0.15 }], '#f6eacc', 0.05);
  for (const x of [HOLDING_BAYS.schoolX, HOLDING_BAYS.coachX]) {
    for (const z of [-1.45, 1.45]) box(site, [HOLDING_BAYS.length, 0.025, 0.07], [x, 0.05, HOLDING_BAYS.z + z], '#eee5c7');
    for (const end of [-1, 1]) box(site, [0.07, 0.025, 2.9], [x + end * HOLDING_BAYS.length / 2, 0.05, HOLDING_BAYS.z], '#eee5c7');
  }
  for (const z of [TAXI_BAY.z - 1, TAXI_BAY.z + 1]) box(site, [4.5, 0.025, 0.07], [TAXI_BAY.centreX, 0.05, z], '#efd18b');
  for (const x of [TAXI_BAY.centreX - 2.25, TAXI_BAY.centreX + 2.25]) box(site, [0.07, 0.025, 2], [x, 0.05, TAXI_BAY.z], '#efd18b');
  // Large-vehicle loading and waiting spaces remain identifiable between arrivals.
  for (const z of [-1.45, 1.45]) box(site, [8, 0.025, 0.07], [0, 0.05, z], '#eee5c7');
  for (const x of [-4, 4]) box(site, [0.07, 0.025, 2.9], [x, 0.05, 0], '#eee5c7');
  const dividerX = (BAY_DIVIDER.left + BAY_DIVIDER.right) / 2, dividerZ = (BAY_DIVIDER.back + BAY_DIVIDER.front) / 2;
  box(site, [BAY_DIVIDER.right - BAY_DIVIDER.left, 0.2, BAY_DIVIDER.front - BAY_DIVIDER.back], [dividerX, 0.055, dividerZ], '#e7dcc0');
  box(site, [0.8, 0.3, 1.3], [dividerX, 0.3, dividerZ], '#b4c49c');
  const island = new THREE.Group(); site.add(island);
  const platformShape = new THREE.Shape();
  platformOutline().forEach((p, i) => i ? platformShape.lineTo(p.x, -p.z) : platformShape.moveTo(p.x, -p.z)); platformShape.closePath();
  const platformGeometry = new THREE.ExtrudeGeometry(platformShape, { depth: 0.2, bevelEnabled: false }); platformGeometry.rotateX(-Math.PI / 2);
  const platform = new THREE.Mesh(platformGeometry, material('#e7dcc0')); platform.position.y = -0.045; platform.castShadow = true; platform.receiveShadow = true; island.add(platform);
  box(island, [MAIN_PLATFORM.right - MAIN_PLATFORM.left, 0.07, 0.18], [(MAIN_PLATFORM.left + MAIN_PLATFORM.right) / 2, 0.17, MAIN_PLATFORM.curbZ + 0.1], '#f6eac9');
  box(island, [TAXI_BAY.right - TAXI_BAY.left, 0.025, 0.2], [(TAXI_BAY.left + TAXI_BAY.right) / 2, 0.21, MAIN_PLATFORM.curbZ + 0.1], '#e3bc68');
  for (let x = MAIN_PLATFORM.left + 0.4; x < MAIN_PLATFORM.right; x += 0.6) box(island, [0.3, 0.025, 0.08], [x, 0.17, 2.05], '#c3b58e');
  for (const [x, z, color] of [[-14.1, 3.7, '#bc9c71'], [-2.45, 4.7, '#a6b497'], [1.55, 3.7, '#a0adbd']] as const) {
    const marker = new THREE.Mesh(new THREE.CircleGeometry(0.77, 32), material(color)); marker.rotation.x = -Math.PI / 2; marker.position.set(x, 0.17, z); island.add(marker);
  }
  const bench = createTownBench(shapes); bench.scale.setScalar(0.45); bench.position.set(5.3, 0.17, 6.1); island.add(bench);
  // Shelter covers the bench only, keeping the entire boarding path and waiting passengers visible.
  for (const x of [4.58, 6.02]) cylinder(island, 0.055, 2.1, [x, 1.2, 6.35], '#819d91', 8);
  box(island, [1.8, 0.15, 1.15], [5.3, 2.3, 6.1], '#a2bdb0');
  const taxiSignZ = MAIN_PLATFORM.walkZ + 0.6, taxiSignX = TAXI_BAY.right - 0.3;
  cylinder(island, 0.06, 2.3, [taxiSignX, 1.3, taxiSignZ], '#8b9f92', 8);
  box(island, [1.0, 0.75, 0.12], [taxiSignX, 2.35, taxiSignZ], '#fff0c6');
  box(island, [0.7, 0.22, 0.13], [taxiSignX, 2.3, taxiSignZ + 0.09], '#dcb75f');
  box(island, [0.32, 0.15, 0.13], [taxiSignX, 2.48, taxiSignZ + 0.09], '#dcb75f');
  for (const x of [taxiSignX - 0.23, taxiSignX + 0.23]) cylinder(island, 0.08, 0.05, [x, 2.16, taxiSignZ + 0.14], '#667d73', 10).rotation.x = Math.PI / 2;
  cylinder(island, 0.065, 2.9, [5.5, 1.55, 2.5], '#8b9f92', 8);
  box(island, [0.9, 1, 0.14], [5.5, 2.8, 2.5], '#faf0d5');
  box(island, [0.65, 0.36, 0.1], [5.5, 2.93, 2.6], '#8db2a5');
  for (const x of [5.28, 5.72]) cylinder(island, 0.09, 0.06, [x, 2.64, 2.6], '#647e76', 10).rotation.x = Math.PI / 2;
  const station = createTownHouse(shapes, '#f1dfbd', '#9ab5ae'); station.position.set(STATION.x, 0, STATION.z); station.scale.set(1.25, 0.62, 0.85); scene.add(station);
  box(scene, [7.3, 0.13, 3.2], [STATION.x, -0.01, STATION.z], '#e2d8bd');
  for (const [x, z, scale] of [[13, -12, 0.8], [14, 7, 0.8], [-15, 7, 0.75], [-8, -13, 0.75]]) {
    const tree = createTownTree(shapes); tree.position.set(x, 0, z); tree.scale.setScalar(scale); scene.add(tree);
  }
  const vehicles = { bus: createBus(shapes, 'bus'), taxi: createTaxi(shapes), school: createBus(shapes, 'school'), coach: createBus(shapes, 'coach') };
  Object.values(vehicles).forEach(v => scene.add(v.root));
  const passengers = Array.from({ length: 6 }, (_, i) => {
    const person = createResident(shapes, i); person.root.name = `transfer-passenger-${i}`; scene.add(person.root);
    if (i === 2 || i === 3) { box(person.root, [0.3, 0.34, 0.15], [0, 0.55, -0.19], i === 2 ? '#c58f78' : '#91a5ba'); box(person.root, [0.17, 0.08, 0.04], [0, 0.54, -0.28], '#f0d9ac'); }
    if (i >= 4) cylinder(person.root, 0.22, 0.07, [0, 1.16, 0], '#d1b489', 12);
    return person;
  });
  const steward = createPerson(shapes, true); steward.root.scale.setScalar(0.86); scene.add(steward.root);
  const suitcase = createSuitcase(shapes); scene.add(suitcase.root);
  const confetti = Array.from({ length: 36 }, (_, n) => box(scene, [0.12, 0.14, 0.045], [0, 0, 0], ['#e6bd6c', '#9dbba3', '#d89983', '#b1a4c5'][n % 4]));
  const routeMaterial = new THREE.MeshBasicMaterial({ color: '#fff1c4' }), routeGeometry = new THREE.CircleGeometry(0.11, 8);
  const markers = Array.from({ length: 110 }, () => { const m = new THREE.Mesh(routeGeometry, routeMaterial); m.rotation.x = -Math.PI / 2; scene.add(m); return m; });
  const berth = new THREE.Group(); site.add(berth);
  for (const z of [-1.45, 1.45]) for (let x = -3.4; x <= 3.4; x += 0.55) box(berth, [0.3, 0.03, 0.06], [x, 0.065, z], '#fff0c3');
  for (const x of [-3.75, 3.75]) for (let z = -1.35; z <= 1.35; z += 0.5) box(berth, [0.06, 0.03, 0.28], [x, 0.065, z], '#fff0c3');
  const resize = yield* Effect.acquireRelease(Effect.sync(() => new ResizeObserver(() => {
    const r = host.getBoundingClientRect(); if (!r.width || !r.height) return;
    resizeTransferCamera(camera, r.width / r.height); renderer.setSize(r.width, r.height);
  })), value => Effect.sync(() => value.disconnect()));
  resize.observe(host);
  function screen(p: Point, y = 1): Screen {
    camera.updateMatrixWorld(true); const r = canvas.getBoundingClientRect(), v = new THREE.Vector3(p.x, y, p.z).project(camera);
    return { x: (v.x + 1) * r.width / 2, y: (1 - v.y) * r.height / 2 };
  }
  function world(p: Screen, y = 0.6): Position {
    const r = canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((p.x - r.x) / r.width * 2 - 1, -(p.y - r.y) / r.height * 2 + 1), camera);
    const out = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), out);
    return { x: out.x, y, z: out.z };
  }
  const phaseIndex = (s: TransitState) => stages.indexOf(s.phase);
  const atLeast = (s: TransitState, p: Stage) => phaseIndex(s) >= stages.indexOf(p);
  function vehiclePose(s: TransitState, v: Vehicle) {
    const p = vehicleBerth(s.round, v), active = currentVehicle(s), pair = transferPair(s.round);
    const visible = v === 'bus' ? phaseIndex(s) <= stages.indexOf('bus-departure') : v === finalVehicle(s.round) ? isFinalVisit(s) && !atLeast(s, 'celebrate') : atLeast(s, 'transfer-entrance') && !s.order.includes(v) && !isFinalVisit(s);
    if (s.phase === 'transfer-entrance' && v !== 'bus' && pair.includes(v)) return entrancePose(s.round, v, s.elapsed, Math.max(26, camera.right * 1.2 + 5));
    if (s.phase === 'coach-entrance' && v === finalVehicle(s.round)) return finalEntrancePose(s.round, s.elapsed, Math.max(30, camera.right * 1.2 + 5));
    let path = arrivalRoute(s.round, v), fraction = 0;
    if (v === active && s.phase !== 'choose') {
      if (s.phase.endsWith('-arrival')) fraction = s.travel;
      else if (s.phase.endsWith('-exit')) { path = exitRoute(s.round, v); fraction = s.travel; }
      else if (s.phase.endsWith('-departure')) {
        const end = exitRoute(s.round, v).at(-1)!, x = lerp(end.x, Math.max(28, camera.right * 1.25 + 14), smooth(s.elapsed / 2));
        return { x, z: end.z, yaw: 0, distance: x - p.x + pathLength(path), visible };
      } else if (s.phase !== 'intro') fraction = 1;
    }
    return { ...pathPose(path, fraction), visible };
  }
  function opening(s: TransitState, v: Vehicle) {
    if (v !== currentVehicle(s)) return 0;
    if (s.phase === 'unloading') return 1 - smooth((s.elapsed - 5.3) / 0.8);
    if (s.phase === 'boarding' || s.phase === 'coach-boarding') return 1 - smooth((s.elapsed - 3.3) / 0.8);
    return s.doors[v];
  }
  function bagPose(s: TransitState) {
    if (s.phase === 'loading') { const t = smooth(s.elapsed / 1.1), p = stowedLuggage(vehiclePose(s, 'coach')); return { x: lerp(s.luggage.x, p.x, t), y: lerp(s.luggage.y, p.y, t), z: lerp(s.luggage.z, p.z, t), tilt: t * Math.PI / 2, yaw: p.yaw }; }
    if (luggageAboard(s)) return stowedLuggage(vehiclePose(s, 'coach'));
    return { ...s.luggage, tilt: 0, yaw: 0 };
  }
  function task(s: TransitState, vehicle = currentVehicle(s)) {
    const pose = vehiclePose(s, vehicle);
    if (s.phase === 'luggage') {
      const b = bagPose(s), to = cargoTarget(s.round);
      return { vehicle, kind: 'luggage' as const, value: 0, from: screen(b, b.y + 0.5), to: screen(to, to.y + 0.12), points: [] as Screen[] };
    }
    if (isDoor(s)) {
      const handle = vehicles[vehicle].doorHandle, amount = s.doors[vehicle];
      const point = vehicle === 'taxi' ? { x: pose.x + (-0.15 - 0.7 * Math.cos(amount * 1.15)) * 1.1, z: pose.z + 0.76 + Math.sin(amount * 1.15) * 0.77 } : { x: pose.x + handle.x - amount * 0.7, z: pose.z + handle.z };
      const from = screen(point, handle.y);
      const a = screen(pose, 1), b = screen({ x: pose.x + (vehicle === 'taxi' ? 0.65 : -1), z: pose.z + (vehicle === 'taxi' ? 0.8 : 0) }, 1);
      const length = Math.hypot(b.x - a.x, b.y - a.y), dx = (b.x - a.x) / length * 82, dy = (b.y - a.y) / length * 82;
      return { vehicle, kind: 'door' as const, value: amount, from, to: { x: from.x + dx * (1 - amount), y: from.y + dy * (1 - amount) }, points: [] as Screen[] };
    }
    const path = s.phase === 'choose' ? arrivalRoute(s.round, vehicle) : driveRoute(s, vehicle), value = s.phase === 'choose' ? 0 : s.travel;
    const points = path.map(p => screen(p, 1)), end = points.at(-1)!;
    const to = s.phase.endsWith('-exit') ? { x: Math.max(30, Math.min(canvas.clientWidth - 30, end.x)), y: end.y } : end;
    return { vehicle, kind: 'drive' as const, value, from: screen(pose, 1), to, points };
  }
  function hit(clientX: number, clientY: number, s: TransitState): Vehicle | undefined {
    const r = canvas.getBoundingClientRect(), p = { x: clientX - r.x, y: clientY - r.y }, eligible = available(s);
    if (s.action !== 'ready') return;
    if (isDoor(s) || s.phase === 'luggage') {
      const t = task(s); if (Math.hypot(p.x - t.from.x, p.y - t.from.y) <= 48) return currentVehicle(s);
      return;
    }
    scene.updateMatrixWorld(true); const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(p.x / r.width * 2 - 1, 1 - p.y / r.height * 2), camera);
    const intersected = eligible.map(v => ({ v, hit: ray.intersectObject(vehicles[v].hit)[0], d: Math.hypot(p.x - task(s, v).from.x, p.y - task(s, v).from.y) }));
    const exact = intersected.filter(v => v.hit).sort((a, b) => a.hit!.distance - b.hit!.distance);
    return exact[0]?.v ?? intersected.filter(v => v.d < 38).sort((a, b) => a.d - b.d)[0]?.v;
  }
  function target(s: TransitState, vehicle: Vehicle, client: Screen) {
    const r = canvas.getBoundingClientRect(), point = { x: client.x - r.x, y: client.y - r.y }, info = task(s, vehicle), path = driveRoute(s, vehicle);
    if (Math.hypot(point.x - info.to.x, point.y - info.to.y) < 22) return 1;
    const length = pathLength(path); let traversed = 0, nearest = Infinity, value = s.travel;
    for (let i = 1; i < path.length; i++) {
      const a = info.points[i - 1], b = info.points[i], dx = b.x - a.x, dy = b.y - a.y;
      const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1));
      const distance = Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t), segment = Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
      if (distance < nearest) { nearest = distance; value = (traversed + t * segment) / length; } traversed += segment;
    }
    return value;
  }
  function nearCargo(s: TransitState, client: Screen, bag: Position) {
    const r = canvas.getBoundingClientRect(), to = task(s).to, projected = screen(bag, bag.y + 0.5);
    return Math.min(Math.hypot(client.x - r.x - to.x, client.y - r.y - to.y), Math.hypot(projected.x - to.x, projected.y - to.y)) <= 27;
  }
  function choice(s: TransitState, v: Transfer) {
    const p = vehiclePose(s, v), from = screen(p, 1);
    const corners = [-1, 1].flatMap(x => [-1, 1].map(z => screen({ x: p.x + x * (LENGTH[v] / 2 + 0.2), z: p.z + z * (WIDTH[v] / 2 + 0.15) }, 0.2)));
    return { from, width: Math.max(...corners.map(c => c.x)) - Math.min(...corners.map(c => c.x)) + 12, height: Math.max(28, Math.max(...corners.map(c => c.y)) - Math.min(...corners.map(c => c.y)) + 20) };
  }
  return { canvas, task, choice, hit, target, world, nearCargo,
    hint(s: TransitState, preferred?: Vehicle): DragHint | undefined {
      if (s.action !== 'ready') return;
      if (s.phase === 'choose' && available(s).length === 2 && !preferred) return;
      const eligible = available(s), vehicle = preferred && eligible.includes(preferred) ? preferred : eligible[0]; if (!vehicle) return;
      const t = task(s, vehicle), path = t.kind === 'drive' ? s.phase === 'choose' ? arrivalRoute(s.round, vehicle) : driveRoute(s, vehicle) : undefined;
      let via: Screen[] | undefined;
      if (path) { let distance = 0; const length = pathLength(path); via = t.points.filter((_, i) => { if (i) distance += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z); return i > 0 && i < path.length - 1 && distance > t.value * length + 0.05; }); }
      return { from: t.from, to: t.to, via, direction: Math.abs(t.to.y - t.from.y) > Math.abs(t.to.x - t.from.x) ? 'up' : t.to.x < t.from.x ? 'left' : 'right', label: t.kind === 'door' ? '沿箭頭拉開車門' : t.kind === 'luggage' ? '拖行李到遊覽車的行李艙' : '拖車子沿路線到目的地' };
    },
    render(s: TransitState, time: number, preferred?: Vehicle) {
      const d = dock(s.round), palette = PALETTES[s.round.palette], current = currentVehicle(s);
      site.position.x = d.x;
      berth.visible = s.phase.endsWith('-arrival') && current !== 'taxi' || s.phase === 'choose';
      const poses = { bus: vehiclePose(s, 'bus'), taxi: vehiclePose(s, 'taxi'), school: vehiclePose(s, 'school'), coach: vehiclePose(s, 'coach') };
      for (const id of ['bus', 'taxi', 'school', 'coach'] as const) {
        const v = vehicles[id], p = poses[id]; v.root.position.set(p.x, 0.06, p.z); v.root.rotation.y = p.yaw; v.root.visible = p.visible;
      }
      vehicles.bus.pose(poses.bus.distance, time, opening(s, 'bus'), palette.bus);
      vehicles.school.pose(poses.school.distance, time, opening(s, 'school'), '#e4be68');
      vehicles.coach.pose(poses.coach.distance, time, opening(s, 'coach'), palette.coach, ['luggage', 'loading'].includes(s.phase) ? 1 : opening(s, 'coach'));
      vehicles.taxi.pose(poses.taxi.distance, time, opening(s, 'taxi'));
      passengers.forEach((person, id) => {
        const group: Vehicle = id < 2 ? 'taxi' : id < 4 ? 'school' : 'coach';
        let point: Position & { yaw: number } = { ...waiting(s.round, id), yaw: Math.PI }, moving = false, seated = false, visible = true;
        if (!atLeast(s, 'unloading')) {
          const p = poses.bus, local = seat('bus', id); point = { x: p.x + local.x, y: local.y, z: p.z + local.z, yaw: Math.PI / 2 }; seated = true;
        } else if (s.phase === 'unloading') {
          const fraction = clamp((s.elapsed - id * 0.45) / 2.9); point = walkPose(passengerRoute(s.round, 'bus', id), fraction); moving = fraction > 0 && fraction < 1; seated = fraction === 0;
        } else if (s.order.includes(group as Transfer) || atLeast(s, 'celebrate')) visible = false;
        else if (group === current && (s.phase === 'boarding' || s.phase === 'coach-boarding')) {
          const fraction = clamp((s.elapsed - (id % 2) * 0.4) / 2.8); point = walkPose(passengerRoute(s.round, group, id), fraction); moving = fraction > 0 && fraction < 1; seated = fraction === 1;
        } else if (group === current && (s.phase.endsWith('-exit') || s.phase.endsWith('-departure'))) {
          const p = poses[group], local = seat(group, id); point = { x: p.x + Math.cos(p.yaw) * local.x + Math.sin(p.yaw) * local.z, y: local.y, z: p.z - Math.sin(p.yaw) * local.x + Math.cos(p.yaw) * local.z, yaw: p.yaw + Math.PI / 2 }; seated = true; visible = p.visible;
        }
        person.root.visible = visible; person.root.position.set(point.x, point.y + (moving ? Math.abs(Math.sin(time * 10 + id)) * 0.025 : 0), point.z); person.root.rotation.y = point.yaw;
        person.root.scale.setScalar(id === 2 || id === 3 ? 0.72 : 0.86);
        person.arm.rotation.x = moving ? Math.sin(time * 9 + id) * 0.4 : 0;
        person.arm.rotation.z = !moving && !seated ? -0.12 + Math.sin(time * 2 + id) * 0.08 : 0;
        person.legs.forEach((leg, n) => { leg.rotation.x = seated ? -0.9 : moving ? Math.sin(time * 9 + id + n * Math.PI) * 0.5 : 0; });
        const shirt = ['#d5a37d', '#93b2a3', '#e3bc6a', '#b2a0c2', '#93b0bd', '#bf968a'][(id + s.round.cast) % 6];
        const torso = person.root.children.find(o => o instanceof THREE.Mesh && o.geometry.type === 'CylinderGeometry'); if (torso instanceof THREE.Mesh) torso.material = material(shirt);
      });
      const guideHome = { x: d.x + 5.4, y: 0.16, z: 4.7 };
      const guidePath = [guideHome, { x: d.x + 5.3, y: 0.16, z: 3.2 }, { x: d.x + 2.15, y: 0.16, z: 2.3 }];
      const guiding = (s.phase === 'boarding' || s.phase === 'coach-boarding') && current === 'school', guide = guiding ? walkPose(guidePath, s.elapsed < 2.5 ? smooth(s.elapsed / 2.5) : 1 - smooth((s.elapsed - 2.5) / 1.7)) : { ...guideHome, yaw: -Math.PI / 2 };
      steward.root.position.set(guide.x, guide.y, guide.z); steward.root.rotation.y = guide.yaw;
      steward.arm.rotation.z = atLeast(s, 'celebrate') ? -2.1 + Math.sin(time * 4) * 0.3 : guiding ? -1.5 : -0.2;
      const b = bagPose(s); suitcase.root.position.set(b.x, b.y, b.z); suitcase.root.rotation.set(b.tilt, b.yaw, 0, 'YXZ'); suitcase.color(palette.case);
      suitcase.root.visible = atLeast(s, 'unloading') && !coachHasLeft(s) && !atLeast(s, 'celebrate');
      if (s.phase === 'unloading') {
        const home = suitcaseHome(s.round), walking = walkPose(passengerRoute(s.round, 'bus', 4), clamp((s.elapsed - 1.8) / 2.9));
        const putDown = smooth((s.elapsed - 4.7) / 0.5);
        suitcase.root.position.set(lerp(walking.x + 0.3, home.x, putDown), lerp(walking.y + 0.2, home.y, putDown), lerp(walking.z + 0.2, home.z, putDown));
      }
      const eligible = available(s), chosen = s.phase === 'choose' && eligible.length === 2 && !preferred ? undefined : preferred && eligible.includes(preferred) ? preferred : eligible[0], path = chosen && !isDoor(s) && s.phase !== 'luggage' ? s.phase === 'choose' ? arrivalRoute(s.round, chosen) : driveRoute(s, chosen) : undefined;
      const length = path ? pathLength(path) : 0;
      markers.forEach((m, n) => { m.visible = !!path && n * 0.5 < length; if (path && m.visible) { const p = pathPose(path, n * 0.5 / length); m.position.set(p.x, 0.065, p.z); } });
      confetti.forEach((p, n) => { p.visible = atLeast(s, 'celebrate'); const t = (time * 0.22 + n / 36) % 1; p.position.set(d.x + Math.sin(n * 5) * 8, 7 - t * 6, 3 + Math.cos(n * 7) * 3); p.rotation.set(time, n, time + n); p.scale.setScalar(Math.sin(t * Math.PI)); });
      renderer.render(scene, camera);
    },
  };
});

export type TransferScene = Effect.Success<ReturnType<typeof createTransferScene>>;
