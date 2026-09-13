export interface ScreenPoint { x: number; y: number }

// All distances are CSS pixels, including the forgiving edge around the house.
export const CRANE_TARGET_RADIUS = 36;
export const CRANE_TARGET_PADDING = 24;
export const CRANE_DRAG_DISTANCE = 18;
export const CRANE_SETTLE_SECONDS = 0.4;
export interface CraneTarget { assembly: readonly ScreenPoint[]; raised: ScreenPoint }
const distance = (a: ScreenPoint, b: ScreenPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const finite = (p: ScreenPoint) => Number.isFinite(p.x) && Number.isFinite(p.y);
const cross = (a: ScreenPoint, b: ScreenPoint, c: ScreenPoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

// The projected final part includes its base, visible faces and empty wall
// corners. Children can aim at any of these instead of an elevated waypoint.
export function convexOutline(points: readonly ScreenPoint[]): ScreenPoint[] {
  const sorted = points.filter(finite).sort((a, b) => a.x - b.x || a.y - b.y);
  const half = (list: readonly ScreenPoint[]) => {
    const result: ScreenPoint[] = [];
    for (const p of list) {
      while (result.length >= 2 && cross(result.at(-2)!, result.at(-1)!, p) <= 0) result.pop();
      result.push(p);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}
function nearOutline(point: ScreenPoint, outline: readonly ScreenPoint[]) {
  if (outline.length < 3) return false;
  let positive = false, negative = false, nearEdge = false;
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length], side = cross(a, b, point);
    positive ||= side > 0; negative ||= side < 0;
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    nearEdge ||= distance(point, { x: a.x + t * dx, y: a.y + t * dy }) <= CRANE_TARGET_PADDING;
  });
  return !(positive && negative) || nearEdge;
}
export function craneTargetReached(pointer: ScreenPoint, anchor: ScreenPoint, target: CraneTarget, origin: ScreenPoint) {
  // A tap or a naturally overlapping load at pickup must not build a part.
  if (!finite(pointer) || !finite(origin) || distance(pointer, origin) < CRANE_DRAG_DISTANCE) return false;
  return [pointer, anchor].some(point => finite(point) && (nearOutline(point, target.assembly)
    || distance(point, target.raised) <= CRANE_TARGET_RADIUS));
}
export function advanceCraneSettle(elapsed: number, delta: number, accepted: boolean) {
  if (!accepted) return 0;
  if (!Number.isFinite(delta) || delta <= 0) return elapsed;
  return Math.min(CRANE_SETTLE_SECONDS, elapsed + Math.min(delta, 0.1));
}
