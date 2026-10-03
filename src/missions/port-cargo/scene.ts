import * as THREE from 'three';
import { createShapes } from '../../runtime/geometry.ts';
import { createCrane, createFlatbed, link } from '../../runtime/construction-models.ts';
import { createPerson } from '../../runtime/emergency-models.ts';
import { createTownHouse, createTownTree } from '../../runtime/town-scenery.ts';
import type { DragHint } from '../../runtime/drag-hint.ts';
import { cargoBoatOutline, createCargoBoat, createForklift, createPalletCargo } from './vehicles.ts';
import { DECK, QUAY, ROAD_Z, SHIP_Z, LOAD_HEIGHT, EMPTY_HOOK_HEIGHT, FORK_OFFSET, LOADING_APPROACH, HAUL_END, SHIP_HAUL_END, TRUCK_SLOTS, missionStages, stageIndex, isCraneStage, craneSource, craneTarget, craneLandingHeight, forkSource, forkDestination, forkHeight, forkLoadingDuration, available, forkPose, forkRoute, pickupYaw, quayYaw, mirror, mix, smooth, clamp, distance, pathLength, loweringDuration, exitDistance } from './domain/port.ts';
import { nearCraneHook, CRANE_PICKUP_SCREEN_RADIUS, CRANE_ATTACH_SECONDS, CRANE_RELEASE_SECONDS } from '../../runtime/crane-control.ts';
import type { PortState, Cargo, Point } from './domain/port.ts';
type Screen = { x: number; y: number };
export type Task = { from: Screen; to: Screen; via: Screen[]; points: Screen[]; route: Point[]; value: number; id?: Cargo; label: string };

export function createPortScene(host: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#c9e2dd');
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement; canvas.setAttribute('aria-label', '碼頭搬貨：貨船、吊車、堆高機、平板車合作搬貨'); host.append(canvas);
  const scene = new THREE.Scene(), site = new THREE.Group(); scene.add(site);
  const camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 100); camera.position.set(7, 13, 20); camera.lookAt(0, 0.5, -1);
  scene.add(new THREE.HemisphereLight('#fff8e6', '#97af9b', 2.5));
  const sun = new THREE.DirectionalLight('#fff1d3', 2.7); sun.position.set(-7, 16, 9); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = 0.04;
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 16, bottom: -16, far: 50 }); scene.add(sun);
  const shapes = createShapes(), { box, cylinder, material } = shapes;
  box(site, [70, 0.4, 28], [0, -0.25, 10.4], '#d9d0b3');
  box(site, [70, 0.16, 50], [0, -0.55, -28.6], '#9dc8c6');
  box(site, [70, 0.72, 0.38], [0, -0.26, -3.55], '#c3b89b');
  box(site, [70, 0.09, 3.6], [0, 0, ROAD_Z], '#a8ab99');
  for (let x = -24; x <= 24; x += 2.5) box(site, [1.1, 0.02, 0.075], [x, 0.058, ROAD_Z], '#f5e9ca');
  for (const x of [-8, -5, -2, 1, 4, 7]) {
    box(site, [0.35, 0.3, 0.4], [x, 0.18, -3.32], '#7e8a7b'); cylinder(site, 0.12, 0.32, [x, 0.47, -3.32], '#78897e', 8);
    box(site, [0.8, 0.22, 0.16], [x, 0.48, -3.32], '#8a9888');
    box(site, [0.85, 0.38, 0.18], [x, -0.22, -3.83], '#768d86');
  }
  // Shore-side scenery clears the foreground road and the crane's exit lane.
  for (const side of [-1, 1]) {
    const house = createTownHouse(shapes); house.position.set(side * 10.5, 0.03, 1.6); house.scale.set(0.65, 0.52, 0.45); site.add(house);
    const tree = createTownTree(shapes); tree.position.set(side * 13, 0, 0.8); tree.scale.setScalar(0.65); site.add(tree);
  }
  const berthMaterial = new THREE.MeshBasicMaterial({ color: '#fff0c7', transparent: true, opacity: 0.9, depthWrite: false });
  const berth = new THREE.Group(); site.add(berth);
  const berthPoints = cargoBoatOutline().getPoints().map(p => ({ x: p.x * 1.1, z: SHIP_Z - p.y * 1.12 }));
  for (let i = 1; i < berthPoints.length; i++) {
    const a = berthPoints[i - 1], b = berthPoints[i], length = distance(a, b);
    for (let along = 0; along < length; along += 0.5) {
      const dash = Math.min(0.32, length - along), p = mix(a, b, (along + dash / 2) / length);
      const stroke = new THREE.Mesh(new THREE.BoxGeometry(dash, 0.01, 0.07), berthMaterial);
      stroke.position.set(p.x, -0.435, p.z); stroke.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x); berth.add(stroke);
    }
  }
  // The neutral preview shares the real pallet and box geometry, without supply symbols.
  const preview = createPalletCargo(shapes);
  const previewMaterial = new THREE.MeshBasicMaterial({ color: '#a3c1ad', transparent: true, opacity: 0.16, depthWrite: false });
  preview.root.traverse(o => { if (o instanceof THREE.Mesh && o !== preview.hit) { o.material = previewMaterial; o.castShadow = o.receiveShadow = false; } });
  const previewEdgeMaterial = new THREE.LineBasicMaterial({ color: '#7f9f90', transparent: true, opacity: 0.75, depthWrite: false });
  const previewEdges = new THREE.LineSegments(new THREE.EdgesGeometry(preview.crate.geometry), previewEdgeMaterial);
  previewEdges.position.copy(preview.crate.position); preview.root.add(previewEdges); site.add(preview.root);
  const parking = new THREE.Group(); site.add(parking);
  for (const z of [ROAD_Z - 1.18, ROAD_Z + 1.18]) box(parking, [6.4, 0.02, 0.06], [-0.55, 0.058, z], '#fff0c7');
  for (const x of [-3.75, 2.65]) box(parking, [0.06, 0.02, 2.36], [x, 0.058, ROAD_Z], '#fff0c7');
  const boat = createCargoBoat(shapes), truck = createFlatbed(shapes, false), crane = createCrane(shapes), forklift = createForklift(shapes);
  crane.root.position.set(-4.6, 0, -1); site.add(boat.root, truck.root, crane.root, forklift.root);
  const cargo = [createPalletCargo(shapes, 0), createPalletCargo(shapes, 1)]; cargo.forEach(c => site.add(c.root));
  const sling = [0, 1].map(() => cylinder(site, 0.023, 1, [0, 0, 0], '#647c70', 8));
  const mooring = [0, 1].map(() => cylinder(site, 0.026, 1, [0, 0, 0], '#9c947b', 8));
  const workers = [createPerson(shapes, true), createPerson(shapes)];
  workers.forEach((p, i) => { p.root.position.set(7.4 + i * 0.85, 0, 5.5); site.add(p.root); });
  function waterStroke(length: number) {
    const stroke = new THREE.Mesh(new THREE.BoxGeometry(length, 0.008, 0.045), new THREE.MeshBasicMaterial({ color: '#e0eee2', transparent: true, opacity: 0, depthWrite: false }));
    site.add(stroke); return stroke;
  }
  const waves = Array.from({ length: 24 }, (_, i) => waterStroke(0.7 + i % 3 * 0.35));
  const wake = Array.from({ length: 12 }, () => waterStroke(0.65));
  let previousTime: number | undefined, previousBoatX: number | undefined, wakeStrength = 0;
  const confetti = Array.from({ length: 28 }, (_, i) => box(site, [0.13, 0.13, 0.05], [0, 0, 0], ['#e4bc6c', '#84b2a4', '#d5927a'][i % 3]));
  const routeDots = Array.from({ length: 45 }, () => { const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.09, 8), material('#f8edc9')); mesh.rotation.x = -Math.PI / 2; site.add(mesh); return mesh; });
  const resize = new ResizeObserver(() => {
    const r = host.getBoundingClientRect(); if (!r.width || !r.height) return;
    const aspect = r.width / r.height, height = Math.max(16, 25 / aspect);
    camera.left = -height * aspect / 2; camera.right = height * aspect / 2; camera.top = height / 2; camera.bottom = -height / 2;
    camera.updateProjectionMatrix(); renderer.setSize(r.width, r.height);
  }); resize.observe(host);
  function screen(s: PortState, p: Point, y = 1): Screen {
    const q = mirror(s.round, p), r = canvas.getBoundingClientRect(); camera.updateMatrixWorld(true);
    const v = new THREE.Vector3(q.x, y, q.z).project(camera); return { x: (v.x + 1) * r.width / 2, y: (1 - v.y) * r.height / 2 };
  }
  const boatX = (s: PortState) => s.phase === 'ship-transport' ? SHIP_HAUL_END * s.haul : s.phase === 'departure' ? (s.round.direction === 'load' ? SHIP_HAUL_END : 0) + (exitDistance(camera.right) - (s.round.direction === 'load' ? SHIP_HAUL_END : 0)) * smooth(s.elapsed / 3.6) : -8.5 * (1 - s.boat);
  const truckX = (s: PortState) => s.round.direction === 'load' ? s.phase === 'forklift-exit' ? -exitDistance(camera.right) * smooth(s.elapsed / 3.5) : stageIndex(s) > 3 ? -exitDistance(camera.right) : 11.7 * (1 - s.truck) : s.phase === 'transport' ? HAUL_END * s.haul : s.phase === 'departure' ? HAUL_END - (exitDistance(camera.right) + HAUL_END) * smooth(s.elapsed / 3.6) : stageIndex(s) > 7 ? -exitDistance(camera.right) : 11.7 * (1 - s.truck);
  function cargoPose(s: PortState, id: Cargo) {
    const index = s.loaded.indexOf(id), outgoing = s.round.direction === 'load';
    if (index >= 0) return outgoing ? { ...DECK[index], x: DECK[index].x + boatX(s), y: 0.62 } : { ...TRUCK_SLOTS[index], x: TRUCK_SLOTS[index].x + truckX(s), y: 1.24 };
    if (isCraneStage(s) && s.craneAttached && s.selected === id) {
      const target = craneTarget(s), landed = craneLandingHeight(s), sourceHeight = outgoing ? 0.04 : 0.62;
      if (s.action === 'lowering' && loweringDuration(s) === 2) {
        const raise = smooth(s.elapsed / 0.6), traverse = smooth((s.elapsed - 0.6) / 0.6), lower = smooth((s.elapsed - 1.2) / 0.8);
        return { ...mix(s.load, target, traverse), y: (sourceHeight + (LOAD_HEIGHT - sourceHeight) * smooth(s.lift)) * (1 - raise) + LOAD_HEIGHT * raise - (LOAD_HEIGHT - landed) * lower };
      }
      const t = s.action === 'lowering' ? smooth(s.elapsed / 0.8) : 0;
      return { ...mix(s.load, target, t), y: s.action === 'lowering' ? LOAD_HEIGHT * (1 - t) + landed * t : sourceHeight + (LOAD_HEIGHT - sourceHeight) * smooth(s.lift) };
    }
    if (s.phase === 'forklift' && s.selected === id && (s.carrying || s.action === 'picking') && (!outgoing || s.action !== 'picking' || s.elapsed >= 1.1)) {
      const p = forkPose(s); return { x: p.x - Math.sin(p.yaw) * FORK_OFFSET, z: p.z - Math.cos(p.yaw) * FORK_OFFSET, y: forkHeight(s) };
    }
    if (s.unloaded.includes(id)) return { ...QUAY[s.unloaded.indexOf(id)], y: 0.04 };
    return outgoing ? { ...TRUCK_SLOTS[id], x: TRUCK_SLOTS[id].x + truckX(s), y: 1.24 } : { ...DECK[id], x: DECK[id].x + boatX(s), y: 0.62 };
  }
  function cargoYaw(s: PortState, id: Cargo, forkYaw: number) {
    if (s.loaded.includes(id)) return 0;
    if (s.phase === 'forklift' && s.selected === id && (s.carrying || s.action === 'picking') && (s.round.direction !== 'load' || s.action !== 'picking' || s.elapsed >= 1.1)) return forkYaw;
    if (s.round.direction === 'load') return 0;
    if (s.unloaded.includes(id)) return pickupYaw(s, id);
    if (s.phase === 'unload' && s.selected === id && s.action === 'lowering') {
      const turning = loweringDuration(s) === 2 ? smooth((s.elapsed - 0.6) / 0.6) : smooth(s.elapsed / 0.8);
      return quayYaw(s.unloaded.length) * turning;
    }
    return 0;
  }
  function task(s: PortState, candidate?: Cargo): Task | undefined {
    if (!['ready', 'dragging'].includes(s.action)) return;
    const width = canvas.getBoundingClientRect().width;
    let route: Point[], value = 0, y = 1.25, id = candidate;
    let label = '', from: Screen, to: Screen;
    if (isCraneStage(s)) {
      id = s.selected ?? candidate ?? available(s)[0]; if (id === undefined) return;
      from = hookScreen();
      const p = cargoPose(s, id); to = s.craneAttached ? screen(s, craneTarget(s), craneLandingHeight(s) + 0.56) : screen(s, p, p.y + 0.7);
      return { id, from, to, route: [], points: [], via: [], value: s.elapsed / 0.4, label: s.craneAttached ? '拖吊鉤或貨箱到目的地光圈' : '拖吊鉤到任一貨箱，吊車幫你掛起來' };
    }
    if (s.phase === 'boat') { route = [{ x: -8.5, z: SHIP_Z }, { x: 0, z: SHIP_Z }]; value = s.boat; label = '拖貨船靠岸'; }
    else if (s.phase === 'truck') { route = [{ x: 9.6, z: ROAD_Z }, { x: -2.1, z: ROAD_Z }]; value = s.truck; label = '拖平板車停到碼頭'; }
    else if (s.phase === 'transport') { route = [{ x: -2.1, z: ROAD_Z }, { x: HAUL_END - 2.1, z: ROAD_Z }]; value = s.haul; label = '拖載好的平板車，送貨進城'; }
    else if (s.phase === 'ship-transport') { route = [{ x: 0, z: SHIP_Z }, { x: SHIP_HAUL_END, z: SHIP_Z }]; value = s.haul; label = '拖載好物資的貨船，送往對岸'; }
    else if (s.phase === 'forklift') {
      id = s.selected ?? candidate ?? available(s)[0]; if (id === undefined) return;
      route = forkRoute(s, id); value = s.forkTravel; y = 1;
      label = s.round.direction === 'load' ? s.carrying ? '拖堆高機，把貨箱放到碼頭' : '拖堆高機到車上任一貨箱前' : s.carrying ? '拖堆高機到平板車側邊的光圈' : '拖堆高機到任一棧板貨箱前';
    } else return;
    const points = route.map(p => screen(s, p, y));
    from = s.phase === 'forklift' ? screen(s, forkPose(s), 1) : { x: points[0].x + (points.at(-1)!.x - points[0].x) * value, y: points[0].y + (points.at(-1)!.y - points[0].y) * value };
    to = points.at(-1)!;
    if (s.phase === 'forklift') to = screen(s, s.carrying ? s.round.direction === 'load' ? forkDestination(s) : { ...forkDestination(s), z: ROAD_Z - LOADING_APPROACH } : forkSource(s, id!), s.round.direction === 'load' && !s.carrying ? 1.85 : 0.75);
    if (s.phase === 'transport' || s.phase === 'ship-transport') { from = { x: clamp(from.x, 72, width - 72), y: from.y }; to = { x: clamp(to.x, 32, width - 32), y: to.y }; }
    const length = pathLength(route); let traversed = 0;
    const via = points.slice(1, -1).filter((_, i) => { traversed += distance(route[i], route[i + 1]); return traversed / length > value + 0.015; });
    return { id, from, to, points, via: s.phase === 'forklift' && !s.carrying ? [] : via, value, label, route };
  }
  function hookScreen(): Screen {
    const p = crane.hook.getWorldPosition(new THREE.Vector3()).project(camera), r = canvas.getBoundingClientRect();
    return { x: (p.x + 1) * r.width / 2, y: (1 - p.y) * r.height / 2 };
  }
  function hit(x: number, y: number, s: PortState): Cargo | 'vehicle' | 'hook' | undefined {
    if (s.action !== 'ready') return;
    const r = canvas.getBoundingClientRect(), p = { x: x - r.x, y: y - r.y };
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    ray.setFromCamera(new THREE.Vector2(p.x / r.width * 2 - 1, 1 - p.y / r.height * 2), camera);
    if (isCraneStage(s)) {
      if (nearCraneHook(p, hookScreen())) return 'hook';
      if (!s.craneAttached) return;
      const candidates = available(s).map(id => { const box = cargoPose(s, id); return { id, p: screen(s, box, box.y + 0.7), actual: ray.intersectObject(cargo[id].hit)[0] }; });
      const nearest = candidates.sort((a, b) => Math.hypot(p.x - a.p.x, p.y - a.p.y) - Math.hypot(p.x - b.p.x, p.y - b.p.y))[0];
      if (nearest && (nearest.actual || Math.hypot(p.x - nearest.p.x, p.y - nearest.p.y) <= 34)) return nearest.id;
      return;
    }
    const info = task(s); if (!info) return;
    const model = s.phase === 'boat' || s.phase === 'ship-transport' ? boat : s.phase === 'forklift' ? forklift : truck;
    if (ray.intersectObject(model.hit)[0] || Math.hypot(p.x - info.from.x, p.y - info.from.y) <= 38) return 'vehicle';
  }
  const ray = new THREE.Raycaster();
  function relative(p: Screen) { const r = canvas.getBoundingClientRect(); return { x: p.x - r.x, y: p.y - r.y }; }
  function driveTarget(s: PortState, pointer: Screen, origin?: Screen) {
    const finger = relative(pointer);
    const id = s.selected ?? available(s).sort((a, b) => {
      const pa = task(s, a)!.to, pb = task(s, b)!.to;
      if (s.phase === 'forklift' && origin) {
        const start = relative(origin), dx = finger.x - start.x, dy = finger.y - start.y;
        const alignment = (p: Screen) => ((p.x - start.x) * dx + (p.y - start.y) * dy) / (Math.hypot(p.x - start.x, p.y - start.y) || 1);
        return alignment(pb) - alignment(pa);
      }
      return Math.hypot(finger.x - pa.x, finger.y - pa.y) - Math.hypot(finger.x - pb.x, finger.y - pb.y);
    })[0];
    const info = task(s, id)!;
    if (Math.hypot(finger.x - info.to.x, finger.y - info.to.y) < 32) return { value: 1, id };
    const length = pathLength(info.route); let traversed = 0, nearest = Infinity, value = info.value;
    for (let i = 1; i < info.points.length; i++) {
      const a = info.points[i - 1], b = info.points[i], dx = b.x - a.x, dy = b.y - a.y;
      const t = clamp(((finger.x - a.x) * dx + (finger.y - a.y) * dy) / (dx * dx + dy * dy || 1));
      const d = Math.hypot(finger.x - a.x - dx * t, finger.y - a.y - dy * t), segment = distance(info.route[i - 1], info.route[i]);
      if (d < nearest) { nearest = d; value = (traversed + segment * t) / length; } traversed += segment;
    }
    return { value: value > 0.985 ? 1 : value, id };
  }
  function loadTarget(s: PortState, pointer: Screen, adjusted: Screen): Point & { id?: Cargo } {
    const finger = relative(pointer), object = relative(adjusted);
    if (!s.craneAttached) {
      const id = available(s).sort((a, b) => {
        const pa = cargoPose(s, a), pb = cargoPose(s, b), sa = screen(s, pa, pa.y + 0.7), sb = screen(s, pb, pb.y + 0.7);
        return Math.hypot(finger.x - sa.x, finger.y - sa.y) - Math.hypot(finger.x - sb.x, finger.y - sb.y);
      })[0];
      const p = cargoPose(s, id), target = screen(s, p, p.y + 0.7);
      if (Math.hypot(finger.x - target.x, finger.y - target.y) <= CRANE_PICKUP_SCREEN_RADIUS) return { ...craneSource(s, id), id };
    }
    const goal = craneTarget(s), target = screen(s, goal, craneLandingHeight(s) + 0.56);
    if (s.craneAttached && [finger, object].some(p => Math.hypot(p.x - target.x, p.y - target.y) < 36)) return goal;
    const r = canvas.getBoundingClientRect(); camera.updateMatrixWorld(true);
    ray.setFromCamera(new THREE.Vector2(object.x / r.width * 2 - 1, 1 - object.y / r.height * 2), camera);
    const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(s.craneAttached ? LOAD_HEIGHT + 1.4 : EMPTY_HOOK_HEIGHT)), new THREE.Vector3());
    return p ? { x: s.round.layout ? -p.x : p.x, z: p.z } : s.load;
  }
  return {
    canvas, hit, task, driveTarget, loadTarget,
    sources(s: PortState) {
      if (s.action !== 'ready' && !(isCraneStage(s) && !s.craneAttached && s.action === 'dragging')) return [];
      if (isCraneStage(s)) return s.craneAttached ? [] : available(s).map(id => { const p = cargoPose(s, id); return { id, ...screen(s, p, p.y + 0.7) }; });
      if (s.phase === 'forklift' && !s.carrying) return available(s).map(id => ({ id, ...task(s, id)!.to }));
      return [];
    },
    hint(s: PortState): DragHint | undefined {
      if (s.action !== 'ready') return;
      const info = task(s); if (!info) return;
      return { from: info.from, to: info.to, via: info.via, direction: info.to.x < info.from.x ? 'left' : 'right', label: info.label };
    },
    render(s: PortState, time: number) {
      const i = stageIndex(s), sequence = missionStages(s.round.direction), outgoing = s.round.direction === 'load'; site.scale.x = s.round.layout ? -1 : 1;
      boat.root.visible = i < sequence.indexOf('arrival'); boat.root.position.set(boatX(s), 0, SHIP_Z); boat.color(s.round.palette);
      berth.visible = s.phase === 'boat'; berthMaterial.opacity = 0.9 * (1 - smooth(s.elapsed / 0.4));
      preview.root.visible = isCraneStage(s) && s.craneAttached || outgoing && s.phase === 'forklift' && s.carrying;
      if (preview.root.visible) {
        const cranePlacement = isCraneStage(s), p = cranePlacement ? craneTarget(s) : forkDestination(s);
        const duration = s.action === 'lowering' ? loweringDuration(s) : s.action === 'loading' ? forkLoadingDuration(s) : undefined;
        const fade = duration === undefined ? 1 : 1 - smooth((s.elapsed - duration + 0.3) / 0.3);
        preview.root.position.set(p.x, cranePlacement ? craneLandingHeight(s) : 0.04, p.z); preview.root.rotation.y = outgoing ? 0 : quayYaw(s.unloaded.length);
        previewMaterial.opacity = 0.16 * fade; previewEdgeMaterial.opacity = 0.75 * fade;
      }
      truck.root.visible = i <= sequence.indexOf(outgoing ? 'forklift-exit' : 'departure'); truck.root.position.set(truckX(s), 0.05, ROAD_Z); truck.roll(truckX(s)); parking.visible = s.phase === 'truck';
      const craneLeaving = s.phase === 'crane-exit', craneWaiting = outgoing && i < sequence.indexOf('crane-ready'); crane.root.visible = i <= sequence.indexOf('crane-exit');
      crane.root.position.x = craneLeaving ? -4.6 - smooth((s.elapsed - 1.2) / 2.8) * (exitDistance(camera.right) - 4.6) : -4.6;
      crane.retract(craneWaiting ? 1 : s.phase === 'crane-ready' ? 1 - smooth(s.elapsed / 1.2) : craneLeaving ? smooth(s.elapsed / 1.2) : 0); crane.roll(crane.root.position.x + 4.6);
      const stowed = { x: crane.root.position.x + 0.5, z: -1.15, y: 1.1 }, idle = { x: -1.3, z: -3.2, y: EMPTY_HOOK_HEIGHT - 1.4 };
      let raised = craneWaiting ? stowed : s.phase === 'crane-ready' ? { ...mix(stowed, idle, smooth(s.elapsed / 1.2)), y: 1.1 + smooth(s.elapsed / 1.2) * (EMPTY_HOOK_HEIGHT - 2.5) } : isCraneStage(s) ? s.craneAttached ? cargoPose(s, s.selected!) : { ...s.load, y: EMPTY_HOOK_HEIGHT - 1.4 } : idle;
      if (s.action === 'hoisting') raised.y += (EMPTY_HOOK_HEIGHT - (outgoing ? 0.04 : 0.62) - 1.4) * (1 - smooth(s.elapsed / CRANE_ATTACH_SECONDS));
      if (s.action === 'unhooking') raised.y = craneLandingHeight(s) + (EMPTY_HOOK_HEIGHT - 1.4 - craneLandingHeight(s)) * smooth(s.elapsed / CRANE_RELEASE_SECONDS);
      if (craneLeaving) {
        const t = smooth(s.elapsed / 1.2), landed = craneLandingHeight(s);
        raised = { ...mix(s.load, stowed, t), y: landed + (stowed.y - landed) * t };
      }
      crane.aim(new THREE.Vector3(raised.x, raised.y + 0.9, raised.z), 0.3);
      sling.forEach((m, n) => { m.visible = isCraneStage(s) && s.craneAttached && (s.action !== 'hoisting' || s.elapsed >= CRANE_ATTACH_SECONDS); link(m, new THREE.Vector3(raised.x, raised.y + 1.4, raised.z), new THREE.Vector3(raised.x + (n ? 0.45 : -0.45), raised.y + 1.15, raised.z)); });
      const f = forkPose(s, exitDistance(camera.right)); forklift.root.visible = i <= sequence.indexOf('forklift-exit'); forklift.root.position.set(f.x, 0.02, f.z); forklift.root.rotation.y = f.yaw;
      forklift.pose(forkHeight(s), s.forkTravel * (s.selected !== null && s.phase === 'forklift' && s.action !== 'returning' ? pathLength(forkRoute(s)) : 0));
      cargo.forEach((c, n) => {
        const p = cargoPose(s, n as Cargo); c.root.visible = !s.loaded.includes(n as Cargo) || (outgoing ? boat.root.visible : truck.root.visible);
        c.root.position.set(p.x, p.y, p.z);
        c.root.rotation.y = cargoYaw(s, n as Cargo, f.yaw);
      });
      mooring.forEach((m, n) => { m.visible = s.boat === 1 && i < sequence.indexOf('departure') && (s.phase !== 'ship-transport' || s.haul === 0); link(m, new THREE.Vector3(n ? 2.4 : -3.5, 0.7, -4.65), new THREE.Vector3(n ? 4 : -5, 0.5, -3.32)); });
      workers.forEach(p => { p.arm.rotation.z = s.phase === 'complete' || s.phase === 'arrival' ? -2 + Math.sin(time * 3) * 0.2 : -0.2; });
      waves.forEach((w, n) => {
        const t = (time / 12 + n * 0.137) % 1, fade = Math.sin(t * Math.PI);
        w.position.set(-13 + n % 8 * 3.7 + (t - 0.5) * 3.2, -0.455, -8.7 - Math.floor(n / 8) * 2.8);
        w.material.opacity = fade * 0.65; w.scale.x = 0.7 + fade * 0.5;
      });
      const dt = previousTime === undefined ? 0 : clamp(time - previousTime, 0, 0.1);
      const moving = previousBoatX !== undefined && dt > 0 && boat.root.visible && Math.abs(boat.root.position.x - previousBoatX) > 0.0001;
      wakeStrength += ((moving ? 1 : 0) - wakeStrength) * Math.min(1, dt * 3);
      previousTime = time; previousBoatX = boat.root.position.x;
      wake.forEach((w, n) => {
        const row = Math.floor(n / 2), side = n % 2 ? 1 : -1, ripple = (time * 0.35) % 0.55;
        w.visible = boat.root.visible && wakeStrength > 0.01;
        w.position.set(boat.root.position.x - 4.2 - row * 0.55 - ripple, -0.451, SHIP_Z + side * (1.15 + row * 0.16));
        w.rotation.y = side * 0.28; w.material.opacity = wakeStrength * (1 - row / 6) * 0.45;
      });
      confetti.forEach((p, n) => { p.visible = s.phase === 'complete'; const t = (time * 0.23 + n / 28) % 1; p.position.set(Math.sin(n * 5) * 8, 7 - t * 6, 1 + Math.cos(n * 7) * 3); p.rotation.set(time, n, time + n); p.scale.setScalar(Math.sin(t * Math.PI)); });
      const info = task(s), path = s.phase === 'forklift' ? info?.route : undefined;
      routeDots.forEach((m, n) => {
        m.visible = !!path && n * 0.35 < pathLength(path);
        if (path && m.visible) {
          let left = n * 0.35;
          for (let j = 1; j < path.length; j++) { const length = distance(path[j - 1], path[j]); if (left <= length) { const p = mix(path[j - 1], path[j], length ? left / length : 1); m.position.set(p.x, 0.035, p.z); break; } left -= length; }
        }
      });
      renderer.render(scene, camera);
    },
    dispose() {
      resize.disconnect(); const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Line) { geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); } });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); shapes.disposeMaterials(); sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
