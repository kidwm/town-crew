import { reachable } from '../../../runtime/excavator-arm.ts';
import type { Point } from '../../../runtime/excavator-arm.ts';
export type { Point } from '../../../runtime/excavator-arm.ts';

export const stages = ['intro', 'push', 'dozer-exit', 'truck-arrival', 'excavator-arrival', 'excavate', 'excavator-exit', 'haul', 'truck-exit', 'sweeper-arrival', 'sweep', 'sweeper-exit', 'reopen', 'complete'] as const;
export type Stage = typeof stages[number];
export type Pattern = 'spread' | 'cluster';
export interface Round { pattern: Pattern; layout: 0 | 1 }
export const DEFAULT_ROUND: Round = { pattern: 'spread', layout: 0 };
export const ARM_Z = -4.4;
export const PIVOT: Point = { x: -4, y: 2.35, z: ARM_Z };
export const HOME: Point = { x: -2.5, y: 1.4, z: -3.1 };
export const BED: Point = { x: 2.35, y: 2.25, z: ARM_Z };
export const CARRY_HEIGHT = 4.2;
export const PUSH_X = [-5.2, -1.45] as const;
export const PUSH_START = 4.65, PUSH_END = 1.95;
export const PUSH_HEADING = Math.PI / 4;
export function pushPoint(index: 0 | 1, amount: number): Point {
  return { x: PUSH_X[index] + (PUSH_START - PUSH_END) * amount, y: 1, z: PUSH_START + (PUSH_END - PUSH_START) * amount };
}
export const HAUL_START = 2.4, HAUL_END = -9;
export const SWEEP_START = -8, SWEEP_END = 8, SWEEP_Z = 3.4;
export const GUARDRAIL_Z = 7.2;
export const DWELL = 0.4;
export const smooth = (t: number) => { const n = Math.max(0, Math.min(1, t)); return n * n * (3 - 2 * n); };
export const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
export function rocks(round: Round): Point[] {
  return (round.pattern === 'spread' ? [[-1.7, -1.7], [0.25, -1.25], [2.05, -1.85]] : [[-1.45, -1.75], [0.05, -1.85], [1.65, -1.45]]).map(([x, z]) => ({ x, y: 0.65, z }));
}
export function cargo(slot: number): Point { return [{ x: 1.7, y: 2.1, z: ARM_Z }, { x: 2.9, y: 2.1, z: ARM_Z }, { x: 2.3, y: 3, z: ARM_Z }][slot]; }
export function validRound(value: unknown): value is Round {
  if (!value || typeof value !== 'object') return false;
  const r = value as Round; return ['spread', 'cluster'].includes(r.pattern) && [0, 1].includes(r.layout);
}
export function chooseRound(previous?: Round, random = Math.random): Round {
  const draw = () => Math.max(0, Math.min(0.999999, random()));
  return { pattern: previous ? previous.pattern === 'spread' ? 'cluster' : 'spread' : draw() < 0.5 ? 'spread' : 'cluster', layout: draw() < 0.5 ? 0 : 1 };
}
export interface MountainState {
  version: 1; round: Round; phase: Stage; action: 'ready' | 'dragging' | 'auto';
  motion: 'none' | 'lift' | 'unload' | 'return' | 'push-return' | 'drive-finish';
  elapsed: number; pushes: [number, number]; pushIndex: 0 | 1; haul: number; swept: number;
  delivered: number[]; carried: number | null; bucket: Point; from: Point; target: Point;
  desired: number; aimed: number | null; dwell: number;
}
const manual = (phase: Stage) => ['push', 'excavate', 'haul', 'sweep'].includes(phase);
export function createMountain(phase: Stage = 'intro', round: Round = DEFAULT_ROUND): MountainState {
  const index = stages.indexOf(phase);
  const bucket = { ...HOME };
  return { version: 1, round: { ...round }, phase, action: manual(phase) ? 'ready' : 'auto', motion: 'none', elapsed: 0,
    pushes: index > stages.indexOf('push') ? [1, 1] : [0, 0], pushIndex: index > stages.indexOf('push') ? 1 : 0,
    haul: index > stages.indexOf('haul') ? 1 : 0, swept: index > stages.indexOf('sweep') ? 1 : 0,
    delivered: index > stages.indexOf('excavate') ? [0, 1, 2] : [], carried: null, bucket, from: bucket, target: bucket, desired: 0, aimed: null, dwell: 0 };
}
function phase(s: MountainState, next: Stage): MountainState { return { ...s, phase: next, action: manual(next) ? 'ready' : 'auto', motion: 'none', elapsed: 0, dwell: 0, aimed: null, desired: 0 }; }
export function canGrab(s: MountainState) { return manual(s.phase) && s.action === 'ready'; }
export function grab(s: MountainState): MountainState {
  return canGrab(s) ? { ...s, action: 'dragging', desired: s.phase === 'push' ? s.pushes[s.pushIndex] : s.phase === 'haul' ? s.haul : s.swept, aimed: null, dwell: 0 } : s;
}
export function drive(s: MountainState, desired: number): MountainState {
  return s.action === 'dragging' && ['push', 'haul', 'sweep'].includes(s.phase) && Number.isFinite(desired) ? { ...s, desired: Math.max(0, Math.min(1, desired)), dwell: desired >= 0.999 ? s.dwell : 0 } : s;
}
export function moveBucket(s: MountainState, point: Point): MountainState {
  if (s.phase !== 'excavate' || s.action !== 'dragging' || ![point.x, point.y, point.z].every(Number.isFinite)) return s;
  const target = reachable({ x: Math.max(-2.5, Math.min(3.4, point.x)), y: s.carried === null ? 0.85 : CARRY_HEIGHT, z: Math.max(-5, Math.min(-0.4, point.z)) }, PIVOT);
  const aimed = s.carried === null ? rocks(s.round).findIndex((p, i) => !s.delivered.includes(i) && Math.hypot(target.x - p.x, target.z - p.z) < 0.85) : null;
  const id = aimed === -1 ? null : aimed;
  return { ...s, target, aimed: id, dwell: s.aimed === id && Math.hypot(s.target.x - target.x, s.target.z - target.z) < 0.15 ? s.dwell : 0 };
}
const atBed = (p: Point) => Math.hypot(p.x - BED.x, p.z - BED.z) < 0.95;
function commitBucket(s: MountainState): MountainState {
  if (s.carried === null && s.aimed !== null) return { ...s, carried: s.aimed, aimed: null, action: 'auto', motion: 'lift', from: s.bucket, elapsed: 0, dwell: 0 };
  if (s.carried !== null && atBed(s.target)) return { ...s, action: 'auto', motion: 'unload', from: s.bucket, elapsed: 0, dwell: 0 };
  return s;
}
function finishDrive(s: MountainState): MountainState {
  if (s.phase === 'push') return s.pushIndex === 0 ? { ...s, action: 'auto', motion: 'push-return', elapsed: 0, dwell: 0 } : phase(s, 'dozer-exit');
  return phase(s, s.phase === 'haul' ? 'truck-exit' : 'sweeper-exit');
}
export function release(s: MountainState, cancelled = false): MountainState {
  if (s.action !== 'dragging') return s;
  if (!cancelled && s.phase === 'excavate') { const next = commitBucket(s); if (next !== s) return next; }
  if (!cancelled && s.phase !== 'excavate' && s.desired >= 0.999) return { ...s, action: 'auto', motion: 'drive-finish', dwell: 0, elapsed: 0 };
  return { ...s, action: 'ready', target: s.bucket, desired: s.phase === 'push' ? s.pushes[s.pushIndex] : s.phase === 'haul' ? s.haul : s.swept, dwell: 0, aimed: null };
}
function toward(value: number, target: number, distance: number) { return value + Math.max(-distance, Math.min(distance, target - value)); }
export function advance(s: MountainState, delta: number): MountainState {
  if (!Number.isFinite(delta) || delta <= 0 || s.phase === 'complete') return s;
  const dt = Math.min(delta, 0.1), elapsed = s.elapsed + dt;
  if (s.action === 'dragging' || s.motion === 'drive-finish') {
    if (s.phase === 'excavate') {
      const bucket = mix(s.bucket, s.target, 1 - Math.exp(-24 * dt));
      const near = s.carried === null ? s.aimed !== null : atBed(s.target);
      const settled = Math.hypot(bucket.x - s.target.x, bucket.z - s.target.z) < 0.15;
      const next = { ...s, bucket, dwell: near && settled ? s.dwell + dt : 0 };
      return next.dwell >= DWELL ? commitBucket(next) : next;
    }
    const goal = s.motion === 'drive-finish' ? 1 : s.desired;
    const value = s.phase === 'push' ? s.pushes[s.pushIndex] : s.phase === 'haul' ? s.haul : s.swept;
    const nextValue = toward(value, s.phase === 'haul' ? goal : Math.max(value, goal), dt / (s.phase === 'push' ? 2.4 : s.phase === 'haul' ? 3.3 : 4.8));
    const next = { ...s, dwell: nextValue >= 0.999 && goal >= 0.999 ? s.dwell + dt : 0 };
    if (s.phase === 'push') { next.pushes = [...s.pushes]; next.pushes[s.pushIndex] = nextValue; }
    else if (s.phase === 'haul') next.haul = nextValue;
    else next.swept = nextValue;
    return nextValue >= 1 && (s.motion === 'drive-finish' || next.dwell >= DWELL) ? finishDrive(next) : next;
  }
  if (s.action !== 'auto') return s;
  if (s.motion === 'push-return') return elapsed >= 1.6 ? { ...s, action: 'ready', motion: 'none', pushIndex: 1, elapsed: 0, desired: 0 } : { ...s, elapsed };
  if (s.motion === 'lift') {
    const pickup = { ...rocks(s.round)[s.carried!], y: 0.85 };
    const raised = { ...pickup, y: CARRY_HEIGHT }, waiting = { ...HOME, y: CARRY_HEIGHT };
    const bucket = elapsed < 0.3 ? mix(s.from, pickup, smooth(elapsed / 0.3)) : elapsed < 0.95 ? mix(pickup, raised, smooth((elapsed - 0.3) / 0.65)) : mix(raised, waiting, smooth((elapsed - 0.95) / 0.45));
    return elapsed >= 1.4 ? { ...s, action: 'ready', motion: 'none', bucket, target: bucket, elapsed: 0 } : { ...s, elapsed, bucket };
  }
  if (s.motion === 'unload') {
    const high = { ...BED, y: CARRY_HEIGHT };
    const drop = { ...BED, y: Math.max(BED.y, cargo(s.delivered.length).y + 0.35) };
    const bucket = elapsed < 0.65 ? mix(s.from, high, smooth(elapsed / 0.65)) : mix(high, drop, smooth((elapsed - 0.65) / 0.3));
    return elapsed >= 1.15 ? { ...s, motion: 'return', bucket, from: bucket, delivered: [...s.delivered, s.carried!], carried: null, elapsed: 0 } : { ...s, elapsed, bucket };
  }
  if (s.motion === 'return') {
    // Return above the cab before lowering to the work area.
    const highHome = { ...HOME, y: CARRY_HEIGHT };
    const bucket = elapsed < 0.65 ? mix(s.from, highHome, smooth(elapsed / 0.65)) : mix(highHome, HOME, smooth((elapsed - 0.65) / 0.35));
    if (elapsed < 1) return { ...s, elapsed, bucket };
    return s.delivered.length === 3 ? phase({ ...s, bucket: { ...HOME }, target: { ...HOME } }, 'excavator-exit') : { ...s, action: 'ready', motion: 'none', bucket: { ...HOME }, target: { ...HOME }, elapsed: 0 };
  }
  const transitions: Partial<Record<Stage, [number, Stage]>> = { intro: [1.3, 'push'], 'dozer-exit': [2.7, 'truck-arrival'], 'truck-arrival': [2.2, 'excavator-arrival'], 'excavator-arrival': [2.2, 'excavate'], 'excavator-exit': [2.5, 'haul'], 'truck-exit': [2.2, 'sweeper-arrival'], 'sweeper-arrival': [2, 'sweep'], 'sweeper-exit': [2.2, 'reopen'], reopen: [6, 'complete'] };
  const transition = transitions[s.phase];
  return transition && elapsed >= transition[0] ? phase(s, transition[1]) : { ...s, elapsed };
}
export function progress(s: MountainState) { return s.phase === 'complete' ? 1 : (s.pushes[0] + s.pushes[1] + s.delivered.length + s.haul + s.swept) / 7; }

/** Only validated snapshots can resume; pointer targets and uncommitted dwell are transient. */
export function resumeMountain(value: unknown): MountainState | undefined {
  if (!value || typeof value !== 'object') return;
  const s = value as MountainState;
  const fraction = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
  const point = (p: unknown): p is Point => !!p && typeof p === 'object' && ['x', 'y', 'z'].every(k => typeof (p as Record<string, unknown>)[k] === 'number' && Number.isFinite((p as Record<string, number>)[k]) && Math.abs((p as Record<string, number>)[k]) < 40);
  if (s.version !== 1 || !validRound(s.round) || !stages.includes(s.phase) || !['ready', 'dragging', 'auto'].includes(s.action) || !['none', 'lift', 'unload', 'return', 'push-return', 'drive-finish'].includes(s.motion)) return;
  if (!Array.isArray(s.pushes) || s.pushes.length !== 2 || !s.pushes.every(fraction) || ![0, 1].includes(s.pushIndex) || !fraction(s.haul) || !fraction(s.swept)) return;
  if (!Array.isArray(s.delivered) || s.delivered.some(n => !Number.isInteger(n) || n < 0 || n > 2) || new Set(s.delivered).size !== s.delivered.length) return;
  if (s.carried !== null && (!Number.isInteger(s.carried) || s.carried < 0 || s.carried > 2 || s.delivered.includes(s.carried))) return;
  if (![s.bucket, s.target, s.from].every(point) || !Number.isFinite(s.elapsed) || s.elapsed < 0 || s.elapsed > 30) return;
  const i = stages.indexOf(s.phase), push = stages.indexOf('push'), dig = stages.indexOf('excavate'), haul = stages.indexOf('haul'), sweep = stages.indexOf('sweep');
  if (i < push && (s.pushes.some(n => n !== 0) || s.pushIndex !== 0) || i > push && s.pushes.some(n => n !== 1) || s.pushIndex === 1 && s.pushes[0] !== 1 || s.pushIndex === 0 && s.pushes[1] !== 0) return;
  if (i < dig && (s.delivered.length || s.carried !== null) || i > dig && (s.delivered.length !== 3 || s.carried !== null)) return;
  if (i < haul && s.haul !== 0 || i > haul && s.haul !== 1 || i < sweep && s.swept !== 0 || i > sweep && s.swept !== 1) return;
  if (!manual(s.phase) && (s.action !== 'auto' || s.motion !== 'none')) return;
  if (manual(s.phase) && (s.action === 'auto') !== (s.motion !== 'none')) return;
  if (['lift', 'unload', 'return'].includes(s.motion) && s.phase !== 'excavate' || ['lift', 'unload'].includes(s.motion) && s.carried === null || s.motion === 'return' && (s.carried !== null || !s.delivered.length)) return;
  if (s.motion === 'push-return' && (s.phase !== 'push' || s.pushIndex !== 0 || s.pushes[0] !== 1) || s.motion === 'drive-finish' && !['push', 'haul', 'sweep'].includes(s.phase)) return;
  if (s.phase === 'excavate' && s.delivered.length === 3 && s.motion !== 'return') return;
  const copy = structuredClone(s);
  return { ...release(copy, true), dwell: 0, aimed: null, desired: 0 };
}
