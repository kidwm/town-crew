import { Effect } from 'effect';
import * as THREE from 'three';
import { acquireRenderer, acquireScene } from '../../runtime/scene-lifecycle.ts';
import { createShapes } from '../../runtime/geometry.ts';
import { createResident } from '../../runtime/resident.ts';
import { createPerson } from '../../runtime/emergency-models.ts';
import { createTownBench, createTownHouse, createTownTree } from '../../runtime/town-scenery.ts';
import { createTrain, palettes } from './vehicles.ts';
import { createRailCamera, resizeRailCamera } from './view.ts';
import { available, trains, type RailState, type Train } from './domain/rail.ts';
import { bay, boardingRoute, destinationTrain, doorPoint, seatPoint, sourceTrain, trainPose, transferRoute, waitingPoint, walkPose, WIDTH, type Point } from './domain/station.ts';
import { CAB_TIP, carSegments, profiles } from './domain/formation.ts';
interface Screen { x: number; y: number }
export const createRailScene = (host: HTMLElement, makeRenderer = () => new THREE.WebGLRenderer({ antialias: true })) => Effect.gen(function* () {
  const renderer = yield* acquireRenderer(makeRenderer); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#dfe8ce');
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement; canvas.setAttribute('aria-label', '列車轉乘：拖列車靠站、拉開車門，幫乘客轉乘出發'); host.append(canvas);
  const scene = yield* acquireScene(), camera = createRailCamera();
  scene.add(new THREE.HemisphereLight('#fff7df', '#a4b49d', 2.4));
  const sun = new THREE.DirectionalLight('#fff1d7', 2.6); sun.position.set(-14, 25, 16); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = 0.035; Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 18, bottom: -18, far: 90 });
  yield* Effect.addFinalizer(() => Effect.sync(() => sun.shadow.dispose())); scene.add(sun);
  const shapes = createShapes(); yield* Effect.addFinalizer(() => Effect.sync(() => shapes.disposeMaterials()));
  const { box, material, cylinder } = shapes;
  box(scene, [220, 0.3, 220], [0, -0.21, 0], '#c4d6ac');
  box(scene, [4.2, 0.25, 10.15], [0, 0.12, 1.82], '#e9ddbe');
  // Short dashed paths make the pedestrian concourse legible without covering the people.
  for (let z = -2.5; z < 6.5; z += 0.65) for (const x of [-0.6, 0.6]) box(scene, [0.12, 0.018, 0.25], [x, 0.26, z], '#c4bb98');
  const platforms = Object.fromEntries(trains.map(t => {
    const group = new THREE.Group(); group.name = `rail-platform-${t}`; scene.add(group);
    const floor = profiles[t].floor;
    box(group, [57, floor, 2.3], [31.5, floor / 2, 2.12], '#e4d8b9');
    box(group, [57, 0.028, 0.16], [31.5, floor + 0.014, 1.1], '#f8e3a0');
    for (let x = 3.1; x < 60; x += 0.48) box(group, [0.2, 0.025, 0.07], [x, floor + 0.02, 1.34], '#c7b68a');
    const shape = new THREE.Shape(); shape.moveTo(1.9, 0.02); shape.lineTo(3, 0.02); shape.lineTo(3, floor); shape.lineTo(1.9, 0.25); shape.closePath();
    const ramp = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 2.3, bevelEnabled: false }), material('#e4d8b9')); ramp.position.z = 0.97; ramp.receiveShadow = true; group.add(ramp);
    box(group, [75, 0.08, 2.05], [40.5, 0.015, 0], '#a4b1a3');
    for (const z of [-0.65, 0.65]) box(group, [75, 0.055, 0.07], [40.5, 0.09, z], '#7b8e8a');
    for (let x = 3; x < 78; x += 0.52) box(group, [0.14, 0.045, 1.6], [x, 0.05, 0], '#a08e70');
    // Physical buffer stop terminates each rail before the pedestrian concourse.
    for (const z of [-0.65, 0.65]) box(group, [0.14, 0.42, 0.13], [2.65, 0.3, z], '#8c9d8a');
    box(group, [0.22, 0.13, 1.55], [2.65, 0.54, 0], '#d2a47a');
    const bench = createTownBench(shapes); bench.scale.setScalar(0.34); bench.position.set(10.8, floor, 2.64); group.add(bench);
    cylinder(group, 0.045, 1.35, [9.8, floor + 0.7, 2.68], '#8fa495', 8);
    const sign = box(group, [0.7, 0.5, 0.08], [9.8, floor + 1.45, 2.68], palettes[0][t]);
    // A small train-shaped silhouette is physical station decoration, alongside the matching SVG label.
    box(group, [0.43, 0.19, 0.09], [9.8, floor + 1.43, 2.74], '#fff0cb');
    return [t, { group, sign }];
  })) as Record<Train, { group: THREE.Group; sign: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> }>;
  const station = createTownHouse(shapes, '#efdfbf', '#a1b5a3'); station.position.set(0, 0, -7.9); station.scale.set(0.56, 0.42, 0.5); scene.add(station);
  for (const [x, z] of [[-11.8, -7.4], [11.8, -7.4], [-12.8, 8.7], [12.8, 8.7]]) {
    const tree = createTownTree(shapes); tree.position.set(x, 0, z); tree.scale.setScalar(0.5); scene.add(tree);
  }
  const models = Object.fromEntries(trains.map(t => { const model = createTrain(shapes, t); scene.add(model.root); return [t, model]; })) as Record<Train, ReturnType<typeof createTrain>>;
  const passengers = Array.from({ length: 6 }, (_, id) => {
    const p = createResident(shapes, id); p.root.name = `rail-passenger-${id}`; p.root.scale.setScalar(id === 1 || id === 4 ? 0.62 : 0.74); scene.add(p.root);
    if (id === 1 || id === 4) box(p.root, [0.27, 0.3, 0.13], [0, 0.5, -0.2], '#b99674');
    return { ...p, shirt: p.root.children.find(object => object instanceof THREE.Mesh && object.geometry instanceof THREE.CylinderGeometry) as THREE.Mesh };
  });
  const steward = createPerson(shapes, true); steward.root.scale.setScalar(0.74); steward.root.position.set(0, 0.25, 1.4); scene.add(steward.root);
  const confetti = Array.from({ length: 40 }, (_, i) => box(scene, [0.11, 0.14, 0.04], [0, 0, 0], ['#d9b76a', '#a3bb9b', '#ce9c87', '#afa0c2'][i % 4]));
  const resize = yield* Effect.acquireRelease(Effect.sync(() => new ResizeObserver(() => {
    const r = host.getBoundingClientRect(); if (!r.width || !r.height) return;
    resizeRailCamera(camera, r.width / r.height); renderer.setSize(r.width, r.height);
  })), observer => Effect.sync(() => observer.disconnect())); resize.observe(host);
  const outside = () => Math.max(22, camera.right + CAB_TIP + 3);
  function screen(p: Point): Screen {
    camera.updateMatrixWorld(true); const r = canvas.getBoundingClientRect(), v = new THREE.Vector3(p.x, p.y, p.z).project(camera);
    return { x: (v.x + 1) * r.width / 2, y: (1 - v.y) * r.height / 2 };
  }
  function task(s: RailState, t: Train) {
    const b = bay(s.round, t), pose = trainPose(s, t, outside());
    if (s.phase === 'door') {
      const from = screen(doorPoint(s, t, outside()));
      return { train: t, kind: 'door' as const, value: s.door, from, to: { x: from.x - b.side * Math.max(72, canvas.clientWidth * 0.08) * (1 - s.door), y: from.y } };
    }
    const exit = s.phase === 'exit', value = s.phase === 'choose' ? 0 : s.travel;
    return { train: t, kind: 'drive' as const, value, from: screen({ ...pose, x: pose.x - b.side * profiles[t].door, y: 1.1 }), to: screen({ x: (exit ? b.x + b.side * 1.7 : b.x) - b.side * profiles[t].door, y: 1.1, z: b.z }) };
  }
  function bounds(s: RailState, t: Train) {
    const p = trainPose(s, t, outside()), bank = bay(s.round, t), cab = carSegments(t)[0];
    const centreX = p.x - bank.side * (cab.front + cab.rear) / 2;
    const a = screen({ x: p.x - bank.side * cab.rear, y: 0.1, z: p.z }), b = screen({ x: p.x - bank.side * cab.front, y: profiles[t].roof + 0.6, z: p.z });
    return { centre: screen({ ...p, x: centreX, y: 0.12 }), label: screen({ ...p, x: centreX, y: 3.2 }), width: Math.abs(b.x - a.x) + 16, height: Math.abs(b.y - a.y) + 12 };
  }

  function hit(x: number, y: number, s: RailState): Train | undefined {
    const eligible = available(s), r = canvas.getBoundingClientRect();
    if (s.phase === 'door') {
      const point = task(s, s.selected!).from;
      return Math.hypot(x - r.x - point.x, y - r.y - point.y) <= 48 ? s.selected! : undefined;
    }
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((x - r.x) / r.width * 2 - 1, -(y - r.y) / r.height * 2 + 1), camera);
    scene.updateMatrixWorld(true);
    const hits = ray.intersectObjects(eligible.map(t => models[t].root), true);
    return eligible.find(t => hits.some(h => { for (let parent: THREE.Object3D | null = h.object; parent; parent = parent.parent) if (parent === models[t].root) return true; return false; }));
  }
  function render(s: RailState, time: number) {
    for (const t of trains) {
      const p = trainPose(s, t, outside()), b = bay(s.round, t), model = models[t];
      model.root.visible = p.visible; model.root.position.set(p.x, p.y, p.z); model.root.scale.x = -b.side; model.pose(-b.side * p.x, s.selected === t ? s.door : 0, s.round.palette, -b.side * p.direction);
      platforms[t].group.scale.x = b.side; platforms[t].group.position.z = b.z; platforms[t].sign.material = material(palettes[s.round.palette][t]);
    }
    for (let id = 0; id < passengers.length; id++) {
      const person = passengers[id], source = sourceTrain(s.round, id), destination = destinationTrain(s.round, id);
      const unloading = s.selected === source && s.phase === 'passengers', boarding = s.selected === destination && s.phase === 'passengers';
      const leftSource = s.order.includes(source) || s.selected === source && ['closing', 'exit', 'departure'].includes(s.phase);
      const onDestination = s.order.includes(destination) || s.selected === destination && ['closing', 'exit', 'departure'].includes(s.phase);
      let p: Point & { heading?: number }, walking = false;
      if (unloading) { const f = Math.min(1, Math.max(0, (s.elapsed - (id % 3) * 0.3) / 6.1)); p = walkPose(transferRoute(s, id), f); walking = f > 0 && f < 1; }
      else if (boarding) { const f = Math.min(1, Math.max(0, (s.elapsed - Math.floor(id / 2) * 0.3) / 2.8)); p = walkPose(boardingRoute(s, id), f); walking = f > 0 && f < 1; }
      else p = onDestination ? seatPoint(s, destination, id, outside()) : leftSource ? waitingPoint(s.round, id) : seatPoint(s, source, id, outside());
      person.root.visible = unloading || boarding || (leftSource && !onDestination) || trainPose(s, onDestination ? destination : source, outside()).visible;
      person.shirt.material = material(['#dcaa7b', '#93b2a3', '#e9c26e', '#b2a0c2'][(id + s.round.cast) % 4]);
      person.root.position.set(p.x, p.y + 0.08, p.z); person.root.rotation.y = p.heading ?? 0;
      person.legs.forEach((leg, n) => { leg.rotation.x = walking ? Math.sin(time * 9 + id + n * Math.PI) * 0.48 : !leftSource || onDestination ? -0.9 : 0; });
      person.arm.rotation.z = 0;
    }
    const celebrating = ['celebrate', 'complete'].includes(s.phase); steward.arm.rotation.z = celebrating ? -1.2 + Math.sin(time * 5) * 0.25 : -0.12;
    confetti.forEach((m, i) => { m.visible = celebrating; if (celebrating) { m.position.set(Math.sin(i * 2.4) * 6, 3.5 + ((i * 0.37 - time * 0.8) % 3 + 3) % 3, 0.3 + Math.cos(i * 1.3) * 3); m.rotation.set(time + i, i, time * 0.7); } });
    renderer.render(scene, camera);
  }
  return { canvas, render, task, hit, bounds };
});
export type RailScene = Effect.Success<ReturnType<typeof createRailScene>>;
