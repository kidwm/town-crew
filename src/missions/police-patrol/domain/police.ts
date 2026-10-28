export const stages = ['intro', 'setup', 'bikes-arrival', 'guard', 'inspect', 'van-arrival', 'van', 'door', 'boarding', 'lead', 'transport', 'tow-arrival', 'tow', 'tow-load', 'depart', 'complete'] as const;
export type Stage = typeof stages[number];
export type Bike = 'bike0' | 'bike1';
export type Vehicle = 'police' | Bike | 'van' | 'tow';
export const jobs = ['setup', 'guard', 'arrive', 'door', 'escort', 'recover'] as const;
export type Job = typeof jobs[number];
export interface Point { x: number; z: number }
export interface Round { layout: number; color: number; traffic: 'taxi-first' | 'freight-first' }
export interface PoliceState {
  version: 3; round: Round; phase: Stage; action: 'ready' | 'dragging' | 'working';
  elapsed: number; active: Vehicle | null; aim: number; work: Record<Job, number>; selected: Bike | null; checked: number;
}
export const PALETTE = ['#d88973', '#e2ba65', '#82b6c4', '#91b69a', '#aa9bc2', '#dfaa88'];
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
export const direction = (r: Round) => r.layout === 0 ? 1 : -1;
export const vanDoorSide = direction;
export const at = (phase: Stage) => stages.indexOf(phase);
export function validRound(value: unknown): value is Round {
  if (!value || typeof value !== 'object') return false;
  const r = value as Round;
  return Object.keys(r).length === 3 && [0, 1].includes(r.layout) && Number.isInteger(r.color) && r.color >= 0 && r.color < PALETTE.length && ['taxi-first', 'freight-first'].includes(r.traffic);
}
export function chooseRound(previous?: Round, random = Math.random): Round {
  const pick = (n: number) => Math.max(0, Math.min(n - 1, Math.floor(random() * n)));
  const colors = PALETTE.map((_, i) => i).filter(n => n !== previous?.color);
  return { layout: previous ? 1 - previous.layout : pick(2), color: colors[pick(colors.length)], traffic: previous ? previous.traffic === 'taxi-first' ? 'freight-first' : 'taxi-first' : random() < 0.5 ? 'taxi-first' : 'freight-first' };
}
/** All checkpoint paths mirror together. Vehicles steer; the child drags toward one destination. */
export function route(r: Round, points: readonly (readonly [number, number])[]) { return points.map(([x, z]) => ({ x: direction(r) * x, z })); }
export function routes(r: Round) {
  return {
    setup: route(r, [[-5.5, -5.2], [0, -5.2]]),
    bike0: route(r, [[-5.3, 0.1], [5.3, 0.1]]),
    bike1: route(r, [[-5.3, 2.1], [-2.8, 2.1], [3.5, 0.1], [5.3, 0.1]]),
    arrive: route(r, [[-5.6, 4.3], [0, 4.3]]),
    escort: route(r, [[0, 4.3], [5.6, 4.3]]),
    recover: route(r, [[CHECKPOINT.towStart, CHECKPOINT.z], [CHECKPOINT.towX, CHECKPOINT.z]]),
  };
}
export const CHECKPOINT = { x: -2.8, z: -2.0, towX: 3.4, towStart: 5.5 } as const;
export const boardingRoute = (r: Round) => route(r, [[-0.58, 6.1], [-0.58, 4.55]]);
// This walk happens before the van arrives; the waiting area is on its near side.
export const inspectionWalk = (r: Round) => route(r, [[-3.2, -0.9], [-0.4, -0.6], [-0.4, 6.1], [-0.58, 6.1]]);
export const WANTED_CHECK_START = 2.9;
export const inspectionCheckVisible = (s: PoliceState) => s.phase === 'inspect' && s.elapsed >= (s.checked === 2 ? WANTED_CHECK_START : 1.5) && s.elapsed <= (s.checked === 2 ? 4.3 : 2.9);
/** The same saved clock drives approach, escort and boarding; stage changes never relocate the officer. */
export function officerPose(s: PoliceState) {
  const standby = route(s.round, [[1, -1]])[0], waiting = route(s.round, [[-1.18, 6.25]])[0];
  let point = at(s.phase) <= at('inspect') ? standby : waiting, distance = 0, fraction = 0, step = 0;
  const walk = (path: Point[], amount: number) => { fraction = clamp(amount); const p = pathPose(path, smooth(fraction)); point = { x: p.x, z: p.z }; distance = p.distance; };
  if (s.phase === 'inspect' && s.checked === 2) {
    if (s.elapsed < 4) walk(route(s.round, [[1, -1], [1, -0.05], [-3.2, -0.05]]), (s.elapsed - 1.5) / (WANTED_CHECK_START - 1.5));
    else walk(route(s.round, [[-3.2, -0.05], [-1.18, -0.05], [-1.18, 6.25]]), (s.elapsed - 4) / 3.2);
  }
  if (s.phase === 'boarding') {
    walk([waiting, ...boardingRoute(s.round)], (s.elapsed - 0.35) / 1.8);
    step = smooth((s.elapsed - 1.55) / 0.6) * 0.65;
  }
  const walking = fraction > 0 && fraction < 1, sway = walking ? Math.sin(distance * 10) * Math.sin(fraction * Math.PI) : 0;
  return { ...point, y: step + Math.abs(sway) * 0.045, arm: inspectionCheckVisible(s) && (s.checked < 2 || s.elapsed < 3.8) ? -1 : -0.2 + sway * 0.3 };
}
export function pathLength(path: readonly Point[]) { return path.slice(1).reduce((sum, b, i) => sum + Math.hypot(b.x - path[i].x, b.z - path[i].z), 0); }
export function pathPose(path: readonly Point[], fraction: number) {
  const length = pathLength(path); let distance = clamp(fraction) * length;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], segment = Math.hypot(b.x - a.x, b.z - a.z);
    if (distance <= segment || i === path.length - 1) return { ...mix(a, b, segment ? clamp(distance / segment) : 1), yaw: Math.atan2(-(b.z - a.z), b.x - a.x), distance: clamp(fraction) * length };
    distance -= segment;
  }
  return { ...path[0], yaw: 0, distance: 0 };
}
export function workPath(s: PoliceState, vehicle: Vehicle) {
  const paths = routes(s.round), key = job(s, vehicle);
  return key === 'guard' ? paths[vehicle as Bike] : paths[key as 'setup' | 'arrive' | 'escort' | 'recover'];
}
/** Shared by renderer and clearance tests. Automatic departures extend beyond the current frustum. */
export function vehiclePose(s: PoliceState, vehicle: Vehicle, exit = 24) {
  const paths = routes(s.round), r = s.round, w = s.work, t = s.elapsed;
  if (vehicle === 'police') return s.phase === 'depart' ? pathPose(route(r, [[0, -5.2], [exit, -5.2]]), smooth((t - 2.4) / 1.8)) : pathPose(paths.setup, w.setup);
  if (vehicle === 'van') {
    if (s.phase === 'van-arrival') return pathPose([{ x: -direction(r) * exit, z: paths.arrive[0].z }, paths.arrive[0]], smooth(t / 1.8));
    if (at(s.phase) >= at('tow-arrival')) return pathPose(route(r, [[5.6, 4.3], [exit, 4.3]]), s.phase === 'tow-arrival' ? smooth(t / 1.8) : 1);
    return pathPose(at(s.phase) >= at('transport') ? paths.escort : paths.arrive, at(s.phase) >= at('transport') ? w.escort : w.arrive);
  }
  if (vehicle === 'tow') {
    const path = s.phase === 'tow-arrival' ? route(r, [[exit, CHECKPOINT.z], [CHECKPOINT.towStart, CHECKPOINT.z]]) : s.phase === 'depart' ? route(r, [[CHECKPOINT.towX, CHECKPOINT.z], [exit, CHECKPOINT.z]]) : paths.recover;
    const amount = s.phase === 'tow-arrival' ? smooth((t - 1.8) / 1.6) : s.phase === 'depart' ? smooth(t / 2.2) : w.recover;
    return { ...pathPose(path, amount), yaw: direction(r) === 1 ? 0 : Math.PI }; // Reverse into position, with the cab still facing the exit.
  }
  if (s.phase === 'bikes-arrival') {
    const start = paths[vehicle][0], delay = vehicle === 'bike1' ? 0.25 : 0;
    return pathPose([{ x: -direction(r) * exit, z: start.z }, start], smooth((t - delay) / 1.75));
  }
  if (s.selected === vehicle) {
    if (at(s.phase) >= at('lead')) return pathPose(route(r, [[5.3, 0.1], [7.5, 0.1], [9, 4.3], [exit + 8, 4.3]]), s.phase === 'lead' ? smooth(t / 2) : 1);
    return pathPose(paths[vehicle], w.guard);
  }
  const start = paths[vehicle][0];
  return s.phase === 'depart' ? pathPose([start, { x: direction(r) * exit, z: start.z }], smooth((t - 4.4) / 1.8)) : pathPose(paths[vehicle], 0);
}
export const inspectionKind = (s: PoliceState) => s.checked === 2 ? 'wanted' : (s.checked === 0) === (s.round.traffic === 'taxi-first') ? 'taxi' : 'freight';
export function inspectedPose(s: PoliceState, exit = 24) {
  const { x, z } = CHECKPOINT, t = s.elapsed;
  const departing = s.phase === 'inspect' && s.checked < 2 && t >= 2.9;
  return pathPose(route(s.round, departing ? [[x, z], [exit, z]] : [[-exit, z], [x, z]]), s.phase === 'inspect' ? smooth(departing ? (t - 2.9) / 1.5 : t / 1.5) : 1);
}
/** Car tyre contact follows the original flatbed surface as the winch pulls it up and the bed rises. */
export function recoveryPose(s: PoliceState, exit = 24) {
  const loading = s.phase === 'tow-load', carried = at(s.phase) >= at('depart'), t = s.elapsed;
  const lowered = loading ? smooth(t / 0.9) * (1 - smooth((t - 4.5) / 1)) : 0;
  const amount = carried ? 1 : loading ? smooth((t - 1.4) / 3.1) : 0;
  const rig = vehiclePose(s, 'tow', exit), d = direction(s.round), angle = lowered * 0.19;
  const localX = (CHECKPOINT.x - CHECKPOINT.towX) * (1 - amount) - 1.15 * amount;
  const surface = (x: number) => Math.max(0, 0.94 + 0.09 / Math.cos(angle) + (x - 0.85) * Math.tan(angle));
  // The front axle climbs first; before the ramp both tyres stay on the road.
  const onRamp = loading && t >= 1.4 || carried;
  const height = (x: number) => onRamp && x >= 0.85 - 5.325 * Math.cos(angle) ? surface(x) : 0;
  const front = height(localX + 1.05), rear = height(localX - 1.05);
  const car = { x: amount > 0 || carried ? rig.x + d * localX : d * CHECKPOINT.x, z: CHECKPOINT.z, y: 0.07 + (front + rear) / 2, yaw: d === 1 ? 0 : Math.PI, pitch: Math.atan2(front - rear, 2.1) };
  return { rig, car, lowered, amount, secured: carried || loading && t >= 5.5, hooking: loading && t >= 0.9 };
}
const automatic: Partial<Record<Stage, number>> = { intro: 1, 'bikes-arrival': 2, inspect: 7.2, 'van-arrival': 1.8, boarding: 2.8, lead: 2, 'tow-arrival': 3.4, 'tow-load': 5.8, depart: 9.5 };
export const duration = (s: PoliceState) => s.phase === 'inspect' && s.checked < 2 ? 4.4 : automatic[s.phase] ?? 0;
export function crewStatus(s: PoliceState) {
  const active = s.phase === 'intro' || s.phase === 'setup' ? 0 : ['bikes-arrival', 'guard', 'inspect'].includes(s.phase) ? 1 : at(s.phase) < at('tow-arrival') ? 2 : 3;
  const done = [s.work.setup === 1, s.work.guard === 1, s.work.escort === 1, s.phase === 'complete' || s.phase === 'depart' && s.elapsed >= 2.2];
  return done.map((complete, i) => complete ? 'done' : s.phase !== 'complete' && i === active ? 'active' : 'upcoming');
}
export function job(s: PoliceState, vehicle: Vehicle | null = s.active): Job | undefined {
  if (s.phase === 'guard') return vehicle === 'bike0' || vehicle === 'bike1' ? 'guard' : undefined;
  return ({ setup: 'setup', van: 'arrive', door: 'door', transport: 'escort', tow: 'recover' } as Partial<Record<Stage, Job>>)[s.phase];
}
export function available(s: PoliceState): Vehicle[] {
  if (s.action === 'working' || s.phase === 'complete') return [];
  if (s.phase === 'guard') return s.selected ? [s.selected] : ['bike0', 'bike1'];
  if (s.phase === 'tow') return ['tow'];
  if (s.phase === 'setup') return ['police'];
  if (['van', 'door', 'transport'].includes(s.phase)) return ['van'];
  return [];
}
function transition(s: PoliceState, phase: Stage): PoliceState { return { ...s, phase, action: automatic[phase] ? 'working' : 'ready', active: null, aim: 0, elapsed: 0 }; }
export function createPolice(phase: Stage = 'intro', round: Round = chooseRound(), selected: Bike = 'bike0', checked = 0): PoliceState {
  const work = { setup: 0, guard: 0, arrive: 0, door: 0, escort: 0, recover: 0 };
  for (const [stage, key] of [['setup', 'setup'], ['guard', 'guard'], ['van', 'arrive'], ['door', 'door'], ['transport', 'escort'], ['tow', 'recover']] as const) if (at(phase) > at(stage)) work[key] = 1;
  return transition({ version: 3, checked: phase === 'inspect' ? checked : at(phase) > at('inspect') ? 2 : 0, round: { ...round }, phase, work, selected: at(phase) > at('guard') ? selected : null, action: 'ready', active: null, aim: 0, elapsed: 0 }, phase);
}
export function grab(s: PoliceState, vehicle: Vehicle): PoliceState {
  if (s.action !== 'ready' || !available(s).includes(vehicle)) return s;
  return { ...s, selected: s.phase === 'guard' ? vehicle as Bike : s.selected, active: vehicle, action: 'dragging', aim: s.work[job(s, vehicle)!], elapsed: 0 };
}
export function drive(s: PoliceState, target: number): PoliceState { return s.action !== 'dragging' || !Number.isFinite(target) ? s : { ...s, aim: clamp(target) }; }
function commit(s: PoliceState): PoliceState {
  const key = job(s); if (!key || s.work[key] < 1) return s;
  const next: Partial<Record<Stage, Stage>> = { setup: 'bikes-arrival', guard: 'inspect', van: 'door', door: 'boarding', transport: 'tow-arrival', tow: 'tow-load' };
  return transition(s, next[s.phase]!);
}
export function release(s: PoliceState, cancelled = true): PoliceState {
  if (s.action !== 'dragging') return s;
  if (!cancelled && s.work[job(s)!] >= 1) return commit(s);
  return { ...s, selected: s.phase === 'guard' && s.work.guard === 0 ? null : s.selected, action: 'ready', active: null, aim: 0, elapsed: 0 };
}
export function advance(s: PoliceState, delta: number): PoliceState {
  if (!Number.isFinite(delta) || delta <= 0) return s;
  const dt = Math.min(delta, 0.1);
  if (s.action === 'working') {
    const elapsed = s.elapsed + dt;
    if (elapsed < duration(s)) return { ...s, elapsed };
    if (s.phase === 'inspect' && s.checked < 2) return { ...s, checked: s.checked + 1, elapsed: 0 };
    const next: Partial<Record<Stage, Stage>> = { intro: 'setup', 'bikes-arrival': 'guard', inspect: 'van-arrival', 'van-arrival': 'van', boarding: 'lead', lead: 'transport', 'tow-arrival': 'tow', 'tow-load': 'depart', depart: 'complete' };
    return transition(s, next[s.phase]!);
  }
  if (s.action !== 'dragging') return s;
  const key = job(s)!, length = key === 'door' ? 1.8 : pathLength(workPath(s, s.active!));
  const step = dt * (key === 'door' ? 2.2 : key === 'guard' ? 5 : 4) / length;
  const value = s.work[key] + Math.max(-step, Math.min(step, s.aim - s.work[key]));
  const reached = value >= 1 - 1e-7, elapsed = reached ? s.elapsed + dt : 0;
  const next = { ...s, work: { ...s.work, [key]: reached ? 1 : value }, elapsed };
  return elapsed >= 0.4 ? commit(next) : next;
}
export const progress = (s: PoliceState) => s.phase === 'complete' ? 1 : jobs.reduce((sum, key) => sum + s.work[key], 0) / jobs.length * 0.95;
export function resumePolice(value: unknown): PoliceState | undefined {
  if (!value || typeof value !== 'object') return;
  const s = value as PoliceState;
  if (s.version !== 3 || !stages.includes(s.phase) || !validRound(s.round) || !['ready', 'dragging', 'working'].includes(s.action)) return;
  if (!Number.isFinite(s.elapsed) || s.elapsed < 0 || s.elapsed > 9.5 || !Number.isFinite(s.aim) || s.aim < 0 || s.aim > 1 || ![null, 'police', 'bike0', 'bike1', 'van', 'tow'].includes(s.active)) return;
  if (!Number.isInteger(s.checked) || s.checked < 0 || s.checked > 2 || at(s.phase) < at('inspect') && s.checked !== 0 || at(s.phase) > at('inspect') && s.checked !== 2) return;
  if (!s.work || Object.keys(s.work).length !== jobs.length || jobs.some(j => !Number.isFinite(s.work[j]) || s.work[j] < 0 || s.work[j] > 1)) return;
  if (![null, 'bike0', 'bike1'].includes(s.selected)) return;
  if (at(s.phase) < at('guard') && s.selected !== null || at(s.phase) > at('guard') && s.selected === null) return;
  if (s.phase === 'guard' && (s.work.guard > 0 || s.action === 'dragging') && s.selected === null) return;
  const base = createPolice(s.phase, s.round), current = s.phase === 'guard' ? 'guard' : job(s);
  if (jobs.some(j => j !== current && s.work[j] !== base.work[j])) return;
  if (!!automatic[s.phase] !== (s.action === 'working') || s.action !== 'dragging' && s.active !== null) return;
  if (s.action === 'dragging' && (!s.active || !available({ ...s, action: 'ready' }).includes(s.active))) return;
  if (s.action === 'ready' && (s.elapsed !== 0 || s.aim !== 0)) return;
  if (s.action === 'working' && (s.elapsed >= duration(s) || s.aim !== 0)) return;
  if (s.action === 'dragging' && (s.elapsed > 0 && s.work[current!] !== 1 || s.elapsed >= 0.4)) return;
  return release(structuredClone(s), true);
}
