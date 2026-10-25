import type { Point } from '../../../runtime/excavator-arm.ts';
export type { Point } from '../../../runtime/excavator-arm.ts';

export const ARM_Z = -4.4;
export const PIVOT: Point = { x: -4, y: 2.35, z: ARM_Z };
export const HOME: Point = { x: -2.5, y: 1.4, z: -3.1 };
export const BED: Point = { x: 2.35, y: 2.25, z: ARM_Z };
export const CARRY_HEIGHT = 4.2;
export const PUSH_Z = [0.8, 3.8] as const;
export const PUSH_START = -5.2, PUSH_END = 0.6, PUSH_HEADING = 0;
export function pushPoint(index: 0 | 1, amount: number): Point {
  return { x: PUSH_START + (PUSH_END - PUSH_START) * amount, y: 1, z: PUSH_Z[index] };
}
export function soilPoint(index: 0 | 1, pushed = 1): Point {
  const p = pushPoint(index, pushed);
  return { x: p.x + Math.cos(PUSH_HEADING) * 2.9, y: 0.35, z: p.z - Math.sin(PUSH_HEADING) * 2.9 };
}
// Hand off before either mirrored vehicle reaches the frame edge. Saved travel
// is a fraction, so partial work keeps the same progress on the shorter routes.
export const HAUL_START = 2.4, HAUL_END = -6.6;
export const SWEEP_START = -6.5, SWEEP_END = 6.5, SWEEP_Z = 3.4;
export const GUARDRAIL_Z = 7.2;
export const BARRIER_X = [-8.4, 9.2] as const, CONE_X = [-8.9, 9.5] as const;
export const DWELL = 0.4;
export const smooth = (t: number) => { const n = Math.max(0, Math.min(1, t)); return n * n * (3 - 2 * n); };
export const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
