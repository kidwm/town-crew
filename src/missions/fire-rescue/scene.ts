import * as THREE from 'three';
import { createShapes } from '../../runtime/geometry.ts';
import type { DragHint } from '../../runtime/drag-hint.ts';
import { createEngine, createLadder, createAmbulance, createStretcher, createPerson, createCat, link } from './vehicles.ts';
import { stages, goals, isBasket, isDriving, isSpraying, smooth, mix, ENGINE_STOP, STREET_STOP, STREET_Z, HYDRANT, BASKET_HOME, BASKET_STOWED, RESCUES, FIRES, AMBULANCE_REAR } from './domain/fire.ts';
import type { FireState, Point, Goal } from './domain/fire.ts';

interface ScreenPoint { x: number; y: number }
const vector = (p: Point) => new THREE.Vector3(p.x, p.y, p.z);
const raised = (p: Point, y: number): Point => ({ ...p, y: p.y + y });
export function createFireScene(host: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#d7e9e5');
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement; host.append(canvas);
  canvas.setAttribute('aria-label', '消防隊救火現場：接水、噴水、雲梯救居民與小貓、救護車接送');
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-12.5, 12.5, 7.5, -7.5, 0.1, 300);
  // Same orthographic angle and framing, farther back along the view axis so
  // the near plane cannot cut through the ground on tall portrait screens.
  camera.position.set(32, 34, 70.5); camera.lookAt(0, 2, 0.5);
  scene.add(new THREE.HemisphereLight('#fff6df', '#98b39e', 2.4));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.5); sun.position.set(-7, 14, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = 0.035;
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 15, bottom: -15, far: 45 }); scene.add(sun);
  const shapes = createShapes(), { box, cylinder, material } = shapes;
  box(scene, [300, 0.5, 300], [0, -0.4, 0], '#b8cea3');
  box(scene, [24, 0.1, 9.6], [-1, -0.05, 0.25], '#d8d3b7');
  box(scene, [70, 0.08, 3.5], [0, -0.04, STREET_Z], '#aaa995');
  for (let x = -22; x < 23; x += 2) box(scene, [0.9, 0.02, 0.08], [x, 0.025, 7.3], '#f7eccb');
  // An open side apron gives the engine its own route beside the main lane.
  box(scene, [22, 0.08, 3.1], [-12, -0.02, 2.3], '#c7bf9e');
  box(scene, [6.55, 0.23, 4.1], [3, 0.05, -1], '#e8ddba');
  box(scene, [6, 2.35, 3.45], [3, 1.35, -1.1], '#e4b78b');
  box(scene, [6, 2.45, 3.45], [3, 3.75, -1.1], '#f0dab3');
  box(scene, [6.25, 0.2, 3.65], [3, 2.62, -1.1], '#fff0cf');
  box(scene, [6.45, 0.24, 3.9], [3, 5.1, -1.1], '#abc6b3');
  for (const x of [0, 6]) box(scene, [0.17, 0.42, 3.8], [x, 5.42, -1.1], '#d7dfbd');
  box(scene, [6.1, 0.42, 0.17], [3, 5.42, -2.95], '#d7dfbd');
  for (const x of [0.95, 5.0]) {
    box(scene, [1.5, 1.3, 0.12], [x, 1.35, 0.66], '#fff1ce');
    box(scene, [1.25, 1.06, 0.15], [x, 1.35, 0.74], '#98bfc0');
    box(scene, [1.58, 0.16, 0.45], [x, 0.69, 0.8], '#c7d6b5');
    box(scene, [1.42, 1.2, 0.12], [x, 3.83, 0.66], '#fff1ce');
    box(scene, [1.16, 0.96, 0.15], [x, 3.83, 0.75], '#98bfc0');
    box(scene, [0.065, 1.02, 0.18], [x, 3.83, 0.79], '#fff1ce');
  }
  box(scene, [1.3, 1.92, 0.12], [3.05, 1.22, 0.68], '#fff0cd');
  box(scene, [1.05, 1.72, 0.16], [3.05, 1.22, 0.77], '#7baba5');
  box(scene, [0.08, 0.43, 0.15], [3.39, 1.22, 0.91], '#edd399');
  const awning = new THREE.Group(); awning.position.set(3.05, 2.36, 0.97); scene.add(awning);
  for (let i = 0; i < 7; i++) { const strip = box(awning, [0.31, 0.1, 1.04], [(i - 3) * 0.31, 0, 0], i % 2 ? '#f3e6c6' : '#db9780'); strip.rotation.x = 0.13; }
  const balcony = box(scene, [2.45, 0.16, 1.08], [1.35, 2.76, 1.19], '#dfc79c');
  for (const x of [0.17, 2.53]) {
    for (const z of [0.85, 1.66]) box(scene, [0.065, 0.7, 0.065], [x, 3.2, z], '#f3e7c3');
    box(scene, [0.07, 0.08, 0.9], [x, 3.55, 1.23], '#f3e7c3');
  }
  // The centre is an open landing for the rescue basket.
  for (const x of [0.48, 2.22]) box(scene, [0.68, 0.08, 0.07], [x, 3.55, 1.67], '#f3e7c3');
  balcony.name = 'second-floor-rescue-balcony';
  box(scene, [1.45, 0.14, 0.85], [5.05, 5.2, 0.9], '#d4dbc0');
  for (const [x, z] of [[-10, -5], [8.5, -4.4], [9, 1.7]]) {
    cylinder(scene, 0.14, 1.4, [x, 0.55, z], '#a78e6a', 7);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), material('#8aae89')); crown.position.set(x, 1.9, z); scene.add(crown);
  }
  for (const [x, z] of [[-5.5, -8], [1, -9], [8, -9]]) {
    box(scene, [3, 2.2, 2.3], [x, 0.95, z], '#d5d6b8'); box(scene, [3.2, 0.24, 2.5], [x, 2.15, z], '#a3b9a6');
    box(scene, [0.9, 0.8, 0.08], [x, 1.2, z + 1.2], '#9cbbbc');
  }
  const hydrant = new THREE.Group(); hydrant.position.set(HYDRANT.x, 0, HYDRANT.z); scene.add(hydrant);
  cylinder(hydrant, 0.25, 0.95, [0, 0.5, 0], '#d5866e'); cylinder(hydrant, 0.31, 0.12, [0, 0.97, 0], '#efc885');
  for (const x of [-0.32, 0.32]) { const outlet = cylinder(hydrant, 0.12, 0.22, [x, 0.68, 0], '#e8c58d'); outlet.rotation.z = Math.PI / 2; }
  const engine = createEngine(shapes), aerial = createLadder(shapes), ambulance = createAmbulance(shapes), stretcher = createStretcher(shapes);
  scene.add(engine.root, aerial.root, ambulance.root, stretcher.root);
  const connector = new THREE.Group(); scene.add(connector);
  cylinder(connector, 0.2, 0.45, [0, 0, 0], '#eacb8c').rotation.z = Math.PI / 2;
  cylinder(connector, 0.23, 0.1, [-0.2, 0, 0], '#7ca79f').rotation.z = Math.PI / 2;
  const connectorHit = shapes.hitbox(connector, [1.25, 1.1, 1.2], [0, 0, 0]);
  const hose = Array.from({ length: 20 }, () => cylinder(scene, 0.075, 1, [0, 0, 0], '#c3a479', 8));
  const hoseCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
  const resident = createPerson(shapes), cat = createCat(shapes); cat.root.scale.setScalar(1.2);
  const crew = createPerson(shapes, true), escort = createPerson(shapes, true), basketCrew = createPerson(shapes, true);
  basketCrew.root.scale.setScalar(0.82); basketCrew.root.position.set(-0.4, 0.14, -0.05); aerial.basket.add(basketCrew.root);
  scene.add(resident.root, cat.root, crew.root, escort.root);
  box(scene, [1.1, 0.14, 0.65], [-2.1, 0.44, 0.5], '#b59877');
  box(scene, [1.1, 0.62, 0.09], [-2.1, 0.8, 0.19], '#c9b08a');
  for (const x of [-2.52, -1.68]) box(scene, [0.1, 0.48, 0.1], [x, 0.22, 0.5], '#8c8f78');
  const flameGroups = FIRES.map((p, i) => {
    const root = new THREE.Group(); root.position.copy(vector(p)); scene.add(root);
    for (let k = 0; k < 3; k++) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.3, 7), material(k === 1 ? '#f5be63' : '#e28b59'));
      flame.position.set((k - 1) * 0.32, k === 1 ? 0.65 : 0.45, (k % 2) * 0.08); flame.rotation.z = (k - 1) * 0.15; root.add(flame);
      const core = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.76, 7), material('#ffe1a0')); core.position.set((k - 1) * 0.31, 0.3, 0.15); root.add(core);
    }
    const puddle = cylinder(scene, i === 3 ? 0.6 : 0.8, 0.02, [p.x, i === 3 ? 5.25 : 0.025, p.z], '#9dc8bd', 24);
    if (i !== 1 && i !== 3) { box(scene, [0.95, 0.35, 0.7], [p.x, 0.18, p.z], '#c5a682'); box(scene, [0.62, 0.23, 0.6], [p.x + 0.13, 0.46, p.z], '#d7b790'); }
    return { root, puddle };
  });
  const waterMaterial = new THREE.MeshBasicMaterial({ color: '#c3eef0', transparent: true, opacity: 0.75 });
  const steamMaterial = new THREE.MeshBasicMaterial({ color: '#fff8e5', transparent: true, opacity: 0.4, depthWrite: false });
  const water = Array.from({ length: 16 }, () => { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 1, 8), waterMaterial); scene.add(mesh); return mesh; });
  const droplets = Array.from({ length: 28 }, () => { const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 5), waterMaterial); scene.add(mesh); return mesh; });
  const steam = FIRES.flatMap((p, index) => Array.from({ length: 3 }, (_, i) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), steamMaterial); scene.add(mesh); return { mesh, p, index, i };
  }));
  const parking = new THREE.Group(); scene.add(parking);
  for (const z of [-1.3, 1.3]) box(parking, [6.2, 0.025, 0.09], [0, 0, z], '#fff2c8');
  for (const x of [-3.1, 3.1]) box(parking, [0.09, 0.025, 2.6], [x, 0, 0], '#fff2c8');
  const confetti = Array.from({ length: 24 }, (_, i) => box(scene, [0.12, 0.13, 0.055], [0, 0, 0], ['#e6b66b', '#85b8ad', '#df9a80'][i % 3]));
  const ray = new THREE.Raycaster();
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect(); if (!width || !height) return;
    const aspect = width / height, view = Math.max(15, 25 / aspect);
    camera.left = -view * aspect / 2; camera.right = view * aspect / 2; camera.top = view / 2; camera.bottom = -view / 2;
    camera.updateProjectionMatrix(); renderer.setSize(width, height);
  }); resize.observe(host);
  function screen(p: Point): ScreenPoint {
    camera.updateMatrixWorld(true); const bounds = canvas.getBoundingClientRect(), v = vector(p).project(camera);
    return { x: (v.x + 1) * bounds.width / 2, y: (1 - v.y) * bounds.height / 2 };
  }
  function local(p: ScreenPoint) { const r = canvas.getBoundingClientRect(); return { x: p.x - r.left, y: p.y - r.top }; }
  function setRay(x: number, y: number) {
    const r = canvas.getBoundingClientRect(); scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    ray.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, 1 - (y - r.top) / r.height * 2), camera);
  }
  function goalPoint(goal: Goal): Point {
    if (goal === 'hydrant') return HYDRANT;
    if (goal === 'roof') return raised(FIRES[3], 0.35);
    if (goal === 'patient') return raised(RESCUES[0].ground, 0.7);
    if (goal === 'ambulance') return raised(AMBULANCE_REAR, 0.25);
    return raised(RESCUES[goal === 'resident' ? 0 : 1].at, goal === 'resident' ? 0.65 : 0.45);
  }
  function handlePoint(s: FireState) {
    return s.phase === 'hose' ? s.hose : isBasket(s) ? raised(s.basket, 0.5) : raised(s.stretcher, 0.15);
  }
  function targets(s: FireState, pointer?: ScreenPoint, origin?: ScreenPoint) {
    const finger = pointer && local(pointer), anchor = screen(handlePoint(s));
    const moved = pointer && origin && Math.hypot(pointer.x - origin.x, pointer.y - origin.y) >= 18;
    const list = goals(s).map(id => {
      const p = screen(goalPoint(id));
      return { id, ...p, radius: 34, distance: finger ? Math.min(Math.hypot(finger.x - p.x, finger.y - p.y), Math.hypot(anchor.x - p.x, anchor.y - p.y)) : Infinity };
    });
    const closest = moved && s.action === 'dragging' ? [...list].sort((a, b) => a.distance - b.distance)[0] : undefined;
    return list.map(t => ({ ...t, accepted: t.id === closest?.id && t.distance <= 42 }));
  }
  function waterTarget(x: number, y: number, s: FireState) {
    const finger = local({ x, y }), choices = s.phase === 'roof-fire' ? [3] : [0, 1, 2];
    const nearest = choices.map(i => { const p = screen(raised(FIRES[i], 0.4)); return { i, distance: Math.hypot(p.x - finger.x, p.y - finger.y) }; }).sort((a, b) => a.distance - b.distance)[0];
    return nearest.distance <= 48 ? nearest.i : null;
  }
  return { canvas, screen, targets, waterTarget,
    hit(x: number, y: number, s: FireState) {
      if (isSpraying(s)) return waterTarget(x, y, s) !== null;
      setRay(x, y);
      const object = isDriving(s) ? (s.phase === 'dispatch' ? engine.hit : ambulance.hit) : s.phase === 'hose' ? connectorHit : isBasket(s) ? aerial.basketHit : stretcher.hit;
      const p = screen(isDriving(s) ? { x: s.truckX, y: 1.5, z: s.phase === 'dispatch' ? 2.3 : STREET_Z } : handlePoint(s));
      const finger = local({ x, y });
      return Math.hypot(p.x - finger.x, p.y - finger.y) <= 30 || ray.intersectObject(object).length > 0;
    },
    onPlane(x: number, y: number, vertical: boolean, value: number) {
      setRay(x, y); const normal = vertical ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      const p = ray.ray.intersectPlane(new THREE.Plane(normal, -value), new THREE.Vector3());
      return p ? { x: p.x, y: p.y, z: p.z } : undefined;
    },
    dragHint(s: FireState): DragHint | undefined {
      if (s.action !== 'ready' || s.phase === 'complete') return;
      if (isDriving(s)) {
        const z = s.phase === 'dispatch' ? 2.3 : STREET_Z;
        return { from: screen({ x: s.truckX, y: 1.5, z }), to: screen({ x: s.phase === 'dispatch' ? ENGINE_STOP : STREET_STOP, y: 1.5, z }), direction: 'right', label: '按住車子，拖到停車位' };
      }
      if (isSpraying(s)) {
        const index = s.phase === 'roof-fire' ? 3 : s.fires.findIndex((heat, i) => i < 3 && heat > 0);
        if (index < 0) return;
        const point = screen(raised(FIRES[index], 0.4));
        return { from: point, to: point, direction: 'up', label: '按住火苗，水柱跟著手指走' };
      }
      const target = goals(s)[0]; if (!target) return;
      return { from: screen(handlePoint(s)), to: screen(goalPoint(target)), direction: s.phase === 'boarding' ? 'right' : 'up', label: s.phase === 'rescue' ? '拖工作籃，接居民或小貓' : '拖到目的地，幫你接好' };
    },
    render(s: FireState, time: number) {
      const index = stages.indexOf(s.phase), t = s.elapsed;
      const engineExit = s.phase === 'stowing' ? smooth((t - 0.7) / 1.8) : 0;
      engine.root.visible = index <= 7;
      engine.root.position.set(s.phase === 'dispatch' ? s.truckX - (s.action === 'entering' ? 6 * (1 - smooth(t / 1.1)) : 0) : ENGINE_STOP - engineExit * 15, 0, 2.3);
      engine.roll(engine.root.position.x); engine.beacon(time, index <= 5);
      aerial.root.visible = index >= 3 && index <= 7;
      const aerialX = s.phase === 'ladder-arrival' ? STREET_STOP - 17 * (1 - smooth(t / 1.4)) : s.phase === 'stowing' ? STREET_STOP + 17 * smooth((t - 1) / 1.8) : STREET_STOP;
      aerial.root.position.set(aerialX, 0, STREET_Z); aerial.roll(aerialX); aerial.beacon(time, index >= 3 && index <= 6);
      let basket = vector(s.basket), deployed = 1;
      if (s.phase === 'ladder-arrival') {
        const stowed = { ...BASKET_STOWED, x: BASKET_STOWED.x + aerialX - STREET_STOP };
        basket = vector(mix(stowed, BASKET_HOME, smooth((t - 1.4) / 1.2))); deployed = smooth((t - 1.1) / 0.6);
      }
      if (s.phase === 'stowing') {
        basket = vector(mix(BASKET_HOME, BASKET_STOWED, smooth(t / 0.85))); basket.x += aerialX - STREET_STOP;
        deployed = 1 - smooth((t - 0.6) / 0.35);
      }
      aerial.pose(basket, deployed);
      ambulance.root.visible = index >= 8 && index <= 11;
      const ambulanceX = s.phase === 'ambulance' ? s.truckX - (s.action === 'entering' ? 6 * (1 - smooth(t / 1.1)) : 0) : STREET_STOP + (s.phase === 'departure' ? 18 * smooth((t - 0.7) / 2.5) : 0);
      ambulance.root.position.set(ambulanceX, 0, STREET_Z); ambulance.roll(ambulanceX); ambulance.beacon(time, index >= 8 && index <= 11);
      const doorOpen = s.phase === 'ambulance' && s.action === 'working' ? smooth(t / 0.6) : s.phase === 'stretcher' || s.phase === 'boarding' ? 1 : s.phase === 'departure' ? 1 - smooth(t / 0.6) : 0;
      ambulance.open(doorOpen);
      stretcher.root.visible = s.phase === 'stretcher' || s.phase === 'boarding'; stretcher.root.position.copy(vector(s.stretcher));
      stretcher.occupied(s.phase === 'boarding' || (s.phase === 'stretcher' && s.action === 'working' && t >= 1));
      connector.visible = index >= 1 && index <= 7;
      connector.position.copy(vector(index >= 2 ? HYDRANT : s.hose));
      const enginePort = new THREE.Vector3(engine.root.position.x - 1.4, 1.25, 3.32);
      const hoseEnd = connector.position.clone();
      if (s.phase === 'stowing') { hoseEnd.lerp(enginePort, smooth(t / 0.65)); connector.position.copy(hoseEnd); }
      hoseCurve.points = [enginePort, new THREE.Vector3(enginePort.x - 0.5, 0.16, 3.7), new THREE.Vector3(hoseEnd.x + 0.5, 0.12, hoseEnd.z + 0.4), hoseEnd];
      hose.forEach((segment, i) => { segment.visible = connector.visible && engineExit === 0; if (segment.visible) link(segment, hoseCurve.getPoint(i / hose.length), hoseCurve.getPoint((i + 1) / hose.length)); });
      connector.visible &&= engineExit === 0;
      parking.visible = isDriving(s); parking.position.set(s.phase === 'dispatch' ? ENGINE_STOP : STREET_STOP, 0.04, s.phase === 'dispatch' ? 2.3 : STREET_Z);
      flameGroups.forEach(({ root, puddle }, i) => {
        root.visible = s.fires[i] > 0;
        root.scale.set(0.3 + s.fires[i] * 0.7, (0.25 + s.fires[i] * 0.75) * (0.92 + Math.sin(time * 6 + i) * 0.08), 0.3 + s.fires[i] * 0.7);
        puddle.visible = s.fires[i] < 1; puddle.scale.setScalar(Math.max(0.05, 1 - s.fires[i]));
      });
      engine.aim(vector(s.aim));
      const spraying = isSpraying(s) && s.action === 'dragging';
      const source = s.phase === 'roof-fire' ? basket.clone().add(new THREE.Vector3(0.48, 1.1, -0.65)) : engine.nozzle;
      const destination = vector(s.aim);
      const arc = (u: number) => source.clone().lerp(destination, u).add(new THREE.Vector3(0, Math.sin(u * Math.PI) * (s.phase === 'roof-fire' ? 0.15 : 0.75), 0));
      water.forEach((jet, i) => { jet.visible = spraying; if (spraying) link(jet, arc(i / water.length), arc((i + 1) / water.length)); });
      droplets.forEach((drop, i) => {
        drop.visible = spraying;
        if (spraying) { const u = (time * 1.7 + i / droplets.length) % 1; drop.position.copy(arc(u)).add(new THREE.Vector3(Math.sin(i * 5) * u * 0.22, Math.sin(i * 7 + time * 8) * u * 0.12, Math.cos(i * 7) * u * 0.22)); }
      });
      steam.forEach(({ mesh, p, index: i, i: j }) => {
        mesh.visible = isSpraying(s) && s.fires[i] < 0.95;
        const rise = (time * 0.8 + j / 3) % 1; mesh.position.set(p.x + Math.sin(j * 5) * 0.4, p.y + rise * 1.4, p.z); mesh.scale.setScalar((0.25 + rise) * (1 - s.fires[i]));
      });
      RESCUES.forEach((r, i) => {
        const object = i === 0 ? resident.root : cat.root;
        object.visible = !(i === 0 && (index >= 10 || (s.phase === 'stretcher' && s.action === 'working' && t >= 1)));
        let position: Point = s.rescued[i] ? r.ground : r.at;
        if (s.phase === 'rescue' && s.passenger === r.id) {
          const aboard = { x: s.basket.x + 0.23, y: s.basket.y + 0.12, z: s.basket.z };
          position = s.action === 'working' ? mix(r.at, aboard, smooth((t - 0.5) / 0.6)) : s.action === 'unloading' ? mix(aboard, r.ground, smooth(t / 0.8)) : aboard;
        }
        object.rotation.z = 0;
        if (i === 0 && s.phase === 'stretcher' && s.action === 'working') {
          const lift = smooth((t - 0.4) / 0.6);
          position = mix(r.ground, { x: s.stretcher.x + 0.4, y: s.stretcher.y + 0.35, z: s.stretcher.z }, lift);
          object.rotation.z = Math.PI / 2 * lift;
        }
        object.position.copy(vector(position));
        if (i === 0) object.scale.y = s.rescued[0] ? 0.84 : 1;
      });
      resident.arm.rotation.z = s.rescued[0] ? -0.25 : -2.25 + Math.sin(time * 3) * 0.2;
      cat.tail.rotation.y = Math.sin(time * 2) * 0.35;
      const celebration = s.phase === 'complete';
      crew.root.position.set(celebration ? 1.9 : -8.9, 0, celebration ? 2.2 : 0.1);
      crew.arm.rotation.z = celebration ? -2.2 + Math.sin(time * 4) * 0.4 : -0.25;
      escort.root.visible = s.rescued[0] || celebration;
      escort.root.position.set(celebration ? 3.5 : -2.95, 0, celebration ? 2 : 0.5);
      if (s.phase === 'stretcher' || s.phase === 'boarding') {
        escort.root.position.set(s.stretcher.x + 0.1, 0, s.stretcher.z + 0.85);
        escort.root.visible = !(s.phase === 'boarding' && s.action === 'working' && t > 0.5);
      }
      escort.arm.rotation.z = celebration ? -2.2 + Math.sin(time * 4 + 1) * 0.4 : -0.3;
      confetti.forEach((piece, i) => { piece.visible = celebration; const u = (time * 0.22 + i / confetti.length) % 1; piece.position.set(3 + Math.sin(i * 5) * 3.4, 7 - u * 6, 1 + Math.cos(i * 7) * 2); piece.rotation.set(time + i, time, i); piece.scale.setScalar(Math.sin(u * Math.PI)); });
      renderer.render(scene, camera);
    },
    dispose() {
      resize.disconnect(); const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m); } });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); shapes.disposeMaterials(); sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
