export const trains = ['high-speed', 'regional', 'metro', 'tram'] as const;
export type Train = typeof trains[number];
export const stages = ['intro', 'entrance', 'choose', 'approach', 'door', 'passengers', 'closing', 'exit', 'departure', 'celebrate', 'complete'] as const;
export type Stage = typeof stages[number];
export const directions = ['city', 'outbound', 'hsr-metro', 'hsr-tram', 'regional-metro', 'regional-tram'] as const;
export type Direction = typeof directions[number];
export interface Round { direction: Direction; layout: 0 | 1; palette: number; cast: number }
export interface RailState {
  version: 1; phase: Stage; round: Round; order: Train[]; selected: Train | null;
  action: 'ready' | 'dragging' | 'auto'; travel: number; door: number; aim: number; elapsed: number; dwell: number; moved: boolean;
}
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const arrivalPairs: Record<Direction, readonly [Train, Train]> = {
  city: ['high-speed', 'regional'], outbound: ['metro', 'tram'],
  'hsr-metro': ['high-speed', 'metro'], 'hsr-tram': ['high-speed', 'tram'],
  'regional-metro': ['regional', 'metro'], 'regional-tram': ['regional', 'tram'],
};
export const origins = (r: Pick<Round, 'direction'>): Train[] => [...arrivalPairs[r.direction]];
export const destinations = (r: Pick<Round, 'direction'>): Train[] => trains.filter(t => !arrivalPairs[r.direction].includes(t));
export const pair = (s: RailState) => s.order.length < 2 ? origins(s.round) : destinations(s.round);
export const isOrigin = (s: RailState, t: Train) => origins(s.round).includes(t);
export const automatic = (p: Stage) => ['intro', 'entrance', 'passengers', 'closing', 'departure', 'celebrate'].includes(p);
export const duration = (s: RailState) => (({ intro: 0.9, entrance: 3.6, passengers: isOrigin(s, s.selected ?? origins(s.round)[0]) ? 7 : 3.8, closing: 0.8, departure: 3.8, celebrate: 2.2 } as Partial<Record<Stage, number>>)[s.phase] ?? 0);
export function validRound(value: unknown): value is Round {
  if (!value || typeof value !== 'object') return false;
  const r = value as Round;
  return Object.keys(r).sort().join(',') === 'cast,direction,layout,palette' && directions.includes(r.direction) && [0, 1].includes(r.layout) && Number.isInteger(r.palette) && r.palette >= 0 && r.palette < 4 && Number.isInteger(r.cast) && r.cast >= 0 && r.cast < 3;
}
export function chooseRound(previous?: Round, random = Math.random): Round {
  const choices = directions.filter(direction => direction !== previous?.direction);
  return { direction: choices[Math.floor(random() * choices.length)], layout: random() < 0.5 ? 0 : 1, palette: previous ? (previous.palette + 1 + Math.floor(random() * 3)) % 4 : Math.floor(random() * 4), cast: Math.floor(random() * 3) };
}
function next(s: RailState, phase: Stage, changes: Partial<RailState> = {}): RailState {
  return { ...s, phase, action: 'ready', elapsed: 0, travel: 0, aim: 0, dwell: 0, moved: false, ...changes };
}
/** Consistent stage entries are also used by developer tools and fixtures. */
export function createRail(phase: Stage = 'intro', round: Round = { direction: 'city', layout: 0, palette: 0, cast: 0 }, visit = 0): RailState {
  visit = Number.isInteger(visit) ? Math.max(0, Math.min(3, visit)) : 0;
  const sequence = [...origins(round), ...destinations(round)];
  const count = ['celebrate', 'complete'].includes(phase) ? 4 : phase === 'intro' ? 0 : phase === 'entrance' ? visit >= 2 ? 2 : 0 : Math.max(0, Math.min(3, visit));
  const selected = ['approach', 'door', 'passengers', 'closing', 'exit', 'departure'].includes(phase) ? sequence[count] : null;
  return { version: 1, phase, round: { ...round }, order: sequence.slice(0, count), selected, action: 'ready', travel: 0, door: ['passengers', 'closing'].includes(phase) ? 1 : 0, aim: 0, elapsed: 0, dwell: 0, moved: false };
}
export function available(s: RailState): Train[] {
  if (s.action === 'auto') return [];
  return s.phase === 'choose' ? pair(s).filter(t => !s.order.includes(t)) : ['approach', 'door', 'exit'].includes(s.phase) && s.selected ? [s.selected] : [];
}
export function grab(s: RailState, train: Train): RailState {
  if (!available(s).includes(train)) return s;
  return { ...(s.phase === 'choose' ? next(s, 'approach', { selected: train }) : s), action: 'dragging', aim: s.phase === 'door' ? s.door : s.travel, dwell: 0, moved: false };
}
export function drive(s: RailState, value: number): RailState {
  if (s.action !== 'dragging' || !Number.isFinite(value)) return s;
  const aim = clamp(value), moved = s.moved || Math.abs(aim - (s.phase === 'door' ? s.door : s.travel)) > 1e-6;
  if (s.phase === 'door') return aim >= 0.995 && moved ? next(s, 'passengers', { door: 1 }) : { ...s, aim, door: aim, moved };
  return { ...s, aim, moved, dwell: aim < 0.98 ? 0 : s.dwell };
}
function commit(s: RailState) {
  return s.phase === 'approach' ? next(s, 'door') : next(s, 'departure');
}
export function release(s: RailState, cancelled = false): RailState {
  if (s.action !== 'dragging') return s;
  if (!cancelled && s.phase === 'door' && s.door >= 0.995) return next(s, 'passengers', { door: 1 });
  if (!cancelled && (s.moved || s.travel >= 0.98) && s.aim >= 0.98 && ['approach', 'exit'].includes(s.phase)) return { ...s, action: 'auto', aim: 1, dwell: 0 };
  if (s.phase === 'approach' && s.travel < 0.001) return next(s, 'choose', { selected: null });
  return { ...s, action: 'ready', aim: s.phase === 'door' ? s.door : s.travel, dwell: 0, moved: false };
}
export function advance(s: RailState, delta: number): RailState {
  const dt = Math.max(0, Math.min(0.1, delta));
  if (['dragging', 'auto'].includes(s.action) && ['approach', 'exit'].includes(s.phase)) {
    const travel = s.travel + Math.max(-dt * 1.4, Math.min(dt * 1.4, s.aim - s.travel));
    const dwell = (s.moved || s.action === 'auto') && travel >= 0.98 ? s.dwell + dt : 0;
    return dwell >= 0.4 ? commit(s) : { ...s, travel, dwell };
  }
  if (!automatic(s.phase)) return s;
  const elapsed = Math.min(duration(s), s.elapsed + dt), current = { ...s, elapsed };
  if (s.phase === 'closing') current.door = 1 - smooth(elapsed / duration(s));
  if (elapsed + 1e-7 < duration(s)) return current;
  if (s.phase === 'intro') return next(current, 'entrance');
  if (s.phase === 'entrance') return next(current, 'choose');
  if (s.phase === 'passengers') return next(current, 'closing', { door: 1 });
  if (s.phase === 'closing') return next(current, 'exit', { door: 0 });
  if (s.phase === 'departure') {
    const order = [...s.order, s.selected!];
    return next(current, order.length === 4 ? 'celebrate' : order.length === 2 ? 'entrance' : 'choose', { order, selected: null, door: 0 });
  }
  return next(current, 'complete');
}
export function progress(s: RailState) {
  const partial = ({ approach: 0.1 + s.travel * 0.2, door: 0.3 + s.door * 0.2, passengers: 0.5 + s.elapsed / duration(s) * 0.2, closing: 0.7, exit: 0.75 + s.travel * 0.15, departure: 0.9 + s.elapsed / duration(s) * 0.1 } as Partial<Record<Stage, number>>)[s.phase] ?? 0;
  return Math.min(1, (s.order.length + partial) / 4);
}
export function resumeRail(value: unknown): RailState | undefined {
  if (!value || typeof value !== 'object') return;
  const s = value as RailState;
  if (Object.keys(s).sort().join(',') !== 'action,aim,door,dwell,elapsed,moved,order,phase,round,selected,travel,version') return;
  if (s.version !== 1 || !stages.includes(s.phase) || !validRound(s.round) || !['ready', 'dragging', 'auto'].includes(s.action) || typeof s.moved !== 'boolean') return;
  if (![s.travel, s.door, s.aim].every(n => Number.isFinite(n) && n >= 0 && n <= 1) || !Number.isFinite(s.elapsed) || s.elapsed < 0 || !Number.isFinite(s.dwell) || s.dwell < 0 || s.dwell > 0.4) return;
  if (!Array.isArray(s.order) || s.order.length > 4 || new Set(s.order).size !== s.order.length || s.order.some((t, i) => !(i < 2 ? origins(s.round) : destinations(s.round)).includes(t))) return;
  const active = ['approach', 'door', 'passengers', 'closing', 'exit', 'departure'].includes(s.phase);
  if (active ? !s.selected || !trains.includes(s.selected) || !pair(s).includes(s.selected) || s.order.includes(s.selected) : s.selected !== null) return;
  if (['celebrate', 'complete'].includes(s.phase) ? s.order.length !== 4 : s.order.length > 3) return;
  if (s.phase === 'intro' && s.order.length || s.phase === 'entrance' && ![0, 2].includes(s.order.length)) return;
  if (s.action === 'dragging' && !['approach', 'door', 'exit'].includes(s.phase)) return;
  if (s.phase === 'passengers' && s.door !== 1 || !['door', 'passengers', 'closing'].includes(s.phase) && s.door !== 0) return;
  if (s.phase === 'closing' && Math.abs(s.door - (1 - smooth(s.elapsed / duration(s)))) > 1e-6) return;
  if (automatic(s.phase) ? s.elapsed > duration(s) : s.elapsed !== 0) return;
  if (!['approach', 'exit'].includes(s.phase) && s.travel !== 0) return;
  if (s.action === 'auto' && (!['approach', 'exit'].includes(s.phase) || s.aim !== 1)) return;
  const copy: RailState = structuredClone(s);
  if (copy.action === 'auto') return { ...copy, dwell: 0, moved: false };
  return release({ ...copy, action: 'dragging' }, true);
}
