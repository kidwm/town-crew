import * as THREE from 'three';
import { createShapes } from '../../runtime/geometry.ts';
import { createDump, createMixer, createFlatbed, createCrane, link } from './vehicles.ts';
import { HOUSE, PARTS, LOAD_HOME, POUR_TARGETS, ROOF_COLORS, DELIVERY_START, DELIVERY_STOP, isCrane, isDelivery, leavingDuration, smooth } from './domain/house.ts';
import type { HouseState } from './domain/house.ts';
import { CRANE_TARGET_RADIUS, craneTargetReached } from './domain/crane-target.ts';
import type { ScreenPoint } from './domain/crane-target.ts';
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
  const shapes = createShapes(); const { box, cylinder, material } = shapes;
  box(scene, [70, 0.5, 70], [0, -0.5, 0], '#b7cf9e');
  box(scene, [17.5, 0.12, 8], [0, -0.15, -0.2], '#e2cea7');
  box(scene, [70, 0.09, 3.2], [0, -0.13, 5.1], '#c8b393');
  for (let x = -14; x < 16; x += 2) box(scene, [0.85, 0.02, 0.08], [x, -0.075, 6.3], '#f9ebc7');
  // Fences stay behind the site; the full foreground vehicle lane remains open.
  for (const x of [-7.7, -5.4, -3.1, -0.8, 1.5, 3.8, 6.1, 8.4]) {
    box(scene, [2.3, 0.1, 0.12], [x, 0.6, -6.3], '#b7a888');
    box(scene, [2.3, 0.1, 0.12], [x, 1, -6.3], '#c2b494');
    box(scene, [0.15, 1.3, 0.15], [x - 1.05, 0.5, -6.3], '#a09275');
  }
  for (const [x, z, scale] of [[-9, -5, 1.2], [8, -4, 1.1], [9, 2, 0.8]]) {
    const tree = new THREE.Group(); tree.position.set(x, 0, z); tree.scale.setScalar(scale); scene.add(tree);
    cylinder(tree, 0.14, 1.4, [0, 0.6, 0], '#a08761', 7);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 1), material('#84ab86')); crown.position.y = 2; tree.add(crown);
  }
  for (const [x, z] of [[-4, -9], [1.5, -10], [7, -9]]) {
    box(scene, [2.7, 2, 2.1], [x, 0.85, z], '#e1d7b7');
    box(scene, [2.9, 0.24, 2.3], [x, 1.95, z], '#b7c6b0');
    box(scene, [0.7, 0.75, 0.04], [x, 1.1, z + 1.07], '#a0bcbc');
  }
  box(scene, [4.9, 0.08, 4.1], [HOUSE.x, -0.025, HOUSE.z], '#897d63');
  for (const z of [-2.47, 1.67]) box(scene, [5.05, 0.27, 0.12], [HOUSE.x, 0.11, z], '#c49f72');
  for (const x of [-0.5, 4.5]) box(scene, [0.12, 0.27, 4.2], [x, 0.11, HOUSE.z], '#c49f72');
  const gravelFill = box(scene, [4.8, 0.17, 4], [HOUSE.x, 0.08, HOUSE.z], '#b0a285');
  const stones = Array.from({ length: 35 }, (_, i) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09 + (i % 3) * 0.025), material('#c4b797'));
    rock.position.set(0 + (i % 7) * 0.65, 0.2, -1.9 + Math.floor(i / 7) * 0.7); scene.add(rock); return rock;
  });
  const slabs = POUR_TARGETS.map(p => box(scene, [1.58, 0.18, 4], [p.x, 0.25, p.z], '#b9c5bc'));
  const completeSlab = box(scene, [4.8, 0.2, 4], [HOUSE.x, 0.25, HOUSE.z], '#c5cdbf');
  const windows: THREE.Mesh[] = [];
  function part(index: number, ghost = false) {
    const root = new THREE.Group(); root.name = `house-part-${index}`;
    const definition = PARTS[index];
    const wallColor = index >= 3 ? '#f2dfbb' : '#ead0a4';
    const front = definition.kind === 'front';
    if (definition.kind === 'front' || definition.kind === 'back') {
      const z = front ? 1.6 : -1.6, x = front ? -2 : 2;
      box(root, [4.2, 2, 0.18], [0, 1, z], wallColor);
      box(root, [0.18, 2, 3.2], [x, 1, 0], wallColor);
      box(root, [4.3, 0.1, 0.25], [0, 1.96, z], '#fff0d2');
      box(root, [0.25, 0.1, 3.25], [x, 1.96, 0], '#fff0d2');
      for (const wx of [-1.1, 1.1]) {
        if (index === 0 && wx < 0) {
          box(root, [0.95, 1.66, 0.11], [wx, 0.84, z + 0.1], '#fff0d2');
          box(root, [0.75, 1.5, 0.13], [wx, 0.77, z + 0.17], '#829f8b');
          const knob = cylinder(root, 0.045, 0.06, [wx + 0.24, 0.84, z + 0.26], '#fbe4a5', 10); knob.rotation.x = Math.PI / 2;
        } else {
          box(root, [0.98, 1.06, 0.12], [wx, 1.15, z + (front ? 0.1 : -0.1)], '#fff0d2');
          const glass = box(root, [0.77, 0.86, 0.14], [wx, 1.15, z + (front ? 0.15 : -0.15)], '#91b9ba');
          if (!ghost) windows.push(glass);
          box(root, [0.045, 0.88, 0.17], [wx, 1.15, z + (front ? 0.2 : -0.2)], '#f9ebc8');
        }
      }
      for (const wz of [-0.85, 0.85]) {
        box(root, [0.12, 1.06, 0.85], [x + (front ? -0.1 : 0.1), 1.15, wz], '#fff0d2');
        const glass = box(root, [0.14, 0.84, 0.65], [x + (front ? -0.15 : 0.15), 1.15, wz], '#91b9ba');
        if (!ghost) windows.push(glass);
      }
    } else if (definition.kind === 'floor') {
      box(root, [4.4, 0.22, 3.6], [0, 0.11, 0], '#d3d4bd');
      box(root, [4.45, 0.08, 3.65], [0, 0.21, 0], '#f9eccd');
    } else {
      const outline = new THREE.Shape(); outline.moveTo(-2.35, 0); outline.lineTo(0, 1.2); outline.lineTo(2.35, 0); outline.closePath();
      const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: 3.9, bevelEnabled: false }), material(ROOF_COLORS[0]));
      roof.position.z = -1.95; roof.castShadow = roof.receiveShadow = true; root.add(roof);
      for (const x of [-1, 1]) {
        const eave = box(root, [2.7, 0.09, 4.05], [x * 1.18, 0.59, 0], '#e4a082'); eave.rotation.z = -x * 0.472;
        eave.name = 'roof-slope';
      }
    }
    if (ghost) root.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.material = new THREE.MeshBasicMaterial({ color: '#fff2bd', transparent: true, opacity: 0.23, depthWrite: false });
        object.castShadow = object.receiveShadow = false;
      }
    });
    scene.add(root); return root;
  }
  const parts = PARTS.map((_, i) => part(i));
  const roofPickup = new THREE.Vector3(-0.55, 1.3, 5.1);
  const ghosts = PARTS.map((_, i) => part(i, true));
  const loadHit = shapes.hitbox(scene, [4.8, 2.8, 4], [0, 0, 0]);
  const slingA = cylinder(scene, 0.022, 1, [0, 0, 0], '#65796b', 8);
  const slingB = cylinder(scene, 0.022, 1, [0, 0, 0], '#65796b', 8);
  const dump = createDump(shapes), mixer = createMixer(shapes), flatbed = createFlatbed(shapes), crane = createCrane(shapes);
  scene.add(dump.root, mixer.root, flatbed.root, crane.root);
  const chute = box(scene, [0.36, 1, 0.25], [0, 0, 0], '#8faaa4');
  const chuteTip = cylinder(scene, 0.26, 0.22, [0, 0, 0], '#ecd092', 16);
  const chuteHit = shapes.hitbox(chuteTip, [1.1, 1.1, 1.1], [0, 0, 0]);
  const particles = Array.from({ length: 18 }, () => box(scene, [0.12, 0.12, 0.12], [0, 0, 0], '#bdab8a'));
  const stream = cylinder(scene, 0.09, 0.8, [0, 0, 0], '#b8c5bd', 12);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.83, 36), new THREE.MeshBasicMaterial({ color: '#fff2b4', side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; scene.add(ring);
  const trail = Array.from({ length: 7 }, () => {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 6), new THREE.MeshBasicMaterial({ color: '#fff5d3' })); scene.add(dot); return dot;
  });
  const parking = new THREE.Group(); scene.add(parking);
  for (const z of [3.86, 6.34]) box(parking, [6.2, 0.03, 0.08], [DELIVERY_STOP + 0.55, -0.04, z], '#fff1c7');
  for (const x of [-2.05, 4.15]) box(parking, [0.08, 0.03, 2.5], [x, -0.04, 5.1], '#fff1c7');
  const confetti = Array.from({ length: 28 }, (_, i) => box(scene, [0.12, 0.12, 0.06], [0, 0, 0], ['#e8b964', '#85b5ac', '#d88770'][i % 3]));
  const residents = [0, 1, 2].map(i => {
    const root = new THREE.Group(); root.position.set(1.1 + i * 0.65, 0, 2.55); scene.add(root);
    const scale = i === 2 ? 0.65 : 1; root.scale.setScalar(scale);
    cylinder(root, 0.17, 0.54, [0, 0.52, 0], ['#dcaa7b', '#93b2a3', '#e9c26e'][i], 10);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8), material('#e6b594')); head.position.y = 0.98; root.add(head);
    for (const x of [-0.085, 0.085]) box(root, [0.12, 0.28, 0.16], [x, 0.16, 0], '#6f8a84');
    const arm = box(root, [0.12, 0.44, 0.12], [0.25, 0.65, 0], '#e6b594');
    return { root, arm };
  });
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
        const point = new THREE.Vector3(x, y, z).project(camera);
        return { x: (point.x + 1) * bounds.width / 2, y: (1 - point.y) * bounds.height / 2 };
      };
      if (state.phase === 'gravel') {
        const from = dump.grip.project(camera, canvas);
        return { from, to: { x: from.x, y: from.y - 80 }, direction: 'up', label: '按住車斗前端，往上拉' };
      }
      if (isDelivery(state)) return { from: project(state.truckX, 1.5, 5.1), to: project(DELIVERY_STOP, 1.5, 5.1), direction: 'right', label: '按住車子，往右拖到停車位' };
    },
    craneDropTarget(state: HouseState, pointer?: ScreenPoint) {
      const bounds = canvas.getBoundingClientRect();
      const part = PARTS[Math.min(state.placed, PARTS.length - 1)];
      camera.updateMatrixWorld(true);
      const project = (x: number, z: number) => {
        const point = new THREE.Vector3(x, part.lift + part.height / 2, z).project(camera);
        return { x: (point.x + 1) * bounds.width / 2, y: (1 - point.y) * bounds.height / 2 };
      };
      const target = project(HOUSE.x, HOUSE.z);
      const accepted = state.action === 'dragging' && !!pointer && craneTargetReached(
        { x: pointer.x - bounds.left, y: pointer.y - bounds.top }, project(state.load.x, state.load.z), target,
      );
      return { ...target, radius: CRANE_TARGET_RADIUS, accepted };
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
      return p ? { x: p.x, z: p.z } : undefined;
    },
    render(s: HouseState, time: number) {
      const craneStage = isCrane(s), delivery = isDelivery(s), roofChoosing = s.phase === 'roof-color';
      const interactive = s.action === 'ready' || s.action === 'dragging';
      const arriving = s.action === 'entering' ? 1 - smooth(s.elapsed / 1.2) : 0;
      const departing = s.action === 'leaving' ? smooth(s.elapsed / leavingDuration(s)) : 0;
      const craneLeaving = s.phase === 'crane-two' && s.action === 'leaving';
      const craneTravel = craneLeaving ? smooth((s.elapsed - 0.9) / (leavingDuration(s) - 0.9)) : 0;
      crane.root.visible = s.phase !== 'decorate' && s.phase !== 'complete';
      // Pull into the open work area before passing the tree beside the exit.
      crane.root.position.set(-4.7 - craneTravel * 17, 0, -3.8 + 1.4 * smooth(craneTravel / 0.18));
      crane.retract(craneLeaving ? smooth((s.elapsed - 0.5) / 0.4) : 0);
      crane.roll(-craneTravel * 17);
      dump.root.visible = s.phase === 'gravel'; dump.root.position.set(-2.6 - arriving * 12 - departing * 12, 0, 0); dump.roll(dump.root.position.x);
      dump.bed.rotation.z = s.action === 'dragging' ? -s.dragPx / 60 * 0.85 : s.action === 'working' ? -0.95 : s.action === 'leaving' ? -0.95 * (1 - Math.min(s.elapsed * 3, 1)) : 0;
      dump.cargo.scale.y = Math.max(0.01, 1 - s.gravel); dump.cargo.visible = s.gravel < 1;
      gravelFill.scale.x = Math.max(0.001, s.gravel); gravelFill.visible = s.gravel > 0;
      stones.forEach((stone, i) => { stone.visible = s.gravel > (i + 1) / 36 && s.pours[Math.min(2, Math.floor((i % 7) / 2.4))] < 1; });
      slabs.forEach((slab, i) => { slab.visible = s.pours[i] > 0; slab.scale.z = Math.max(0.001, s.pours[i]); });
      completeSlab.visible = s.pours.every(v => v >= 1);
      mixer.root.visible = s.phase === 'concrete'; mixer.root.position.set(-3.2 - arriving * 12 - departing * 12, 0, 0.3); mixer.roll(mixer.root.position.x); mixer.drum.rotation.y = time * 1.1;
      chute.visible = chuteTip.visible = s.phase === 'concrete' && arriving === 0 && departing === 0;
      chuteTip.position.set(s.chute.x, 1.1, s.chute.z);
      link(chute, new THREE.Vector3(-1.6, 1.82, 0.3), chuteTip.position);
      const pouring = s.phase === 'concrete' && s.action === 'dragging' && s.pours.some((v, i) => v < 1 && Math.hypot(s.chute.x - POUR_TARGETS[i].x, s.chute.z - POUR_TARGETS[i].z) < 0.85 && s.pours.slice(0, i).every(n => n === 1));
      stream.visible = pouring; stream.position.set(s.chute.x, 0.65, s.chute.z);
      particles.forEach((particle, i) => {
        particle.visible = s.phase === 'gravel' && s.action === 'working' && s.gravel < 1;
        const t = (time * 1.4 + i / particles.length) % 1;
        particle.position.set(-1.05 + t * 3.6, 1.3 * (1 - t * t), Math.sin(i * 4) * t * 1.5);
        particle.rotation.set(time + i, time * 2, i);
      });
      flatbed.root.visible = delivery || craneStage || roofChoosing;
      const truckX = delivery ? s.truckX - arriving * 10 : DELIVERY_STOP + departing * 15;
      flatbed.root.position.set(truckX, 0, 5.1); flatbed.root.rotation.y = Math.PI; flatbed.roll(-truckX);
      const delivered = s.placed % 3;
      flatbed.cargo.forEach((cargo, i) => { cargo.visible = delivery || (s.action !== 'leaving' && i < 2 - delivered); });
      parking.visible = delivery;
      const currentPart = Math.min(s.placed, 5), definition = PARTS[currentPart];
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
      const holding = craneStage && s.action !== 'leaving';
      parts.forEach((piece, i) => {
        piece.visible = i < s.placed || (holding && i === s.placed) || (roofChoosing && i === 5);
        piece.position.set(HOUSE.x, PARTS[i].base, HOUSE.z);
        if (holding && i === s.placed) piece.position.copy(load);
        if (roofChoosing && i === 5) piece.position.copy(roofPickup);
      });
      ghosts.forEach((ghost, i) => { ghost.visible = holding && i === s.placed && s.action !== 'placing'; ghost.position.set(HOUSE.x, PARTS[i].base, HOUSE.z); });
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
      if (interactive && s.phase === 'concrete') {
        const index = s.pours.findIndex(v => v < 1);
        if (index >= 0) { hintFrom = chuteTip.position.clone(); hintTo = new THREE.Vector3(POUR_TARGETS[index].x, 1.1, POUR_TARGETS[index].z); }
      } else if (interactive && craneStage) {
        hintFrom = load.clone().add(new THREE.Vector3(0, definition.height / 2, 0)); hintTo = new THREE.Vector3(HOUSE.x, definition.lift + definition.height / 2, HOUSE.z);
      }
      // Crane targets are drawn in the HUD using the same screen-space disc as
      // the release check, so a wall cannot hide them or make them look elliptical.
      ring.visible = !!hintTo && !craneStage;
      if (hintTo) { ring.position.copy(hintTo); ring.scale.setScalar(1 + Math.sin(time * 3) * 0.08); }
      trail.forEach((dot, i) => {
        dot.visible = !!hintFrom && !!hintTo && s.action === 'ready';
        if (hintFrom && hintTo) { const t = (time * 0.4 + i / 9) % 1; dot.position.copy(hintFrom).lerp(hintTo, t); dot.scale.setScalar(Math.sin(t * Math.PI)); }
      });
      // Change the roof itself, including both slopes, for an immediate colour preview.
      parts[5].traverse(object => { if (object instanceof THREE.Mesh) object.material = material(ROOF_COLORS[s.color]); });
      windows.forEach(window => { window.material = material(s.phase === 'complete' ? '#ffe4a0' : '#91b9ba'); });
      residents.forEach(({ root, arm }, i) => { root.visible = s.phase === 'complete'; arm.rotation.z = -0.6 + Math.sin(time * 4 + i) * 0.6; root.position.y = s.phase === 'complete' ? Math.max(0, Math.sin(time * 3 + i)) * 0.06 : 0; });
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
      // Cached colours may no longer be attached after decoration changes.
      for (const color of [...ROOF_COLORS, '#91b9ba', '#ffe4a0']) materials.add(material(color));
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); shapes.disposeMaterials(); sun.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
