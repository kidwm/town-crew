import type { Round, SanitationState, Vehicle, Item } from './sanitation.ts';
export interface Point { x: number; y: number; z: number }
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const smooth = (t: number) => { const v = clamp(t); return v * v * (3 - 2 * v); };
export const shift = (round: Round) => round.layout ? 1.4 : -1.4;
export const ROAD_Z = -1;
export const APPROACH = -6.6, EXIT = 8.0;
export const parked = (round: Round): Point => ({ x: shift(round) + 1.3, y: 0, z: ROAD_Z });
export function home(round: Round, item: Item): Point {
  const x = shift(round);
  const points: Record<Item, Point> = {
    'bag-0': { x: x - 4.3, y: 0.55, z: 2.6 }, 'bag-1': { x: x - 2.2, y: 0.55, z: 3.5 },
    bin: { x: x + 0.2, y: 0.65, z: 3.4 }, cardboard: { x: x - 6.4, y: 0.48, z: 3.4 },
    bottles: { x: x + 2.2, y: 0.48, z: 3.6 }, food: { x: x + 4.8, y: 0.65, z: 3.3 },
  };
  return points[item];
}
export const restingBin = (round: Round, item: 'bin' | 'food'): Point => ({ ...home(round, item), z: 5.15 });
export function destination(round: Round, item: Item): Point {
  const p = parked(round);
  if (item.startsWith('bag')) return { x: p.x - 3.05, y: 1.25, z: p.z + 0.15 };
  if (item === 'bin') return { x: p.x - 3.8, y: 0.65, z: p.z };
  if (item === 'food') return { x: p.x - 0.7, y: 0.65, z: p.z + 2.1 };
  return { x: p.x, y: 1.25, z: p.z + 0.7 };
}
/** Shared loading points and swept footprints, used by scene, hints and tests. */
export function vehiclePoint(round: Round, phase: string, travel: number): Point {
  const p = parked(round);
  if (phase === 'sweep') return { x: mix(APPROACH, EXIT, travel), y: 0, z: 2 };
  if (phase.endsWith('-arrival')) return { ...p, x: mix(APPROACH, p.x, travel) };
  if (phase.endsWith('-exit')) return { ...p, x: mix(p.x, EXIT, travel) };
  return p;
}
export function binPose(s: SanitationState, food: boolean): Point & { tilt: number; lid: number } {
  const item = food ? 'food' : 'bin', prefix = food ? 'food' : 'bin';
  const base = destination(s.round, item), p = parked(s.round);
  let raised = 0, tilt = 0, returning = 0;
  if (s.phase === `${prefix}-lift`) raised = s.travel;
  if (s.phase === `${prefix}-tip`) {
    raised = 1 - smooth((s.elapsed - 1.8) / 0.9);
    tilt = smooth(s.elapsed / 0.65) * (1 - smooth((s.elapsed - 1.35) / 0.45));
    returning = smooth((s.elapsed - 2.7) / 0.9);
  }
  const position = food ? { x: base.x, y: mix(base.y, 3.3, raised), z: mix(base.z, p.z + 1.05, raised) }
    : { x: mix(base.x, p.x - 3.65, raised), y: mix(base.y, 2.95, raised), z: base.z };
  const original = restingBin(s.round, item);
  return { x: mix(position.x, original.x, returning), y: mix(position.y, original.y, returning), z: mix(position.z, original.z, returning), tilt: -2.25 * tilt, lid: tilt };
}
export const cargoLocal = (item: 'cardboard' | 'bottles'): Point => ({ x: item === 'cardboard' ? -0.8 : 0.6, y: 1.7, z: 0 });
export const vehicleWidth: Record<Vehicle, number> = { garbage: 2.6, recycle: 2.3, food: 2.7, sweeper: 3.5 };
