import { HOUSE_PALETTES, ROOF_NAMES } from './domain/round.ts';
import { ROOF_COLORS } from './domain/house.ts';
import type { HouseState } from './domain/house.ts';

export function housePlan(s: HouseState) {
  const palette = HOUSE_PALETTES[s.round.palette], roof = ROOF_COLORS[s.color];
  const top = s.round.roof === 'gable' ? 'M10 32L60 5l50 27Z'
    : s.round.roof === 'shed' ? 'M10 23L110 6v26H10Z' : 'M10 20h100v12H10Z';
  return `<svg viewBox="0 0 180 115" aria-hidden="true"><g transform="${s.round.layout ? 'translate(180 0) scale(-1 1)' : ''}"><rect x="4" y="72" width="53" height="34" fill="${palette.lower}"/><rect x="11" y="80" width="39" height="26" fill="#9eaf9b"/><path d="M1 69h59" stroke="${roof}" stroke-width="7"/><g transform="translate(50 0)"><rect x="18" y="32" width="84" height="37" fill="${palette.upper}"/><rect x="18" y="69" width="84" height="37" fill="${palette.lower}"/><path d="${top}" fill="${roof}"/><path d="M14 68h92M14 106h92" stroke="${palette.trim}" stroke-width="5"/><path d="M30 40h19v20H30Zm42 0h19v20H72Zm0 37h19v20H72Z" fill="#9dbfc0" stroke="${palette.trim}" stroke-width="3"/><rect x="29" y="77" width="23" height="28" fill="${palette.door}" rx="1"/></g></g></svg><span>${ROOF_NAMES[s.round.roof]}小樓</span>`;
}
