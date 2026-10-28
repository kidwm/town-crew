import { Effect } from 'effect';
import { acquireRenderer, acquireScene } from '../../runtime/scene-lifecycle.ts';
import * as THREE from 'three';
import { createShapes } from '../../runtime/geometry.ts';
import { createCar } from '../../runtime/car.ts';
import { createTaxi } from '../../runtime/taxi.ts';
import { createTowTruck } from '../../runtime/tow-truck.ts';
import { createFlatbed } from '../../runtime/construction-models.ts';
import { createPalletCargo } from '../../runtime/pallet-cargo.ts';
import { createOfficer, createPerson, link } from '../../runtime/emergency-models.ts';
import { createTownTree, createTownHouse, createTownBench } from '../../runtime/town-scenery.ts';
import { createMotorcycle, createDetectiveVan } from './vehicles.ts';
import { createTrafficCone } from '../../runtime/traffic-cone.ts';
import { createRoadBarrier } from '../../runtime/road-barrier.ts';
import { route, pathPose, pathLength, vehiclePose, inspectedPose, inspectionKind, recoveryPose, CHECKPOINT, workPath, inspectionWalk, boardingRoute, officerPose, vanDoorSide, available, job, direction, at, smooth, PALETTE } from './domain/police.ts';
import type { PoliceState, Vehicle, Point } from './domain/police.ts';
import { createPoliceCamera, fitPoliceCamera, policeExitDistance, policeChoiceMarker } from './view.ts';
import type { DragHint } from '../../runtime/drag-hint.ts';
interface Screen { x: number; y: number }
export const createPoliceScene = (host: HTMLElement, makeRenderer = () => new THREE.WebGLRenderer({ antialias: true })) => Effect.gen(function* () {
  const renderer = yield* acquireRenderer(makeRenderer); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#dce9e0');
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement; canvas.setAttribute('aria-label', '警察臨檢現場：警車就位、三車臨檢、重機警戒、偵防車接送、平板拖吊'); host.append(canvas);
  const scene = yield* acquireScene();
  const camera = createPoliceCamera();
  scene.add(new THREE.HemisphereLight('#fff7e0', '#a3b59c', 2.4));
  const sun = new THREE.DirectionalLight('#fff1da', 2.5);
  yield* Effect.addFinalizer(() => Effect.sync(() => sun.shadow.dispose()));
  sun.position.set(-10, 18, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = 0.035;
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 22, bottom: -22, far: 65 }); scene.add(sun);
  const shapes = createShapes();
  yield* Effect.addFinalizer(() => Effect.sync(() => shapes.disposeMaterials()));
  const { box, cylinder } = shapes;
  box(scene, [200, 0.4, 200], [0, -0.31, 0], '#b9cea7');
  // One continuous road with short parking lanes; no street-block detours.
  box(scene, [100, 0.1, 12], [0, 0, -0.4], '#a9ab9b');
  for (const z of [-7, 6.8]) box(scene, [100, 0.12, 2.3], [0, 0.025, z], '#e7dabe');
  for (let x = -30; x <= 30; x += 2.5) box(scene, [1.2, 0.015, 0.06], [x, 0.065, 2.8], '#f7edce');
  for (const [z, width] of [[-5.2, 4.1], [4.3, 5.2]]) {
    for (const side of [-1, 1]) box(scene, [0.06, 0.018, 1.95], [side * width / 2, 0.065, z], '#f7edce');
  }
  const inspectionBay = new THREE.Group(); scene.add(inspectionBay);
  for (const x of [-3.3, 3.3]) box(inspectionBay, [0.06, 0.018, 2.4], [x, 0.065, CHECKPOINT.z], '#f7edce');
  const checkpoint = new THREE.Group(); scene.add(checkpoint);
  const cones = [-4.1, 4.1].map(x => { const cone = createTrafficCone(shapes); cone.position.set(x, 0.07, -3.7); checkpoint.add(cone); return cone; });
  const barrier = createRoadBarrier(shapes); barrier.rotation.y = Math.PI / 2; barrier.position.set(3.7, 0.06, -6.5); checkpoint.add(barrier);
  const sign = new THREE.Group(); checkpoint.add(sign);
  box(sign, [0.12, 1.6, 0.12], [0, 0.8, 0], '#83958b');
  box(sign, [1.4, 1, 0.12], [0, 1.85, 0], '#eee8d5');
  box(sign, [1.2, 0.15, 0.15], [0, 1.5, 0], '#7195a4');
  // A stop-hand pictogram works before the child can read a checkpoint sign.
  box(sign, [0.28, 0.36, 0.06], [0, 1.86, 0.1], '#7195a4');
  for (let i = 0; i < 4; i++) box(sign, [0.055, 0.2, 0.06], [-0.105 + i * 0.07, 2.08, 0.1], '#7195a4');
  const thumb = box(sign, [0.12, 0.2, 0.06], [-0.18, 1.89, 0.1], '#7195a4'); thumb.rotation.z = 0.5;
  const crossing = new THREE.Group(); scene.add(crossing);
  for (let z = -0.8; z < 5.6; z += 0.75) box(crossing, [0.8, 0.015, 0.28], [0, 0.066, z], '#e8dec4');
  for (const x of [-10, 10]) {
    const house = createTownHouse(shapes, '#e4d6b5', '#9bbcaf'); house.position.set(x, 0, -10); house.scale.set(0.8, 0.65, 0.65); scene.add(house);
    const tree = createTownTree(shapes); tree.position.set(x, 0, 8.5); scene.add(tree);
  }
  const bench = createTownBench(shapes); bench.scale.setScalar(0.5); bench.position.set(5, 0, 7.4); scene.add(bench);
  const police = createCar(shapes, true), bikes = [createMotorcycle(shapes), createMotorcycle(shapes, true)], van = createDetectiveVan(shapes), tow = createTowTruck(shapes);
  const vehicles = { police, bike0: bikes[0], bike1: bikes[1], van, tow }; Object.values(vehicles).forEach(v => scene.add(v.root));
  const suspectCar = createCar(shapes, false, { openingDoors: true }), taxi = createTaxi(shapes), freight = createFlatbed(shapes, false);
  for (const [id, x] of [[0, -0.5], [1, 1]]) { const cargo = createPalletCargo(shapes, id); cargo.root.position.set(x, 1.23, 0); freight.root.add(cargo.root); }
  scene.add(suspectCar.root, taxi.root, freight.root);
  const cable = cylinder(scene, 0.025, 1, [0, 0, 0], '#617b78', 8), hook = box(scene, [0.13, 0.18, 0.12], [0, 0, 0], '#d8b667');
  const suspect = createPerson(shapes), officer = createOfficer(shapes), driver = createOfficer(shapes);
  [suspect, officer, driver].forEach(p => scene.add(p.root));
  const passing = createCar(shapes); scene.add(passing.root);
  const confetti = Array.from({ length: 30 }, (_, i) => box(scene, [0.13, 0.13, 0.05], [0, 0, 0], ['#e5bc6b', '#89b8a7', '#db9a85'][i % 3]));
  const routeGeometry = new THREE.CircleGeometry(0.12, 8), routeMaterial = new THREE.MeshBasicMaterial({ color: '#fff1c7' });
  const routeMarkers = Array.from({ length: 120 }, () => { const m = new THREE.Mesh(routeGeometry, routeMaterial); m.rotation.x = -Math.PI / 2; scene.add(m); return m; });
  const resize = yield* Effect.acquireRelease(Effect.sync(() => new ResizeObserver(() => {
    const r = host.getBoundingClientRect(); if (!r.width || !r.height) return;
    fitPoliceCamera(camera, r.width, r.height); renderer.setSize(r.width, r.height);
  })), value => Effect.sync(() => value.disconnect()));
  resize.observe(host);
  function screen(p: Point, y = 1): Screen { camera.updateMatrixWorld(true); const r = canvas.getBoundingClientRect(), v = new THREE.Vector3(p.x, y, p.z).project(camera); return { x: (v.x + 1) * r.width / 2, y: (1 - v.y) * r.height / 2 }; }
  const exitDistance = () => policeExitDistance(camera);
  const pose = (s: PoliceState, vehicle: Vehicle) => vehiclePose(s, vehicle, exitDistance());
  function task(s: PoliceState, vehicle: Vehicle) {
    const key = job(s, vehicle)!;
    if (key === 'door') {
      const p = pose(s, 'van'), doorSide = vanDoorSide(s.round);
      const handle = (amount: number) => {
        const x = -0.04 - 1.43 * amount, z = doorSide * (1 + 0.14 * amount);
        return screen({ x: p.x + Math.cos(p.yaw) * x + Math.sin(p.yaw) * z, z: p.z - Math.sin(p.yaw) * x + Math.cos(p.yaw) * z }, 1.31);
      };
      const from = handle(0), rear = handle(1), length = Math.hypot(rear.x - from.x, rear.y - from.y);
      const scale = Math.max(1, 72 / length);
      const to = { x: from.x + (rear.x - from.x) * scale, y: from.y + (rear.y - from.y) * scale };
      // The grip follows the real handle, including when resuming a partly open door.
      return { vehicle, key, from: { x: from.x + (rear.x - from.x) * s.work.door, y: from.y + (rear.y - from.y) * s.work.door }, to, points: [from, rear], value: s.work.door };
    }
    const path = workPath(s, vehicle), points = path.map(p => screen(p)), p = pose(s, vehicle);
    const end = points.at(-1)!, rect = canvas.getBoundingClientRect();
    const to = { x: Math.max(27, Math.min(rect.width - 27, end.x)), y: Math.max(95, Math.min(rect.height - 125, end.y)) };
    return { vehicle, key, from: screen(p), to, points, value: s.work[key] };
  }
  const ray = new THREE.Raycaster();
  function hit(x: number, y: number, s: PoliceState): Vehicle | undefined {
    if (s.action !== 'ready') return;
    const r = canvas.getBoundingClientRect(); scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    ray.setFromCamera(new THREE.Vector2((x - r.x) / r.width * 2 - 1, 1 - (y - r.y) / r.height * 2), camera);
    const candidates = available(s).map(id => ({ id, hit: ray.intersectObject(vehicles[id].hit, true)[0], distance: Math.hypot(x - r.x - task(s, id).from.x, y - r.y - task(s, id).from.y) }));
    // At the fixed camera, motorcycle hitboxes can overlap; prefer the bike under the intended grip.
    const actual = candidates.filter(c => c.hit).sort((a, b) => a.distance - b.distance)[0];
    // Keep a 96 px grab area around the door handle, even at the phone's town scale.
    const grabRadius = s.phase === 'door' ? 48 : 30;
    return actual?.id ?? candidates.sort((a, b) => a.distance - b.distance).find(c => c.distance < grabRadius)?.id;
  }
  function target(s: PoliceState, vehicle: Vehicle, point: Screen, startValue = 0) {
    const r = canvas.getBoundingClientRect(), finger = { x: point.x - r.x, y: point.y - r.y }, info = task(s, vehicle);
    if (info.key === 'door') {
      const [a, b] = info.points, dx = b.x - a.x, dy = b.y - a.y;
      const length = Math.hypot(dx, dy), distance = Math.max(72, length);
      // Retain a broad gesture at the fixed town scale, starting at the real handle.
      const value = startValue + ((finger.x - a.x - dx * startValue) * dx + (finger.y - a.y - dy * startValue) * dy) / (length * distance);
      return value >= 0.98 ? 1 : Math.max(0, value);
    }
    if (Math.hypot(finger.x - info.to.x, finger.y - info.to.y) < 24) return 1;
    const path = workPath(s, vehicle), length = pathLength(path); let traversed = 0, nearest = Infinity, value = s.work[info.key];
    for (let i = 1; i < path.length; i++) {
      const a = info.points[i - 1], b = info.points[i], dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((finger.x - a.x) * dx + (finger.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const distance = Math.hypot(finger.x - a.x - t * dx, finger.y - a.y - t * dy), segment = Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
      if (distance < nearest) { nearest = distance; value = (traversed + segment * t) / length; } traversed += segment;
    }
    return value;
  }
  return { canvas, screen, hit, task, target,
    choiceMarker(s: PoliceState, bike: 'bike0' | 'bike1') {
      const r = canvas.getBoundingClientRect();
      return { ...policeChoiceMarker(camera, r.width, r.height, pose(s, bike), direction(s.round)), id: bike };
    },
    hint(s: PoliceState, preferred?: Vehicle): DragHint | undefined {
      if (s.action !== 'ready') return;
      const eligible = available(s), v = preferred && eligible.includes(preferred) ? preferred : eligible[0]; if (!v) return;
      const { from, to, key, value, points } = task(s, v);
      let via: Screen[] | undefined;
      if (key !== 'door') {
        const path = workPath(s, v), length = pathLength(path); let distance = 0;
        via = points.filter((_, i) => { if (i) distance += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z); return i > 0 && i < path.length - 1 && distance > value * length + 0.05; });
      }
      return { from, to, via, direction: to.x < from.x ? 'left' : 'right', label: s.phase === 'door' ? '沿箭頭拉開側滑門' : s.phase === 'guard' && !s.selected ? '兩台重機任選一台，按住車子拖到出口警戒位' : '按住車子，沿亮起的路線拖曳' };
    },
    render(s: PoliceState, time: number, preferred?: Vehicle, showRoute = true) {
      const i = at(s.phase), d = direction(s.round), w = s.work, complete = s.phase === 'complete', t = s.elapsed;
      const exit = exitDistance();
      sign.position.set(d * 3.6, 0, -5.5); crossing.position.x = -d * 0.4; inspectionBay.position.x = d * CHECKPOINT.x;
      barrier.position.x = d * 3.7;
      checkpoint.visible = !complete && !(s.phase === 'depart' && t >= 7.2);
      const clear = s.phase === 'depart' ? smooth((t - 6.2) / 1) : 0;
      cones.forEach(c => { c.position.y = 0.07 - clear; });
      barrier.position.z = -6.5 - clear * 2; sign.position.y = -clear * 3;
      Object.entries(vehicles).forEach(([id, vehicle]) => {
        const v = id as Vehicle, p = pose(s, v);
        vehicle.root.position.set(p.x, 0.07, p.z); vehicle.root.rotation.y = p.yaw;
        vehicle.root.visible = !complete && (v === 'police' ? true : v === 'van' ? i >= at('van-arrival') : v === 'tow' ? i >= at('tow-arrival') : i >= at('bikes-arrival'));
      });
      police.pose('#eee8d5', pose(s, 'police').distance, time, false, false);
      bikes.forEach((b, n) => b.pose(pose(s, n ? 'bike1' : 'bike0').distance, time, s.active === `bike${n}` || s.phase === 'bikes-arrival' || s.phase === 'lead' || s.phase === 'depart', i >= at('inspect') && i < at('lead')));
      van.pose(pose(s, 'van').distance, time, true);
      const opening = s.phase === 'door' ? w.door : s.phase === 'boarding' ? 1 - smooth((t - 2.15) / 0.65) : 0;
      van.open(opening, vanDoorSide(s.round));
      const inspected = inspectedPose(s, exit), kind = inspectionKind(s), recovering = i >= at('tow-load'), recovery = recoveryPose(s, exit);
      for (const [car, id] of [[taxi, 'taxi'], [freight, 'freight']] as const) {
        car.root.visible = s.phase === 'inspect' && kind === id;
        car.root.position.set(inspected.x, 0.07, inspected.z); car.root.rotation.y = inspected.yaw + (id === 'freight' ? Math.PI : 0);
      }
      taxi.pose(inspected.distance, time, 0); freight.roll(-inspected.distance);
      suspectCar.root.visible = i >= at('inspect') && s.checked === 2 && !complete;
      const car = recovering ? recovery.car : { ...inspected, y: 0.07, pitch: 0 };
      suspectCar.root.position.set(car.x, car.y, car.z); suspectCar.root.rotation.set(0, car.yaw, 0); suspectCar.root.rotateZ(car.pitch);
      suspectCar.pose(PALETTE[s.round.color], recovering ? recovery.amount * 5.05 : inspected.distance, time, false, false);
      const exitDoor = s.phase === 'inspect' && s.checked === 2 ? smooth((t - 3.5) / 0.3) * (1 - smooth((t - 4.3) / 0.3)) : 0;
      suspectCar.openDoors(exitDoor, d);
      tow.pose(recovery.lowered, recovery.secured); tow.beacon(time, true);
      tow.roll(pose(s, 'tow').distance * (s.phase === 'depart' ? 1 : -1));
      hook.visible = cable.visible = s.phase === 'tow-load' && t >= 0.9 && t < 5.5;
      if (hook.visible) {
        const start = new THREE.Vector3(recovery.rig.x + d * 0.5, 1.27, CHECKPOINT.z);
        const end = new THREE.Vector3(car.x + d * 1.6, car.y + 0.5, car.z);
        hook.position.copy(start).lerp(end, smooth((t - 0.9) / 0.5)); link(cable, start, hook.position);
      }
      let person = boardingRoute(s.round)[0];
      const companion = officerPose(s);
      suspect.root.visible = s.phase === 'inspect' && s.checked === 2 && t >= 3.8 || ['van-arrival', 'van', 'door', 'boarding'].includes(s.phase);
      officer.root.visible = i >= at('guard') && i <= at('boarding');
      if (s.phase === 'inspect' && s.checked === 2) {
        person = pathPose(inspectionWalk(s.round), smooth((t - 3.8) / 3.4));
      }
      if (s.phase === 'boarding') {
        const path = boardingRoute(s.round);
        person = pathPose(path, smooth(t / 1.8));
        suspect.root.visible = t < 1.8; officer.root.visible = t < 2.15;
      }
      const step = s.phase === 'boarding' ? smooth((t - 1.2) / 0.6) * 0.65 : 0;
      suspect.root.position.set(person.x, step, person.z); officer.root.position.set(companion.x, companion.y, companion.z);
      suspect.root.rotation.y = s.phase === 'boarding' ? Math.PI : 0; officer.root.rotation.y = suspect.root.rotation.y;
      officer.arm.rotation.z = companion.arm;
      // The second officer returns to the patrol car before the recovery truck enters.
      driver.root.visible = i >= at('guard') && i <= at('tow-arrival') && !(s.phase === 'tow-arrival' && t >= 1.6);
      const returning = s.phase === 'tow-arrival' ? smooth(t / 1.6) : 0;
      driver.root.position.set(d * (-1.3 + returning * 0.9), 0, -3.9 - returning * 0.65);
      const pass = pathPose(route(s.round, [[-exit, CHECKPOINT.z], [exit, CHECKPOINT.z]]), smooth((t - 7.2) / 2.3));
      passing.root.visible = s.phase === 'depart' && t >= 7.2;
      passing.root.position.set(pass.x, 0.07, pass.z); passing.root.rotation.y = pass.yaw; passing.pose('#91b69a', pass.distance, time, false, false);
      confetti.forEach((p, n) => { p.visible = complete; const u = (time * 0.25 + n / 30) % 1; p.position.set(Math.sin(n * 5) * 7, 7 - u * 6, Math.cos(n * 7) * 3); p.rotation.set(time, n, time + n); p.scale.setScalar(Math.sin(u * Math.PI)); });
      const eligible = available(s), selected = s.active ?? (preferred && eligible.includes(preferred) ? preferred : eligible[0]);
      const key = selected ? job(s, selected) : undefined, path = key && key !== 'door' ? workPath(s, selected!) : undefined;
      const length = path ? pathLength(path) : 0;
      routeMarkers.forEach((marker, n) => {
        marker.visible = showRoute && !!path && n * 0.55 <= length;
        if (path && marker.visible) { const p = pathPose(path, n * 0.55 / length); marker.position.set(p.x, 0.085, p.z); }
      });
      renderer.render(scene, camera);
    },
  };
});

export type PoliceScene = Effect.Success<ReturnType<typeof createPoliceScene>>;
