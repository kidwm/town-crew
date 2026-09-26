import type { Point } from './excavator.ts';

export const DAMAGE_PATTERNS = ['staggered', 'split', 'clustered'] as const;
export type DamagePattern = typeof DAMAGE_PATTERNS[number];
export interface RoadRound { pattern: DamagePattern; layout: 0 | 1 }
export const DEFAULT_ROUND: Readonly<RoadRound> = { pattern: 'staggered', layout: 0 };
export interface RoadDamage {
  name: string;
  chunks: readonly Point[];
  outline: readonly (readonly [number, number])[];
  scales: readonly (readonly [number, number])[];
  rotations: readonly number[];
}
export const DAMAGE: Record<DamagePattern, RoadDamage> = {
  // Preserve the original shape and positions for existing saved games.
  staggered: {
    name: '前後錯落',
    chunks: [{ x: 1.15, y: 0, z: -0.65 }, { x: 2.35, y: 0, z: 0.55 }, { x: 3.35, y: 0, z: -0.45 }],
    outline: [[0.225, -1.525], [4.275, -1.525], [4.275, 1.525], [0.225, 1.525]],
    scales: [[1, 1], [1, 1], [1, 1]], rotations: [0, 0.45, 0.9],
  },
  split: {
    name: '並排裂開',
    chunks: [{ x: 0.95, y: 0, z: 0.1 }, { x: 2.25, y: 0, z: 0.1 }, { x: 3.5, y: 0, z: 0.1 }],
    outline: [[0.2, -0.85], [3.95, -0.85], [4.3, -0.3], [4.3, 0.65], [3.8, 1.05], [0.6, 1.05], [0.2, 0.65]],
    scales: [[0.9, 1.35], [0.9, 1.35], [0.9, 1.35]], rotations: [0, 0.08, -0.08],
  },
  clustered: {
    name: '集中破損',
    chunks: [{ x: 1.45, y: 0, z: 0.75 }, { x: 2.9, y: 0, z: 0.75 }, { x: 2.15, y: 0, z: -0.65 }],
    outline: [[0.55, 0.3], [1.2, -1.25], [2.9, -1.25], [3.8, 0.3], [3.55, 1.4], [0.85, 1.4]],
    scales: [[0.95, 1.1], [0.95, 1.1], [1.05, 1]], rotations: [-0.2, 0.35, 0.1],
  },
};
export const roadDamage = (round: RoadRound) => DAMAGE[round.pattern];
export const siteX = (round: RoadRound, x: number) => round.layout === 0 ? x : -x;
export const haulDirection = (round: RoadRound) => round.layout === 0 ? 'left' : 'right';
export const rollerDirection = (round: RoadRound, passes: number) => (passes === 0) === (round.layout === 0) ? 'right' : 'left';
export function validRound(value: unknown): value is RoadRound {
  if (!value || typeof value !== 'object') return false;
  const r = value as RoadRound;
  return DAMAGE_PATTERNS.includes(r.pattern) && [0, 1].includes(r.layout);
}
export function chooseRound(previous?: RoadRound, random = Math.random): RoadRound {
  const choices = DAMAGE_PATTERNS.filter(pattern => pattern !== previous?.pattern);
  const sample = random();
  const index = Math.max(0, Math.min(choices.length - 1, Math.floor((Number.isFinite(sample) ? sample : 0) * choices.length)));
  return { pattern: choices[index], layout: previous ? previous.layout === 0 ? 1 : 0 : random() < 0.5 ? 0 : 1 };
}
