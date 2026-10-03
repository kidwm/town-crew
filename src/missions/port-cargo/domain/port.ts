export type Point = { x: number; z: number };
export type Cargo = 0 | 1;
export type Direction = 'unload' | 'load';
export type Round = { layout: 0 | 1; palette: number; direction: Direction };
type LegacyRound = Omit<Round, 'direction'>;
export const stages = ['boat', 'truck', 'unload', 'crane-exit', 'forklift', 'forklift-exit', 'transport', 'departure', 'arrival', 'complete', 'crane-ready', 'load-ship', 'ship-transport'] as const;
export type Stage = typeof stages[number];
const unloadStages: Stage[] = ['boat', 'truck', 'unload', 'crane-exit', 'forklift', 'forklift-exit', 'transport', 'departure', 'arrival', 'complete'];
const loadStages: Stage[] = ['boat', 'truck', 'forklift', 'forklift-exit', 'crane-ready', 'load-ship', 'crane-exit', 'ship-transport', 'departure', 'arrival', 'complete'];
export const missionStages = (direction: Direction) => direction === 'load' ? loadStages : unloadStages;
export const stageIndex = (s: PortState) => missionStages(s.round.direction).indexOf(s.phase);
export const isCraneStage = (s: PortState) => s.phase === 'unload' || s.phase === 'load-ship';
const manualStages: Stage[] = ['boat', 'truck', 'unload', 'load-ship', 'forklift', 'transport', 'ship-transport'];
export type Action = 'ready' | 'dragging' | 'lowering' | 'picking' | 'loading' | 'returning' | 'auto';
export interface PortState {
  version: 2; round: Round; phase: Stage; action: Action;
  boat: number; truck: number; haul: number; forkTravel: number;
  unloaded: Cargo[]; loaded: Cargo[]; selected: Cargo | null; carrying: boolean;
  load: Point; lift: number; elapsed: number;
  // Desired input and dwell are transient; resume/release always discard them.
  desired: number | null; aim: Point | null; moved: boolean;
}
export const SHIP_Z = -6.2, ROAD_Z = 8.5, LOAD_HEIGHT = 3.25, FORK_OFFSET = 2.3, LOADING_APPROACH = 1.9;
export const HAUL_END = -8.5, SHIP_HAUL_END = 7.5;
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
export const mirror = (round: Round | LegacyRound, p: Point): Point => ({ x: round.layout ? -p.x : p.x, z: p.z });
export function validRound(value: unknown): value is Round {
  if (!value || typeof value !== 'object') return false;
  const r = value as Round;
  return (r.layout === 0 || r.layout === 1) && Number.isInteger(r.palette) && r.palette >= 0 && r.palette < 4 && (r.direction === 'unload' || r.direction === 'load');
}
export function readRound(value: unknown): Round | undefined {
  if (!value || typeof value !== 'object') return;
  const r = value as Partial<Round>, normalized = { ...r, direction: r.direction === undefined ? 'unload' : r.direction };
  return validRound(normalized) ? normalized : undefined;
}
export function chooseRound(previous?: Round | LegacyRound, random = Math.random): Round {
  const n = clamp(random(), 0, 0.999999);
  const old = readRound(previous);
  return { layout: n < 0.5 ? 0 : 1, direction: old ? old.direction === 'unload' ? 'load' : 'unload' : Math.floor(n * 4) % 2 ? 'load' : 'unload',
    palette: previous ? (previous.palette + 1 + Math.floor(n * 3)) % 4 : Math.floor(n * 4) };
}
export function createPort(phase: Stage = 'boat', round: Round | LegacyRound = { layout: 0, palette: 0, direction: 'unload' }): PortState {
  const normalized = readRound(round)!, sequence = missionStages(normalized.direction);
  if (!sequence.includes(phase)) phase = 'boat';
  const i = sequence.indexOf(phase), outgoing = normalized.direction === 'load';
  return { version: 2, round: normalized, phase, action: manualStages.includes(phase) ? 'ready' : 'auto',
    boat: i > 0 ? 1 : 0, truck: i > 1 ? 1 : 0, haul: i > (outgoing ? 7 : 6) ? 1 : 0, forkTravel: 0,
    unloaded: i >= 3 ? [0, 1] : [], loaded: i >= (outgoing ? 6 : 5) ? [0, 1] : [], selected: null, carrying: false,
    load: { ...(outgoing ? QUAY[0] : DECK[0]) }, lift: 0, elapsed: 0, desired: null, aim: null, moved: false };
}
export const craneSource = (s: PortState, id: Cargo) => s.round.direction === 'load' ? quayFor(s, id) : DECK[id];
export const craneTarget = (s: PortState) => s.round.direction === 'load' ? DECK[Math.min(s.loaded.length, 1)] : QUAY[Math.min(s.unloaded.length, 1)];
export const craneLandingHeight = (s: PortState) => s.round.direction === 'load' ? 0.62 : 0.04;
export const forkCount = (s: PortState) => s.round.direction === 'load' ? s.unloaded.length : s.loaded.length;
export const forkSource = (s: PortState, id: Cargo) => s.round.direction === 'load' ? TRUCK_SLOTS[id] : quayFor(s, id);
export const forkDestination = (s: PortState) => s.round.direction === 'load' ? QUAY[Math.min(s.unloaded.length, 1)] : TRUCK_SLOTS[Math.min(s.loaded.length, 1)];
export const pickupDuration = (s: PortState) => s.round.direction === 'load' ? 2.45 : 0.65;
export const forkLoadingDuration = (s: PortState) => s.round.direction === 'load' ? 1 : 1.4;
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
export function pickupYaw(s: PortState, id: Cargo) { return s.round.direction === 'load' ? Math.PI : pickupSide(s, id) * Math.PI / 2; }
export function forkHome(s: PortState) { return s.round.direction === 'unload' && s.loaded.length === 1 ? SECOND_HOME : HOME; }
export function pickupRoute(s: PortState, id: Cargo): Point[] {
  if (s.round.direction === 'load') {
    const p = TRUCK_SLOTS[id], end = { x: p.x, z: ROAD_Z - FORK_OFFSET - LOADING_APPROACH };
    return Array.from({ length: 21 }, (_, i) => {
      const t = i / 20, u = 1 - t;
      return { x: u ** 3 * HOME.x + 3 * u * u * t * HOME.x + 3 * u * t * t * end.x + t ** 3 * end.x,
        z: u ** 3 * HOME.z + 3 * u * u * t * (HOME.z + 0.4) + 3 * u * t * t * (end.z - 0.4) + t ** 3 * end.z };
    });
  }
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
  if (s.round.direction === 'load') {
    const source = TRUCK_SLOTS[s.selected!], goal = forkDestination(s);
    const start = { x: source.x, z: ROAD_Z - FORK_OFFSET - LOADING_APPROACH }, end = { x: goal.x, z: goal.z + FORK_OFFSET + 1.1 };
    return Array.from({ length: 21 }, (_, i) => {
      const t = i / 20, u = 1 - t;
      return { x: u ** 3 * start.x + 3 * u * u * t * start.x + 3 * u * t * t * end.x + t ** 3 * end.x,
        z: u ** 3 * start.z + 3 * u * u * t * (start.z - 0.8) + 3 * u * t * t * (end.z + 0.8) + t ** 3 * end.z };
    });
  }
  const slot = TRUCK_SLOTS[s.loaded.length], p = quayFor(s, s.selected!), side = pickupSide(s, s.selected!);
  const start = { x: p.x + side * FORK_OFFSET, z: p.z }, radius = 1.6;
  // Turn forward toward land as soon as the pallet lifts. The carried box
  // swings away from the remaining bay, without retracing the pickup route.
  const arc = Array.from({ length: 13 }, (_, i) => {
    const angle = i / 12 * Math.PI / 2;
    return { x: start.x - side * radius * Math.sin(angle), z: start.z + radius * (1 - Math.cos(angle)) };
  });
  return [...arc, { x: arc.at(-1)!.x, z: HOME.z - 0.8 }, { x: slot.x, z: HOME.z }, { x: slot.x, z: ROAD_Z - FORK_OFFSET - LOADING_APPROACH }];
}
export function returnRoute(s: PortState): Point[] {
  if (s.round.direction === 'load') {
    const p = QUAY[s.unloaded.length - 1];
    return [{ x: p.x, z: p.z + FORK_OFFSET }, { x: p.x, z: HOME.z }, HOME];
  }
  const slot = TRUCK_SLOTS[s.loaded.length - 1], home = forkHome(s);
  return [{ x: slot.x, z: ROAD_Z - FORK_OFFSET }, { x: slot.x, z: HOME.z }, { x: home.x, z: HOME.z }, ...(home.z === HOME.z ? [] : [home])];
}
export function forkRoute(s: PortState, candidate: Cargo = s.selected ?? s.unloaded.find(id => !s.loaded.includes(id)) ?? 0) {
  return s.carrying ? deliveryRoute(s) : pickupRoute(s, candidate);
}
export function forkPose(s: PortState, exit = 22) {
  if (s.action === 'returning') {
    const route = returnRoute(s), outgoing = s.round.direction === 'load';
    const headings = route.slice(1).map((p, i) => i === 0 ? outgoing ? 0 : Math.PI : Math.atan2(-(p.x - route[i].x), -(p.z - route[i].z)));
    return pathPose(route, smooth(s.elapsed / 2), headings, outgoing ? 0 : Math.PI, outgoing ? Math.PI : 0);
  }
  const outgoing = s.round.direction === 'load', homeYaw = outgoing ? Math.PI : 0;
  if (s.phase === 'forklift-exit') return { ...mix(HOME, { x: -exit, z: HOME.z }, smooth((s.elapsed - 0.4) / 3.1)), yaw: homeYaw + (Math.PI / 2 - homeYaw) * smooth(s.elapsed / 0.4), segment: 0 };
  if (s.phase !== 'forklift' || s.selected === null) return { ...forkHome(s), yaw: homeYaw, segment: 0 };
  const route = forkRoute(s);
  const p = pathPose(route, s.forkTravel, undefined, outgoing ? s.carrying ? 0 : homeYaw : s.carrying ? pickupYaw(s, s.selected) : 0, s.carrying ? outgoing ? 0 : Math.PI : pickupYaw(s, s.selected));
  if (s.action === 'picking' && outgoing) {
    p.z += LOADING_APPROACH * (smooth((s.elapsed - 0.6) / 0.5) - smooth((s.elapsed - 1.35) / 0.5));
    p.yaw = Math.PI * (1 - smooth((s.elapsed - 1.85) / 0.6));
  }
  if (s.action === 'loading') p.z += outgoing ? -1.1 * smooth(s.elapsed / 0.5) : LOADING_APPROACH * smooth((s.elapsed - 0.8) / 0.6);
  // Side pickup turns forward toward the truck; loading inserts only after lifting.
  return p;
}
export function forkHeight(s: PortState) {
  if (s.round.direction === 'load') {
    if (s.action === 'picking') return 0.04 + 1.2 * smooth(s.elapsed / 0.6) + 0.12 * smooth((s.elapsed - 1.1) / 0.25) - 1.06 * smooth((s.elapsed - 1.85) / 0.6);
    if (s.action === 'loading') return 0.3 - 0.26 * smooth((s.elapsed - 0.5) / 0.5);
    return s.carrying ? 0.3 : 0.04;
  }
  const f = forkPose(s);
  return s.action === 'loading' ? 0.3 + smooth(s.elapsed / 0.8) * 0.94 : s.action === 'returning' ? 0.04 + 1.2 * smooth((f.z - (ROAD_Z - FORK_OFFSET - LOADING_APPROACH)) / LOADING_APPROACH) : s.carrying ? 0.3 : s.action === 'picking' ? 0.04 + smooth(s.elapsed / 0.65) * 0.26 : 0.04;
}
export function available(s: PortState): Cargo[] {
  if (isCraneStage(s)) return s.selected === null ? s.round.direction === 'load' ? s.unloaded.filter(id => !s.loaded.includes(id)) : ([0, 1] as Cargo[]).filter(id => !s.unloaded.includes(id)) : [s.selected];
  if (s.phase === 'forklift') return s.selected === null ? s.round.direction === 'load' ? ([0, 1] as Cargo[]).filter(id => !s.unloaded.includes(id)) : s.unloaded.filter(id => !s.loaded.includes(id)) : [s.selected];
  return [];
}
function resetInput(s: PortState): PortState { return { ...s, desired: null, aim: null, moved: false, elapsed: 0 }; }
function nextPhase(s: PortState, phase: Stage): PortState {
  return { ...resetInput(s), phase, action: manualStages.includes(phase) ? 'ready' : 'auto', selected: null, forkTravel: 0, carrying: false };
}
export function grab(s: PortState, id?: Cargo): PortState {
  if (s.action !== 'ready') return s;
  if (isCraneStage(s)) {
    const selected = s.selected ?? id;
    if (selected === undefined || !available(s).includes(selected)) return s;
    return { ...resetInput(s), action: 'dragging', selected, load: s.selected === null ? { ...craneSource(s, selected) } : s.load };
  }
  if (!['boat', 'truck', 'forklift', 'transport', 'ship-transport'].includes(s.phase)) return s;
  const parked = s.phase === 'boat' ? s.boat === 1 : s.phase === 'truck' ? s.truck === 1 : ['transport', 'ship-transport'].includes(s.phase) ? s.haul === 1 : s.selected !== null && s.forkTravel === 1;
  return { ...resetInput(s), action: 'dragging', moved: parked };
}
export function drive(s: PortState, desired: number, candidate?: Cargo): PortState {
  if (s.action !== 'dragging' || !Number.isFinite(desired)) return s;
  if (s.phase === 'forklift' && s.selected === null) {
    if (candidate === undefined || !available(s).includes(candidate)) return s;
    return { ...s, selected: candidate, desired: clamp(desired), moved: true };
  }
  if (!['boat', 'truck', 'forklift', 'transport', 'ship-transport'].includes(s.phase)) return s;
  return { ...s, desired: clamp(desired), moved: true };
}
export function moveLoad(s: PortState, aim: Point): PortState {
  if (!isCraneStage(s) || s.action !== 'dragging' || !Number.isFinite(aim.x) || !Number.isFinite(aim.z)) return s;
  return { ...s, aim: { x: clamp(aim.x, -1.8, 4.3), z: clamp(aim.z, -5.8, -1.35) }, moved: true };
}
export function loweringDuration(s: PortState) { return s.lift === 1 && distance(s.load, craneTarget(s)) < 0.2 ? 0.8 : 2; }
function reached(s: PortState) {
  if (!s.moved) return false;
  if (s.phase === 'boat') return s.boat === 1;
  if (s.phase === 'truck') return s.truck === 1;
  if (s.phase === 'transport' || s.phase === 'ship-transport') return s.haul === 1;
  if (s.phase === 'forklift') return s.selected !== null && s.forkTravel === 1;
  return isCraneStage(s) && s.lift === 1 && distance(s.load, craneTarget(s)) < 0.2;
}
function commit(s: PortState): PortState {
  if (s.phase === 'boat') return nextPhase(s, 'truck');
  if (s.phase === 'truck') return nextPhase(s, s.round.direction === 'load' ? 'forklift' : 'unload');
  if (s.phase === 'transport' || s.phase === 'ship-transport') return nextPhase(s, 'departure');
  return { ...resetInput(s), action: isCraneStage(s) ? 'lowering' : s.carrying ? 'loading' : 'picking' };
}
export function release(s: PortState, cancelled = false): PortState {
  if (s.action !== 'dragging') return s;
  if (!cancelled && (reached(s) || isCraneStage(s) && s.moved && s.aim && distance(s.aim, craneTarget(s)) < 0.2)) return commit(s);
  const tapped = isCraneStage(s) && s.lift === 0 && !s.moved;
  return { ...resetInput(s), action: 'ready', selected: tapped ? null : s.selected };
}
const toward = (value: number, goal: number, step: number) => Math.abs(goal - value) <= step ? goal : value + Math.sign(goal - value) * step;
export function advance(s: PortState, seconds: number): PortState {
  const dt = clamp(seconds, 0, 0.1); if (!dt || s.phase === 'complete') return s;
  if (s.action === 'dragging') {
    let n = { ...s };
    if (isCraneStage(s) && s.moved && s.aim) {
      n.lift = clamp(s.lift + dt / 0.55);
      const length = distance(s.load, s.aim);
      if (n.lift === 1) n.load = mix(s.load, s.aim, length ? Math.min(1, dt * 8 / length) : 1);
    } else if (s.desired !== null) {
      const key = s.phase === 'boat' ? 'boat' : s.phase === 'truck' ? 'truck' : s.phase === 'transport' || s.phase === 'ship-transport' ? 'haul' : 'forkTravel';
      const speed = s.phase === 'forklift' ? 3.5 / pathLength(forkRoute(s)) : 0.35;
      n[key] = toward(s[key], s.desired, dt * speed);
    }
    // Reaching the exit lane hands off the remaining departure automatically.
    if ((s.phase === 'transport' || s.phase === 'ship-transport') && n.haul === 1 && n.moved) return commit(n);
    n.elapsed = reached(n) ? s.elapsed + dt : 0;
    return n.elapsed >= 0.4 ? commit(n) : n;
  }
  if (s.action === 'ready') return s;
  const n = { ...s, elapsed: s.elapsed + dt };
  if (s.action === 'lowering' && n.elapsed >= loweringDuration(s)) {
    if (s.round.direction === 'load') n.loaded = [...s.loaded, s.selected!]; else n.unloaded = [...s.unloaded, s.selected!];
    n.load = { ...craneTarget(s) }; n.lift = 0; n.selected = null; n.action = 'ready'; n.elapsed = 0;
    return (s.round.direction === 'load' ? n.loaded : n.unloaded).length === 2 ? nextPhase(n, 'crane-exit') : n;
  }
  if (s.action === 'picking' && n.elapsed >= pickupDuration(s)) return { ...resetInput(n), action: 'ready', carrying: true, forkTravel: 0 };
  if (s.action === 'loading' && n.elapsed >= forkLoadingDuration(s)) return { ...resetInput(n), action: 'returning', ...(s.round.direction === 'load' ? { unloaded: [...s.unloaded, s.selected!] } : { loaded: [...s.loaded, s.selected!] }), carrying: false };
  if (s.action === 'returning' && n.elapsed >= 2) {
    const ready = { ...resetInput(n), action: 'ready' as const, selected: null, forkTravel: 0 };
    return forkCount(ready) === 2 ? nextPhase(ready, 'forklift-exit') : ready;
  }
  if (s.phase === 'crane-ready' && n.elapsed >= 1.2) return nextPhase(n, 'load-ship');
  if (s.phase === 'crane-exit' && n.elapsed >= 4) return nextPhase(n, s.round.direction === 'load' ? 'ship-transport' : 'forklift');
  if (s.phase === 'forklift-exit' && n.elapsed >= 3.5) return nextPhase(n, s.round.direction === 'load' ? 'crane-ready' : 'transport');
  if (s.phase === 'departure' && n.elapsed >= 3.6) return nextPhase(n, 'arrival');
  if (s.phase === 'arrival' && n.elapsed >= 6) return nextPhase(n, 'complete');
  return n;
}
export function progress(s: PortState) {
  return clamp((s.boat + s.truck + s.unloaded.length + s.loaded.length + s.haul + (s.phase === 'complete' ? 1 : s.phase === 'arrival' ? s.elapsed / 6 : 0)) / 8);
}
export function resumePort(value: unknown): PortState | undefined {
  if (!value || typeof value !== 'object') return;
  const raw = value as Omit<Partial<PortState>, 'version' | 'round'> & { version?: unknown; round?: unknown }, legacy = raw.version === 1;
  const round = legacy ? readRound(raw.round) : validRound(raw.round) ? raw.round : undefined;
  if (!round || legacy && round.direction !== 'unload' || !legacy && raw.version !== 2) return;
  const s = { ...raw, version: 2, round } as PortState;
  const fraction = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
  const order = (a: unknown): a is Cargo[] => Array.isArray(a) && a.length <= 2 && a.every(id => id === 0 || id === 1) && new Set(a).size === a.length;
  if (!missionStages(round.direction).includes(s.phase) || !['ready', 'dragging', 'auto', 'lowering', 'picking', 'loading', 'returning'].includes(s.action)) return;
  if (![s.boat, s.truck, s.haul, s.forkTravel, s.lift].every(fraction) || !order(s.unloaded) || !order(s.loaded) || !s.loaded.every(id => s.unloaded.includes(id))) return;
  if (s.selected !== null && s.selected !== 0 && s.selected !== 1 || typeof s.carrying !== 'boolean' || !Number.isFinite(s.elapsed) || s.elapsed < 0) return;
  if (!s.load || !Number.isFinite(s.load.x) || !Number.isFinite(s.load.z) || s.load.x < -1.8 || s.load.x > 4.3 || s.load.z < -5.8 || s.load.z > -1.35) return;
  const i = stageIndex(s), outgoing = round.direction === 'load', haulIndex = outgoing ? 7 : 6;
  const auto = !manualStages.includes(s.phase);
  if (i > 0 && s.boat !== 1 || i > 1 && s.truck !== 1 || i > haulIndex && s.haul !== 1) return;
  if (i < 2 && (s.unloaded.length || s.loaded.length || s.selected !== null) || i >= 3 && s.unloaded.length !== 2) return;
  if (outgoing ? i < 5 && s.loaded.length || i >= 6 && s.loaded.length !== 2 : i < 4 && s.loaded.length || i >= 5 && s.loaded.length !== 2) return;
  if (s.phase === 'boat' && (s.truck || s.haul) || i < haulIndex && s.haul || auto && s.action !== 'auto' || !auto && s.action === 'auto') return;
  if (isCraneStage(s)) {
    const moved = outgoing ? s.loaded : s.unloaded;
    if (moved.length === 2 || s.selected !== null && (moved.includes(s.selected) || outgoing && !s.unloaded.includes(s.selected)) || !['ready', 'dragging', 'lowering'].includes(s.action) || s.action === 'lowering' && s.selected === null) return;
  } else if (s.phase === 'forklift') {
    if (!['ready', 'dragging', 'picking', 'loading', 'returning'].includes(s.action)) return;
    const moved = outgoing ? s.unloaded : s.loaded;
    if (s.selected !== null && !outgoing && !s.unloaded.includes(s.selected) || s.selected === null && (s.carrying || s.forkTravel || !['ready', 'dragging'].includes(s.action))) return;
    if (s.action === 'returning' ? s.selected === null || !moved.includes(s.selected) || s.carrying : s.selected !== null && moved.includes(s.selected)) return;
    if (s.action === 'picking' && (s.selected === null || s.carrying || s.forkTravel !== 1) || s.action === 'loading' && (!s.carrying || s.forkTravel !== 1)) return;
    if (moved.length === 2 && s.action !== 'returning') return;
  } else if (s.selected !== null || s.carrying || s.forkTravel || !auto && !['ready', 'dragging'].includes(s.action)) return;
  if (s.phase !== 'forklift' && s.carrying) return;
  const restored = structuredClone(s);
  if (s.action === 'dragging') { restored.action = 'ready'; restored.elapsed = 0; }
  restored.desired = null; restored.aim = null; restored.moved = false;
  if ((restored.phase === 'transport' || restored.phase === 'ship-transport') && restored.haul === 1) return nextPhase(restored, 'departure');
  return restored;
}
