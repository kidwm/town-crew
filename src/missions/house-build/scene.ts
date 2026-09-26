import * as THREE from 'three';
import { createShapes } from '../../runtime/geometry.ts';
import { createDump, createMixer, createFlatbed, createCrane, link } from './vehicles.ts';
import { HOUSE, PARTS, LOAD_HOME, POUR_TARGETS, DELIVERY_START, DELIVERY_STOP, isCrane, isDelivery, leavingDuration, smooth, partFor, pourIndex } from './domain/house.ts';
import type { HouseState, Point } from './domain/house.ts';
import { CRANE_TARGET_RADIUS, convexOutline, craneTargetReached } from './domain/crane-target.ts';
import type { ScreenPoint } from './domain/crane-target.ts';
import { siteX } from './domain/round.ts';
import { createHouseParts } from './house-model.ts';
import { createResidents } from './residents.ts';
import { createGarage } from './garage.ts';
import type { DragHint } from '../../runtime/drag-hint.ts';

export function createHouseScene(host: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor('#d2e8e5');
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', '蓋房子工地：拖車斗倒砂石、移動出料槽、運送材料和吊裝兩層樓');
  host.append(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 100);
  camera.position.set(8, 10, 18); camera.lookAt(0, 1.8, 0.5);
  scene.add(new THREE.HemisphereLight('#fff9ec', '#97ab91', 2.5));
  const sun = new THREE.DirectionalLight('#fff1d3', 2.7); sun.position.set(-7, 14, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = 0.04;
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, far: 45 }); scene.add(sun);
  const site = new THREE.Group(); scene.add(site);
  const shapes = createShapes(); const { box, cylinder, material } = shapes;
  box(site, [70, 0.5, 70], [0, -0.5, 0], '#b7cf9e');
  box(site, [17.5, 0.12, 8], [0, -0.15, -0.2], '#e2cea7');
  box(site, [70, 0.09, 3.2], [0, -0.13, 5.1], '#c8b393');
  for (let x = -14; x < 16; x += 2) box(site, [0.85, 0.02, 0.08], [x, -0.075, 6.3], '#f9ebc7');
  // Fences stay behind the site; the full foreground vehicle lane remains open.
  for (const x of [-7.7, -5.4, -3.1, -0.8, 1.5, 3.8, 6.1, 8.4]) {
    box(site, [2.3, 0.1, 0.12], [x, 0.6, -6.3], '#b7a888');
    box(site, [2.3, 0.1, 0.12], [x, 1, -6.3], '#c2b494');
    box(site, [0.15, 1.3, 0.15], [x - 1.05, 0.5, -6.3], '#a09275');
  }
  for (const [x, z, scale] of [[-9, -7.5, 1.2], [8, -4, 1.1], [9, 2, 0.8]]) {
    const tree = new THREE.Group(); tree.position.set(x, 0, z); tree.scale.setScalar(scale); site.add(tree);
    cylinder(tree, 0.14, 1.4, [0, 0.6, 0], '#a08761', 7);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), material('#84ab86')); crown.position.y = 2; tree.add(crown);
  }
  for (const [x, z] of [[-4, -9], [1.5, -10], [7, -9]]) {
    box(site, [2.7, 2, 2.1], [x, 0.85, z], '#e1d7b7');
    box(site, [2.9, 0.24, 2.3], [x, 1.95, z], '#b7c6b0');
    box(site, [0.7, 0.75, 0.04], [x, 1.1, z + 1.07], '#a0bcbc');
  }
  box(site, [4.9, 0.08, 4.1], [HOUSE.x, -0.025, HOUSE.z], '#897d63');
  for (const z of [-2.47, 1.67]) box(site, [5.05, 0.27, 0.12], [HOUSE.x, 0.11, z], '#c49f72');
  for (const x of [-0.5, 4.5]) box(site, [0.12, 0.27, 4.2], [x, 0.11, HOUSE.z], '#c49f72');
  const gravelFill = box(site, [4.8, 0.17, 4], [HOUSE.x, 0.08, HOUSE.z], '#b0a285');
  const stones = Array.from({ length: 35 }, (_, i) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09 + (i % 3) * 0.025), material('#c4b797'));
    rock.position.set(0 + (i % 7) * 0.65, 0.2, -1.9 + Math.floor(i / 7) * 0.7); site.add(rock); return rock;
  });
  const slabs = POUR_TARGETS.map(p => box(site, [1.58, 0.18, 4], [p.x, 0.25, p.z], '#b9c5bc'));
  const completeSlab = box(site, [4.8, 0.2, 4], [HOUSE.x, 0.25, HOUSE.z], '#c5cdbf');
  const pourSurface = (state: HouseState, index: number) => state.pours[index] > 0 ? 0.36 : 0.185;
  const pourZones = POUR_TARGETS.map(p => {
    const root = new THREE.Group(); root.position.set(p.x, 0, p.z); site.add(root);
    for (const x of [-0.79, 0.79]) box(root, [0.035, 0.015, 4], [x, 0, 0], '#e8dec1');
    for (const z of [-2, 2]) box(root, [1.58, 0.015, 0.035], [0, 0, z], '#e8dec1');
    return root;
  });
  const home = createHouseParts(shapes, site);
  const { parts, ghosts } = home;
  const roofPickup = new THREE.Vector3(-0.55, 1.3, 5.1);
  const loadHit = shapes.hitbox(site, [4.8, 2.8, 4], [0, 0, 0]);
  const slingA = cylinder(site, 0.022, 1, [0, 0, 0], '#65796b', 8);
  const slingB = cylinder(site, 0.022, 1, [0, 0, 0], '#65796b', 8);
  const dump = createDump(shapes), mixer = createMixer(shapes), flatbed = createFlatbed(shapes), crane = createCrane(shapes);
  site.add(dump.root, mixer.root, flatbed.root, crane.root);
  const chute = box(site, [0.36, 1, 0.25], [0, 0, 0], '#8faaa4');
  const chuteTip = cylinder(site, 0.26, 0.22, [0, 0, 0], '#ecd092', 16);
  const chuteHit = shapes.hitbox(chuteTip, [1.1, 1.1, 1.1], [0, 0, 0]);
  const particles = Array.from({ length: 18 }, () => box(site, [0.12, 0.12, 0.12], [0, 0, 0], '#bdab8a'));
  const stream = cylinder(site, 0.09, 0.8, [0, 0, 0], '#b8c5bd', 12);
  const rings = POUR_TARGETS.map(target => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.83, 36), new THREE.MeshBasicMaterial({ color: '#fff2b4', side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(target.x, 0.185, target.z); site.add(ring); return ring;
  });
  const trail = Array.from({ length: 7 }, () => {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 6), new THREE.MeshBasicMaterial({ color: '#fff5d3' })); site.add(dot); return dot;
  });
  const parking = new THREE.Group(); site.add(parking);
  for (const z of [3.86, 6.34]) box(parking, [6.2, 0.03, 0.08], [DELIVERY_STOP + 0.55, -0.04, z], '#fff1c7');
  for (const x of [-2.05, 4.15]) box(parking, [0.08, 0.03, 2.5], [x, -0.04, 5.1], '#fff1c7');
  const confetti = Array.from({ length: 28 }, (_, i) => box(site, [0.12, 0.12, 0.06], [0, 0, 0], ['#e8b964', '#85b5ac', '#d88770'][i % 3]));
  const residents = createResidents(shapes, site);
  const garage = createGarage(shapes, site);
  const ray = new THREE.Raycaster();
  function setRay(x: number, y: number) {
    const rect = canvas.getBoundingClientRect();
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    ray.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), camera);
  }
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect(); if (!width || !height) return;
    const aspect = width / height, view = Math.max(14.5, 24 / aspect);
    camera.left = -view * aspect / 2; camera.right = view * aspect / 2; camera.top = view / 2; camera.bottom = -view / 2;
    camera.updateProjectionMatrix(); renderer.setSize(width, height);
  }); resize.observe(host);
  return {
    canvas,
    dragHint(state: HouseState): DragHint | undefined {
      if (state.action !== 'ready') return;
      const bounds = canvas.getBoundingClientRect();
      const project = (x: number, y: number, z: number) => {
        const point = new THREE.Vector3(siteX(state.round, x), y, z).project(camera);
        return { x: (point.x + 1) * bounds.width / 2, y: (1 - point.y) * bounds.height / 2 };
      };
      if (state.phase === 'gravel') {
        const from = dump.grip.project(camera, canvas);
        return { from, to: { x: from.x, y: from.y - 80 }, direction: 'up', label: '按住車斗前端，往上拉' };
      }
      if (isDelivery(state)) return { from: project(state.truckX, 1.5, 5.1), to: project(DELIVERY_STOP, 1.5, 5.1), direction: state.round.layout === 0 ? 'right' : 'left', label: `按住車子，往${state.round.layout === 0 ? '右' : '左'}拖到停車位` };
    },
    craneDropTarget(state: HouseState, pointer?: ScreenPoint, origin?: ScreenPoint) {
      const bounds = canvas.getBoundingClientRect();
      const part = partFor(state.round, state.placed);
      camera.updateMatrixWorld(true);
      const project = (x: number, y: number, z: number) => {
        const point = new THREE.Vector3(siteX(state.round, x), y, z).project(camera);
        return { x: (point.x + 1) * bounds.width / 2, y: (1 - point.y) * bounds.height / 2 };
      };
      const footprint = [[-2.4, -2], [2.4, -2], [2.4, 2], [-2.4, 2]].map(([x, z]) => project(HOUSE.x + x, part.base + 0.03, HOUSE.z + z));
      const top = [[-2.4, -2], [2.4, -2], [2.4, 2], [-2.4, 2]].map(([x, z]) => project(HOUSE.x + x, part.base + part.height, HOUSE.z + z));
      const target = project(HOUSE.x, part.base + 0.03, HOUSE.z);
      const raised = project(HOUSE.x, part.lift + part.height / 2, HOUSE.z);
      const accepted = state.action === 'dragging' && !!pointer && !!origin && craneTargetReached(
        { x: pointer.x - bounds.left, y: pointer.y - bounds.top }, project(state.load.x, part.lift + part.height / 2, state.load.z),
        { assembly: convexOutline([...footprint, ...top]), raised }, { x: origin.x - bounds.left, y: origin.y - bounds.top },
      );
      return { ...target, footprint, radius: CRANE_TARGET_RADIUS, accepted };
    },
    hit(x: number, y: number, state: HouseState) {
      setRay(x, y);
      if (state.phase === 'gravel' && dump.grip.hit(x, y, camera, canvas)) return true;
      const target = state.phase === 'gravel' ? dump.hit : state.phase === 'concrete' ? chuteHit : isDelivery(state) ? flatbed.hit : isCrane(state) ? loadHit : undefined;
      return !!target && ray.intersectObject(target).length > 0;
    },
    onPlane(x: number, y: number, height: number) {
      setRay(x, y);
      const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -height), new THREE.Vector3());
      return p ? { x: p.x * site.scale.x, z: p.z } : undefined;
    },
    concreteAim(x: number, y: number, state: HouseState, aim: Point): Point {
      setRay(x, y);
      // Prefer the finger on an unfinished ground region; an elevated outlet
      // also works. Each partially filled region retains its own surface height.
      let nearest = -1, distance = Infinity;
      state.pours.forEach((value, i) => {
        if (value >= 1) return;
        const ground = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -pourSurface(state, i)), new THREE.Vector3());
        if (!ground) return;
        const point = { x: siteX(state.round, ground.x), z: ground.z }, target = POUR_TARGETS[i];
        const d = Math.hypot(point.x - target.x, point.z - target.z);
        if (pourIndex(state, point) === i && d < distance) { nearest = i; distance = d; }
      });
      const index = nearest >= 0 ? nearest : pourIndex(state, aim);
      return index >= 0 ? { ...POUR_TARGETS[index] } : aim;
    },
    render(s: HouseState, time: number) {
      site.scale.x = siteX(s.round, 1); home.update(s); residents.update(s, time); garage.update(s);
      const craneStage = isCrane(s), delivery = isDelivery(s), roofChoosing = s.phase === 'roof-color';
      const finishing = s.action === 'finishing';
      const interactive = s.action === 'ready' || s.action === 'dragging';
      const arriving = s.action === 'entering' ? 1 - smooth(s.elapsed / 1.2) : 0;
      const departing = s.action === 'leaving' ? smooth(s.elapsed / leavingDuration(s)) : 0;
      const craneLeaving = s.phase === 'crane-two' && s.action === 'leaving';
      const craneTravel = craneLeaving ? smooth((s.elapsed - 0.9) / (leavingDuration(s) - 0.9)) : 0;
      crane.root.visible = s.phase !== 'decorate' && s.phase !== 'complete' && !(s.phase === 'crane-two' && finishing);
      // The rear service lane clears the garage, its pillars and the fence.
      crane.root.position.set(-2.6 - craneTravel * 17, 0, -4.2);
      crane.retract(craneLeaving ? smooth((s.elapsed - 0.5) / 0.4) : 0);
      crane.roll(-craneTravel * 17);
      dump.root.visible = s.phase === 'gravel' && !finishing; dump.root.position.set(-2.6 - arriving * 12 - departing * 12, 0, 0); dump.roll(dump.root.position.x);
      dump.bed.rotation.z = s.action === 'dragging' ? -s.dragPx / 60 * 0.85 : s.action === 'working' ? -0.95 : s.action === 'leaving' ? -0.95 * (1 - Math.min(s.elapsed * 3, 1)) : 0;
      dump.cargo.scale.y = Math.max(0.01, 1 - s.gravel); dump.cargo.visible = s.gravel < 1;
      gravelFill.scale.x = Math.max(0.001, s.gravel); gravelFill.visible = s.gravel > 0;
      stones.forEach((stone, i) => {
        const zone = Math.min(2, Math.max(0, Math.floor((stone.position.x - (HOUSE.x - 2.4)) / 1.6)));
        stone.visible = s.gravel > (i + 1) / 36 && s.pours[zone] < 1;
      });
      slabs.forEach((slab, i) => { slab.visible = s.pours[i] > 0; slab.scale.z = Math.max(0.001, s.pours[i]); });
      pourZones.forEach((zone, i) => { zone.visible = s.phase === 'concrete' && s.pours[i] < 1; zone.position.y = pourSurface(s, i); });
      completeSlab.visible = s.pours.every(v => v >= 1);
      mixer.root.visible = s.phase === 'concrete' && !finishing; mixer.root.position.set(-3.2 - arriving * 12 - departing * 12, 0, 0.3); mixer.roll(mixer.root.position.x); mixer.drum.rotation.y = time * 1.1;
      chute.visible = chuteTip.visible = s.phase === 'concrete' && !finishing && arriving === 0 && departing === 0;
      chuteTip.position.set(s.chute.x, 1.1, s.chute.z);
      link(chute, new THREE.Vector3(-1.6, 1.82, 0.3), chuteTip.position);
      const pouring = s.phase === 'concrete' && s.action === 'dragging' && pourIndex(s) >= 0;
      stream.visible = pouring; stream.position.set(s.chute.x, 0.65, s.chute.z);
      particles.forEach((particle, i) => {
        particle.visible = s.phase === 'gravel' && s.action === 'working' && s.gravel < 1;
        const t = (time * 1.4 + i / particles.length) % 1;
        particle.position.set(-1.05 + t * 3.6, 1.3 * (1 - t * t), Math.sin(i * 4) * t * 1.5);
        particle.rotation.set(time + i, time * 2, i);
      });
      flatbed.root.visible = (delivery || craneStage || roofChoosing) && !finishing;
      const truckX = delivery ? s.truckX - arriving * 10 : DELIVERY_STOP + departing * 15;
      flatbed.root.position.set(truckX, 0, 5.1); flatbed.root.rotation.y = Math.PI; flatbed.roll(-truckX);
      const delivered = s.placed % 3;
      flatbed.cargo.forEach((cargo, i) => { cargo.visible = delivery || (s.action !== 'leaving' && i < 2 - delivered); });
      parking.visible = delivery;
      const currentPart = Math.min(s.placed, 5), definition = partFor(s.round, currentPart);
      const load = new THREE.Vector3(s.load.x, definition.lift, s.load.z);
      if (s.action === 'pickup' && craneStage) {
        const t = smooth(s.elapsed / 1.25);
        // Lift above the parked transporter, then carry into the working plane.
        const rise = smooth(s.elapsed / 0.6), carry = smooth((s.elapsed - 0.6) / 0.65);
        const origin = currentPart === 5 ? roofPickup : new THREE.Vector3(0.75, 1.85, 5.1);
        load.set(origin.x + (LOAD_HOME.x - origin.x) * carry, origin.y + (definition.lift - origin.y) * rise, origin.z + (LOAD_HOME.z - origin.z) * carry);
        if (t >= 1) load.set(LOAD_HOME.x, definition.lift, LOAD_HOME.z);
      }
      if (s.action === 'placing') {
        const align = smooth(s.elapsed / 0.35), lower = smooth((s.elapsed - 0.35) / 0.8);
        load.set(s.from.x + (HOUSE.x - s.from.x) * align, definition.lift + (definition.base - definition.lift) * lower, s.from.z + (HOUSE.z - s.from.z) * align);
      }
      const holding = craneStage && s.action !== 'leaving' && !finishing;
      parts.forEach((piece, i) => {
        piece.visible = i < s.placed || (holding && i === s.placed) || (roofChoosing && i === 5);
        piece.position.set(HOUSE.x, PARTS[i].base, HOUSE.z);
        if (holding && i === s.placed) piece.position.copy(load);
        if (roofChoosing && i === 5) piece.position.copy(roofPickup);
      });
      ghosts.forEach((ghost, i) => { ghost.visible = holding && i === s.placed && s.action !== 'placing'; ghost.position.set(HOUSE.x, PARTS[i].base, HOUSE.z); });
      loadHit.scale.y = (definition.height + 0.6) / 2.8;
      loadHit.position.copy(load).add(new THREE.Vector3(0, definition.height / 2, 0));
      if (craneLeaving) {
        const fold = smooth(s.elapsed / 0.6);
        const stowed = crane.root.position.clone().add(new THREE.Vector3(-1.2, 1.8, 0));
        const lastLoad = new THREE.Vector3(HOUSE.x, definition.base, HOUSE.z).lerp(stowed, fold);
        crane.aim(lastLoad, definition.height + (0.3 - definition.height) * fold);
      } else crane.aim(holding ? load : new THREE.Vector3(-3.3, 2.2, -2.6), holding ? definition.height : 0.3);
      slingA.visible = slingB.visible = holding;
      const hook = load.clone().add(new THREE.Vector3(0, definition.height + 0.2, 0));
      link(slingA, hook, load.clone().add(new THREE.Vector3(-1.3, definition.height - 0.05, 0)));
      link(slingB, hook, load.clone().add(new THREE.Vector3(1.3, definition.height - 0.05, 0)));
      let hintFrom: THREE.Vector3 | undefined, hintTo: THREE.Vector3 | undefined;
      if (interactive && craneStage) {
        hintFrom = load.clone().add(new THREE.Vector3(0, definition.height / 2, 0)); hintTo = new THREE.Vector3(HOUSE.x, definition.base + 0.03, HOUSE.z);
      }
      // All unfinished concrete regions are equally available; no forced first target.
      rings.forEach((ring, i) => {
        ring.visible = interactive && s.phase === 'concrete' && s.pours[i] < 1;
        ring.position.y = pourSurface(s, i);
        ring.scale.setScalar(1 + Math.sin(time * 3) * 0.04);
        ring.material.color.set(pouring && pourIndex(s) === i ? '#bfe0a1' : '#fff2b4');
      });
      trail.forEach((dot, i) => {
        dot.visible = !!hintFrom && !!hintTo && s.action === 'ready';
        if (hintFrom && hintTo) { const t = (time * 0.4 + i / 9) % 1; dot.position.copy(hintFrom).lerp(hintTo, t); dot.scale.setScalar(Math.sin(t * Math.PI)); }
      });
      confetti.forEach((piece, i) => {
        piece.visible = s.phase === 'complete' || (s.phase === 'crane-one' && s.action === 'leaving');
        const t = (time * 0.25 + i / confetti.length) % 1;
        piece.position.set(HOUSE.x + Math.sin(i * 5) * 3.1, 7 - t * 6, HOUSE.z + Math.cos(i * 7) * 2);
        piece.rotation.set(time + i, time, i); piece.scale.setScalar(Math.sin(t * Math.PI));
      });
      renderer.render(scene, camera);
    },
    dispose() {
      resize.disconnect();
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
      scene.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m); } });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); shapes.disposeMaterials(); sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
