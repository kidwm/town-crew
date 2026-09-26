export const ROOF_TYPES = ['gable', 'shed', 'flat'] as const;
export type RoofType = typeof ROOF_TYPES[number];
export const ROOF_NAMES: Record<RoofType, string> = { gable: '尖屋頂', shed: '單斜屋頂', flat: '平屋頂' };
export const ROOF_HEIGHTS: Record<RoofType, number> = { gable: 1.2, shed: 1.2, flat: 0.4 };
export const HOUSE_PALETTES = [
  { lower: '#ead0a4', upper: '#f2dfbb', trim: '#fff0d2', door: '#829f8b' },
  { lower: '#a8c5b4', upper: '#c4d8bf', trim: '#fff0d2', door: '#b87f68' },
  { lower: '#acc7d6', upper: '#cfdee2', trim: '#fcf0d7', door: '#b58b62' },
  { lower: '#dbb4a5', upper: '#edceba', trim: '#fff2dc', door: '#729899' },
] as const;
export interface HouseRound {
  roof: RoofType; layout: 0 | 1; palette: number; family: 0 | 1 | 2; pet: 'none' | 'cat' | 'dog';
}
// Old homes keep their original appearance and local coordinates on migration.
export const DEFAULT_ROUND: Readonly<HouseRound> = { roof: 'gable', layout: 0, palette: 0, family: 0, pet: 'none' };
export function validRound(value: unknown): value is HouseRound {
  if (!value || typeof value !== 'object') return false;
  const r = value as HouseRound;
  return ROOF_TYPES.includes(r.roof) && [0, 1].includes(r.layout)
    && Number.isInteger(r.palette) && r.palette >= 0 && r.palette < HOUSE_PALETTES.length
    && [0, 1, 2].includes(r.family) && ['none', 'cat', 'dog'].includes(r.pet);
}
export function chooseRound(previous?: HouseRound, random = Math.random): HouseRound {
  const pick = <T>(values: readonly T[]): T => {
    const sample = random();
    return values[Math.max(0, Math.min(values.length - 1, Math.floor((Number.isFinite(sample) ? sample : 0) * values.length)))];
  };
  return {
    roof: pick(ROOF_TYPES.filter(roof => roof !== previous?.roof)),
    layout: pick(([0, 1] as const).filter(layout => layout !== previous?.layout)),
    palette: pick(HOUSE_PALETTES.map((_, i) => i).filter(i => i !== previous?.palette)),
    family: pick([0, 1, 2] as const), pet: pick(['none', 'none', 'cat', 'dog'] as const),
  };
}
// Simulation uses the original site coordinates. Only the view/input boundary
// mirrors X, keeping the entire site and every vehicle route coordinated.
export const siteX = (round: HouseRound, x: number) => round.layout === 0 ? x : -x;
