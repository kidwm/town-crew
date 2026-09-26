import * as THREE from 'three';
import { createTownTree, createTownHouse, createTownBench } from '../../runtime/town-scenery.ts';
import { createTrafficCone } from '../../runtime/traffic-cone.ts';
import { createShapes } from '../../runtime/geometry.ts';
import { createAmbulance, createStretcher, createPerson, createOfficer, link } from '../../runtime/emergency-models.ts';
import type { DragHint } from '../../runtime/drag-hint.ts';
import { createCar, createTowTruck, createWheelLiftTruck, createWheelYoke, createSweeper } from './vehicles.ts';
import { CARS, CONES, PATIENT, DEBRIS, PALETTE, TOW_LANE, towDirection, towType, stages, goals, goalPoint, isDriving, driveEnd, mix, smooth } from './domain/traffic.ts';
import { towingPose, towedCarPose, CAR_AXLE, CAR_WHEEL } from './domain/towing.ts';
import type { TrafficState, Point } from './domain/traffic.ts';
const vector = (p: Point) => new THREE.Vector3(p.x, p.y, p.z);
interface ScreenPoint { x: number; y: number }
export function createTrafficScene(host: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#dce9e0');
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement; canvas.setAttribute('aria-label', '交通救援現場：警車管制、拖吊兩台小客車、清掃道路、救護車接送'); host.append(canvas);
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-15, 15, 9, -9, 0.1, 300);
  camera.position.set(22, 32, 60); camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight('#fff7e0', '#a3b59c', 2.4));
  const sun = new THREE.DirectionalLight('#fff1da', 2.5); sun.position.set(-10, 18, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = 0.035;
  Object.assign(sun.shadow.camera, { left: -23, right: 23, top: 19, bottom: -19, far: 55 }); scene.add(sun);
  const shapes = createShapes(), { box, cylinder, material } = shapes;
  box(scene, [300, 0.4, 300], [0, -0.3, 0], '#b9cea7');
  box(scene, [100, 0.1, 11.6], [0, -0.05, 0], '#a9ab9b');
  for (const z of [-5.7, 5.7]) box(scene, [100, 0.025, 0.13], [0, 0.02, z], '#f8edcd');
  for (let x = -32; x <= 32; x += 2.5) for (const z of [-2.8, 2.8]) box(scene, [1.1, 0.02, 0.09], [x, 0.02, z], '#f7ebcd');
  box(scene, [100, 0.16, 2.1], [0, 0.02, -6.9], '#e3d8b8');
  for (const [x, z] of [[-12, -8.7], [12, -8.7], [-15, 12], [14, 12]]) {
    const tree = createTownTree(shapes); tree.position.set(x, 0, z); scene.add(tree);
  }
  for (const [x, color, roof] of [[-7, '#e4c79e', '#c8917a'], [1, '#e9d9b9', '#9bbcaf'], [8, '#e2c2a3', '#d0b174']] as const) {
    const house = createTownHouse(shapes, color, roof); house.position.set(x, 0, -11); scene.add(house);
  }
  const bench = createTownBench(shapes); bench.position.set(1, 0, -7); scene.add(bench);
  const cars = [createCar(shapes), createCar(shapes)], police = createCar(shapes, true), flatbed = createTowTruck(shapes), wheelLift = createWheelLiftTruck(shapes), sweeper = createSweeper(shapes), ambulance = createAmbulance(shapes), passing = createCar(shapes);
  [police, flatbed, wheelLift, sweeper, ambulance, passing, ...cars].forEach(v => scene.add(v.root));
  const cones = CONES.map(() => createTrafficCone(shapes)), looseCone = createTrafficCone(shapes); cones.forEach(c => scene.add(c)); scene.add(looseCone);
  const hook = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(0.27, -0.18, 0), new THREE.Vector3(0.33, 0.06, 0)]);
  hook.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.09, 8, false), material('#e6bd67'))); scene.add(hook);
  const yoke = createWheelYoke(shapes); scene.add(yoke);
  const yokeHit = shapes.hitbox(yoke, [1.3, 1.3, 2.4], [0, 0, 0]);
  const hookHit = shapes.hitbox(hook, [1.2, 1.2, 1.2], [0.1, 0, 0]);
  const cable = cylinder(scene, 0.04, 1, [0, 0, 0], '#627d7a');
  const stretcher = createStretcher(shapes); scene.add(stretcher.root);
  const residents = [createPerson(shapes), createPerson(shapes)], officer = createOfficer(shapes), medic = createPerson(shapes, true);
  [...residents, officer, medic].forEach(p => scene.add(p.root));
  // Make uniforms distinct while keeping the shared character silhouette.
  medic.root.traverse(o => { if (!(o instanceof THREE.Mesh)) return; if (o.material === material('#d3a968') || o.material === material('#efd27d')) o.material = material('#f1ebd6'); else if (o.material === material('#f1e5ad')) o.material = material('#85b4a3'); });
  const cameraProp = new THREE.Group(); cameraProp.position.set(0.1, 0.96, 0.3); officer.root.add(cameraProp);
  box(cameraProp, [0.34, 0.23, 0.13], [0, 0, 0], '#587678');
  cylinder(cameraProp, 0.09, 0.11, [0, 0, 0.1], '#a6bbb0').rotation.x = Math.PI / 2;
  const flash = box(cameraProp, [0.14, 0.1, 0.04], [0.11, 0.11, 0.09], '#fff5cd');
  const debris = DEBRIS.map((x, i) => {
    const root = new THREE.Group(); root.position.set(x, 0.06, 0); scene.add(root);
    for (let j = 0; j < 3; j++) { const piece = box(root, [0.19 + (i % 2) * 0.08, 0.09, 0.22], [Math.sin(i + j) * 0.2, 0, (j - 1) * 0.75], j === 1 ? '#c3d4c7' : '#c7ba9b'); piece.rotation.y = i + j; }
    return root;
  });
  const dust = Array.from({ length: 12 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 5), material('#dfd5b6')); scene.add(m); return m; });
  const parking = new THREE.Group(); scene.add(parking);
  for (const z of [-1.1, 1.1]) box(parking, [6.6, 0.035, 0.08], [0, 0, z], '#fff2c6');
  for (const x of [-3.3, 3.3]) box(parking, [0.08, 0.035, 2.2], [x, 0, 0], '#fff2c6');
  const confetti = Array.from({ length: 30 }, (_, i) => box(scene, [0.13, 0.13, 0.05], [0, 0, 0], ['#e5bc6b', '#89b8a7', '#db9a85'][i % 3]));
  const ray = new THREE.Raycaster();
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect(); if (!width || !height) return;
    const aspect = width / height, view = Math.max(19, 31 / aspect);
    camera.left = -view * aspect / 2; camera.right = view * aspect / 2; camera.top = view / 2; camera.bottom = -view / 2;
    camera.updateProjectionMatrix(); renderer.setSize(width, height);
  }); resize.observe(host);
  function screen(p: Point): ScreenPoint { camera.updateMatrixWorld(true); const r = canvas.getBoundingClientRect(), v = vector(p).project(camera); return { x: (v.x + 1) * r.width / 2, y: (1 - v.y) * r.height / 2 }; }
  const drivingZ = (s: TrafficState) => s.phase === 'police' || s.phase === 'ambulance' ? -4.7 : s.phase === 'tow-exit' ? TOW_LANE : 0;
  function anchor(s: TrafficState): Point { return s.phase === 'tow-choice' ? goalPoint(goals(s)[0] ?? 'car-0') : isDriving(s) ? { x: s.truckX, y: 1, z: drivingZ(s) } : s.handle; }
  function targets(s: TrafficState, pointer?: ScreenPoint, origin?: ScreenPoint) {
    const r = canvas.getBoundingClientRect(), finger = pointer && { x: pointer.x - r.x, y: pointer.y - r.y }, held = screen(anchor(s));
    const moved = pointer && origin && Math.hypot(pointer.x - origin.x, pointer.y - origin.y) >= 18;
    const list = goals(s).map(id => { const p = screen(goalPoint(id)); return { id, ...p, distance: finger ? Math.min(Math.hypot(finger.x - p.x, finger.y - p.y), Math.hypot(held.x - p.x, held.y - p.y)) : Infinity }; });
    // Shrink capture regions if two destinations project close together on a phone.
    const spacing = list.length > 1 ? Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y) : 100;
    const radius = Math.min(40, Math.max(20, spacing * 0.45));
    const closest = moved && s.action === 'dragging' ? [...list].sort((a, b) => a.distance - b.distance)[0] : undefined;
    return list.map(t => ({ ...t, accepted: t.id === closest?.id && t.distance < radius }));
  }
  function setRay(x: number, y: number) { const r = canvas.getBoundingClientRect(); scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); ray.setFromCamera(new THREE.Vector2((x - r.x) / r.width * 2 - 1, 1 - (y - r.y) / r.height * 2), camera); }
  return {
    canvas, screen, targets, anchor,
    carAt(x: number, y: number, s: TrafficState) {
      if (s.phase !== 'tow-choice' || !['ready', 'dragging'].includes(s.action)) return;
      setRay(x, y);
      const available = goals(s), hits = available.map(id => ({ id, hit: ray.intersectObject(cars[id === 'car-0' ? 0 : 1].hit, true)[0] })).filter(v => v.hit).sort((a, b) => a.hit!.distance - b.hit!.distance);
      if (hits.length) return hits[0].id;
      const r = canvas.getBoundingClientRect(), nearest = targets(s).map(t => ({ ...t, distance: Math.hypot(x - r.x - t.x, y - r.y - t.y) })).sort((a, b) => a.distance - b.distance);
      return nearest[0]?.distance < 24 ? nearest[0].id : undefined;
    },
    onPlane(x: number, y: number, height = 0.7) { setRay(x, y); const p = new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -height), p) ? { x: p.x, y: p.y, z: p.z } : undefined; },
    hit(x: number, y: number, s: TrafficState) {
      if (s.action !== 'ready' || !(isDriving(s) || goals(s).length)) return false;
      setRay(x, y);
      const tow = towType(s) === 'flatbed' ? flatbed : wheelLift;
      const object = s.phase === 'police' ? police.hit : s.phase === 'tow-exit' ? tow.hit : ['sweeper', 'sweep'].includes(s.phase) ? sweeper.hit : s.phase === 'ambulance' ? ambulance.hit : s.phase === 'hook' ? towType(s) === 'flatbed' ? hookHit : yokeHit : s.phase === 'cones' ? looseCone : stretcher.hit;
      if (ray.intersectObject(object, true).length) return true;
      const r = canvas.getBoundingClientRect(), p = screen(anchor(s)); return Math.hypot(x - r.x - p.x, y - r.y - p.y) < 28;
    },
    dragHint(s: TrafficState): DragHint | undefined {
      if (s.action !== 'ready' || !(isDriving(s) || goals(s).length)) return;
      if (s.phase === 'tow-choice') { const point = screen(goalPoint(goals(s)[0])); return { from: point, to: point, direction: 'up', label: '點一台小客車，呼叫拖吊車' }; }
      const from = screen(anchor(s)), to = screen(isDriving(s) ? { ...anchor(s), x: driveEnd(s) } : goalPoint(goals(s)[0]));
      return { from, to, direction: isDriving(s) ? s.phase === 'tow-exit' && towDirection(s) < 0 ? 'left' : 'right' : s.phase === 'boarding' ? 'right' : 'up', label: isDriving(s) ? '按住車子，沿箭頭慢慢拖' : s.phase === 'hook' ? towType(s) === 'flatbed' ? '把掛鉤拖到選好的小客車' : '把托輪架拖到選好的小客車' : s.phase === 'cones' ? '把交通錐拖到輪廓' : '把擔架拖到光圈' };
    },
    render(s: TrafficState, time: number) {
      const index = stages.indexOf(s.phase), t = s.elapsed, working = s.action === 'working';
      const entry = s.action === 'entering' ? 7 * (1 - smooth(t / 1.2)) : 0;
      const closing = s.phase === 'reopen' ? smooth(t / 1) : s.phase === 'complete' ? 1 : 0;
      const policeX = s.phase === 'police' ? s.truckX - entry : -7 + (s.phase === 'reopen' ? -18 * smooth((t - 1) / 1.6) : 0);
      police.root.visible = index >= 1 && s.phase !== 'complete'; police.root.position.set(policeX, 0, -4.7 - (index >= 3 ? 3 : s.phase === 'cones' && working && s.cones.every(Boolean) ? 3 * smooth(t / 0.75) : 0)); police.pose('#f0e8d5', policeX, time, true, false);
      officer.root.visible = index >= 2; officer.root.position.set(-4, 0.1, -6.4); officer.arm.rotation.z = s.phase === 'complete' ? -2.1 + Math.sin(time * 4) * 0.3 : -0.4;
      cameraProp.visible = s.phase === 'cones' && working && s.cones.every(Boolean); flash.visible = t > 0.25 && t < 0.45;
      const rig = towingPose(s), towVisible = ['tow-arrival', 'hook', 'tow-exit'].includes(s.phase);
      const attached = rig.departing || rig.loading && t >= 3.6;
      for (const [vehicle, type] of [[flatbed, 'flatbed'], [wheelLift, 'wheel-lift']] as const) {
        vehicle.root.visible = towVisible && rig.type === type; vehicle.root.position.set(rig.x, 0, rig.z); vehicle.root.rotation.y = rig.yaw;
        vehicle.roll(rig.x * rig.direction); vehicle.beacon(time, true);
      }
      flatbed.pose(rig.lowered, rig.departing); wheelLift.pose(rig.raised, attached);
      cars.forEach((car, i) => {
        car.root.visible = !s.towed[i]; const pose = towedCarPose(s, i), p = pose.position;
        if (s.phase === 'collision') { const approach = smooth(t / 1.45); p.x += (i ? 1 : -1) * (8 * (1 - approach) - 0.24 * Math.sin(Math.min(1, Math.max(0, t - 1.45) / 0.5) * Math.PI)); }
        car.root.position.copy(vector(p)); car.root.rotation.set(0, pose.yaw, pose.pitch);
        const carried = s.selected === i && attached;
        car.pose(PALETTE[s.colors[i]], carried && rig.type === 'flatbed' ? 0 : p.x * Math.cos(pose.yaw), time, !carried, index > 0 || t > 1.4, !carried);
      });
      cones.forEach((cone, i) => { cone.visible = s.cones[i] && closing < 1; cone.position.set(CONES[i].x, 0, CONES[i].z); cone.scale.setScalar(1 - closing); });
      looseCone.visible = s.phase === 'cones' && !working; looseCone.position.set(s.handle.x, 0, s.handle.z);
      hook.visible = s.phase === 'hook' && rig.type === 'flatbed';
      yoke.visible = s.phase === 'hook' && rig.type === 'wheel-lift' && !attached;
      let equipment = s.handle;
      if (rig.loading && s.selected !== null) {
        const car = cars[s.selected].root;
        const axle = new THREE.Vector3(CAR_AXLE, CAR_WHEEL - 0.22, 0).applyEuler(car.rotation).add(car.position);
        equipment = rig.type === 'flatbed' ? { x: car.position.x + rig.direction * 1.6, y: car.position.y + 0.6, z: car.position.z } : mix({ ...car.position, y: 0.7 }, axle, smooth(t / 1.3));
      }
      hook.position.copy(vector(equipment)); yoke.position.copy(vector(equipment)); yoke.rotation.y = rig.yaw;
      cable.visible = hook.visible; if (cable.visible) link(cable, new THREE.Vector3(rig.x + rig.direction * 0.5, 1.2, rig.z), hook.position);
      const sweepX = s.truckX + (s.phase === 'sweep' && working ? 20 * smooth(t / 2) : -entry);
      sweeper.root.visible = s.phase === 'sweeper' || s.phase === 'sweep'; sweeper.root.position.set(sweepX, 0, 0); sweeper.roll(sweepX); sweeper.beacon(time, true); sweeper.brush(time, s.phase === 'sweep' && s.action !== 'ready');
      debris.forEach((piece, i) => { piece.visible = (index > 0 || t > 1.5) && i >= s.cleaned; });
      dust.forEach((p, i) => { p.visible = s.phase === 'sweep' && s.action === 'dragging'; const u = (time * 1.8 + i / 12) % 1; p.position.set(sweepX + 0.5 - u, 0.13 + u * 0.35, Math.sin(i * 7) * 1.5); p.scale.setScalar((1 - u) * 0.8); });
      const ambulanceX = s.phase === 'ambulance' ? s.truckX - entry : 5.6 + (s.phase === 'departure' ? 23 * smooth((t - 0.6) / 2.6) : 0);
      ambulance.root.visible = index >= stages.indexOf('ambulance') && index <= stages.indexOf('departure'); ambulance.root.position.set(ambulanceX, 0, -4.7); ambulance.roll(ambulanceX); ambulance.beacon(time, true);
      ambulance.open(s.phase === 'stretcher' || s.phase === 'boarding' ? 1 : s.phase === 'ambulance' && working ? smooth(t / 0.7) : s.phase === 'departure' ? 1 - smooth(t / 0.6) : 0);
      stretcher.root.visible = s.phase === 'stretcher' || s.phase === 'boarding'; stretcher.root.position.copy(vector(s.handle));
      if (s.phase === 'boarding' && working) stretcher.root.position.x += smooth(t / 1.2) * 2;
      stretcher.occupied(s.phase === 'boarding' || s.phase === 'stretcher' && working && t > 1);
      residents.forEach((p, i) => {
        const waiting = { x: i ? 3 : PATIENT.x, y: 0.1, z: -6.4 }, start = { ...CARS[i], y: 0 };
        const walk = s.phase === 'collision' ? smooth((t - 1.8) / 1.8) : 1;
        p.root.position.copy(vector(mix(start, waiting, walk))); p.root.visible = (index > 0 || t >= 1.8) && (i === 1 || index < stages.indexOf('boarding') && !(s.phase === 'stretcher' && working && t >= 1));
        p.root.rotation.z = i === 0 && s.phase === 'stretcher' && working ? smooth(t) * Math.PI / 2 : 0;
        if (i === 0 && s.phase === 'stretcher' && working) p.root.position.copy(vector(mix(waiting, { ...s.handle, y: 0.9 }, smooth(t))));
        p.arm.rotation.z = s.phase === 'complete' ? -2.1 + Math.sin(time * 3) * 0.3 : -0.2;
      });
      medic.root.visible = s.phase === 'stretcher' || s.phase === 'boarding'; medic.root.position.set(stretcher.root.position.x, 0.1, stretcher.root.position.z - 0.85);
      if (s.phase === 'boarding' && working && t > 0.6) medic.root.visible = false;
      parking.visible = ['police', 'ambulance', 'sweeper'].includes(s.phase); parking.position.set(driveEnd(s), 0.06, drivingZ(s)); parking.scale.x = s.phase === 'police' ? 0.6 : 1;
      passing.root.visible = s.phase === 'reopen' && t > 2.6; const passX = -22 + 44 * smooth((t - 2.6) / 1.4); passing.root.position.set(passX, 0, 0); passing.pose('#91b7a2', passX, time, false, false);
      confetti.forEach((p, i) => { p.visible = s.phase === 'complete'; const u = (time * 0.25 + i / confetti.length) % 1; p.position.set(Math.sin(i * 5) * 8, 8 - u * 7, Math.cos(i * 7) * 4); p.rotation.set(time, i, time + i); p.scale.setScalar(Math.sin(u * Math.PI)); });
      renderer.render(scene, camera);
    },
    dispose() {
      resize.disconnect(); const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); } });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); shapes.disposeMaterials(); sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
