export type Point = { x: number; z: number };
export type Cargo = 0 | 1;
export type Round = { layout: 0 | 1; palette: number };
export const stages = ['boat', 'truck', 'unload', 'crane-exit', 'forklift', 'forklift-exit', 'transport', 'departure', 'arrival', 'complete'] as const;
export type Stage = typeof stages[number];
export type Action = 'ready' | 'dragging' | 'lowering' | 'picking' | 'loading' | 'returning' | 'auto';
export interface PortState {
  version: 1; round: Round; phase: Stage; action: Action;
  boat: number; truck: number; haul: number; forkTravel: number;
  unloaded: Cargo[]; loaded: Cargo[]; selected: Cargo | null; carrying: boolean;
  load: Point; lift: number; elapsed: number;
  // Desired input and dwell are transient; resume/release always discard them.
  desired: number | null; aim: Point | null; moved: boolean;
}
export const SHIP_Z = -6.2, ROAD_Z = 8.5, LOAD_HEIGHT = 3.25, FORK_OFFSET = 2.3, LOADING_APPROACH = 1.9;
export const HAUL_END = -8.5;
// Includes whole vehicle/boat lengths and the fixed camera's lateral perspective.
export const exitDistance = (halfWidth: number) => Math.max(22, halfWidth * 1.2 + 8);
export const DECK: Point[] = [{ x: -0.9, z: -5.8 }, { x: 1.3, z: -5.8 }];
export const QUAY: Point[] = [{ x: 1.3, z: -1.35 }, { x: 3.6, z: -1.35 }];
export const HOME: Point = { x: -0.8, z: 3.2 };
export const SECOND_HOME: Point = { x: 2.45, z: 1.35 };
export const TRUCK_SLOTS: Point[] = [{ x: -0.6, z: ROAD_Z }, { x: 1.1, z: ROAD_Z }];
export const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
export const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export const mirror = (round: Round, p: Point): Point => ({ x: round.layout ? -p.x : p.x, z: p.z });
export function validRound(value: unknown): value is Round {
  if (!value || typeof value !== 'object') return false;
  const r = value as Round;
  return (r.layout === 0 || r.layout === 1) && Number.isInteger(r.palette) && r.palette >= 0 && r.palette < 4;
}
export function chooseRound(previous?: Round, random = Math.random): Round {
  const n = clamp(random(), 0, 0.999999);
  return { layout: previous ? previous.layout === 0 ? 1 : 0 : n < 0.5 ? 0 : 1,
    palette: previous ? (previous.palette + 1 + Math.floor(n * 3)) % 4 : Math.floor(n * 4) };
}
export function createPort(phase: Stage = 'boat', round: Round = { layout: 0, palette: 0 }): PortState {
  const i = stages.indexOf(phase);
  return { version: 1, round: { ...round }, phase, action: ['boat', 'truck', 'unload', 'forklift', 'transport'].includes(phase) ? 'ready' : 'auto',
    boat: i > 0 ? 1 : 0, truck: i > 1 ? 1 : 0, haul: i > 6 ? 1 : 0, forkTravel: 0,
    unloaded: i >= 3 ? [0, 1] : [], loaded: i >= 5 ? [0, 1] : [], selected: null, carrying: false,
    load: { ...DECK[0] }, lift: 0, elapsed: 0, desired: null, aim: null, moved: false };
}
export function pathLength(path: Point[]) { return path.slice(1).reduce((sum, p, i) => sum + distance(path[i], p), 0); }
const turn = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
export function pathPose(path: Point[], progress: number, headings?: number[], startYaw?: number, endYaw?: number) {
  let remaining = pathLength(path) * clamp(progress);
  const heading = (i: number) => headings?.[i] ?? Math.atan2(-(path[i + 1].x - path[i].x), -(path[i + 1].z - path[i].z));
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], length = distance(a, b);
    if (remaining <= length || i === path.length - 1) {
      let yaw = heading(i - 1); const radius = Math.min(0.4, length / 2);
      if (remaining < radius) {
        if (i > 1) yaw = turn(heading(i - 2), yaw, 0.5 + smooth(remaining / radius) * 0.5);
        else if (startYaw !== undefined) yaw = turn(startYaw, yaw, smooth(remaining / radius));
      } else if (remaining > length - radius) {
        if (i < path.length - 1) yaw = turn(yaw, heading(i), smooth((remaining - length + radius) / radius) * 0.5);
        else if (endYaw !== undefined) yaw = turn(yaw, endYaw, smooth((remaining - length + radius) / radius));
      }
      return { ...mix(a, b, length ? clamp(remaining / length) : 1), yaw, segment: i - 1 };
    }
    remaining -= length;
  }
  return { ...path[0], yaw: 0, segment: 0 };
}
export function quayFor(s: PortState, id: Cargo) { return QUAY[Math.max(0, s.unloaded.indexOf(id))]; }
export const quayYaw = (index: number) => index === 0 ? -Math.PI / 2 : Math.PI / 2;
function pickupSide(s: PortState, id: Cargo) {
  const outer = s.unloaded.indexOf(id) === 0 ? -1 : 1;
  return s.loaded.some(other => other !== id) ? -outer : outer;
}
export function pickupYaw(s: PortState, id: Cargo) { return pickupSide(s, id) * Math.PI / 2; }
export function forkHome(s: PortState) { return s.loaded.length === 1 ? SECOND_HOME : HOME; }
export function pickupRoute(s: PortState, id: Cargo): Point[] {
  const p = quayFor(s, id), side = pickupSide(s, id), stopX = p.x + side * FORK_OFFSET;
  if (s.loaded.some(other => other !== id)) {
    // The first pallet is gone: enter through its vacant bay, rather than
    // circling the remaining box. Keep the final insertion horizontal.
    const end = { x: stopX + side * 0.25, z: p.z };
    const start = forkHome(s), first = { x: stopX + side * 2.6, z: start.z };
    const second = { x: end.x + side * 1.6, z: p.z };
    const curve = Array.from({ length: 21 }, (_, i) => {
      const t = i / 20, u = 1 - t;
      return { x: u ** 3 * start.x + 3 * u * u * t * first.x + 3 * u * t * t * second.x + t ** 3 * end.x,
        z: u ** 3 * start.z + 3 * u * u * t * first.z + 3 * u * t * t * second.z + t ** 3 * end.z };
    });
    return [...curve, { x: stopX, z: p.z }];
  }
  const radius = 1.6, insertion = 0.85;
  const centre = { x: stopX + side * insertion, z: p.z + radius };
  // Turn clear of the quay edge, then insert horizontally from the outer side.
  // Each pallet has its own approach, so either loading order stays unobstructed.
  const arc = Array.from({ length: 7 }, (_, i) => {
    const angle = i / 6 * Math.PI / 2;
    return { x: centre.x + side * radius * Math.cos(angle), z: centre.z - radius * Math.sin(angle) };
  });
  return [HOME, { x: arc[0].x, z: HOME.z }, ...arc, { x: stopX, z: p.z }];
}
export function deliveryRoute(s: PortState): Point[] {
  const slot = TRUCK_SLOTS[s.loaded.length];
  if (s.loaded.length === 1) {
    // Both quay bays are clear after the second pickup. Reverse out, then
    // turn toward the truck without retracing the pickup curve.
    const p = quayFor(s, s.selected!), side = pickupSide(s, s.selected!);
    const start = { x: p.x + side * FORK_OFFSET, z: p.z }, retreat = { x: start.x + side * 1.2, z: p.z };
    return [start, retreat, { x: retreat.x, z: HOME.z }, { x: slot.x, z: HOME.z }, { x: slot.x, z: ROAD_Z - FORK_OFFSET - LOADING_APPROACH }];
  }
  // Reverse through the same clear approach before turning toward the truck.
  return [...pickupRoute(s, s.selected!).slice(1).reverse(), { x: slot.x, z: HOME.z }, { x: slot.x, z: ROAD_Z - FORK_OFFSET - LOADING_APPROACH }];
}
export function returnRoute(s: PortState): Point[] {
  const slot = TRUCK_SLOTS[s.loaded.length - 1], home = forkHome(s);
  return [{ x: slot.x, z: ROAD_Z - FORK_OFFSET }, { x: slot.x, z: HOME.z }, { x: home.x, z: HOME.z }, ...(home.z === HOME.z ? [] : [home])];
}
export function forkRoute(s: PortState, candidate: Cargo = s.selected ?? s.unloaded.find(id => !s.loaded.includes(id)) ?? 0) {
  return s.carrying ? deliveryRoute(s) : pickupRoute(s, candidate);
}
export function forkPose(s: PortState, exit = 22) {
  if (s.action === 'returning') {
    const route = returnRoute(s), headings = route.slice(1).map((p, i) => i === 0 ? Math.PI : Math.atan2(-(p.x - route[i].x), -(p.z - route[i].z)));
    return pathPose(route, smooth(s.elapsed / 2), headings, Math.PI, 0);
  }
  if (s.phase === 'forklift-exit') return { ...mix(HOME, { x: -exit, z: HOME.z }, smooth((s.elapsed - 0.4) / 3.1)), yaw: Math.PI / 2 * smooth(s.elapsed / 0.4), segment: 0 };
  if (s.phase !== 'forklift' || s.selected === null) return { ...forkHome(s), yaw: 0, segment: 0 };
  const route = forkRoute(s), reverseSegments = s.loaded.length === 1 ? 1 : route.length - 3;
  const headings = s.carrying ? route.slice(1).map((p, i) => {
    const dx = p.x - route[i].x, dz = p.z - route[i].z;
    return i < reverseSegments ? Math.atan2(dx, dz) : Math.atan2(-dx, -dz);
  }) : undefined;
  const p = pathPose(route, s.forkTravel, headings, s.carrying ? pickupYaw(s, s.selected) : 0, s.carrying ? Math.PI : pickupYaw(s, s.selected));
  if (s.action === 'loading') p.z += LOADING_APPROACH * smooth((s.elapsed - 0.8) / 0.6);
  // The loaded approach reverses, then steering blends toward the truck.
  return p;
}
export function available(s: PortState): Cargo[] {
  if (s.phase === 'unload') return s.selected === null ? ([0, 1] as Cargo[]).filter(id => !s.unloaded.includes(id)) : [s.selected];
  if (s.phase === 'forklift') return s.selected === null ? s.unloaded.filter(id => !s.loaded.includes(id)) : [s.selected];
  return [];
}
function resetInput(s: PortState): PortState { return { ...s, desired: null, aim: null, moved: false, elapsed: 0 }; }
function nextPhase(s: PortState, phase: Stage): PortState {
  return { ...resetInput(s), phase, action: ['truck', 'unload', 'forklift', 'transport'].includes(phase) ? 'ready' : 'auto', selected: null, forkTravel: 0, carrying: false };
}
export function grab(s: PortState, id?: Cargo): PortState {
  if (s.action !== 'ready') return s;
  if (s.phase === 'unload') {
    const selected = s.selected ?? id;
    if (selected === undefined || !available(s).includes(selected)) return s;
    return { ...resetInput(s), action: 'dragging', selected, load: s.selected === null ? { ...DECK[selected] } : s.load };
  }
  if (!['boat', 'truck', 'forklift', 'transport'].includes(s.phase)) return s;
  const parked = s.phase === 'boat' ? s.boat === 1 : s.phase === 'truck' ? s.truck === 1 : s.phase === 'transport' ? s.haul === 1 : s.selected !== null && s.forkTravel === 1;
  return { ...resetInput(s), action: 'dragging', moved: parked };
}
export function drive(s: PortState, desired: number, candidate?: Cargo): PortState {
  if (s.action !== 'dragging' || !Number.isFinite(desired)) return s;
  if (s.phase === 'forklift' && s.selected === null) {
    if (candidate === undefined || !available(s).includes(candidate)) return s;
    return { ...s, selected: candidate, desired: clamp(desired), moved: true };
  }
  if (!['boat', 'truck', 'forklift', 'transport'].includes(s.phase)) return s;
  return { ...s, desired: clamp(desired), moved: true };
}
export function moveLoad(s: PortState, aim: Point): PortState {
  if (s.phase !== 'unload' || s.action !== 'dragging' || !Number.isFinite(aim.x) || !Number.isFinite(aim.z)) return s;
  return { ...s, aim: { x: clamp(aim.x, -1.8, 4.3), z: clamp(aim.z, -5.8, -1.35) }, moved: true };
}
export function loweringDuration(s: PortState) { return s.lift === 1 && distance(s.load, QUAY[s.unloaded.length]) < 0.2 ? 0.8 : 2; }
function reached(s: PortState) {
  if (!s.moved) return false;
  if (s.phase === 'boat') return s.boat === 1;
  if (s.phase === 'truck') return s.truck === 1;
  if (s.phase === 'transport') return s.haul === 1;
  if (s.phase === 'forklift') return s.selected !== null && s.forkTravel === 1;
  return s.phase === 'unload' && s.lift === 1 && distance(s.load, QUAY[s.unloaded.length]) < 0.2;
}
function commit(s: PortState): PortState {
  if (s.phase === 'boat') return nextPhase(s, 'truck');
  if (s.phase === 'truck') return nextPhase(s, 'unload');
  if (s.phase === 'transport') return nextPhase(s, 'departure');
  return { ...resetInput(s), action: s.phase === 'unload' ? 'lowering' : s.carrying ? 'loading' : 'picking' };
}
export function release(s: PortState, cancelled = false): PortState {
  if (s.action !== 'dragging') return s;
  if (!cancelled && (reached(s) || s.phase === 'unload' && s.moved && s.aim && distance(s.aim, QUAY[s.unloaded.length]) < 0.2)) return commit(s);
  const tapped = s.phase === 'unload' && s.lift === 0 && !s.moved;
  return { ...resetInput(s), action: 'ready', selected: tapped ? null : s.selected };
}
const toward = (value: number, goal: number, step: number) => Math.abs(goal - value) <= step ? goal : value + Math.sign(goal - value) * step;
export function advance(s: PortState, seconds: number): PortState {
  const dt = clamp(seconds, 0, 0.1); if (!dt || s.phase === 'complete') return s;
  if (s.action === 'dragging') {
    let n = { ...s };
    if (s.phase === 'unload' && s.moved && s.aim) {
      n.lift = clamp(s.lift + dt / 0.55);
      const length = distance(s.load, s.aim);
      if (n.lift === 1) n.load = mix(s.load, s.aim, length ? Math.min(1, dt * 8 / length) : 1);
    } else if (s.desired !== null) {
      const key = s.phase === 'boat' ? 'boat' : s.phase === 'truck' ? 'truck' : s.phase === 'transport' ? 'haul' : 'forkTravel';
      const speed = s.phase === 'forklift' ? 3.5 / pathLength(forkRoute(s)) : 0.35;
      n[key] = toward(s[key], s.desired, dt * speed);
    }
    // Reaching the exit lane hands off the remaining departure automatically.
    if (s.phase === 'transport' && n.haul === 1 && n.moved) return commit(n);
    n.elapsed = reached(n) ? s.elapsed + dt : 0;
    return n.elapsed >= 0.4 ? commit(n) : n;
  }
  if (s.action === 'ready') return s;
  const n = { ...s, elapsed: s.elapsed + dt };
  if (s.action === 'lowering' && n.elapsed >= loweringDuration(s)) {
    n.unloaded = [...s.unloaded, s.selected!]; n.load = { ...QUAY[s.unloaded.length] }; n.lift = 0; n.selected = null; n.action = 'ready'; n.elapsed = 0;
    return n.unloaded.length === 2 ? nextPhase(n, 'crane-exit') : n;
  }
  if (s.action === 'picking' && n.elapsed >= 0.65) return { ...resetInput(n), action: 'ready', carrying: true, forkTravel: 0 };
  if (s.action === 'loading' && n.elapsed >= 1.4) return { ...resetInput(n), action: 'returning', loaded: [...s.loaded, s.selected!], carrying: false };
  if (s.action === 'returning' && n.elapsed >= 2) {
    const ready = { ...resetInput(n), action: 'ready' as const, selected: null, forkTravel: 0 };
    return ready.loaded.length === 2 ? nextPhase(ready, 'forklift-exit') : ready;
  }
  if (s.phase === 'crane-exit' && n.elapsed >= 4) return nextPhase(n, 'forklift');
  if (s.phase === 'forklift-exit' && n.elapsed >= 3.5) return nextPhase(n, 'transport');
  if (s.phase === 'departure' && n.elapsed >= 3.6) return nextPhase(n, 'arrival');
  if (s.phase === 'arrival' && n.elapsed >= 6) return nextPhase(n, 'complete');
  return n;
}
export function progress(s: PortState) {
  return clamp((s.boat + s.truck + s.unloaded.length + s.loaded.length + s.haul + (s.phase === 'complete' ? 1 : s.phase === 'arrival' ? s.elapsed / 6 : 0)) / 8);
}
export function resumePort(value: unknown): PortState | undefined {
  if (!value || typeof value !== 'object') return;
  const s = value as PortState;
  const fraction = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
  const order = (a: unknown): a is Cargo[] => Array.isArray(a) && a.length <= 2 && a.every(id => id === 0 || id === 1) && new Set(a).size === a.length;
  if (s.version !== 1 || !validRound(s.round) || !stages.includes(s.phase) || !['ready', 'dragging', 'auto', 'lowering', 'picking', 'loading', 'returning'].includes(s.action)) return;
  if (![s.boat, s.truck, s.haul, s.forkTravel, s.lift].every(fraction) || !order(s.unloaded) || !order(s.loaded) || !s.loaded.every(id => s.unloaded.includes(id))) return;
  if (s.selected !== null && s.selected !== 0 && s.selected !== 1 || typeof s.carrying !== 'boolean' || !Number.isFinite(s.elapsed) || s.elapsed < 0) return;
  if (!s.load || !Number.isFinite(s.load.x) || !Number.isFinite(s.load.z) || s.load.x < -1.8 || s.load.x > 4.3 || s.load.z < -5.8 || s.load.z > -1.35) return;
  const i = stages.indexOf(s.phase), auto = ['crane-exit', 'forklift-exit', 'departure', 'arrival', 'complete'].includes(s.phase);
  if (i > 0 && s.boat !== 1 || i > 1 && s.truck !== 1 || i > 6 && s.haul !== 1) return;
  if (i < 2 && (s.unloaded.length || s.loaded.length || s.selected !== null) || i >= 3 && s.unloaded.length !== 2 || i < 4 && s.loaded.length || i >= 5 && s.loaded.length !== 2) return;
  if (s.phase === 'boat' && (s.truck || s.haul) || i < 6 && s.haul || auto && s.action !== 'auto' || !auto && s.action === 'auto') return;
  if (s.phase === 'unload') {
    if (s.unloaded.length === 2 || s.selected !== null && s.unloaded.includes(s.selected) || !['ready', 'dragging', 'lowering'].includes(s.action) || s.action === 'lowering' && s.selected === null) return;
  } else if (s.phase === 'forklift') {
    if (!['ready', 'dragging', 'picking', 'loading', 'returning'].includes(s.action)) return;
    if (s.selected !== null && !s.unloaded.includes(s.selected) || s.selected === null && (s.carrying || s.forkTravel || !['ready', 'dragging'].includes(s.action))) return;
    if (s.action === 'returning' ? s.selected === null || !s.loaded.includes(s.selected) || s.carrying : s.selected !== null && s.loaded.includes(s.selected)) return;
    if (s.action === 'picking' && (s.selected === null || s.carrying || s.forkTravel !== 1) || s.action === 'loading' && (!s.carrying || s.forkTravel !== 1)) return;
    if (s.loaded.length === 2 && s.action !== 'returning') return;
  } else if (s.selected !== null || s.carrying || s.forkTravel || !auto && !['ready', 'dragging'].includes(s.action)) return;
  if (s.phase !== 'forklift' && s.carrying) return;
  const restored = structuredClone(s);
  if (s.action === 'dragging') { restored.action = 'ready'; restored.elapsed = 0; }
  restored.desired = null; restored.aim = null; restored.moved = false;
  if (restored.phase === 'transport' && restored.haul === 1) return nextPhase(restored, 'departure');
  return restored;
}
