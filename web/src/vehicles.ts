import * as THREE from 'three';
import type { Shapes } from './geometry.ts';
import { BOOM, STICK, PIVOT, elbow, ROCKS, UNLOAD } from './domain/excavator.ts';
import type { Point, ExcavatorState } from './domain/excavator.ts';

export function createExcavatorVisual(shapes: Shapes) {
  const { box, cylinder, material } = shapes;
  const root = new THREE.Group();
  root.name = 'excavator';
  for (const z of [-0.85, 0.85]) {
    box(root, [2.9, 0.55, 0.48], [-4.8, 0.32, z], '#39474b');
    for (let x = -5.8; x <= -3.8; x += 0.5) {
      cylinder(root, 0.21, 0.51, [x, 0.34, z], '#8c998c', 12).rotation.x = Math.PI / 2;
    }
    for (let x = -6.1; x < -3.4; x += 0.23) box(root, [0.08, 0.08, 0.5], [x, 0.63, z], '#6a7773');
  }
  box(root, [2.6, 0.48, 1.6], [-4.8, 0.91, 0], '#e5a741');
  box(root, [1.25, 1.45, 1.4], [-5.35, 1.83, 0], '#edb84f');
  box(root, [1.4, 0.13, 1.55], [-5.35, 2.61, 0], '#ffda7e');
  for (const z of [-0.71, 0.71]) box(root, [0.86, 0.88, 0.04], [-5.25, 1.97, z], '#b6e0e1');
  box(root, [0.04, 0.88, 1.13], [-4.7, 1.97, 0], '#a0d2d9');
  box(root, [0.9, 0.95, 1.45], [-4.13, 1.46, 0], '#dba03d');
  const boom = box(root, [0.36, BOOM, 0.38], [0, 0, 0], '#efb54c');
  const stick = box(root, [0.27, STICK, 0.29], [0, 0, 0], '#efb54c');
  const piston = box(root, [0.1, 1, 0.1], [0, 0, 0], '#dde0d2');
  const joint = cylinder(root, 0.25, 0.48, [0, 0, 0], '#69766d');
  joint.rotation.x = Math.PI / 2;
  cylinder(root, 0.3, 0.53, [PIVOT.x, PIVOT.y, PIVOT.z], '#69766d').rotation.x = Math.PI / 2;
  const bucket = new THREE.Group();
  box(bucket, [0.9, 0.22, 0.95], [0.12, -0.24, 0], '#dd9335');
  box(bucket, [0.18, 0.68, 0.95], [-0.26, 0.02, 0], '#e6a242');
  for (const z of [-0.42, 0.42]) box(bucket, [0.82, 0.58, 0.13], [0.07, 0, z], '#f1b350');
  for (const z of [-0.3, 0, 0.3]) box(bucket, [0.32, 0.12, 0.14], [0.62, -0.27, z], '#f6d184');
  const hitbox = shapes.hitbox(bucket, [1.55, 1.5, 1.6], [0.1, 0, 0]);
  root.add(bucket);
  const rocks = ROCKS.map((position, i) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.57, 0), material('#a49e86'));
    rock.position.set(position.x, position.y, position.z);
    rock.rotation.set(0.2, i * 0.8, 0.1);
    rock.castShadow = true;
    return rock;
  });
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.64, 0.82, 32), new THREE.MeshBasicMaterial({ color: '#fff0a6', side: THREE.DoubleSide }));
  halo.rotation.x = -Math.PI / 2;
  const trail = Array.from({ length: 5 }, () => new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff4c4' })));
  const discarded = ROCKS.map((_, i) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 0), material('#a49e86'));
    rock.position.set(UNLOAD.x + (i - 1) * 0.46, 0.3, 2.7 + (i % 2) * 0.18);
    rock.castShadow = true;
    return rock;
  });
  const vec = (p: Point) => new THREE.Vector3(p.x, p.y, p.z);
  const orient = (mesh: THREE.Mesh, from: Point, to: Point) => {
    const a = vec(from), b = vec(to);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  };
  return {
    root, hitbox, rocks, halo, trail, discarded,
    render(state: ExcavatorState, active: boolean, offset: number, time: number, canInteract = true) {
      root.visible = active;
      root.position.x = offset;
      const armElbow = elbow(state.bucket);
      orient(boom, PIVOT, armElbow);
      orient(stick, armElbow, state.bucket);
      joint.position.copy(vec(armElbow));
      const rodStart = { x: PIVOT.x + 0.15, y: PIVOT.y - 0.35, z: 0.25 };
      const rodEnd = { x: (PIVOT.x + armElbow.x) / 2, y: (PIVOT.y + armElbow.y) / 2, z: 0.25 };
      orient(piston, rodStart, rodEnd);
      piston.scale.y = vec(rodStart).distanceTo(vec(rodEnd));
      bucket.position.copy(vec(state.bucket));
      bucket.rotation.z = state.action === 'scooping' || state.action === 'unloading' ? -0.28 : 0;
      const ready = active && canInteract && state.action === 'ready';
      const target = ROCKS[state.cleared];
      halo.visible = ready && !!target;
      if (target) {
        halo.position.set(target.x, 0.12, target.z);
        halo.scale.setScalar(1 + Math.sin(time * 4) * 0.08);
      }
      rocks.forEach((rock, i) => {
        rock.visible = active && i >= state.cleared;
        rock.position.copy(vec(ROCKS[i]));
        rock.scale.setScalar(1);
        if (i === state.cleared && ['scooping', 'unloading'].includes(state.action)) {
          rock.position.copy(vec(state.bucket)).add(new THREE.Vector3(0.2, -0.1, 0));
          if (state.action === 'unloading') {
            const fall = Math.max(0, (state.elapsed - 0.7) / 0.2);
            rock.position.y -= fall;
            rock.scale.setScalar(1 - fall * 0.4);
          }
        } else if (ready && i === state.cleared) rock.scale.setScalar(1 + Math.sin(time * 4) * 0.07);
      });
      trail.forEach((dot, i) => {
        dot.visible = ready && !!target;
        if (target) {
          const t = (time * 0.45 + i * 0.09) % 1;
          dot.position.copy(vec(state.bucket)).lerp(vec({ ...target, y: 0.95 }), t);
          dot.scale.setScalar(Math.sin(t * Math.PI));
        }
      });
      discarded.forEach((rock, i) => { rock.visible = i < state.cleared; });
    },
  };
}

export function createRollerVisual(shapes: Shapes) {
  const { box, cylinder } = shapes;
  const root = new THREE.Group();
  root.name = 'road-roller';
  box(root, [2.8, 0.36, 1.65], [-0.25, 0.9, 0], '#cd9a43');
  box(root, [1.35, 0.95, 1.45], [-1.05, 1.5, 0], '#e9b755');
  const tires = [-1.02, 1.02].map(z => shapes.wheel(root, -1.05, z, 0.62));
  box(root, [0.65, 0.22, 0.9], [0.03, 1.2, 0], '#485d60');
  box(root, [0.16, 0.75, 0.9], [-0.23, 1.62, 0], '#485d60');
  for (const z of [-0.7, 0.7]) box(root, [0.09, 1.72, 0.09], [-0.6, 1.98, z], '#6b7561');
  box(root, [1.6, 0.16, 1.8], [-0.25, 2.87, 0], '#f1c975');
  const drum = new THREE.Group();
  drum.position.set(1.25, 0.7, 0);
  cylinder(drum, 0.7, 1.9, [0, 0, 0], '#a8baba', 24).rotation.x = Math.PI / 2;
  for (const z of [-0.98, 0.98]) {
    cylinder(drum, 0.24, 0.04, [0, 0, z], '#758f96').rotation.x = Math.PI / 2;
    box(drum, [0.1, 0.8, 0.06], [0, 0, z], '#cbd4c9');
    box(root, [1.3, 0.2, 0.13], [0.77, 0.74, z * 1.09], '#dfaa47');
  }
  root.add(drum);
  const hitbox = shapes.hitbox(root, [4.4, 3.0, 2.6], [0.15, 1.35, 0]);
  const arrows = new THREE.Group();
  for (const direction of [-1, 1]) {
    const arrow = new THREE.Group();
    arrow.position.set(direction * 3.0, 0.12, 1.1);
    box(arrow, [0.9, 0.09, 0.15], [0, 0, 0], '#fff0b5');
    for (const sign of [-1, 1]) {
      const part = box(arrow, [0.5, 0.09, 0.14], [direction * 0.3, 0, sign * 0.17], '#fff0b5');
      part.rotation.y = sign * direction * 0.65;
    }
    arrows.add(arrow);
  }
  root.add(arrows);
  return { root, hitbox, render(x: number, passes: number, ready: boolean, time: number) {
    root.position.x = x;
    for (const tire of tires) tire.rotation.z = -(x + 9) / 0.62;
    drum.rotation.z = -(x + 9) / 0.7;
    arrows.visible = ready;
    arrows.children.forEach((arrow, i) => {
      arrow.visible = passes === 0 || i === 0;
      arrow.scale.setScalar((passes === 0 && i === 0 ? 0.55 : 1) * (1 + Math.sin(time * 3) * 0.09));
    });
  } };
}

export function createCarVisual(shapes: Shapes) {
  const { box } = shapes;
  const root = new THREE.Group();
  root.name = 'passing-car';
  box(root, [2.9, 0.62, 1.48], [0, 0.8, 0], '#dc8166');
  box(root, [1.65, 0.75, 1.38], [-0.15, 1.41, 0], '#ee9b7b');
  for (const z of [-0.7, 0.7]) {
    box(root, [0.65, 0.47, 0.035], [-0.55, 1.45, z], '#bde5e3');
    box(root, [0.59, 0.47, 0.035], [0.18, 1.45, z], '#bde5e3');
  }
  box(root, [0.035, 0.47, 1.13], [0.69, 1.45, 0], '#bde5e3');
  for (const z of [-0.51, 0.51]) box(root, [0.04, 0.22, 0.29], [1.47, 0.88, z], '#fff0b2');
  const wheels = [-0.95, 0.95].flatMap(x => [-0.84, 0.84].map(z => shapes.wheel(root, x, z, 0.36)));
  return { root, render(x: number) { root.position.x = x; for (const wheel of wheels) wheel.rotation.z = -(x + 10) / 0.36; } };
}
