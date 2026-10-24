import { Effect } from 'effect';
import * as THREE from 'three';
import { acquireRenderer, acquireScene } from '../../runtime/scene-lifecycle.ts';
import { createShapes } from '../../runtime/geometry.ts';
import { createTownHouse, createTownTree, createTownBench } from '../../runtime/town-scenery.ts';
import { createPerson } from '../../runtime/emergency-models.ts';
import { createResident } from '../../runtime/resident.ts';
import { createSweeper } from '../../runtime/sweeper.ts';
import type { DragHint } from '../../runtime/drag-hint.ts';
import { createGarbageTruck, createRecyclingTruck, createFoodTruck, createBin, createCollectible } from './vehicles.ts';
import { createSanitationCamera, resizeSanitationCamera } from './view.ts';
import { available, currentVehicle, driving, lifting, index, phaseDuration, items } from './domain/sanitation.ts';
import type { SanitationState, Item } from './domain/sanitation.ts';
import { APPROACH, EXIT, ROAD_Z, parked, shift, home, destination, vehiclePoint, binPose, cargoLocal, mix, smooth, clamp } from './domain/site.ts';
import type { Point } from './domain/site.ts';
interface Screen { x: number; y: number }
export const createSanitationScene = (host: HTMLElement, makeRenderer = () => new THREE.WebGLRenderer({ antialias: true })) => Effect.gen(function* () {
  const renderer = yield* acquireRenderer(makeRenderer); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#d9e9e2');
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement; canvas.setAttribute('aria-label', '垃圾車清潔隊：收垃圾、升桶倒垃圾、搬回收物、收廚餘和清掃街道'); host.append(canvas);
  const scene = yield* acquireScene(), site = new THREE.Group(); scene.add(site);
  const camera = createSanitationCamera();
  scene.add(new THREE.HemisphereLight('#fff9e8', '#94aa91', 2.4));
  const sun = new THREE.DirectionalLight('#fff1da', 2.7); sun.position.set(-8, 18, 10); sun.castShadow = true;
  yield* Effect.addFinalizer(() => Effect.sync(() => sun.shadow.dispose()));
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = 0.035;
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 22, bottom: -22, far: 70 }); scene.add(sun);
  const shapes = createShapes(); yield* Effect.addFinalizer(() => Effect.sync(shapes.disposeMaterials));
  const { box, material } = shapes;
  box(site, [150, 0.4, 150], [0, -0.32, 0], '#bed0ac');
  box(site, [120, 0.12, 8.5], [0, -0.07, 0], '#9da99f');
  box(site, [120, 0.18, 2.4], [0, 0, 5.55], '#e2d7b9');
  box(site, [120, 0.18, 1.5], [0, 0, -5.05], '#e2d7b9');
  for (const z of [-4.2, 4.35]) box(site, [120, 0.18, 0.16], [0, 0.05, z], '#f4ead0');
  for (let x = -24; x < 26; x += 3) box(site, [1.3, 0.02, 0.08], [x, 0.015, -2.65], '#f5edcf');
  // The bay moves as one complete configuration. All vehicles retain the visible working side.
  const bay = new THREE.Group(); site.add(bay);
  for (let x = -5; x <= 5; x += 0.8) box(bay, [0.42, 0.025, 0.06], [x, 0.02, 0.6], '#ecd7a1');
  const houses = [-8.5, -1.8, 5.6].map((x, i) => { const h = createTownHouse(shapes, ['#e2c6a2', '#c7d2b5', '#e2c9ad'][i]); h.scale.set(0.85, 0.58, 0.7); h.position.set(x, 0.1, -7.1); site.add(h); return h; });
  for (const x of [-11, 10.5]) { const tree = createTownTree(shapes); tree.scale.setScalar(0.8); tree.position.set(x, 0, -5.9); site.add(tree); }
  const bench = createTownBench(shapes); bench.scale.setScalar(0.55); bench.position.set(-5, 0.1, 5.7); site.add(bench);
  const garbage = createGarbageTruck(shapes), recycle = createRecyclingTruck(shapes, 0), food = createFoodTruck(shapes), sweeper = createSweeper(shapes);
  const trucks = { garbage, recycle, food, sweeper }; Object.values(trucks).forEach(v => site.add(v.root));
  const bins = { bin: createBin(shapes), food: createBin(shapes, true) }; Object.values(bins).forEach(v => site.add(v.root));
  const objects = Object.fromEntries(items.map(id => [id, id === 'bin' || id === 'food' ? bins[id].root : createCollectible(shapes, id)])) as Record<Item, THREE.Group>;
  for (const id of items) if (id !== 'bin' && id !== 'food') site.add(objects[id]);
  const workers = [createPerson(shapes, true), createPerson(shapes, true)]; workers.forEach((p, i) => { p.root.position.set(3.3 + i * 0.95, 0.1, 6.3); site.add(p.root); });
  const residents = [createResident(shapes), createResident(shapes, 1)]; residents.forEach((p, i) => { p.root.position.set(-2 + i * 0.85, 0.1, 6.3); site.add(p.root); });
  const scraps = Array.from({ length: 28 }, (_, i) => {
    const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.13 + i % 3 * 0.04, 5), material(['#c4af7c', '#e2c99e', '#9bb58a'][i % 3]));
    leaf.rotation.x = -Math.PI / 2; leaf.rotation.z = i * 1.9; leaf.scale.y = 0.6; leaf.position.set(-5.5 + i % 14 * 0.86, 0.025, 1.2 + Math.floor(i / 14) * 1.4); site.add(leaf); return leaf;
  });
  const stream = Array.from({ length: 14 }, (_, i) => { const bit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), material(i % 2 ? '#afba99' : '#dfbb85')); site.add(bit); return bit; });
  const confetti = Array.from({ length: 32 }, (_, i) => box(site, [0.14, 0.12, 0.04], [0, 0, 0], ['#e9b965', '#93b5a0', '#dc9d80'][i % 3]));
  const resize = yield* Effect.acquireRelease(Effect.sync(() => new ResizeObserver(() => {
    const r = host.getBoundingClientRect(); if (!r.width || !r.height) return;
    resizeSanitationCamera(camera, r.width / r.height); renderer.setSize(r.width, r.height);
  })), value => Effect.sync(() => value.disconnect())); resize.observe(host);
  function screen(p: Point): Screen {
    camera.updateMatrixWorld(true); const r = canvas.getBoundingClientRect(), v = new THREE.Vector3(p.x, p.y, p.z).project(camera);
    return { x: (v.x + 1) * r.width / 2, y: (1 - v.y) * r.height / 2 };
  }
  const exit = () => Math.max(35, camera.right * 1.6 + 15);
  function truckPoint(s: SanitationState) {
    if (s.phase === 'intro' || s.phase.endsWith('-entrance')) return { x: mix(-exit(), APPROACH, smooth(s.elapsed / phaseDuration(s.phase))), y: 0, z: s.phase === 'sweeper-entrance' ? 2 : ROAD_Z };
    if (s.phase.endsWith('-departure')) return { x: mix(EXIT, exit(), smooth(s.elapsed / phaseDuration(s.phase))), y: 0, z: s.phase === 'sweeper-departure' ? 2 : ROAD_Z };
    return vehiclePoint(s.round, s.phase, s.travel);
  }
  function itemPoint(s: SanitationState, id: Item): Point {
    if (lifting(s) && id === (s.phase === 'bin-lift' ? 'bin' : 'food')) return binPose(s, id === 'food');
    return s.positions[id];
  }
  function task(s: SanitationState, requested?: Item) {
    const id = requested ?? s.held ?? available(s)[0];
    if (driving(s)) {
      const start = vehiclePoint(s.round, s.phase, 0), end = vehiclePoint(s.round, s.phase, 1), current = vehiclePoint(s.round, s.phase, s.travel);
      return { from: screen({ ...current, y: 1.3 }), to: screen({ ...end, y: 1.3 }), start: screen({ ...start, y: 1.3 }), value: s.travel, kind: 'drive' as const, item: undefined };
    }
    if (lifting(s)) {
      const from = screen(binPose(s, s.phase === 'food-lift')), length = Math.max(85, Math.min(130, canvas.clientHeight * 0.16));
      return { from, to: { x: from.x, y: from.y - length * (1 - s.travel) }, start: from, value: s.travel, kind: 'lift' as const, item: id };
    }
    const from = screen(itemPoint(s, id ?? 'bag-0')), to = screen(destination(s.round, id ?? 'bag-0'));
    return { from, to, start: from, value: 0, kind: 'item' as const, item: id };
  }
  const ray = new THREE.Raycaster();
  function setRay(point: Screen) {
    const r = canvas.getBoundingClientRect(); scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    ray.setFromCamera(new THREE.Vector2((point.x - r.x) / r.width * 2 - 1, 1 - (point.y - r.y) / r.height * 2), camera);
  }
  function world(point: Screen, y: number): Point {
    setRay(point); const target = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), target); return { x: target.x, y, z: target.z };
  }
  function hit(point: Screen, s: SanitationState): Item | 'vehicle' | undefined {
    if (s.action !== 'ready' || s.phase === 'complete') return;
    const r = canvas.getBoundingClientRect(); setRay(point);
    if (driving(s)) {
      const from = task(s).from;
      return ray.intersectObject(trucks[currentVehicle(s)].hit, true).length || Math.hypot(point.x - r.x - from.x, point.y - r.y - from.y) <= 48 ? 'vehicle' : undefined;
    }
    const candidates = available(s).map(id => { const p = task(s, id).from; return { id, distance: Math.hypot(point.x - r.x - p.x, point.y - r.y - p.y), intersects: ray.intersectObject(objects[id], true).length > 0 }; }).sort((a, b) => a.distance - b.distance);
    return candidates.find(c => c.intersects || c.distance <= 48)?.id;
  }
  function target(s: SanitationState, point: Screen) {
    const r = canvas.getBoundingClientRect(), t = task(s), vx = t.to.x - t.start.x, vy = t.to.y - t.start.y;
    return clamp(((point.x - r.x - t.start.x) * vx + (point.y - r.y - t.start.y) * vy) / (vx * vx + vy * vy));
  }
  function near(s: SanitationState, point: Screen, position: Point) {
    if (!s.held) return false;
    const r = canvas.getBoundingClientRect(), goal = screen(destination(s.round, s.held)), object = screen(position);
    return Math.hypot(point.x - r.x - goal.x, point.y - r.y - goal.y) <= 32 || Math.hypot(object.x - goal.x, object.y - goal.y) <= 28;
  }
  function hint(s: SanitationState): DragHint | undefined {
    if (s.action !== 'ready' || s.phase === 'complete') return;
    const t = task(s); return { from: t.from, to: t.to, direction: t.kind === 'lift' ? 'up' : t.to.x < t.from.x ? 'left' : 'right', label: t.kind === 'lift' ? '向上拖桶，升高後自動翻桶倒入' : t.kind === 'drive' ? '沿箭頭拖車，放手就暫停' : Math.hypot(t.to.x - t.from.x, t.to.y - t.from.y) <= 28 ? '按住物品停一下，接著放好' : '拖物品到真正的收集位置' };
  }
  let previousPalette = -1, previousCast = -1;
  function render(s: SanitationState, time: number) {
    bay.position.x = shift(s.round); const phase = index(s.phase), p = truckPoint(s), active = currentVehicle(s);
    for (const [id, v] of Object.entries(trucks)) { v.root.visible = id === active && phase < index('celebrate'); if (v.root.visible) { v.root.position.set(p.x, p.y, p.z); v.roll(p.x); v.beacon(time, s.action !== 'ready'); } }
    if (previousPalette !== s.round.palette) {
      const colors = ['#719d8c', '#789faa', '#83a790', '#8d9f79'];
      recycle.root.traverse(o => { if (o instanceof THREE.Mesh && o.material === material(colors[Math.max(0, previousPalette)])) o.material = material(colors[s.round.palette]); }); previousPalette = s.round.palette;
    }
    if (previousCast !== s.round.cast) {
      const shirts = [['#dcaa7b', '#93b2a3'], ['#b2a0c2', '#e9c26e'], ['#93b2a3', '#b2a0c2']];
      residents.forEach((r, i) => {
        r.root.scale.setScalar(i === 1 && s.round.cast === 1 ? 0.75 : 1);
        const before = material(shirts[Math.max(0, previousCast)][i]), after = material(shirts[s.round.cast][i]);
        r.root.traverse(o => { if (o instanceof THREE.Mesh && o.material === before) o.material = after; });
      }); previousCast = s.round.cast;
    }
    const binStage = s.phase === 'bin-lift' || s.phase === 'bin-tip', foodStage = s.phase === 'food-lift' || s.phase === 'food-tip';
    const trashPose = binPose(s, false), foodPose = binPose(s, true);
    const raise = binStage ? clamp((trashPose.y - 0.65) / 2.3) : 0, foodRaise = foodStage ? clamp((foodPose.y - 0.65) / 2.65) : 0;
    garbage.pose(raise, s.phase === 'compact' ? s.elapsed / phaseDuration('compact') : 0);
    recycle.pose(phase >= index('recycling') && phase < index('recycle-stow') ? 1 : s.phase === 'recycle-stow' ? 1 - smooth(s.elapsed / 0.9) : 0);
    food.pose(foodRaise, phase >= index('food-lock') && phase <= index('food-tip') ? s.phase === 'food-tip' ? 1 - smooth((s.elapsed - 2.7) / 0.6) : 1 : 0);
    sweeper.brush(time, s.phase === 'sweep' && s.action === 'dragging');
    for (const id of items) {
      const object = objects[id]; object.rotation.set(0, 0, 0); object.scale.setScalar(1);
      object.visible = id.startsWith('bag') ? !s.bags.includes(id as 'bag-0' | 'bag-1') : id === 'cardboard' || id === 'bottles' ? !s.recycled.includes(id) || recycle.root.visible : true;
      let pos = s.positions[id];
      if (id === 'bin' && binStage || id === 'food' && foodStage) {
        const pose = id === 'bin' ? trashPose : foodPose; pos = pose; if (id === 'bin') object.rotation.z = pose.tilt; else object.rotation.x = pose.tilt;
      }
      if ((s.phase === 'bin-lock' && id === 'bin') || (s.phase === 'food-lock' && id === 'food')) {
        const dest = destination(s.round, id), t = smooth(s.elapsed / 0.65); pos = { x: mix(pos.x, dest.x, t), y: mix(pos.y, dest.y, t), z: mix(pos.z, dest.z, t) };
      }
      if (id === s.held && (s.phase === 'bag-loading' || s.phase === 'recycle-loading')) {
        const t = smooth(s.elapsed / 0.9), dest = s.phase === 'recycle-loading' ? { x: parked(s.round).x + cargoLocal(id as 'cardboard' | 'bottles').x, y: 1.7, z: ROAD_Z } : destination(s.round, id);
        pos = { x: mix(pos.x, dest.x, t), y: mix(pos.y, dest.y, t) + Math.sin(t * Math.PI) * 0.6, z: mix(pos.z, dest.z, t) };
        if (s.phase === 'bag-loading') object.scale.setScalar(1 - clamp((t - 0.65) / 0.35) * 0.6);
      }
      if ((id === 'cardboard' || id === 'bottles') && s.recycled.includes(id)) { const local = cargoLocal(id); pos = { x: recycle.root.position.x + local.x, y: local.y, z: ROAD_Z }; }
      object.position.set(pos.x, pos.y, pos.z);
    }
    bins.bin.pose(s.phase === 'bin-tip' ? trashPose.lid : s.phase === 'bin-lift' ? 0.15 : 0, s.binEmpty || s.phase === 'bin-tip' && s.elapsed > 1.2);
    bins.food.pose(s.phase === 'food-tip' ? foodPose.lid : 0, s.foodEmpty || s.phase === 'food-tip' && s.elapsed > 1.2);
    stream.forEach((bit, i) => {
      bit.visible = (s.phase === 'bin-tip' || s.phase === 'food-tip') && s.elapsed > 0.55 && s.elapsed < 1.4;
      const t = ((s.elapsed * 2 + i / stream.length) % 1), point = s.phase === 'food-tip' ? { x: parked(s.round).x - 0.7, y: 2.8, z: ROAD_Z + 0.65 } : { x: parked(s.round).x - 3.2, y: 2.5, z: ROAD_Z };
      bit.position.set(point.x + Math.sin(i * 3) * 0.2 + (s.phase === 'bin-tip' ? t * 0.5 : 0), point.y - t * 1.15, point.z + Math.cos(i * 2) * 0.18); bit.rotation.set(time + i, time, i);
    });
    scraps.forEach(leaf => { const work = (leaf.position.x - 0.9 - APPROACH) / (EXIT - APPROACH); leaf.visible = s.swept === 0 || s.swept < work; });
    const celebrating = phase >= index('celebrate');
    workers.forEach((w, i) => { w.arm.rotation.z = celebrating ? -0.7 + Math.sin(time * 5 + i) * 0.4 : -0.1; });
    residents.forEach((r, i) => { r.arm.rotation.z = celebrating ? -0.8 + Math.sin(time * 4 + i) * 0.4 : -0.1; });
    confetti.forEach((bit, i) => { bit.visible = s.phase === 'celebrate'; const t = (s.elapsed * 0.45 + i / confetti.length) % 1; bit.position.set(Math.sin(i * 8) * 8, 6 * (1 - t), Math.cos(i * 5) * 3 + 1); bit.rotation.set(time + i, time * 2, i); });
    renderer.render(scene, camera);
  }
  return { canvas, screen, world, task, target, hit, near, hint, render, available, camera, truckPoint, objects, trucks, houses };
});
export type SanitationScene = Effect.Success<ReturnType<typeof createSanitationScene>>;
