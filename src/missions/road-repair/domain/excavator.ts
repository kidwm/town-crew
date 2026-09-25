export interface Point { x: number; y: number; z: number }
export const HOME: Point = { x: -1.25, y: 0.85, z: 0 };
export const PIVOT: Point = { x: -4, y: 2.35, z: 0 };
export const UNLOAD: Point = { x: 1.76, y: 2.25, z: -2 };
export const BOOM = 3.6;
export const STICK = 4;
export const ROAD_CHUNKS: Point[] = [
  { x: 1.15, y: 0, z: -0.65 },
  { x: 2.35, y: 0, z: 0.55 },
  { x: 3.35, y: 0, z: -0.45 },
];
export type ExcavatorAction = 'entering' | 'ready' | 'dragging' | 'scooping' | 'unloading' | 'returning' | 'complete';
export interface ExcavatorState {
  action: ExcavatorAction;
  elapsed: number;
  cleared: number;
  bucket: Point;
  target: Point;
  from: Point;
}
export const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
export const smooth = (t: number) => { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v); };
export function createExcavator(): ExcavatorState {
  return { action: 'entering', elapsed: 0, cleared: 0, bucket: { ...HOME }, target: { ...HOME }, from: { ...HOME } };
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
  return state.action === 'ready' ? { ...state, action: 'dragging' } : state;
}
export function moveBucket(state: ExcavatorState, target: Point): ExcavatorState {
  if (state.action !== 'dragging') return state;
  return { ...state, target: reachable({ x: Math.max(-2, Math.min(4.3, target.x)), y: HOME.y, z: Math.max(-1.65, Math.min(1.65, target.z)) }) };
}
export function releaseBucket(state: ExcavatorState): ExcavatorState {
  return state.action === 'dragging' ? { ...state, action: 'returning', elapsed: 0, from: state.bucket } : state;
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
    const bucket = reachable(mix(state.from, { ...state.from, x: state.from.x - 0.4, y: state.from.y + 1.6 }, smooth(elapsed / 0.65)));
    return elapsed >= 0.65 ? { ...state, bucket, from: bucket, action: 'unloading', elapsed: 0 } : { ...state, bucket, elapsed };
  }
  if (state.action === 'unloading') {
    const bucket = reachable(mix(state.from, UNLOAD, smooth(elapsed / 0.7)));
    return elapsed >= 0.9 ? { ...state, bucket, from: bucket, cleared: state.cleared + 1, action: 'returning', elapsed: 0 } : { ...state, bucket, elapsed };
  }
  if (state.action === 'returning') {
    const t = smooth(elapsed / 0.55), returning = mix(state.from, HOME, t);
    // Lift over the cleanup truck's cab before returning to the work area.
    if (state.from.y > HOME.y + 1) returning.y += Math.sin(t * Math.PI) * 1.1;
    const bucket = reachable(returning);
    return elapsed >= 0.55 ? { ...state, bucket: { ...HOME }, action: state.cleared === 3 ? 'complete' : 'ready', elapsed: 0 } : { ...state, bucket, elapsed };
  }
  return state;
}
