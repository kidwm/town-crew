import * as THREE from 'three';
import type { Shapes } from '../../runtime/geometry.ts';
import type { Train } from './domain/rail.ts';
import { carSegments, profiles, WIDTH } from './domain/formation.ts';
export const palettes = [
  { 'high-speed': '#d59a64', regional: '#91b5a5', metro: '#8aa9bd', tram: '#c3a1b5' },
  { 'high-speed': '#c68d74', regional: '#91acbc', metro: '#b2a4c2', tram: '#96b397' },
  { 'high-speed': '#d4b26c', regional: '#aca5bd', metro: '#8cb9ae', tram: '#cfa284' },
  { 'high-speed': '#bd967d', regional: '#b7b88b', metro: '#a6a4c4', tram: '#8ab4b7' },
];

/** A real multi-car consist. Local +X is the inward cab; the scene mirrors X for the opposite bank. */
export function createTrain(shapes: Shapes, kind: Train) {
  const root = new THREE.Group(); root.name = `rail-${kind}`;
  const { box, cylinder, material } = shapes, spec = profiles[kind], side = WIDTH / 2;
  const bullet = kind === 'high-speed', regional = kind === 'regional', metro = kind === 'metro', tram = kind === 'tram';
  const { floor, roof } = spec, cars = carSegments(kind);
  const accents: THREE.Mesh[] = [], doors: { mesh: THREE.Mesh; x: number; direction: number }[] = [], wheels: THREE.Group[] = [];
  const lamps: { mesh: THREE.Mesh; end: number }[] = [];
  const glass = material('#8eafb3').clone(); Object.assign(glass, { transparent: true, opacity: 0.4, depthWrite: false });
  const paint = (parent: THREE.Object3D, size: number[], at: number[]) => {
    const mesh = box(parent, size, at, palettes[0][kind]); accents.push(mesh); return mesh;
  };
  function window(parent: THREE.Object3D, size: number[], at: number[]) {
    const mesh = box(parent, size, at, '#8eafb3'); mesh.material = glass; mesh.castShadow = false; return mesh;
  }
  function rod(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
    const delta = b.clone().sub(a), mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, delta.length(), 6), material('#697f7e'));
    mesh.position.copy(a).add(b).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); parent.add(mesh);
  }
  function pantograph(parent: THREE.Object3D, x: number) {
    const p = new THREE.Group(); p.position.set(x, roof + 0.13, 0); parent.add(p);
    for (const z of [-0.23, 0.23]) { rod(p, new THREE.Vector3(-0.35, 0, z), new THREE.Vector3(0.1, 0.3, z)); rod(p, new THREE.Vector3(0.1, 0.3, z), new THREE.Vector3(-0.15, 0.55, z)); }
    box(p, [0.16, 0.06, 0.95], [-0.15, 0.56, 0], '#687e7c');
  }
  /** Low-poly oval sections narrow in plan as well as dropping toward the long, low tip. */
  function nose(parent: THREE.Object3D, shoulder: number, end: number) {
    const sections = [
      { t: 0, y: roof - 0.04, width: side },
      { t: 0.23, y: roof - 0.16, width: side * 0.94 },
      { t: 0.5, y: floor + 0.82, width: side * 0.76 },
      { t: 0.78, y: floor + 0.38, width: side * 0.43 },
      { t: 1, y: floor + 0.19, width: side * 0.12 },
    ];
    const vertices: number[] = [], indices: number[] = [];
    for (const section of sections) {
      const x = shoulder + (end - shoulder) * section.t, bottom = floor - 0.08;
      // Beveled shoulders replace the old full-width rectangular wedge.
      for (const [y, z] of [[bottom, -section.width * 0.78], [section.y - 0.15, -section.width], [section.y, -section.width * 0.55], [section.y, section.width * 0.55], [section.y - 0.15, section.width], [bottom, section.width * 0.78]]) vertices.push(x, y, z);
    }
    for (let n = 0; n < sections.length - 1; n++) for (let k = 0; k < 6; k++) {
      const a = n * 6 + k, b = n * 6 + (k + 1) % 6, c = (n + 1) * 6 + k, d = (n + 1) * 6 + (k + 1) % 6;
      indices.push(a, b, d, a, d, c);
    }
    for (let k = 1; k < 5; k++) { indices.push(0, k + 1, k); const start = (sections.length - 1) * 6; indices.push(start, start + k, start + k + 1); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    // Section winding is kept consistent for either double-ended cab.
    if (end < shoulder) geometry.setIndex(indices.flatMap((_, i) => i % 3 ? [] : [indices[i], indices[i + 2], indices[i + 1]]));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material('#f5f0df')); mesh.name = end > shoulder ? 'high-speed-leading-nose' : 'high-speed-trailing-nose'; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
    // Fit the glazing to the swept nose surface instead of placing a flat box above it.
    const glazing: number[] = [];
    for (const t of [0.06, 0.23, 0.43]) {
      const upper = sections.findIndex(section => section.t >= t), lo = sections[upper - 1], hi = sections[upper], f = (t - lo.t) / (hi.t - lo.t);
      const y = lo.y + (hi.y - lo.y) * f, width = lo.width + (hi.width - lo.width) * f;
      for (const z of [-0.72, -0.55, 0, 0.55, 0.72]) glazing.push(shoulder + (end - shoulder) * t, y - Math.max(0, Math.abs(z) - 0.55) / 0.45 * 0.15 + 0.035, width * z);
    }
    const windscreenGeometry = new THREE.BufferGeometry(); windscreenGeometry.setAttribute('position', new THREE.Float32BufferAttribute(glazing, 3));
    const faces: number[] = [];
    for (let row = 0; row < 2; row++) for (let column = 0; column < 4; column++) {
      const a = row * 5 + column; faces.push(a, a + 1, a + 6, a, a + 6, a + 5);
    }
    windscreenGeometry.setIndex(end > shoulder ? faces : faces.flatMap((_, i) => i % 3 ? [] : [faces[i], faces[i + 2], faces[i + 1]])); windscreenGeometry.computeVertexNormals();
    const windscreen = new THREE.Mesh(windscreenGeometry, material('#526d78')); windscreen.name = 'high-speed-swept-windscreen'; parent.add(windscreen);
    for (const z of [-1, 1]) {
      const stripe = paint(parent, [0.95, 0.095, 0.035], [shoulder + (end - shoulder) * 0.23, floor + 0.27, z * side * 0.83]); stripe.rotation.y = z * (end > shoulder ? 0.18 : -0.18);
      lamps.push({ mesh: box(parent, [0.065, 0.075, 0.16], [end - Math.sign(end - shoulder) * 0.24, floor + 0.21, z * 0.18], '#fff0c0'), end: end > shoulder ? 1 : -1 });
    }
  }
  for (const segment of cars) {
    const car = new THREE.Group(); car.name = segment.index === 0 ? `rail-${kind}-cab` : `rail-${kind}-car-${segment.index}`; root.add(car);
    const cabEnd = segment.cab === 1 ? segment.front : segment.rear, rear = segment.rear + (segment.cab === -1 ? spec.nose : 0), front = segment.front - (segment.cab === 1 ? spec.nose : 0);
    const length = front - rear, centre = (rear + front) / 2;
    box(car, [length, 0.14, WIDTH - 0.08], [centre, floor - 0.07, 0], bullet ? '#e5e4d4' : '#cbd3cd');
    box(car, [length - 0.1, tram ? 0.1 : 0.22, WIDTH - 0.22], [centre, 0.33, 0], '#5a6f74');
    const axleInset = Math.min(0.75, length * 0.24);
    for (const bx of [rear + axleInset, front - axleInset]) {
      box(car, [0.72, 0.2, 1.4], [bx, 0.28, 0], '#64787b');
      for (const offset of [-0.2, 0.2]) for (const z of [-0.72, 0.72]) {
        const wheel = new THREE.Group(); wheel.position.set(bx + offset, 0.25, z); car.add(wheel);
        cylinder(wheel, 0.25, 0.12, [0, 0, 0], '#65797d', 10).rotation.x = Math.PI / 2;
        cylinder(wheel, 0.13, 0.14, [0, 0, 0], '#b3beb7', 10).rotation.x = Math.PI / 2;
        box(wheel, [0.05, 0.3, 0.15], [0, 0, 0], '#8e9f9b'); wheels.push(wheel);
      }
    }
    for (const z of [-side, side]) {
      const openings = z > 0 ? segment.doors.filter(x => x - spec.doorWidth / 2 > rear && x + spec.doorWidth / 2 < front) : [];
      let start = rear;
      for (const stop of [...openings.map(x => x - spec.doorWidth / 2), front]) {
        if (stop <= start) continue;
        const panel = box(car, [stop - start, 0.49, 0.09], [(start + stop) / 2, floor + 0.245, z], bullet ? '#f4f0df' : regional ? '#c6cece' : '#cdd9d3');
        if (tram) accents.push(panel);
        paint(car, [stop - start, metro ? 0.3 : tram ? 0.15 : 0.1, 0.105], [(start + stop) / 2, floor + (metro ? 0.29 : 0.39), z + Math.sign(z) * 0.012]);
        if (regional) box(car, [stop - start, 0.045, 0.105], [(start + stop) / 2, floor + 0.29, z + Math.sign(z) * 0.014], '#eef0e3');
        const count = Math.max(1, Math.ceil((stop - start) / (tram ? 1.4 : bullet ? 1.05 : 0.8)));
        for (let n = 0; n <= count; n++) box(car, [tram ? 0.045 : 0.065, roof - floor - 0.4, 0.1], [start + n * (stop - start) / count, (roof + floor + 0.4) / 2, z], bullet ? '#f5f0df' : regional ? '#dce0d9' : '#c8d5d2');
        for (let n = 0; n < count; n++) window(car, [(stop - start) / count - 0.08, roof - floor - (tram ? 0.59 : bullet ? 0.85 : 0.74), 0.035], [start + (n + 0.5) * (stop - start) / count, (roof + floor + (tram ? 0.34 : 0.38)) / 2, z]);
        const nextDoor = openings.find(x => Math.abs(x - spec.doorWidth / 2 - stop) < 0.001);
        start = nextDoor === undefined ? stop : nextDoor + spec.doorWidth / 2;
      }
    }
    // Rounded roof edges, a clean high-speed roof and distinct metro/rail equipment.
    box(car, [length + 0.04, 0.1, WIDTH - 0.15], [centre, roof, 0], bullet ? '#f8f2e2' : regional ? '#b5c0bd' : '#d4ddd5');
    for (const z of [-1, 1]) {
      const shoulder = box(car, [length + 0.02, 0.1, 0.19], [centre, roof - 0.035, z * 0.77], bullet ? '#f8f2e2' : '#d4ddd5'); shoulder.rotation.x = z * 0.4;
    }
    if (metro) for (const offset of [-0.65, 0.65]) box(car, [0.94, 0.18, 1.02], [centre + offset, roof + 0.14, 0], '#a4b5b3');
    else if (!bullet) box(car, [Math.min(1.45, length - 0.4), tram ? 0.18 : 0.14, tram ? 1.1 : 0.85], [centre, roof + 0.13, 0], '#a9b7ad');
    else if (segment.cab === 0) box(car, [1.15, 0.08, 0.72], [centre, roof + 0.08, 0], '#d8dfd6');
    for (const doorX of segment.doors.filter(x => x - spec.doorWidth / 2 > rear && x + spec.doorWidth / 2 < front)) {
      for (const direction of [-1, 1]) {
        const panel = box(car, [spec.doorWidth / 2 - 0.025, roof - floor - 0.15, 0.08], [doorX + direction * spec.doorWidth / 4, (roof + floor) / 2, side + 0.04], regional ? '#a7b6b3' : metro ? '#8caaa9' : '#9db4ae');
        window(panel, [spec.doorWidth / 2 - 0.09, metro || tram ? 0.86 : 0.62, 0.04], [0, 0.13, 0.06]);
        box(panel, [0.035, 0.18, 0.045], [-direction * 0.1, -0.22, 0.07], '#f4e9c8'); doors.push({ mesh: panel, x: panel.position.x, direction });
      }
      box(car, [spec.doorWidth, 0.075, 0.15], [doorX, floor - 0.05, side], '#e4d8b3');
    }
    // The visible boarding car retains three seats; farther coaches have simple interiors.
    for (const x of segment.index === 0 ? [spec.door - 0.7, spec.door, spec.door + 0.7] : [centre - 0.55, centre + 0.55]) {
      box(car, [0.5, 0.12, 0.5], [x, floor + 0.17, -0.25], metro ? '#8fabb1' : '#9bb19f');
      box(car, [0.5, 0.5, 0.08], [x, floor + 0.43, -0.51], metro ? '#8fabb1' : '#9bb19f');
    }
    if (segment.cab) {
      if (bullet) nose(car, segment.cab === 1 ? front : rear, cabEnd);
      else {
        const cap = box(car, [spec.nose + 0.03, roof - floor + 0.02, WIDTH - (tram ? 0.1 : 0)], [cabEnd - segment.cab * spec.nose / 2, (roof + floor) / 2, 0], regional ? '#d6dcd3' : metro ? '#526f79' : palettes[0].tram);
        if (tram) { accents.push(cap); cap.rotation.z = segment.cab * 0.08; }
        box(car, [0.035, metro ? 1.08 : tram ? 1.16 : 0.79, WIDTH - (regional ? 0.21 : 0.15)], [cabEnd + segment.cab * 0.025, roof - (tram ? 0.61 : 0.53), 0], metro ? '#344f5c' : '#64858d');
        if (regional) {
          for (const z of [-1, 1]) {
            box(car, [0.56, 0.42, 0.105], [cabEnd - segment.cab * 0.25, floor + 0.25, z * side], '#e1c278');
            box(car, [0.54, 0.7, 0.035], [cabEnd - segment.cab * 0.25, roof - 0.52, z * (side + 0.055)], '#5f7d87');
          }
          box(car, [0.05, 0.43, 1.35], [cabEnd + segment.cab * 0.04, floor + 0.26, 0], '#e3c277');
          box(car, [0.06, 1.19, 0.3], [cabEnd + segment.cab * 0.055, floor + 0.66, 0], '#a9b8b0');
          for (const z of [-0.57, 0.57]) cylinder(car, 0.09, 0.055, [cabEnd + segment.cab * 0.07, floor + 0.26, z], '#fff0bc', 10).rotation.z = Math.PI / 2;
        } else {
          // Wraparound dark cab band is visible in side view, not only on the end face.
          for (const z of [-1, 1]) box(car, [0.5, metro ? 0.98 : 1.1, 0.035], [cabEnd - segment.cab * 0.25, roof - 0.55, z * (side + 0.035)], metro ? '#405f6c' : '#6d929a');
        }
        box(car, [0.045, 0.12, 0.63], [cabEnd + segment.cab * 0.04, roof - 0.21, 0], '#e8e9cb');
        for (const z of [-0.57, 0.57]) lamps.push({ mesh: box(car, [0.065, 0.08, metro ? 0.3 : 0.19], [cabEnd + segment.cab * 0.06, floor + 0.23, z], '#fff0c0'), end: segment.cab });
        box(car, [0.15, 0.12, 1.12], [cabEnd, floor - 0.17, 0], '#718786');
      }
    } else for (const end of [segment.front, segment.rear]) box(car, [0.065, roof - floor - 0.06, WIDTH - 0.08], [end, (floor + roof) / 2, 0], '#becac1');
    if (segment.index < cars.length - 1) {
      const jointX = segment.rear - spec.gap / 2;
      for (let n = 0; n < (tram ? 5 : 3); n++) box(car, [0.035, roof - floor - 0.12, WIDTH - 0.15], [jointX + (n - (tram ? 2 : 1)) * 0.045, (floor + roof) / 2, 0], tram ? '#647b7c' : '#849892');
      box(car, [spec.gap + 0.18, 0.09, 0.18], [jointX, 0.35, 0], '#627876');
    }
    if (tram && segment.index === 0 || regional && segment.index % 2 === 0 || bullet && [1, 6].includes(segment.index)) pantograph(car, centre - (tram ? 0.3 : 0));
    shapes.hitbox(car, [segment.front - segment.rear + 0.1, roof + 0.25, WIDTH + 0.18], [(segment.front + segment.rear) / 2, (roof + 0.25) / 2, 0]);
  }
  return { root, pose(distance: number, opening: number, palette: number, direction: number) {
    accents.forEach(m => { m.material = material(palettes[palette][kind]); });
    doors.forEach(d => { d.mesh.position.x = d.x + d.direction * opening * (spec.doorWidth / 2 + 0.015); });
    wheels.forEach(w => { w.rotation.z = -distance / 0.25; });
    lamps.forEach(l => { l.mesh.material = material(l.end === direction ? '#fff0bd' : '#c58e7c'); });
  } };
}
