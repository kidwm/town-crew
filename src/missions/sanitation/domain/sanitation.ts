import { APPROACH, EXIT, home, restingBin, destination, clamp } from './site.ts';
import type { Point } from './site.ts';
export const vehicles = ['garbage', 'recycle', 'food', 'sweeper'] as const;
export type Vehicle = typeof vehicles[number];
export const recyclables = ['cardboard', 'bottles', 'cans', 'paper'] as const;
export type Recyclable = typeof recyclables[number];
export const cargoPairs: [Recyclable, Recyclable][] = [['cardboard', 'bottles'], ['cardboard', 'cans'], ['cardboard', 'paper'], ['bottles', 'cans'], ['bottles', 'paper'], ['cans', 'paper']];
export const items = ['bag-0', 'bag-1', 'bin', ...recyclables, 'food'] as const;
export type Item = typeof items[number];
export type Bag = 'bag-0' | 'bag-1';
export const stages = ['intro', 'garbage-arrival', 'bags', 'bag-loading', 'compact', 'bin-dock', 'bin-lock', 'bin-lift', 'bin-tip', 'garbage-exit', 'garbage-departure', 'recycle-entrance', 'recycle-arrival', 'recycling', 'recycle-loading', 'recycle-stow', 'recycle-exit', 'recycle-departure', 'food-entrance', 'food-arrival', 'food-dock', 'food-lock', 'food-lift', 'food-tip', 'food-exit', 'food-departure', 'sweeper-entrance', 'sweep', 'sweeper-departure', 'celebrate', 'complete'] as const;
export type Stage = typeof stages[number];
export type Service = 'recycle-first' | 'food-first';
export interface Round { layout: 0 | 1; palette: number; cast: number; cargo: [Recyclable, Recyclable]; service: Service }
export const defaultRound: Round = { layout: 0, palette: 0, cast: 0, cargo: ['cardboard', 'bottles'], service: 'recycle-first' };
export type RoundOptions = Pick<Round, 'layout' | 'palette' | 'cast'> & Partial<Pick<Round, 'cargo' | 'service'>>;
const foodFirstStages: readonly Stage[] = [...stages.slice(0, 11), ...stages.slice(18, 26), ...stages.slice(11, 18), ...stages.slice(26)];
export const stageOrder = (round: Round) => round.service === 'food-first' ? foodFirstStages : stages;
export const vehicleOrder = (round: Round): Vehicle[] => round.service === 'food-first' ? ['garbage', 'food', 'recycle', 'sweeper'] : [...vehicles];
export const isRecyclable = (id: Item): id is Recyclable => (recyclables as readonly string[]).includes(id);
export interface SanitationState {
  version: 2; phase: Stage; round: Round; action: 'ready' | 'dragging' | 'auto';
  travel: number; aim: number; elapsed: number; dwell: number; near: boolean; moved: boolean;
  held: Item | null; positions: Record<Item, Point>; bags: Bag[]; recycled: Recyclable[];
  binEmpty: boolean; foodEmpty: boolean; swept: number;
}
export const index = (phase: Stage, round: Round = defaultRound) => stageOrder(round).indexOf(phase);
export function validRound(value: unknown): value is Round {
  if (!value || typeof value !== 'object') return false;
  const r = value as Round;
  return (r.layout === 0 || r.layout === 1) && Number.isInteger(r.palette) && r.palette >= 0 && r.palette < 4 && Number.isInteger(r.cast) && r.cast >= 0 && r.cast < 3 && (r.service === 'recycle-first' || r.service === 'food-first') && Array.isArray(r.cargo) && r.cargo.length === 2 && r.cargo[0] !== r.cargo[1] && r.cargo.every(id => recyclables.includes(id));
}
export function chooseRound(previous?: Round, random = Math.random): Round {
  const n = (count: number) => Math.min(count - 1, Math.max(0, Math.floor(random() * count)));
  const pairs = cargoPairs.filter(pair => !previous || pair.some(id => !previous.cargo.includes(id)));
  return { cargo: [...pairs[n(pairs.length)]], service: n(2) ? 'food-first' : 'recycle-first', layout: previous ? previous.layout ? 0 : 1 : n(2) as 0 | 1, palette: previous ? (previous.palette + 1 + n(3)) % 4 : n(4), cast: n(3) };
}
export const automatic = (phase: Stage) => !['complete', 'bags', 'recycling', 'bin-dock', 'bin-lift', 'food-dock', 'food-lift', 'sweep'].includes(phase) && !phase.endsWith('-arrival') && !phase.endsWith('-exit');
export const driving = (s: SanitationState) => s.phase.endsWith('-arrival') || s.phase.endsWith('-exit') || s.phase === 'sweep';
export const lifting = (s: SanitationState) => s.phase === 'bin-lift' || s.phase === 'food-lift';
export function currentVehicle(s: SanitationState): Vehicle {
  if (s.phase.startsWith('recycle') || s.phase === 'recycling') return 'recycle';
  if (s.phase.startsWith('food')) return 'food';
  if (s.phase.startsWith('sweep') || s.phase === 'celebrate' || s.phase === 'complete') return 'sweeper';
  return 'garbage';
}
export function available(s: SanitationState): Item[] {
  if (s.action === 'auto') return [];
  if (s.phase === 'bags') return (['bag-0', 'bag-1'] as const).filter(id => !s.bags.includes(id));
  if (s.phase === 'recycling') return s.round.cargo.filter(id => !s.recycled.includes(id));
  if (s.phase === 'bin-dock' || s.phase === 'bin-lift') return ['bin'];
  if (s.phase === 'food-dock' || s.phase === 'food-lift') return ['food'];
  return [];
}
function enter(s: SanitationState, phase: Stage): SanitationState {
  return { ...s, phase, action: automatic(phase) ? 'auto' : 'ready', travel: 0, aim: 0, elapsed: 0, dwell: 0, near: false, moved: false, held: null };
}
export function createSanitation(phase: Stage = 'intro', configuration: RoundOptions = defaultRound): SanitationState {
  const round: Round = { ...defaultRound, ...configuration, cargo: [...(configuration.cargo ?? defaultRound.cargo)] };
  const i = index(phase, round), positions = Object.fromEntries(items.map(id => [id, home(round, id)])) as Record<Item, Point>;
  const s: SanitationState = { version: 2, phase, round: { ...round }, action: automatic(phase) ? 'auto' : 'ready', travel: 0, aim: 0, elapsed: 0, dwell: 0, near: false, moved: false, held: null, positions,
    bags: i > index('bag-loading') ? ['bag-0', 'bag-1'] : [], recycled: i > index('recycle-loading', round) ? [...round.cargo] : [], binEmpty: i > index('bin-tip'), foodEmpty: i > index('food-tip', round), swept: i > index('sweep') ? 1 : 0 };
  if (s.binEmpty) s.positions.bin = restingBin(round, 'bin');
  if (s.foodEmpty) s.positions.food = restingBin(round, 'food');
  if (phase === 'bag-loading') s.held = 'bag-0';
  if (phase === 'recycle-loading') s.held = round.cargo[0];
  if (phase === 'bin-lock') s.held = 'bin';
  if (phase === 'food-lock') s.held = 'food';
  if (['bin-lock', 'bin-lift', 'bin-tip'].includes(phase)) s.positions.bin = destination(round, 'bin');
  if (['food-lock', 'food-lift', 'food-tip'].includes(phase)) s.positions.food = destination(round, 'food');
  return s;
}
export function grab(s: SanitationState, item?: Item, atTarget = false): SanitationState {
  if (s.action !== 'ready' || s.phase === 'complete') return s;
  if (!driving(s) && !lifting(s) && (!item || !available(s).includes(item))) return s;
  if (lifting(s) && item !== (s.phase === 'bin-lift' ? 'bin' : 'food')) return s;
  return { ...s, action: 'dragging', held: item ?? null, aim: s.travel, near: atTarget, dwell: 0, moved: false };
}
export function drive(s: SanitationState, value: number): SanitationState {
  if (s.action !== 'dragging' || !Number.isFinite(value) || !driving(s) && !lifting(s)) return s;
  const target = clamp(value);
  if (lifting(s)) return target >= 0.995 ? enter(s, s.phase === 'bin-lift' ? 'bin-tip' : 'food-tip') : { ...s, travel: target, aim: target, moved: true };
  return { ...s, aim: target, moved: true };
}
export function moveItem(s: SanitationState, point: Point, near: boolean): SanitationState {
  if (s.action !== 'dragging' || !s.held || driving(s) || lifting(s) || ![point.x, point.y, point.z].every(Number.isFinite)) return s;
  const p = { x: Math.max(-10, Math.min(10, point.x)), y: Math.max(0.35, Math.min(2.8, point.y)), z: Math.max(-3, Math.min(8, point.z)) };
  return { ...s, positions: { ...s.positions, [s.held]: p }, near, dwell: near ? s.dwell : 0, moved: true };
}
function commit(s: SanitationState): SanitationState {
  if (!s.held) return s;
  const next: Stage = s.phase === 'bags' ? 'bag-loading' : s.phase === 'recycling' ? 'recycle-loading' : s.phase === 'bin-dock' ? 'bin-lock' : 'food-lock';
  return { ...enter(s, next), held: s.held };
}
export function release(s: SanitationState, cancelled = false): SanitationState {
  if (s.action !== 'dragging') return s;
  if (!cancelled && s.near && s.moved && s.held && !lifting(s)) return commit(s);
  return { ...s, action: 'ready', aim: s.travel, dwell: 0, near: false, moved: false, held: null };
}
const duration = (phase: Stage) => phase === 'intro' ? 1.6 : phase === 'bin-tip' || phase === 'food-tip' ? 3.6 : phase.endsWith('-entrance') || phase.endsWith('-departure') ? 2.8 : phase === 'celebrate' ? 3 : phase === 'compact' ? 1.7 : phase.endsWith('-lock') ? 0.65 : 0.9;
export const phaseDuration = duration;
export function advance(s: SanitationState, dt: number): SanitationState {
  if (!Number.isFinite(dt) || dt <= 0 || s.phase === 'complete') return s;
  if (s.action === 'auto') {
    const elapsed = s.elapsed + dt;
    if (elapsed < duration(s.phase)) return { ...s, elapsed };
    if (s.phase === 'bag-loading') {
      const bags = [...s.bags, s.held as Bag];
      return enter({ ...s, bags }, bags.length === 2 ? 'compact' : 'bags');
    }
    if (s.phase === 'recycle-loading') {
      const recycled = [...s.recycled, s.held as Recyclable];
      return enter({ ...s, recycled }, recycled.length === 2 ? 'recycle-stow' : 'recycling');
    }
    if (s.phase === 'bin-lock' || s.phase === 'food-lock') {
      const item = s.phase === 'bin-lock' ? 'bin' : 'food';
      return enter({ ...s, positions: { ...s.positions, [item]: destination(s.round, item) } }, item === 'bin' ? 'bin-lift' : 'food-lift');
    }
    if (s.phase === 'bin-tip' || s.phase === 'food-tip') {
      const food = s.phase === 'food-tip', item = food ? 'food' : 'bin';
      return enter({ ...s, binEmpty: food ? s.binEmpty : true, foodEmpty: food ? true : s.foodEmpty, positions: { ...s.positions, [item]: restingBin(s.round, item) } }, food ? 'food-exit' : 'garbage-exit');
    }
    return enter(s, stageOrder(s.round)[index(s.phase, s.round) + 1]);
  }
  if (s.action !== 'dragging') return s;
  if (driving(s) || lifting(s)) {
    const delta = s.aim - s.travel, step = Math.min(Math.abs(delta), dt * (lifting(s) ? 0.65 : 0.48));
    const travel = clamp(s.travel + Math.sign(delta) * step), swept = s.phase === 'sweep' ? Math.max(s.swept, travel) : s.swept;
    if (travel < 0.995 || !s.moved) return { ...s, travel, swept };
    return enter({ ...s, swept: s.phase === 'sweep' ? 1 : swept }, s.phase === 'garbage-arrival' ? 'bags' : s.phase === 'recycle-arrival' ? 'recycling' : s.phase === 'food-arrival' ? 'food-dock' : s.phase === 'bin-lift' ? 'bin-tip' : s.phase === 'food-lift' ? 'food-tip' : s.phase === 'sweep' ? 'sweeper-departure' : stageOrder(s.round)[index(s.phase, s.round) + 1]);
  }
  const dwell = s.near ? s.dwell + dt : 0;
  return dwell >= 0.4 ? commit(s) : { ...s, dwell };
}
export function progress(s: SanitationState) {
  if (s.phase === 'complete') return 1;
  if (s.phase === 'bags' || s.phase === 'bag-loading') return (index('bags') + (s.bags.length + (s.phase === 'bag-loading' ? clamp(s.elapsed / 0.9) : 0))) / (stages.length - 1);
  if (s.phase === 'recycling' || s.phase === 'recycle-loading') return (index('recycling', s.round) + (s.recycled.length + (s.phase === 'recycle-loading' ? clamp(s.elapsed / 0.9) : 0))) / (stages.length - 1);
  const fraction = s.phase === 'sweep' ? s.swept : s.action === 'auto' ? clamp(s.elapsed / duration(s.phase)) : driving(s) || lifting(s) ? s.travel : 0;
  return (index(s.phase, s.round) + fraction) / (stages.length - 1);
}
/** Require complete current data and reject contradictory cargo/phase combinations. */
export function resumeSanitation(value: unknown): SanitationState | undefined {
  if (!value || typeof value !== 'object') return;
  const s = value as SanitationState;
  if (s.version !== 2 || !stages.includes(s.phase) || !validRound(s.round) || !['ready', 'dragging', 'auto'].includes(s.action)) return;
  if (![s.travel, s.aim, s.swept].every(v => Number.isFinite(v) && v >= 0 && v <= 1) || ![s.elapsed, s.dwell].every(v => Number.isFinite(v) && v >= 0) || s.dwell > 0.4) return;
  if (![s.binEmpty, s.foodEmpty, s.near, s.moved].every(v => typeof v === 'boolean') || s.held !== null && !items.includes(s.held)) return;
  if (!Array.isArray(s.bags) || new Set(s.bags).size !== s.bags.length || s.bags.some(b => b !== 'bag-0' && b !== 'bag-1') || !Array.isArray(s.recycled) || new Set(s.recycled).size !== s.recycled.length || s.recycled.some(b => !s.round.cargo.includes(b))) return;
  if (!s.positions || Object.keys(s.positions).length !== items.length || items.some(id => { const p = s.positions[id]; return !p || ![p.x, p.y, p.z].every(Number.isFinite) || Math.abs(p.x) > 10 || p.y < 0.35 || p.y > 2.8 || p.z < -3 || p.z > 8; })) return;
  const i = index(s.phase, s.round), before = (p: Stage) => i < index(p, s.round), after = (p: Stage) => i > index(p, s.round);
  if (before('bags') && s.bags.length || after('bag-loading') && s.bags.length !== 2 || s.phase === 'bags' && s.bags.length > 1 || s.phase === 'bag-loading' && (s.held !== 'bag-0' && s.held !== 'bag-1' || s.bags.includes(s.held as Bag) || s.bags.length > 1)) return;
  if (before('recycling') && s.recycled.length || after('recycle-loading') && s.recycled.length !== 2 || s.phase === 'recycling' && s.recycled.length > 1 || s.phase === 'recycle-loading' && (!s.round.cargo.includes(s.held as Recyclable) || s.recycled.includes(s.held as Recyclable) || s.recycled.length > 1)) return;
  if (s.binEmpty !== after('bin-tip') || s.foodEmpty !== after('food-tip') || before('sweep') && s.swept !== 0 || after('sweep') && s.swept !== 1 || s.phase === 'sweep' && s.swept < s.travel) return;
  if (automatic(s.phase) !== (s.action === 'auto') || s.phase === 'complete' && s.action !== 'ready') return;
  if (s.action === 'auto' && s.elapsed >= duration(s.phase) || s.action !== 'auto' && s.elapsed !== 0) return;
  if (s.action === 'dragging' && !driving(s) && (!s.held || !available(s).includes(s.held))) return;
  if (s.action === 'ready' && s.held !== null || s.action === 'dragging' && driving(s) && s.held !== null) return;
  const expectedHeld = s.phase === 'bin-lock' ? 'bin' : s.phase === 'food-lock' ? 'food' : undefined;
  if (expectedHeld && s.held !== expectedHeld || s.action === 'auto' && !expectedHeld && !['bag-loading', 'recycle-loading'].includes(s.phase) && s.held !== null) return;
  return { ...s, round: { ...s.round, cargo: [...s.round.cargo] }, positions: structuredClone(s.positions), bags: [...s.bags], recycled: [...s.recycled], action: s.action === 'dragging' ? 'ready' : s.action, held: s.action === 'dragging' ? null : s.held, aim: s.travel, near: false, dwell: 0, moved: false };
}
// These lengths are shared with full-route visibility and departure checks.
export const routeRange = { start: APPROACH, end: EXIT };
