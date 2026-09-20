export const stages = ['collision', 'police', 'cones', 'tow-choice', 'tow-arrival', 'hook', 'tow-exit', 'sweeper', 'sweep', 'ambulance', 'stretcher', 'boarding', 'departure', 'reopen', 'complete'] as const;
export type Stage = typeof stages[number];
export type Action = 'entering' | 'ready' | 'dragging' | 'working';
export type Goal = 'cone-left' | 'cone-right' | 'car-0' | 'car-1' | 'patient' | 'ambulance';
export interface Point { x: number; y: number; z: number }
export const PALETTE = ['#d88973', '#e2ba65', '#82b6c4', '#91b69a', '#aa9bc2', '#dfaa88'] as const;
export const CARS: Point[] = [{ x: -1.75, y: 0, z: -0.95 }, { x: 1.75, y: 0, z: 0.95 }];
export const CONES: Point[] = [{ x: -6, y: 0.4, z: -3.5 }, { x: 6, y: 0.4, z: -3.5 }];
export const CONE_HOME = { x: -4.5, y: 0.4, z: -4.7 };
export type TowType = 'flatbed' | 'wheel-lift';
export type TowPair = [TowType, TowType];
export const TOW_LANE = 4.2;
export const towDirection = (s: TrafficState) => s.selected === 0 ? -1 : 1;
export const towType = (s: TrafficState) => s.towTypes[s.selected ?? 0];
export const towHome = (s: TrafficState): Point => ({ x: towDirection(s) * 4.3, y: 0.7, z: TOW_LANE });
export const chooseTowTypes = (random = Math.random): TowPair => random() < 0.5 ? ['flatbed', 'wheel-lift'] : ['wheel-lift', 'flatbed'];
export const PATIENT = { x: 1, y: 0.7, z: -6.4 };
export const STRETCHER_HOME = { x: -1.8, y: 0.7, z: -4.7 };
export const AMBULANCE_REAR = { x: 3, y: 0.7, z: -4.7 };
export const DEBRIS = [-3.8, -2.9, -1.8, -0.9, 0, 0.9, 1.8, 2.9, 3.8];
export const SETTLE_SECONDS = 0.4;
export interface TrafficState {
  version: 2; towTypes: TowPair; phase: Stage; action: Action; elapsed: number;
  colors: [number, number]; cones: [boolean, boolean]; towed: [boolean, boolean];
  selected: 0 | 1 | null; cleaned: number; truckX: number; handle: Point;
}
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const smooth = (n: number) => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
export const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
export function chooseColors(previous?: readonly number[], random = Math.random): [number, number] {
  const choices: [number, number][] = [];
  for (let a = 0; a < PALETTE.length; a++) for (let b = 0; b < PALETTE.length; b++) {
    if (a !== b && (!previous || (a !== previous[0] && b !== previous[1] && !(a === previous[1] && b === previous[0])))) choices.push([a, b]);
  }
  return choices[clamp(Math.floor(random() * choices.length), 0, choices.length - 1)];
}
export function createTraffic(phase: Stage = 'collision', colors: [number, number] = chooseColors(), towTypes: TowPair = chooseTowTypes()): TrafficState {
  const index = stages.indexOf(phase), selected = ['tow-arrival', 'hook', 'tow-exit'].includes(phase) ? 0 : null;
  const state: TrafficState = { version: 2, towTypes: [...towTypes], phase,
    action: ['collision', 'tow-arrival', 'departure', 'reopen'].includes(phase) ? 'working' : ['police', 'sweeper', 'ambulance'].includes(phase) ? 'entering' : 'ready', elapsed: 0,
    colors: [...colors], cones: [index > 2, index > 2], towed: [index >= stages.indexOf('sweeper'), index >= stages.indexOf('sweeper')], selected,
    cleaned: index >= stages.indexOf('ambulance') ? DEBRIS.length : 0, truckX: phase === 'tow-exit' ? -8 : phase === 'sweep' ? -6 : -10,
    handle: phase === 'cones' ? { ...CONE_HOME } : phase === 'boarding' ? { ...PATIENT } : { ...STRETCHER_HOME } };
  if (phase === 'hook') state.handle = towHome(state);
  return state;
}
export const isDriving = (s: TrafficState) => ['police', 'tow-exit', 'sweeper', 'sweep', 'ambulance'].includes(s.phase);
export const driveEnd = (s: TrafficState) => s.phase === 'police' ? -7 : s.phase === 'tow-exit' ? towDirection(s) * 11 : s.phase === 'sweeper' ? -6 : s.phase === 'sweep' ? 6 : 5.6;
export function goals(s: TrafficState): Goal[] {
  if (!['ready', 'dragging'].includes(s.action)) return [];
  if (s.phase === 'cones') return CONES.flatMap((_, i) => s.cones[i] ? [] : [i ? 'cone-right' as const : 'cone-left' as const]);
  if (s.phase === 'hook') return s.selected === 0 ? ['car-0'] : ['car-1'];
  if (s.phase === 'tow-choice') return CARS.flatMap((_, i) => s.towed[i] ? [] : [i ? 'car-1' as const : 'car-0' as const]);
  return s.phase === 'stretcher' ? ['patient'] : s.phase === 'boarding' ? ['ambulance'] : [];
}
export function goalPoint(goal: Goal): Point {
  if (goal.startsWith('cone')) return CONES[goal === 'cone-left' ? 0 : 1];
  if (goal.startsWith('car')) return { ...CARS[goal === 'car-0' ? 0 : 1], y: 0.7 };
  return goal === 'patient' ? PATIENT : AMBULANCE_REAR;
}
function next(s: TrafficState, phase: Stage, action: Action = 'ready'): TrafficState {
  const truckX = phase === 'police' || phase === 'sweeper' || phase === 'ambulance' ? -10 : phase === 'tow-exit' ? towDirection(s) * 8 : phase === 'sweep' ? -6 : s.truckX;
  const handle = phase === 'cones' ? CONE_HOME : phase === 'hook' ? towHome(s) : phase === 'stretcher' ? STRETCHER_HOME : phase === 'boarding' ? PATIENT : s.handle;
  return { ...s, phase, action, elapsed: 0, truckX, handle: { ...handle } };
}
export function grab(s: TrafficState): TrafficState {
  return s.action === 'ready' && (isDriving(s) || goals(s).length > 0) ? { ...s, action: 'dragging' } : s;
}
export function drive(s: TrafficState, x: number): TrafficState {
  if (s.action !== 'dragging' || !isDriving(s) || !Number.isFinite(x)) return s;
  const start = s.phase === 'tow-exit' ? towDirection(s) * 8 : s.phase === 'sweep' ? -6 : -10;
  const end = driveEnd(s), truckX = clamp(x, Math.min(start, end), Math.max(start, end));
  // Cleaning depends on the brush passing every patch; reversal never restores dirt.
  const cleaned = s.phase === 'sweep' ? Math.max(s.cleaned, DEBRIS.filter(p => p <= truckX + 0.9).length) : s.cleaned;
  const changed = { ...s, truckX, cleaned };
  return Math.abs(truckX - end) <= 0.03 ? { ...changed, action: 'working', elapsed: 0 } : changed;
}
export function moveHandle(s: TrafficState, p: Point): TrafficState {
  if (s.action !== 'dragging' || isDriving(s) || s.phase === 'tow-choice' || ![p.x, p.y, p.z].every(Number.isFinite)) return s;
  return { ...s, handle: { x: clamp(p.x, -11, 11), y: 0.7, z: clamp(p.z, -6.5, 5.5) } };
}
export function accept(s: TrafficState, goal: Goal): TrafficState {
  if (s.action !== 'dragging' || !goals(s).includes(goal)) return s;
  if (s.phase === 'tow-choice') return next({ ...s, selected: goal === 'car-0' ? 0 : 1 }, 'tow-arrival', 'working');
  return { ...s, action: 'working', elapsed: 0, handle: { ...goalPoint(goal) },
    selected: goal.startsWith('car') ? goal === 'car-0' ? 0 : 1 : s.selected,
    cones: goal === 'cone-left' ? [true, s.cones[1]] : goal === 'cone-right' ? [s.cones[0], true] : s.cones };
}
export function release(s: TrafficState, cancelled: boolean, goal?: Goal): TrafficState {
  if (s.action !== 'dragging') return s;
  if (!cancelled && goal) return accept(s, goal);
  const handle = s.phase === 'cones' ? CONE_HOME : s.phase === 'hook' ? towHome(s) : s.phase === 'stretcher' ? STRETCHER_HOME : s.phase === 'boarding' ? PATIENT : s.handle;
  return { ...s, action: 'ready', handle: { ...handle } };
}
export const durations: Partial<Record<Stage, number>> = { collision: 3.8, police: 0.5, cones: 0.75, 'tow-arrival': 2, hook: 4.5, 'tow-exit': 1.5, sweeper: 0.5, sweep: 2, ambulance: 0.7, stretcher: 1.4, boarding: 1.2, departure: 3.2, reopen: 4 };
export function advance(s: TrafficState, dt: number): TrafficState {
  if (!Number.isFinite(dt) || dt <= 0 || !['entering', 'working'].includes(s.action)) return s;
  const elapsed = s.elapsed + Math.min(dt, 0.1), waiting = { ...s, elapsed };
  if (elapsed < (s.action === 'entering' ? 1.2 : durations[s.phase] ?? Infinity)) return waiting;
  if (s.action === 'entering') return { ...s, action: 'ready', elapsed: 0 };
  switch (s.phase) {
    case 'collision': return next(s, 'police', 'entering');
    case 'police': return next(s, 'cones');
    case 'cones': return s.cones.every(Boolean) ? next(s, 'tow-choice') : next(s, 'cones');
    case 'tow-arrival': return next(s, 'hook');
    case 'hook': return next(s, 'tow-exit');
    case 'tow-exit': {
      if (s.selected === null) return s;
      const towed: [boolean, boolean] = [...s.towed]; towed[s.selected] = true;
      return towed.every(Boolean) ? next({ ...s, towed, selected: null }, 'sweeper', 'entering')
        : next({ ...s, towed, selected: towed[0] ? 1 : 0 }, 'tow-arrival', 'working');
    }
    case 'sweeper': return next(s, 'sweep');
    case 'sweep': return next(s, 'ambulance', 'entering');
    case 'ambulance': return next(s, 'stretcher');
    case 'stretcher': return next(s, 'boarding');
    case 'boarding': return next(s, 'departure', 'working');
    case 'departure': return next(s, 'reopen', 'working');
    case 'reopen': return next(s, 'complete');
    default: return s;
  }
}
export function progress(s: TrafficState) {
  const values: Record<Stage, number> = { collision: 0, police: 0.04, cones: 0.08, 'tow-choice': 0.16, 'tow-arrival': 0.18, hook: 0.2, 'tow-exit': 0.31, sweeper: 0.58, sweep: 0.62, ambulance: 0.8, stretcher: 0.85, boarding: 0.9, departure: 0.94, reopen: 0.97, complete: 1 };
  return values[s.phase] + (['tow-choice', 'tow-arrival', 'hook', 'tow-exit'].includes(s.phase) ? s.towed.filter(Boolean).length * 0.2 : s.phase === 'sweep' ? s.cleaned / DEBRIS.length * 0.15 : s.phase === 'cones' ? s.cones.filter(Boolean).length * 0.03 : 0);
}
export function resumeTraffic(value: unknown): TrafficState | undefined {
  if (!value || typeof value !== 'object') return;
  let s = value as TrafficState;
  const index = stages.indexOf(s.phase), sweep = stages.indexOf('sweep'), towing = ['tow-choice', 'tow-arrival', 'hook', 'tow-exit'].includes(s.phase);
  const boolPair = (v: unknown): v is [boolean, boolean] => Array.isArray(v) && v.length === 2 && v.every(x => typeof x === 'boolean');
  const legacy = (value as { version: number }).version === 1;
  if ((!legacy && s.version !== 2) || index < 0 || !['entering', 'ready', 'dragging', 'working'].includes(s.action) || !Number.isFinite(s.elapsed) || s.elapsed < 0 || s.elapsed > 10) return;
  if (!Array.isArray(s.colors) || s.colors.length !== 2 || s.colors.some(c => !Number.isInteger(c) || c < 0 || c >= PALETTE.length) || s.colors[0] === s.colors[1]) return;
  if (!boolPair(s.cones) || !boolPair(s.towed) || ![null, 0, 1].includes(s.selected) || !Number.isInteger(s.cleaned) || s.cleaned < 0 || s.cleaned > DEBRIS.length) return;
  if (!s.handle || ![s.handle.x, s.handle.y, s.handle.z, s.truckX].every(Number.isFinite) || s.truckX < (legacy ? -10 : -11) || s.truckX > (legacy ? 12 : 11) || Math.abs(s.handle.x) > 11 || Math.abs(s.handle.z) > 6.5 || s.handle.y < 0 || s.handle.y > 2) return;
  if (index < 2 && s.cones.some(Boolean) || index > 2 && !s.cones.every(Boolean)) return;
  if (index < 3 && s.towed.some(Boolean) || index >= stages.indexOf('sweeper') && !s.towed.every(Boolean) || towing && s.towed.every(Boolean)) return;
  if (index < sweep && s.cleaned !== 0 || index > sweep && s.cleaned !== DEBRIS.length) return;
  if (s.selected !== null && s.towed[s.selected]) return;
  if (s.action === 'entering' && !['police', 'sweeper', 'ambulance'].includes(s.phase)) return;
  if (['collision', 'tow-arrival', 'departure', 'reopen'].includes(s.phase) && s.action !== 'working') return;
  if (s.phase === 'complete' && s.action !== 'ready') return;
  if (legacy) {
    // Keep completed work and colours; an unfinished old trip returns to selection.
    const loaded = s.phase === 'tow-exit' || s.phase === 'hook' && s.action === 'working';
    if (s.phase === 'tow-choice' || loaded !== (s.selected !== null)) return;
    if (s.action === 'working' && isDriving(s) && Math.abs(s.truckX - (s.phase === 'tow-exit' ? 12 : driveEnd(s))) > 0.03) return;
    s = { ...s, version: 2, towTypes: ['flatbed', 'wheel-lift'] };
    if (towing) s = next({ ...s, selected: null, truckX: -10 }, 'tow-choice');
  }
  if (!Array.isArray(s.towTypes) || s.towTypes.length !== 2 || s.towTypes.some(t => !['flatbed', 'wheel-lift'].includes(t)) || s.towTypes[0] === s.towTypes[1]) return;
  if (['tow-arrival', 'hook', 'tow-exit'].includes(s.phase) !== (s.selected !== null)) return;
  if (s.phase === 'tow-choice' && !['ready', 'dragging'].includes(s.action)) return;
  if (s.phase === 'tow-exit' && (s.truckX * towDirection(s) < 8 || s.truckX * towDirection(s) > 11)) return;
  if (s.action === 'working' && isDriving(s) && Math.abs(s.truckX - driveEnd(s)) > 0.03) return;
  if (s.action === 'dragging' && !isDriving(s) && !goals(s).length) return;
  // Old development saves may be waiting on the now-unnecessary second choice.
  if (s.phase === 'tow-choice' && s.towed.some(Boolean)) s = next({ ...s, selected: s.towed[0] ? 1 : 0 }, 'tow-arrival', 'working');
  return release(structuredClone(s), true);
}
