import { DEFAULT_ROUND, ROOF_HEIGHTS, validRound } from './round.ts';
import type { HouseRound } from './round.ts';
import { ARRIVAL, SITE_FINISH_SECONDS } from './arrival.ts';

export const stages = ['gravel', 'concrete', 'delivery-one', 'crane-one', 'delivery-two', 'crane-two', 'roof-color', 'decorate', 'complete'] as const;
export type Stage = typeof stages[number];
export type Action = 'entering' | 'ready' | 'dragging' | 'working' | 'leaving' | 'finishing' | 'pickup' | 'placing' | 'resetting';
export interface Point { x: number; z: number }
export const HOUSE = { x: 2, z: -0.4 };
export const POUR_TARGETS = [{ x: 0.4, z: -0.4 }, { x: 2, z: -0.4 }, { x: 3.6, z: -0.4 }];
export const POUR_RADIUS = 0.85;
export const PARTS = [
  { name: '一樓前牆', base: 0.35, height: 2, lift: 2.9, kind: 'front' },
  { name: '一樓後牆', base: 0.35, height: 2, lift: 2.9, kind: 'back' },
  { name: '二樓樓板', base: 2.4, height: 0.22, lift: 3, kind: 'floor' },
  { name: '二樓前牆', base: 2.62, height: 2, lift: 5.2, kind: 'front' },
  { name: '二樓後牆', base: 2.62, height: 2, lift: 5.2, kind: 'back' },
  { name: '屋頂', base: 4.67, height: 1.2, lift: 5.3, kind: 'roof' },
] as const;
export const ROOF_COLORS = ['#d87f65', '#739f91', '#769bb7'] as const;
export const partFor = (round: HouseRound, index: number) => {
  const part = PARTS[Math.min(index, PARTS.length - 1)];
  return { ...part, height: part.kind === 'roof' ? ROOF_HEIGHTS[round.roof] : part.height };
};
export const LOAD_HOME: Point = { x: -3.1, z: -0.4 };
export const DELIVERY_START = -6;
export const DELIVERY_STOP = 0.5;
export interface HouseState {
  version: 5; round: HouseRound; phase: Stage; action: Action; elapsed: number;
  gravel: number; pours: number[]; chute: Point; placed: number;
  truckX: number; dragPx: number; load: Point; from: Point; color: number;
}
// The last lift needs time to stow the crane before it drives away.
export const leavingDuration = (s: HouseState) => s.phase === 'crane-one' ? 2.2 : s.phase === 'crane-two' ? 2.6 : 1.4;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
export const isCrane = (s: HouseState) => s.phase === 'crane-one' || s.phase === 'crane-two';
export const isDelivery = (s: HouseState) => s.phase === 'delivery-one' || s.phase === 'delivery-two';
export function createHouse(phase: Stage = 'gravel', round: HouseRound = DEFAULT_ROUND): HouseState {
  const index = stages.indexOf(phase);
  return {
    version: 5, round: { ...round }, phase, action: index >= 6 ? 'ready' : phase.startsWith('crane') ? 'pickup' : 'entering', elapsed: 0,
    gravel: index > 0 ? 1 : 0, pours: index > 1 ? [1, 1, 1] : [0, 0, 0], chute: { x: -0.8, z: 1.8 },
    placed: phase === 'roof-color' ? 5 : index >= 7 ? 6 : index >= 4 ? 3 : 0, truckX: DELIVERY_START,
    dragPx: 0, load: { ...LOAD_HOME }, from: { ...LOAD_HOME }, color: round.palette % ROOF_COLORS.length,
  };
}
export function grab(s: HouseState): HouseState {
  return s.action === 'ready' && !['roof-color', 'decorate', 'complete'].includes(s.phase) ? { ...s, action: 'dragging', dragPx: 0 } : s;
}
export function dragGravel(s: HouseState, upward: number): HouseState {
  if (s.phase !== 'gravel' || s.action !== 'dragging' || !Number.isFinite(upward)) return s;
  return upward >= 60 ? { ...s, dragPx: 60, action: 'working', elapsed: 0 } : { ...s, dragPx: clamp(upward, 0, 60) };
}
export function moveChute(s: HouseState, p: Point): HouseState {
  return s.phase === 'concrete' && s.action === 'dragging' && finitePoint(p)
    ? { ...s, chute: { x: clamp(p.x, -1, 4.8), z: clamp(p.z, -2.3, 2.3) } } : s;
}
export function pourIndex(s: HouseState, point: Point = s.chute): number {
  let nearest = -1, distance = POUR_RADIUS;
  POUR_TARGETS.forEach((target, i) => {
    const d = Math.hypot(point.x - target.x, point.z - target.z);
    if (s.pours[i] < 1 && d < distance) { nearest = i; distance = d; }
  });
  return nearest;
}
export function drive(s: HouseState, x: number): HouseState {
  if (!isDelivery(s) || s.action !== 'dragging' || !Number.isFinite(x)) return s;
  const truckX = clamp(x, DELIVERY_START, DELIVERY_STOP);
  return truckX >= DELIVERY_STOP - 0.15 ? { ...s, truckX: DELIVERY_STOP, action: 'working', elapsed: 0 } : { ...s, truckX };
}
export function moveLoad(s: HouseState, p: Point): HouseState {
  return isCrane(s) && s.action === 'dragging' && finitePoint(p)
    ? { ...s, load: { x: clamp(p.x, -4.5, 4.8), z: clamp(p.z, -2.5, 2.2) } } : s;
}
export const atTarget = (s: HouseState) => Math.hypot(s.load.x - HOUSE.x, s.load.z - HOUSE.z) < 0.85;
export function release(s: HouseState, cancelled = false, targetReached = atTarget(s)): HouseState {
  if (s.action !== 'dragging') return s;
  if (isCrane(s)) return { ...s, action: !cancelled && targetReached ? 'placing' : 'resetting', elapsed: 0, from: { ...s.load } };
  return { ...s, action: 'ready', dragPx: 0 };
}
function startRoofLift(s: HouseState): HouseState {
  return s.phase === 'roof-color' ? { ...s, phase: 'crane-two', action: 'pickup', elapsed: 0, load: { ...LOAD_HOME }, from: { ...LOAD_HOME } } : s;
}
export function advance(s: HouseState, delta: number): HouseState {
  if (!Number.isFinite(delta) || delta <= 0 || s.phase === 'complete') return s;
  // Old colour-choice saves keep their colour and automatically start the final lift.
  if (s.phase === 'roof-color') return startRoofLift(s);
  const dt = Math.min(delta, 0.1), elapsed = s.elapsed + dt;
  // One persisted clock drives driving, parking, disembarking and walking.
  if (s.phase === 'decorate') return elapsed >= ARRIVAL.duration
    ? { ...s, phase: 'complete', elapsed: 0 } : { ...s, elapsed };
  let next = { ...s, elapsed };
  if (s.action === 'finishing') {
    if (elapsed < SITE_FINISH_SECONDS) return next;
    const phase: Stage = s.phase === 'gravel' ? 'concrete' : s.phase === 'concrete' ? 'delivery-one' : s.phase === 'crane-one' ? 'delivery-two' : 'decorate';
    return { ...next, phase, action: phase === 'decorate' ? 'ready' : 'entering', elapsed: 0, truckX: DELIVERY_START, dragPx: 0 };
  }
  if (s.action === 'entering' && elapsed >= 1.2) return { ...next, action: 'ready', elapsed: 0 };
  if (s.phase === 'gravel' && s.action === 'working') {
    next.gravel = clamp(elapsed / 1.9);
    if (elapsed >= 2.3) return { ...next, action: 'leaving', elapsed: 0 };
  }
  if (s.phase === 'concrete' && s.action === 'dragging') {
    const target = pourIndex(s);
    if (target >= 0) {
      next.pours = s.pours.map((v, i) => i === target ? clamp(v + dt / 1.15) : v);
      if (next.pours.every(v => v === 1)) return { ...next, action: 'working', elapsed: 0 };
    }
  }
  if (s.phase === 'concrete' && s.action === 'working' && elapsed >= 0.9) return { ...next, action: 'leaving', elapsed: 0 };
  if (isDelivery(s) && s.action === 'working' && elapsed >= 0.6) return { ...next, phase: s.phase === 'delivery-one' ? 'crane-one' : 'crane-two', action: 'pickup', elapsed: 0 };
  if (isCrane(s)) {
    if (s.action === 'pickup' && elapsed >= 1.25) return { ...next, action: 'ready', elapsed: 0, load: { ...LOAD_HOME } };
    if (s.action === 'resetting') {
      const t = smooth(elapsed / 0.5);
      next.load = { x: s.from.x + (LOAD_HOME.x - s.from.x) * t, z: s.from.z + (LOAD_HOME.z - s.from.z) * t };
      if (elapsed >= 0.5) return { ...next, action: 'ready', elapsed: 0, load: { ...LOAD_HOME } };
    }
    if (s.action === 'placing' && elapsed >= 1.25) {
      const placed = s.placed + 1;
      return { ...next, placed, load: { ...LOAD_HOME }, action: placed === 3 || placed === 6 ? 'leaving' : 'pickup', elapsed: 0 };
    }
  }
  if (s.action === 'leaving' && elapsed >= leavingDuration(s)) {
    return { ...next, action: 'finishing', elapsed: 0 };
  }
  return next;
}
function finitePoint(p: Point) { return p && Number.isFinite(p.x) && Number.isFinite(p.z) && Math.abs(p.x) < 30 && Math.abs(p.z) < 30; }
export function resumeHouse(value: unknown): HouseState | undefined {
  if (!value || typeof value !== 'object') return;
  const version = (value as { version: unknown }).version;
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== 5) return;
  const s = { ...value, version: 5, round: version >= 3 ? (value as HouseState).round : { ...DEFAULT_ROUND } } as HouseState;
  if (!validRound(s.round) || !stages.includes(s.phase) || !['entering', 'ready', 'dragging', 'working', 'leaving', 'finishing', 'pickup', 'placing', 'resetting'].includes(s.action)
    || ![s.elapsed, s.gravel, s.truckX, s.dragPx, s.placed, s.color].every(Number.isFinite)
    || s.elapsed < 0 || s.elapsed > 1e7 || s.gravel < 0 || s.gravel > 1
    || !Array.isArray(s.pours) || s.pours.length !== 3 || !s.pours.every(v => Number.isFinite(v) && v >= 0 && v <= 1)
    || ![s.chute, s.load, s.from].every(finitePoint) || !Number.isInteger(s.placed) || s.placed < 0 || s.placed > 6
    || !Number.isInteger(s.color) || s.color < 0 || s.color > 2 || s.truckX < DELIVERY_START || s.truckX > DELIVERY_STOP
    || s.dragPx < 0 || s.dragPx > 60) return;
  const minPlaced = s.phase === 'roof-color' ? 5 : stages.indexOf(s.phase) >= 7 ? 6 : stages.indexOf(s.phase) >= 4 ? 3 : 0;
  const maxPlaced = isCrane(s) ? (s.phase === 'crane-one' ? 3 : 6) : minPlaced;
  if (s.placed < minPlaced || s.placed > maxPlaced || (isCrane(s) && (s.placed === maxPlaced) !== (s.action === 'leaving' || s.action === 'finishing'))) return;
  const index = stages.indexOf(s.phase);
  if ((index > 0 && s.gravel !== 1) || (index > 1 && !s.pours.every(v => v === 1)) || (index === 0 && s.pours.some(v => v !== 0))) return;
  if (version < 3) {
    const firstIncomplete = s.pours.findIndex(v => v < 1);
    if (firstIncomplete >= 0 && s.pours.slice(firstIncomplete + 1).some(v => v !== 0)) return;
  }
  const allowed: readonly Action[] = isCrane(s) ? ['pickup', 'ready', 'dragging', 'placing', 'resetting', 'leaving', 'finishing']
    : isDelivery(s) ? ['entering', 'ready', 'dragging', 'working']
    : index >= 6 ? ['ready'] : ['entering', 'ready', 'dragging', 'working', 'leaving', 'finishing'];
  if (!allowed.includes(s.action) || (s.phase === 'concrete' && ['working', 'leaving', 'finishing'].includes(s.action) && s.pours.some(v => v < 1))) return;
  if (s.action === 'finishing' && (version < 5 || s.elapsed >= SITE_FINISH_SECONDS || s.gravel !== 1)) return;
  if (s.phase === 'decorate') {
    if (version < 4) s.elapsed = 0; // Old doorbell/welcome clocks did not describe an arrival.
    else if (s.elapsed >= ARRIVAL.duration) return;
  }
  // Keep the old pickup point and chosen colour when upgrading unfinished roofs.
  // The compatibility phase automatically starts pickup on the next frame.
  if (version === 1 && s.phase === 'crane-two' && s.placed === 5) {
    return { ...s, phase: 'roof-color', action: 'ready', elapsed: 0, load: { ...LOAD_HOME }, from: { ...LOAD_HOME } };
  }
  return release(structuredClone(s), true);
}
export function progress(s: HouseState) {
  return (s.gravel + s.pours.reduce((a, b) => a + b, 0) / 3 + (stages.indexOf(s.phase) >= 3 ? 1 : 0) + (stages.indexOf(s.phase) >= 5 ? 1 : 0) + s.placed + (s.phase === 'complete' ? 1 : s.phase === 'decorate' ? s.elapsed / ARRIVAL.duration : 0)) / 11;
}
