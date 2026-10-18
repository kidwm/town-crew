import { arrivalRoute, exitRoute, pathLength, suitcaseHome, cargoTarget, clamp, ENTRANCE, FINAL_ENTRANCE_SECONDS, companion, finalVehicle, transferPair } from './terminal.ts';
import type { Round, Vehicle, Transfer, Position } from './terminal.ts';
export type { Round, Vehicle, Transfer, Position } from './terminal.ts';
// Keep the original final-visit stage IDs so existing saves and development links still work.
export const stages = ['intro', 'bus-arrival', 'bus-door', 'unloading', 'bus-exit', 'bus-departure', 'transfer-entrance', 'choose', 'transfer-arrival', 'transfer-door', 'boarding', 'transfer-exit', 'transfer-departure', 'coach-entrance', 'coach-arrival', 'coach-door', 'luggage', 'loading', 'coach-boarding', 'coach-exit', 'coach-departure', 'celebrate', 'complete'] as const;
export type Stage = typeof stages[number];
export interface TransitState {
  version: 4; phase: Stage; action: 'ready' | 'dragging' | 'auto'; round: Round;
  selected: Transfer | null; order: Transfer[]; travel: number; aim: number;
  doors: Record<Vehicle, number>; luggage: Position; elapsed: number;
}
export const durations: Partial<Record<Stage, number>> = { intro: 0.8, unloading: 6.2, 'bus-departure': 2, 'transfer-entrance': ENTRANCE.duration, boarding: 4.2, 'transfer-departure': 2, 'coach-entrance': FINAL_ENTRANCE_SECONDS, loading: 1.1, 'coach-boarding': 4.2, 'coach-departure': 2, celebrate: 2.5 };
const isTransfer = (v: unknown): v is Transfer => v === 'taxi' || v === 'school' || v === 'coach';
const unit = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
export function validRound(v: unknown): v is Round {
  if (!v || typeof v !== 'object') return false;
  const r = v as Round;
  return (r.layout === 0 || r.layout === 1) && Number.isInteger(r.palette) && r.palette >= 0 && r.palette < 4 && Number.isInteger(r.cast) && r.cast >= 0 && r.cast < 3 && (r.companion === undefined || r.companion === 'school' || r.companion === 'coach');
}
export function chooseRound(previous?: Round, random = Math.random): Round {
  const draw = (n: number) => Math.min(n - 1, Math.max(0, Math.floor(random() * n)));
  return { layout: previous ? previous.layout === 0 ? 1 : 0 : draw(2) as 0 | 1, palette: previous ? (previous.palette + 1 + draw(3)) % 4 : draw(4), cast: draw(3), companion: draw(2) ? 'coach' : 'school' };
}
const index = (p: Stage) => stages.indexOf(p);
export const isFinalVisit = (s: TransitState) => s.phase.startsWith('coach-') || (s.phase === 'luggage' || s.phase === 'loading') && s.selected === null || s.phase === 'celebrate' || s.phase === 'complete';
export const coachHasLeft = (s: TransitState) => s.order.includes('coach') || finalVehicle(s.round) === 'coach' && (s.phase === 'celebrate' || s.phase === 'complete');
export const luggageAboard = (s: TransitState) => currentVehicle(s) === 'coach' && ['boarding', 'coach-boarding', 'transfer-exit', 'transfer-departure', 'coach-exit', 'coach-departure'].includes(s.phase);
export function createTransit(phase: Stage = 'intro', round: Round = { layout: 0, palette: 0, cast: 0 }): TransitState {
  const s: TransitState = { version: 4, phase, action: durations[phase] ? 'auto' : 'ready', round: { ...round, companion: companion(round) }, selected: null, order: [], travel: 0, aim: 0, doors: { bus: 0, taxi: 0, school: 0, coach: 0 }, luggage: suitcaseHome(round), elapsed: 0 };
  if (index(phase) >= index('transfer-arrival') && index(phase) <= index('transfer-departure')) s.selected = 'taxi';
  if (index(phase) >= index('coach-entrance')) s.order = transferPair(round);
  if ((phase === 'luggage' || phase === 'loading') && companion(round) === 'coach') { s.selected = 'coach'; s.order = []; }
  if (['bus-door', 'transfer-door', 'coach-door'].includes(phase)) s.travel = 1;
  if (['unloading', 'bus-exit', 'bus-departure'].includes(phase)) s.doors.bus = phase === 'unloading' ? 1 : 0;
  if (phase === 'boarding') s.doors.taxi = 1;
  if (phase === 'luggage' || phase === 'loading') s.doors.coach = 1;
  if (phase === 'coach-boarding') s.doors[finalVehicle(round)] = 1;
  if (phase === 'loading' || index(phase) >= index('coach-boarding')) s.luggage = cargoTarget(round);
  return s;
}
export function currentVehicle(s: TransitState): Vehicle {
  if (index(s.phase) <= index('bus-departure')) return 'bus';
  if (isFinalVisit(s)) return finalVehicle(s.round);
  return s.selected ?? transferPair(s.round).find(v => !s.order.includes(v)) ?? 'taxi';
}
export function available(s: TransitState): Vehicle[] {
  if (s.action === 'auto') return [];
  if (s.phase === 'choose') return transferPair(s.round).filter(v => !s.order.includes(v));
  return ['bus-arrival', 'bus-door', 'bus-exit', 'transfer-arrival', 'transfer-door', 'transfer-exit', 'coach-arrival', 'coach-door', 'luggage', 'coach-exit'].includes(s.phase) ? [currentVehicle(s)] : [];
}
export const isDoor = (s: TransitState) => s.phase.endsWith('-door');
export const isDriving = (s: TransitState) => s.phase.endsWith('-arrival') || s.phase.endsWith('-exit');
export const driveRoute = (s: TransitState, vehicle = currentVehicle(s)) => s.phase.endsWith('-exit') ? exitRoute(s.round, vehicle) : arrivalRoute(s.round, vehicle);
function enter(s: TransitState, phase: Stage): TransitState { return { ...s, phase, action: durations[phase] ? 'auto' : 'ready', travel: 0, aim: 0, elapsed: 0 }; }
export function grab(s: TransitState, v: Vehicle): TransitState {
  if (s.action !== 'ready' || !available(s).includes(v)) return s;
  const next = s.phase === 'choose' && isTransfer(v) ? { ...enter(s, 'transfer-arrival'), selected: v } : s;
  return { ...next, action: 'dragging', aim: next.travel, elapsed: 0 };
}
export function drive(s: TransitState, amount: number): TransitState {
  if (s.action !== 'dragging' || !Number.isFinite(amount)) return s;
  if (isDriving(s)) return { ...s, aim: clamp(amount) };
  if (!isDoor(s)) return s;
  const vehicle = currentVehicle(s), doors = { ...s.doors, [vehicle]: clamp(amount) };
  if (amount < 0.99) return { ...s, doors };
  doors[vehicle] = 1;
  return enter({ ...s, doors }, vehicle === 'bus' ? 'unloading' : vehicle === 'coach' ? 'luggage' : isFinalVisit(s) ? 'coach-boarding' : 'boarding');
}
export function moveLuggage(s: TransitState, point: Position, near: boolean): TransitState {
  if (s.phase !== 'luggage' || s.action !== 'dragging' || ![point.x, point.y, point.z].every(Number.isFinite)) return s;
  return { ...s, luggage: { x: Math.max(-13, Math.min(13, point.x)), y: Math.max(0.16, Math.min(2, point.y)), z: Math.max(1.3, Math.min(8, point.z)) }, aim: near ? 1 : 0, elapsed: near ? s.elapsed : 0 };
}
export function release(s: TransitState, cancelled: boolean): TransitState {
  if (s.action !== 'dragging') return s;
  if (s.phase === 'luggage' && !cancelled && s.aim === 1) return enter(s, 'loading');
  if (s.phase === 'transfer-arrival' && s.travel === 0) return { ...enter(s, 'choose'), selected: null };
  return { ...s, action: 'ready', aim: 0, elapsed: 0 };
}
export function advance(s: TransitState, dt: number): TransitState {
  if (!Number.isFinite(dt) || dt <= 0) return s;
  if (s.action === 'dragging') {
    if (s.phase === 'luggage') return s.aim === 1 ? s.elapsed + dt >= 0.4 ? enter(s, 'loading') : { ...s, elapsed: s.elapsed + dt } : s;
    if (!isDriving(s)) return s;
    const amount = 5.5 * dt / pathLength(driveRoute(s));
    const travel = s.travel + Math.sign(s.aim - s.travel) * Math.min(Math.abs(s.aim - s.travel), amount);
    // The last 30 cm are automatic alignment, so a paused, nearly parked car stays easy to finish.
    if ((1 - travel) * pathLength(driveRoute(s)) > 0.3 || s.aim < 0.999) return travel === s.travel ? s : { ...s, travel };
    return enter(s, s.phase === 'bus-arrival' ? 'bus-door' : s.phase === 'transfer-arrival' ? 'transfer-door' : s.phase === 'coach-arrival' ? 'coach-door' : s.phase === 'bus-exit' ? 'bus-departure' : s.phase === 'transfer-exit' ? 'transfer-departure' : 'coach-departure');
  }
  if (s.action !== 'auto') return s;
  const elapsed = s.elapsed + dt, duration = durations[s.phase]!;
  if (elapsed < duration) return { ...s, elapsed };
  if (s.phase === 'intro') return enter(s, 'bus-arrival');
  if (s.phase === 'unloading') return enter({ ...s, doors: { ...s.doors, bus: 0 } }, 'bus-exit');
  if (s.phase === 'bus-departure') return enter(s, 'transfer-entrance');
  if (s.phase === 'transfer-entrance') return enter(s, 'choose');
  if (s.phase === 'boarding') return enter({ ...s, doors: { ...s.doors, [s.selected!]: 0 } }, 'transfer-exit');
  if (s.phase === 'transfer-departure') {
    const order = [...s.order, s.selected!];
    return enter({ ...s, order, selected: null }, order.length === 2 ? 'coach-entrance' : 'choose');
  }
  if (s.phase === 'coach-entrance') return enter(s, 'coach-arrival');
  if (s.phase === 'loading') return enter({ ...s, luggage: cargoTarget(s.round) }, s.selected === 'coach' ? 'boarding' : 'coach-boarding');
  if (s.phase === 'coach-boarding') return enter({ ...s, doors: { ...s.doors, [finalVehicle(s.round)]: 0 } }, 'coach-exit');
  return enter(s, s.phase === 'coach-departure' ? 'celebrate' : 'complete');
}
export function progress(s: TransitState) {
  if (s.phase === 'complete') return 1;
  if (s.phase === 'transfer-entrance') return 0.22 + 0.03 * clamp(s.elapsed / ENTRANCE.duration);
  if (s.phase === 'coach-entrance') return 0.69 + 0.01 * clamp(s.elapsed / FINAL_ENTRANCE_SECONDS);
  if (index(s.phase) >= index('celebrate')) return 0.97;
  const visit = s.phase.endsWith('-arrival') ? 0.08 : s.phase.endsWith('-door') ? 0.22 : s.phase === 'luggage' ? 0.34 : s.phase === 'loading' ? 0.46 : s.phase === 'boarding' || s.phase === 'coach-boarding' ? 0.62 : s.phase.endsWith('-exit') ? 0.8 : 0.94;
  if (isFinalVisit(s)) return 0.7 + visit * 0.25;
  if (index(s.phase) >= index('choose')) return 0.25 + s.order.length * 0.22 + (s.selected ? visit * 0.22 : 0);
  return index(s.phase) / 6 * 0.25;
}
/** Validate phase relationships as well as numbers; never restore phantom passengers or cargo. */
export function resumeTransit(value: unknown): TransitState | undefined {
  if (!value || typeof value !== 'object') return;
  const candidate = value as Omit<TransitState, 'version'> & { version: number };
  if (![1, 2, 3, 4].includes(candidate.version) || !validRound(candidate.round)) return;
  const s: TransitState = { ...candidate, version: 4, round: { ...candidate.round, companion: candidate.version < 4 ? 'school' : companion(candidate.round) } };
  if (!stages.includes(s.phase) || !validRound(s.round) || !['ready', 'dragging', 'auto'].includes(s.action)) return;
  const pair = transferPair(s.round);
  if (!Array.isArray(s.order) || s.order.length > 2 || s.order.some(v => !pair.includes(v)) || new Set(s.order).size !== s.order.length || s.selected !== null && !pair.includes(s.selected)) return;
  if (!unit(s.travel) || !unit(s.aim) || !Number.isFinite(s.elapsed) || s.elapsed < 0 || !s.doors || !(['bus', 'taxi', 'school', 'coach'] as const).every(v => unit(s.doors[v]))) return;
  if (!s.luggage || ![s.luggage.x, s.luggage.y, s.luggage.z].every(Number.isFinite) || Math.abs(s.luggage.x) > 13 || s.luggage.y < 0.16 || s.luggage.y > 2 || s.luggage.z < 1.2 || s.luggage.z > 8) return;
  const i = index(s.phase), transferring = i >= index('transfer-arrival') && i <= index('transfer-departure') || (s.phase === 'luggage' || s.phase === 'loading') && s.selected === 'coach';
  if (transferring ? !s.selected || s.order.includes(s.selected) || s.order.length > 1 : s.selected !== null) return;
  if (i < index('choose') && s.order.length || s.phase === 'choose' && s.order.length > 1 || isFinalVisit(s) && s.order.length !== 2) return;
  if ((s.phase === 'luggage' || s.phase === 'loading') && currentVehicle(s) !== 'coach') return;
  const auto = durations[s.phase];
  if (auto ? s.action !== 'auto' || s.elapsed >= auto : s.action === 'auto' || s.elapsed > 0 && !(s.phase === 'luggage' && s.action === 'dragging' && s.elapsed < 0.4)) return;
  const expected = createTransit(s.phase, s.round).doors;
  if (s.phase === 'boarding') { expected.taxi = 0; expected[s.selected!] = 1; }
  for (const v of ['bus', 'taxi', 'school', 'coach'] as const) {
    if (isDoor(s) && v === currentVehicle(s)) continue;
    if (s.doors[v] !== expected[v]) return;
  }
  if (s.action === 'dragging' && available(s).length === 0) return;
  return release(structuredClone(s), true);
}
