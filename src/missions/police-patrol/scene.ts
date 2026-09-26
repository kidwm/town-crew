import * as THREE from 'three';
import { createShapes } from '../../runtime/geometry.ts';
import { createCar } from '../../runtime/car.ts';
import { createOfficer, createPerson } from '../../runtime/emergency-models.ts';
import { createTownTree, createTownHouse, createTownBench } from '../../runtime/town-scenery.ts';
import { createMotorcycle, createDetectiveVan, createSuspect, createBag } from './vehicles.ts';
import { routes, pathPose, pathLength, guardRoute, suspectRoute, boardingRoute, vanDoorSide, available, job, side, entry, stages, smooth, mix, PALETTE, BAG_COLORS } from './domain/police.ts';
import type { PoliceState, Vehicle, Point } from './domain/police.ts';
import type { DragHint } from '../../runtime/drag-hint.ts';
interface Screen { x: number; y: number }
export function createPoliceScene(host: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#dce9e0');
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement; canvas.setAttribute('aria-label', '警察協作現場：警車跟進、兩台重機包抄、偵防車押送'); host.append(canvas);
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-18, 18, 11, -11, 0.1, 300);
  camera.position.set(12, 57, 60); camera.lookAt(0, 0, 0.8);
  scene.add(new THREE.HemisphereLight('#fff7e0', '#a3b59c', 2.4));
  const sun = new THREE.DirectionalLight('#fff1da', 2.5); sun.position.set(-10, 18, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = 0.035;
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 22, bottom: -22, far: 65 }); scene.add(sun);
  const shapes = createShapes(), { box, material } = shapes;
  box(scene, [200, 0.4, 200], [0, -0.31, 0], '#b9cea7');
  // Four real street blocks: a perimeter road, a central street and two short alleys.
  // Sidewalks frame the buildings; the child can see why an outer route is needed.
  const streets = [
    ...[-11, 0, 11].map(x => ({ x, z: -0.5, width: 4.2, depth: 19.2 })),
    ...[-8, 7].map(z => ({ x: 0, z, width: 60, depth: 4.2 })),
    { x: 0, z: 0, width: 22, depth: 2.9 },
    // Guard bays connect to the streets outside the transport corridor.
    ...[-2.9, 2.9].map(x => ({ x, z: -2, width: 3.5, depth: 1.6 })),
  ];
  function pave(margin: number, y: number, color: string) {
    const rectangles = streets.map(r => ({ left: r.x - r.width / 2 - margin, right: r.x + r.width / 2 + margin, back: r.z - r.depth / 2 - margin, front: r.z + r.depth / 2 + margin }));
    const xs = [...new Set(rectangles.flatMap(r => [r.left, r.right]))].sort((a, b) => a - b);
    const zs = [...new Set(rectangles.flatMap(r => [r.back, r.front]))].sort((a, b) => a - b);
    const vertices: number[] = [];
    // Tile the union once: crossings never stack coplanar road faces or cast seams.
    for (let i = 1; i < xs.length; i++) for (let j = 1; j < zs.length; j++) {
      const x0 = xs[i - 1], x1 = xs[i], z0 = zs[j - 1], z1 = zs[j];
      const x = (x0 + x1) / 2, z = (z0 + z1) / 2;
      if (!rectangles.some(r => x > r.left && x < r.right && z > r.back && z < r.front)) continue;
      vertices.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
    const surface = new THREE.Mesh(geometry, material(color)); surface.receiveShadow = true; scene.add(surface);
  }
  pave(0.275, 0.01, '#e7dabe');
  pave(0, 0.055, '#a9ab9b');
  for (let x = -24; x <= 24; x += 3) for (const z of [-8, 7]) {
    if ([-11, 0, 11].every(j => Math.abs(x - j) > 2.8)) box(scene, [1.2, 0.02, 0.08], [x, 0.068, z], '#f5eacd');
  }
  for (const x of [-11, 0, 11]) for (const z of [-4.5, 3.4]) box(scene, [0.08, 0.02, 1.1], [x, 0.068, z], '#f5eacd');
  for (const x of [-6.3, 6.3]) for (const z of [-4.5, 3.9]) {
    const house = createTownHouse(shapes, x < 0 ? '#e4c79e' : '#e9d9b9', z < 0 ? '#c8917a' : '#9bbcaf');
    house.position.set(x, 0.06, z);
    // Low foreground shops leave the alley and its cars visible from the fixed camera.
    house.scale.z = z > 0 ? 0.65 : 0.8;
    if (z > 0) house.scale.y = 0.58;
    scene.add(house);
    box(scene, [5.9, 0.1, z > 0 ? 2.4 : 2.9], [x, 0, z], '#e4d7b7');
  }
  // Crosswalks at the central junction make the entrance and the northern exit legible.
  for (const z of [-5.5, 4.5]) for (let x = -1.5; x <= 1.5; x += 0.6) box(scene, [0.32, 0.025, 0.85], [x, 0.07, z], '#f7edce');
  for (const [x, z] of [[-15, -9], [15, -9], [-15, 10], [15, 10], [-6.3, -12], [6.3, -12]]) {
    const tree = createTownTree(shapes); tree.position.set(x, 0, z); scene.add(tree);
  }
  const bench = createTownBench(shapes); scene.add(bench);
  const police = createCar(shapes, true), bikes = [createMotorcycle(shapes), createMotorcycle(shapes, true)], van = createDetectiveVan(shapes);
  const vehicles = { police, bike0: bikes[0], bike1: bikes[1], van }; Object.values(vehicles).forEach(v => scene.add(v.root));
  const suspectCar = createCar(shapes), suspectVan = createDetectiveVan(shapes, false); let renderedColor = '';
  scene.add(suspectCar.root, suspectVan.root);
  const suspect = createSuspect(shapes), officer = createOfficer(shapes), resident = createPerson(shapes);
  [suspect, officer, resident].forEach(p => scene.add(p.root));
  const bag = createBag(shapes, BAG_COLORS[0]); scene.add(bag);
  const confetti = Array.from({ length: 30 }, (_, i) => box(scene, [0.13, 0.13, 0.05], [0, 0, 0], ['#e5bc6b', '#89b8a7', '#db9a85'][i % 3]));
  const routeGeometry = new THREE.CircleGeometry(0.12, 8), routeMaterial = new THREE.MeshBasicMaterial({ color: '#fff1c7' });
  const routeMarkers = Array.from({ length: 120 }, () => { const m = new THREE.Mesh(routeGeometry, routeMaterial); m.rotation.x = -Math.PI / 2; scene.add(m); return m; });
  const resize = new ResizeObserver(() => {
    const r = host.getBoundingClientRect(); if (!r.width || !r.height) return;
    const aspect = r.width / r.height, height = Math.max(27, 35 / aspect);
    camera.left = -height * aspect / 2; camera.right = height * aspect / 2; camera.top = height / 2; camera.bottom = -height / 2;
    camera.updateProjectionMatrix(); renderer.setSize(r.width, r.height);
  }); resize.observe(host);
  function screen(p: Point, y = 1): Screen { camera.updateMatrixWorld(true); const r = canvas.getBoundingClientRect(), v = new THREE.Vector3(p.x, y, p.z).project(camera); return { x: (v.x + 1) * r.width / 2, y: (1 - v.y) * r.height / 2 }; }
  function pose(s: PoliceState, vehicle: Vehicle) {
    const r = routes(s.round), w = s.work;
    if (vehicle === 'bike1' && stages.indexOf(s.phase) >= stages.indexOf('arrest')) return pathPose(guardRoute(s.round), s.phase === 'arrest' ? smooth((s.elapsed - 1.5) / 1.3) : 1);
    const key = vehicle === 'police' ? w.follow === 1 ? 'yield' : 'follow' : vehicle === 'bike0' ? w.bike0 === 1 && stages.indexOf(s.phase) >= stages.indexOf('lead') ? 'lead' : 'bike0' : vehicle === 'bike1' ? 'bike1' : w.arrive === 1 && stages.indexOf(s.phase) >= stages.indexOf('transport') ? 'escort' : 'arrive';
    return pathPose(r[key], w[key]);
  }
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
    const path = routes(s.round)[key], points = path.map(p => screen(p)), p = pose(s, vehicle);
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
    const actual = candidates.filter(c => c.hit).sort((a, b) => a.hit!.distance - b.hit!.distance)[0];
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
    const path = routes(s.round)[info.key], length = pathLength(path); let traversed = 0, nearest = Infinity, value = s.work[info.key];
    for (let i = 1; i < path.length; i++) {
      const a = info.points[i - 1], b = info.points[i], dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((finger.x - a.x) * dx + (finger.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const distance = Math.hypot(finger.x - a.x - t * dx, finger.y - a.y - t * dy), segment = Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
      if (distance < nearest) { nearest = distance; value = (traversed + segment * t) / length; } traversed += segment;
    }
    return value;
  }
  return { canvas, screen, hit, task, target,
    hint(s: PoliceState, preferred?: Vehicle): DragHint | undefined {
      if (s.action !== 'ready') return;
      const eligible = available(s), v = preferred && eligible.includes(preferred) ? preferred : eligible[0]; if (!v) return;
      const { from, to, key, value, points } = task(s, v);
      let via: Screen[] | undefined;
      if (key !== 'door') {
        const path = routes(s.round)[key], length = pathLength(path); let distance = 0;
        via = points.filter((_, i) => { if (i) distance += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z); return i > 0 && i < path.length - 1 && distance > value * length + 0.05; });
      }
      return { from, to, via, direction: to.x < from.x ? 'left' : 'right', label: s.phase === 'door' ? '沿箭頭拉開側滑門' : '按住車子，沿亮起的路線拖曳' };
    },
    render(s: PoliceState, time: number, preferred?: Vehicle) {
      const i = stages.indexOf(s.phase), sideX = side(s.round), e = entry(s.round), w = s.work, departing = s.phase === 'depart', complete = s.phase === 'complete';
      bench.position.set(-sideX * 8.5, 0, 10.5);
      Object.entries(vehicles).forEach(([id, vehicle]) => {
        const v = id as Vehicle, p = pose(s, v);
        vehicle.root.position.set(p.x, 0, p.z); vehicle.root.rotation.y = p.yaw;
        vehicle.root.visible = !complete && (v === 'police' ? i > 0 : v === 'van' ? i >= stages.indexOf('van') : i >= stages.indexOf('bikes'));
        if (v === 'bike0' && w.lead === 1) vehicle.root.visible = false;
      });
      if (departing) {
        const r = routes(s.round), t = s.elapsed;
        const policePath = [r.yield.at(-1)!, { x: -sideX * 11, z: 0 }, { x: -sideX * 11, z: 7 }, { x: -e * 25, z: 7 }];
        const bikePath = [guardRoute(s.round).at(-1)!, { x: 0, z: -2 }, { x: 0, z: -8 }, { x: -e * 25, z: -8 }];
        for (const [id, path] of [['police', policePath], ['bike1', bikePath]] as const) { const p = pathPose(path, smooth(t / 4)); vehicles[id].root.position.set(p.x, 0, p.z); vehicles[id].root.rotation.y = p.yaw; }
        van.root.position.x += -e * 12 * smooth(t / 1.4);
      }
      const policeDistance = pathLength(routes(s.round).follow) * w.follow + pathLength(routes(s.round).yield) * w.yield + (departing ? s.elapsed * 5 : 0);
      police.pose('#eee8d5', policeDistance, time, false, false);
      bikes.forEach((b, n) => b.pose(pathLength(routes(s.round)[n ? 'bike1' : 'bike0']) * w[n ? 'bike1' : 'bike0'] + (n ? 0 : pathLength(routes(s.round).lead) * w.lead) + (departing ? s.elapsed * 6 : 0), time, s.active === `bike${n}` || departing, w[n ? 'bike1' : 'bike0'] === 1 && i < stages.indexOf('lead')));
      van.pose(pathLength(routes(s.round).arrive) * w.arrive + pathLength(routes(s.round).escort) * w.escort + (departing ? s.elapsed * 5 : 0), time, true);
      const opening = s.phase === 'door' ? w.door : s.phase === 'boarding' ? 1 - smooth((s.elapsed - 4.1) / 0.7) : 0;
      van.open(opening, vanDoorSide(s.round));
      const color = PALETTE[s.round.color];
      if (renderedColor !== color) {
        // Only the civilian van's body material changes; police identification stays fixed.
        const old = renderedColor || '#627c8e'; suspectVan.root.traverse(o => { if (o instanceof THREE.Mesh && o.material === material(old)) o.material = material(color); }); renderedColor = color;
      }
      let suspectPose = pathPose(suspectRoute(s.round), w.follow);
      if (departing) suspectPose = pathPose([{ x: sideX * 5, z: 0 }, { x: sideX * 11, z: 0 }, { x: sideX * 11, z: -8 }, { x: -e * 25, z: -8 }], smooth((s.elapsed - 1.8) / 4.5));
      [suspectCar, suspectVan].forEach((car, n) => { car.root.visible = !complete && (s.round.body === 'van') === Boolean(n); car.root.position.set(suspectPose.x, 0, suspectPose.z); car.root.rotation.y = suspectPose.yaw; });
      suspectCar.pose(color, suspectPose.distance, time, i >= stages.indexOf('arrest'), false); suspectVan.pose(suspectPose.distance, time, false);
      const home = { x: -sideX * 9.3, z: 10.5 }, waiting = { x: sideX * 2.3, z: 1.25 };
      resident.root.position.set(home.x, 0, home.z); resident.arm.rotation.z = complete ? -2.1 + Math.sin(time * 3) * 0.25 : -0.2;
      suspect.root.visible = s.phase === 'intro' || i >= stages.indexOf('arrest') && i <= stages.indexOf('boarding');
      officer.root.visible = i >= stages.indexOf('arrest') && i <= stages.indexOf('boarding');
      let person = waiting, companion = { x: waiting.x - 0.55, z: waiting.z + 0.15 };
      if (s.phase === 'intro') person = mix({ x: -sideX * 8.5, z: 10.5 }, { x: -sideX * 6, z: 7 }, smooth((s.elapsed - 0.5) / 2));
      if (s.phase === 'arrest') person = mix({ x: sideX * 5, z: 0.7 }, waiting, smooth(s.elapsed / 1.1));
      if (s.phase === 'boarding') {
        const path = boardingRoute(s.round);
        person = pathPose(path, smooth(s.elapsed / 4)); if (s.elapsed >= 4) suspect.root.visible = officer.root.visible = false;
        companion = pathPose(path, smooth((s.elapsed - 0.2) / 3.8));
      } else if (s.phase === 'arrest') {
        companion = { x: person.x - 0.55, z: person.z + 0.15 };
      }
      const stepUp = s.phase === 'boarding' ? smooth((s.elapsed - 3.35) / 0.6) * 0.78 : 0;
      suspect.root.position.set(person.x, stepUp, person.z); officer.root.position.set(companion.x, stepUp, companion.z);
      suspect.surrender(s.phase === 'arrest' ? smooth((s.elapsed - 0.7) / 0.7) : i > stages.indexOf('arrest') && i < stages.indexOf('boarding') ? 1 : 0);
      officer.arm.rotation.z = s.phase === 'arrest' ? -1.5 : -0.3;
      bag.traverse(o => { if (o instanceof THREE.Mesh && o.geometry.type === 'BoxGeometry') o.material = material(BAG_COLORS[s.round.bag]); });
      bag.visible = s.phase === 'intro' || i >= stages.indexOf('arrest');
      const recovered = i > stages.indexOf('arrest') || s.phase === 'arrest' && s.elapsed > 2;
      bag.position.set(recovered ? home.x + 0.4 : person.x + 0.3, recovered ? 0.45 : 0.5, recovered ? home.z : person.z);
      confetti.forEach((p, n) => { p.visible = complete; const u = (time * 0.25 + n / 30) % 1; p.position.set(Math.sin(n * 5) * 10, 8 - u * 7, Math.cos(n * 7) * 4); p.rotation.set(time, n, time + n); p.scale.setScalar(Math.sin(u * Math.PI)); });
      const eligible = available(s), selected = s.active ?? (preferred && eligible.includes(preferred) ? preferred : eligible[0]);
      const key = selected ? job(s, selected) : undefined, path = key && key !== 'door' ? routes(s.round)[key] : undefined;
      const length = path ? pathLength(path) : 0;
      routeMarkers.forEach((marker, n) => {
        marker.visible = !!path && n * 0.55 <= length;
        if (path && marker.visible) { const p = pathPose(path, n * 0.55 / length); marker.position.set(p.x, 0.085, p.z); }
      });
      renderer.render(scene, camera);
    },
    dispose() {
      resize.disconnect(); const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(o => { if (o instanceof THREE.Mesh) { geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m)); } });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); shapes.disposeMaterials(); sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
