export interface Point { x: number; y: number; z: number }
export const HOME: Point = { x: -1.25, y: 0.85, z: 0 };
export const PIVOT: Point = { x: -4, y: 2.35, z: 0 };
export const UNLOAD: Point = { x: 1.76, y: 2.25, z: -2 };
export const CARRY_HEIGHT = 2.8;
export const BOOM = 3.6;
export const STICK = 4;
export const ROAD_CHUNKS: Point[] = [
  { x: 1.15, y: 0, z: -0.65 },
  { x: 2.35, y: 0, z: 0.55 },
  { x: 3.35, y: 0, z: -0.45 },
];
export type ExcavatorAction = 'entering' | 'ready' | 'dragging' | 'scooping' | 'carrying' | 'carrying-drag' | 'unloading' | 'returning' | 'complete';
export interface ExcavatorState {
  action: ExcavatorAction;
  elapsed: number;
  cleared: number;
  bucket: Point;
  target: Point;
  from: Point;
  control: 'none' | 'pointer' | 'tap';
}
export const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
export const smooth = (t: number) => { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v); };
export function createExcavator(): ExcavatorState {
  return { action: 'entering', elapsed: 0, cleared: 0, bucket: { ...HOME }, target: { ...HOME }, from: { ...HOME }, control: 'none' };
}
export function reachable(target: Point): Point {
  const dx = target.x - PIVOT.x, dy = target.y - PIVOT.y, dz = target.z - PIVOT.z;
  const distance = Math.hypot(dx, dy, dz);
  const length = Math.max(Math.abs(BOOM - STICK) + 0.04, Math.min(BOOM + STICK - 0.04, distance));
  if (distance < 1e-6) return { x: PIVOT.x + length, y: PIVOT.y, z: PIVOT.z };
  return { x: PIVOT.x + dx / distance * length, y: PIVOT.y + dy / distance * length, z: PIVOT.z + dz / distance * length };
}
export function elbow(target: Point): Point {
  const end = reachable(target);
  const d = Math.hypot(end.x - PIVOT.x, end.y - PIVOT.y, end.z - PIVOT.z);
  const unit = { x: (end.x - PIVOT.x) / d, y: (end.y - PIVOT.y) / d, z: (end.z - PIVOT.z) / d };
  const along = (BOOM * BOOM - STICK * STICK + d * d) / (2 * d);
  const height = Math.sqrt(Math.max(0, BOOM * BOOM - along * along));
  const up = { x: -unit.x * unit.y, y: 1 - unit.y * unit.y, z: -unit.z * unit.y };
  const upLength = Math.hypot(up.x, up.y, up.z);
  const bend = upLength < 1e-6 ? { x: 1, y: 0, z: 0 } : { x: up.x / upLength, y: up.y / upLength, z: up.z / upLength };
  return { x: PIVOT.x + unit.x * along + bend.x * height, y: PIVOT.y + unit.y * along + bend.y * height, z: PIVOT.z + unit.z * along + bend.z * height };
}
export function grabBucket(state: ExcavatorState): ExcavatorState {
  if (state.action === 'ready') return { ...state, action: 'dragging', control: 'pointer' };
  if (state.action === 'carrying') return { ...state, action: 'carrying-drag', control: 'pointer' };
  return state;
}
export const hasBucketLoad = (state: ExcavatorState) => ['scooping', 'carrying', 'carrying-drag', 'unloading'].includes(state.action);
export const overTruck = (point: Point) => Math.abs(point.x - UNLOAD.x) <= 0.95 && Math.abs(point.z - UNLOAD.z) <= 0.85;
export function moveBucket(state: ExcavatorState, target: Point): ExcavatorState {
  if (!['dragging', 'carrying-drag'].includes(state.action) || ![target.x, target.y, target.z].every(Number.isFinite)) return state;
  const loaded = hasBucketLoad(state);
  return { ...state, target: reachable({ x: Math.max(-2, Math.min(4.3, target.x)), y: loaded ? CARRY_HEIGHT : HOME.y, z: Math.max(loaded ? -3 : -1.65, Math.min(1.65, target.z)) }) };
}
function unloadBucket(state: ExcavatorState): ExcavatorState {
  return { ...state, action: 'unloading', control: 'none', elapsed: 0, from: state.bucket };
}
export function releaseBucket(state: ExcavatorState, cancelled = false): ExcavatorState {
  if (state.action === 'scooping') return { ...state, control: 'none' };
  if (state.action === 'carrying-drag') {
    // Use the intended destination so releasing a quick drag does not lose to
    // the small visual follow delay. Cancellation never commits a delivery.
    if (!cancelled && overTruck(state.target)) return unloadBucket(state);
    return { ...state, action: 'carrying', control: 'none', target: state.bucket };
  }
  return state.action === 'dragging' ? { ...state, action: 'ready', control: 'none', target: state.bucket } : state;
}
/** A selected bucket can also be sent to the current destination by a tap/key. */
export function tapBucketTarget(state: ExcavatorState): ExcavatorState {
  if (!['ready', 'carrying'].includes(state.action)) return state;
  const target = state.action === 'carrying' ? UNLOAD : ROAD_CHUNKS[state.cleared];
  return target ? { ...moveBucket(grabBucket(state), target), control: 'tap' } : state;
}
export function advanceExcavator(state: ExcavatorState, delta: number): ExcavatorState {
  const elapsed = state.elapsed + delta;
  if (state.action === 'entering') return elapsed >= 0.9 ? { ...state, action: 'ready', elapsed: 0 } : { ...state, elapsed };
  if (state.action === 'dragging') {
    const bucket = mix(state.bucket, state.target, 1 - Math.exp(-24 * delta));
    const chunk = ROAD_CHUNKS[state.cleared];
    if (chunk && Math.hypot(bucket.x - chunk.x, bucket.z - chunk.z) <= 1.1) {
      return { ...state, bucket, from: bucket, action: 'scooping', elapsed: 0 };
    }
    return { ...state, bucket };
  }
  if (state.action === 'scooping') {
    const bucket = reachable(mix(state.from, { ...state.from, y: CARRY_HEIGHT }, smooth(elapsed / 0.45)));
    return elapsed >= 0.45 ? { ...state, bucket, target: bucket, action: state.control === 'pointer' ? 'carrying-drag' : 'carrying', control: state.control === 'pointer' ? 'pointer' : 'none', elapsed: 0 } : { ...state, bucket, elapsed };
  }
  if (state.action === 'carrying-drag') {
    const bucket = mix(state.bucket, state.target, 1 - Math.exp(-24 * delta));
    const next = { ...state, bucket };
    return state.control === 'tap' && overTruck(state.target) && Math.hypot(bucket.x - state.target.x, bucket.z - state.target.z) < 0.12 ? unloadBucket(next) : next;
  }
  if (state.action === 'unloading') {
    // Align while high enough to clear the cab, then lower over the open bed.
    const above = { ...UNLOAD, y: CARRY_HEIGHT };
    const bucket = reachable(elapsed < 0.5 ? mix(state.from, above, smooth(elapsed / 0.5)) : mix(above, UNLOAD, smooth((elapsed - 0.5) / 0.2)));
    return elapsed >= 0.9 ? { ...state, bucket, from: bucket, cleared: state.cleared + 1, action: 'returning', elapsed: 0 } : { ...state, bucket, elapsed };
  }
  if (state.action === 'returning') {
    const t = smooth(elapsed / 0.55), returning = mix(state.from, HOME, t);
    // Lift over the cleanup truck's cab before returning to the work area.
    if (state.from.y > HOME.y + 1) returning.y += Math.sin(t * Math.PI) * 1.1;
    const bucket = reachable(returning);
    return elapsed >= 0.55 ? { ...state, bucket: { ...HOME }, target: { ...HOME }, action: state.cleared === 3 ? 'complete' : 'ready', elapsed: 0 } : { ...state, bucket, elapsed };
  }
  return state;
}

export function resumeExcavator(state: ExcavatorState): ExcavatorState {
  if (state.control === undefined) {
    // Old automatic pickup animations restart that unfinished piece only.
    const interrupted = ['dragging', 'scooping', 'unloading', 'returning'].includes(state.action);
    return { ...state, control: 'none', ...(interrupted ? { action: state.cleared === 3 ? 'complete' as const : 'ready' as const, elapsed: 0, bucket: { ...HOME }, target: { ...HOME }, from: { ...HOME } } : {}) };
  }
  return { ...releaseBucket(state, true), control: 'none' };
}
