export const stages = ['intro', 'pursuit', 'bikes', 'arrest', 'clearance', 'van', 'door', 'boarding', 'lead', 'transport', 'depart', 'complete'] as const;
export type Stage = typeof stages[number];
export type Vehicle = 'police' | 'bike0' | 'bike1' | 'van';
export type Bike = 'bike0' | 'bike1';
export const jobs = ['follow', 'bike0', 'bike1', 'yield', 'arrive', 'door', 'lead', 'escort'] as const;
export type Job = typeof jobs[number];
export interface Point { x: number; z: number }
export interface Round { layout: number; color: number; body: 'car' | 'van'; bag: number }
export interface PoliceState {
  version: 1; round: Round; phase: Stage; action: 'ready' | 'dragging' | 'working';
  elapsed: number; active: Vehicle | null; aim: number; work: Record<Job, number>; order: Bike[];
}
export const PALETTE = ['#d88973', '#e2ba65', '#82b6c4', '#91b69a', '#aa9bc2', '#dfaa88'];
export const BAG_COLORS = ['#dcad61', '#ad95b5', '#83b5a2', '#d18b79'];
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
export const side = (r: Round) => r.layout < 2 ? -1 : 1;
export const entry = (r: Round) => r.layout % 2 === 0 ? -1 : 1;
export const vanDoorSide = (r: Round) => -entry(r);
export function validRound(value: unknown): value is Round {
  if (!value || typeof value !== 'object') return false;
  const r = value as Round;
  return Number.isInteger(r.layout) && r.layout >= 0 && r.layout < 4 && Number.isInteger(r.color) && r.color >= 0 && r.color < PALETTE.length && ['car', 'van'].includes(r.body) && Number.isInteger(r.bag) && r.bag >= 0 && r.bag < BAG_COLORS.length;
}
export function chooseRound(previous?: Round, random = Math.random): Round {
  const pick = (n: number) => Math.max(0, Math.min(n - 1, Math.floor(random() * n)));
  const layouts = [0, 1, 2, 3].filter(n => n !== previous?.layout);
  const colors = PALETTE.map((_, i) => i).filter(n => n !== previous?.color);
  return { layout: layouts[pick(layouts.length)], color: colors[pick(colors.length)], body: random() < 0.5 ? 'car' : 'van', bag: pick(BAG_COLORS.length) };
}
function rawRoutes(r: Round): Record<Exclude<Job, 'door'>, Point[]> {
  const s = side(r), e = entry(r), p = (x: number, z: number) => ({ x, z });
  return {
    follow: [p(-s * 13, 7), p(0, 7), p(0, 3.3)],
    bike0: [p(-s * 11, -4), p(-s * 11, -8), p(s * 11, -8), p(s * 11, 0), p(s * 9, 0)],
    bike1: [p(0, -6.5), p(0, -3.2)],
    yield: [p(0, 3.3), p(0, 0), p(-s * 5, 0)],
    arrive: [p(e * 13, 7), p(0, 7)],
    lead: s === -e ? [p(s * 9, 0), p(s * 11, 0), p(s * 11, 7), p(-e * 16, 7)]
      : [p(s * 9, 0), p(s * 11, 0), p(s * 11, -8), p(-e * 11, -8), p(-e * 11, 7), p(-e * 16, 7)],
    escort: [p(0, 7), p(-e * 16, 7)],
  };
}
export const guardRoute = (r: Round): Point[] => [{ x: 0, z: -3.2 }, { x: 0, z: -2 }, { x: -side(r) * 2.9, z: -2 }];
export const suspectRoute = (r: Round): Point[] => rounded([{ x: -side(r) * 6, z: 7 }, { x: 0, z: 7 }, { x: 0, z: 0 }, { x: side(r) * 5, z: 0 }]);
/** Walk down the cleared street, around the van's rear and into the visible door. */
export function boardingRoute(r: Round): Point[] {
  const e = entry(r);
  return [{ x: side(r) * 2.3, z: 1.25 }, { x: 0, z: 1.8 }, { x: 0, z: 4.9 },
    { x: e * 3.1, z: 4.9 }, { x: e * 3.1, z: 8.6 }, { x: e * 0.58, z: 8.6 }, { x: e * 0.58, z: 7.25 }];
}
/** Round road corners so steering changes continuously instead of pivoting in place. */
function rounded(points: Point[]) {
  const path = points.filter((p, i) => !i || Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z) > 0.001);
  const output = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1], b = path[i], c = path[i + 1];
    const before = Math.hypot(b.x - a.x, b.z - a.z), after = Math.hypot(c.x - b.x, c.z - b.z), radius = Math.min(0.75, before / 3, after / 3);
    const start = mix(b, a, radius / before), end = mix(b, c, radius / after); output.push(start);
    for (let n = 1; n <= 6; n++) { const t = n / 6; output.push(mix(mix(start, b, t), mix(b, end, t), t)); }
  }
  output.push(path.at(-1)!); return output;
}
const routeCache = new Map<number, Record<Exclude<Job, 'door'>, Point[]>>();
export function routes(r: Round) {
  let paths = routeCache.get(r.layout);
  if (!paths) { paths = Object.fromEntries(Object.entries(rawRoutes(r)).map(([key, path]) => [key, rounded(path)])) as Record<Exclude<Job, 'door'>, Point[]>; routeCache.set(r.layout, paths); }
  return paths;
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
const automatic: Partial<Record<Stage, number>> = { intro: 3.2, arrest: 3, boarding: 4.8, depart: 6.5 };
export const duration = (s: PoliceState) => automatic[s.phase] ?? 0;
export function job(s: PoliceState, vehicle: Vehicle | null = s.active): Job | undefined {
  if (s.phase === 'bikes') return vehicle === 'bike0' || vehicle === 'bike1' ? vehicle : undefined;
  return ({ pursuit: 'follow', clearance: 'yield', van: 'arrive', door: 'door', lead: 'lead', transport: 'escort' } as Partial<Record<Stage, Job>>)[s.phase];
}
export function available(s: PoliceState): Vehicle[] {
  if (s.action === 'working' || s.phase === 'complete') return [];
  if (s.phase === 'bikes') return (['bike0', 'bike1'] as const).filter(v => !s.order.includes(v));
  if (s.phase === 'pursuit' || s.phase === 'clearance') return ['police'];
  if (s.phase === 'lead') return ['bike0'];
  if (['van', 'door', 'transport'].includes(s.phase)) return ['van'];
  return [];
}
function transition(s: PoliceState, phase: Stage): PoliceState {
  return { ...s, phase, action: automatic[phase] ? 'working' : 'ready', active: null, aim: 0, elapsed: 0 };
}
export function createPolice(phase: Stage = 'intro', round: Round = chooseRound()): PoliceState {
  const work = Object.fromEntries(jobs.map(j => [j, 0])) as Record<Job, number>;
  const i = stages.indexOf(phase), past = (p: Stage) => i > stages.indexOf(p);
  if (past('pursuit')) work.follow = 1;
  if (past('bikes')) work.bike0 = work.bike1 = 1;
  if (past('clearance')) work.yield = 1;
  if (past('van')) work.arrive = 1;
  if (past('door')) work.door = 1;
  if (past('lead')) work.lead = 1;
  if (past('transport')) work.escort = 1;
  return transition({ version: 1, round: { ...round }, phase, work, order: past('bikes') ? ['bike0', 'bike1'] : [], action: 'ready', active: null, aim: 0, elapsed: 0 }, phase);
}
export function grab(s: PoliceState, vehicle: Vehicle): PoliceState {
  if (s.action !== 'ready' || !available(s).includes(vehicle)) return s;
  const key = job(s, vehicle)!;
  return { ...s, active: vehicle, action: 'dragging', aim: s.work[key], elapsed: 0 };
}
export function drive(s: PoliceState, target: number): PoliceState {
  if (s.action !== 'dragging' || !Number.isFinite(target)) return s;
  return { ...s, aim: clamp(target) };
}
function commit(s: PoliceState): PoliceState {
  const key = job(s); if (!key || s.work[key] < 1) return s;
  if (s.phase === 'bikes') {
    const order = [...s.order, key as Bike];
    return transition({ ...s, order }, order.length === 2 ? 'arrest' : 'bikes');
  }
  const next: Partial<Record<Stage, Stage>> = { pursuit: 'bikes', clearance: 'van', van: 'door', door: 'boarding', lead: 'transport', transport: 'depart' };
  return transition(s, next[s.phase]!);
}
export function release(s: PoliceState, cancelled = true): PoliceState {
  if (s.action !== 'dragging') return s;
  const key = job(s)!;
  if (!cancelled && s.work[key] >= 1) return commit(s);
  // A cancelled dwell does not dispatch a vehicle. Resume by touching it again.
  return { ...s, action: 'ready', active: null, aim: 0, elapsed: 0 };
}
export function advance(s: PoliceState, delta: number): PoliceState {
  if (!Number.isFinite(delta) || delta <= 0) return s;
  const dt = Math.min(delta, 0.1);
  if (s.action === 'working') {
    const elapsed = s.elapsed + dt;
    if (elapsed < duration(s)) return { ...s, elapsed };
    const next: Partial<Record<Stage, Stage>> = { intro: 'pursuit', arrest: 'clearance', boarding: 'lead', depart: 'complete' };
    return transition(s, next[s.phase]!);
  }
  if (s.action !== 'dragging') return s;
  const key = job(s)!;
  const length = key === 'door' ? 1.8 : pathLength(routes(s.round)[key]);
  const step = dt * (key === 'door' ? 2.2 : key.startsWith('bike') || key === 'lead' ? 7 : 5) / length;
  const value = s.work[key] + Math.max(-step, Math.min(step, s.aim - s.work[key]));
  const reached = value >= 1 - 1e-7, elapsed = reached ? s.elapsed + dt : 0;
  const next = { ...s, work: { ...s.work, [key]: reached ? 1 : value }, elapsed };
  return elapsed >= 0.4 ? commit(next) : next;
}
export const progress = (s: PoliceState) => s.phase === 'complete' ? 1 : jobs.reduce((sum, key) => sum + s.work[key], 0) / 8 * 0.95;
export function resumePolice(value: unknown): PoliceState | undefined {
  if (!value || typeof value !== 'object') return;
  const s = value as PoliceState;
  if (s.version !== 1 || !stages.includes(s.phase) || !validRound(s.round) || !['ready', 'dragging', 'working'].includes(s.action)) return;
  if (!Number.isFinite(s.elapsed) || s.elapsed < 0 || s.elapsed > 7 || !Number.isFinite(s.aim) || s.aim < 0 || s.aim > 1 || ![null, 'police', 'bike0', 'bike1', 'van'].includes(s.active)) return;
  if (!s.work || Object.keys(s.work).length !== jobs.length || jobs.some(j => !Number.isFinite(s.work[j]) || s.work[j] < 0 || s.work[j] > 1)) return;
  if (!Array.isArray(s.order) || s.order.length > 2 || new Set(s.order).size !== s.order.length || s.order.some(b => b !== 'bike0' && b !== 'bike1')) return;
  const base = createPolice(s.phase, s.round), current = s.phase === 'bikes' ? ['bike0', 'bike1'] : [job(s)];
  if (jobs.some(j => !current.includes(j) && s.work[j] !== base.work[j])) return;
  if (s.phase === 'bikes') {
    if (s.order.length >= 2 || s.order.some(b => s.work[b] !== 1)) return;
    if ((['bike0', 'bike1'] as const).some(b => s.work[b] === 1 && !s.order.includes(b) && !(s.active === b || s.action === 'ready'))) return;
  } else if (s.order.length !== base.order.length) return;
  if (s.order.some(b => s.work[b] !== 1)) return;
  if (!!automatic[s.phase] !== (s.action === 'working') || s.action !== 'dragging' && s.active !== null) return;
  if (s.action === 'dragging' && (!s.active || !(s.phase === 'bikes' ? !s.order.includes(s.active as Bike) && ['bike0', 'bike1'].includes(s.active) : available({ ...s, action: 'ready' }).includes(s.active)))) return;
  if (s.action === 'ready' && (s.elapsed !== 0 || s.aim !== 0)) return;
  return release(structuredClone(s), true);
}
