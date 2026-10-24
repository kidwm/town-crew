import type { Round, SanitationState, Vehicle, Item, Recyclable } from './sanitation.ts';
export interface Point { x: number; y: number; z: number }
export interface Pose extends Point { heading: number }
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const smooth = (t: number) => { const v = clamp(t); return v * v * (3 - 2 * v); };
export const shift = (round: Pick<Round, 'layout'>) => round.layout ? 1.4 : -1.4;
export const ROAD = { far: -7.6, near: 0, center: -3.8, lane: -1.9 } as const;
export const ROAD_Z = ROAD.lane, BAY_Z = 1.5, SWEEP_Z = 3, SIDEWALK_Z = 5.8;
export const APPROACH = -3.8, EXIT = 6.6, SWEEP_END = 4.4;
export const sweepDebris = Array.from({ length: 28 }, (_, i) => ({ x: APPROACH + 1.1 + i % 14 * 0.6, y: 0.025, z: 1.8 + Math.floor(i / 14) * 2.4 }));
export const parked = (round: Round): Point => ({ x: shift(round) + 1.3, y: 0, z: BAY_Z });
export const bayOutline = (round: Pick<Round, 'layout'>) => [[-12, 0], [-8, SIDEWALK_Z], [8.3, SIDEWALK_Z], [13, 0]].map(([x, z]) => ({ x: x + shift(round), z }));
export function onPavement(round: Round, x: number, z: number) {
  if (z >= ROAD.far && z <= ROAD.near) return true;
  if (z < 0 || z > SIDEWALK_Z) return false;
  const left = shift(round) - 12 + 4 * z / SIDEWALK_Z, right = shift(round) + 13 - 4.7 * z / SIDEWALK_Z;
  return x >= left && x <= right;
}
export function home(round: Round, item: Item): Point {
  const x = shift(round);
  if (['cardboard', 'bottles', 'cans', 'paper'].includes(item)) {
    const slot = Math.max(0, round.cargo.indexOf(item as Recyclable));
    return { x: x + (slot ? 2.2 : -6.4), y: 0.48, z: 4.4 };
  }
  return ({ 'bag-0': { x: x - 4.3, y: 0.55, z: 3.9 }, 'bag-1': { x: x - 2.2, y: 0.55, z: 4.4 }, bin: { x: x + 0.2, y: 0.65, z: 4.4 }, food: { x: x + 4.8, y: 0.65, z: 4.4 } } as Record<string, Point>)[item];
}
export const restingBin = (round: Round, item: 'bin' | 'food'): Point => ({ ...home(round, item), y: 0.74, z: 6.45 });
export function destination(round: Round, item: Item): Point {
  const p = parked(round);
  if (item.startsWith('bag')) return { x: p.x - 3.05, y: 1.25, z: p.z + 0.15 };
  if (item === 'bin') return { x: p.x - 3.8, y: 0.65, z: p.z };
  if (item === 'food') return { x: p.x - 0.7, y: 0.65, z: p.z + 2.1 };
  return { x: p.x, y: 1.25, z: p.z + 0.7 };
}
/** Gentle, coordinated yaw keeps the whole rear over the outbound lane or pullout. */
export function vehiclePoint(round: Round, phase: string, travel: number): Pose {
  const p = parked(round), t = clamp(travel), curve = smooth(t);
  if (phase === 'sweep') return { x: mix(APPROACH, SWEEP_END, t), y: 0, z: SWEEP_Z, heading: 0 };
  if (phase.endsWith('-arrival')) return { x: mix(APPROACH, p.x, t), y: 0, z: mix(ROAD_Z, p.z, curve), heading: -0.47 * Math.sin(Math.PI * curve) };
  if (phase.endsWith('-exit')) return { x: mix(p.x, EXIT, t), y: 0, z: mix(p.z, ROAD_Z, curve), heading: 0.47 * Math.sin(Math.PI * curve) };
  return { ...p, heading: 0 };
}
export function binPose(s: SanitationState, food: boolean): Point & { tilt: number; lid: number } {
  const item = food ? 'food' : 'bin', prefix = food ? 'food' : 'bin', base = destination(s.round, item), p = parked(s.round);
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
export const cargoLocal = (round: Round, item: Recyclable): Point => ({ x: round.cargo.indexOf(item) === 0 ? -0.8 : 0.6, y: { cardboard: 1.55, bottles: 1.61, cans: 1.61, paper: 1.505 }[item], z: 0 });
export const vehicleWidth: Record<Vehicle, number> = { garbage: 2.6, recycle: 2.3, food: 2.7, sweeper: 3.5 };

/** Fold brushes before merging; automatic approach/departure shares this geometry. */
export function sweeperHandoff(progress: number, exitX: number, departing: boolean): Pose & { stowed: number } {
  const t = clamp(progress);
  if (departing) {
    const u = clamp((t - 0.15) / 0.85), merge = clamp(u * 3);
    return { x: mix(SWEEP_END, exitX, u * u), y: 0, z: mix(SWEEP_Z, ROAD_Z, smooth(merge)), heading: 0.47 * Math.sin(Math.PI * merge), stowed: clamp(t / 0.15) };
  }
  const u = clamp((t - 0.35) / 0.65), merge = smooth(u);
  return { x: t < 0.35 ? mix(-exitX, -9.5, smooth(t / 0.35)) : mix(-9.5, APPROACH, u), y: 0, z: mix(ROAD_Z, SWEEP_Z, merge), heading: -0.47 * Math.sin(Math.PI * merge), stowed: 1 - smooth((u - 0.8) / 0.2) };
}
