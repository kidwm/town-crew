export interface ScreenPoint { x: number; y: number }

// CSS pixels: the visible disc and both pointer/anchor checks share this radius.
// A screen-space target stays round and finger-sized on narrow viewports too.
export const CRANE_TARGET_RADIUS = 36;
export function craneTargetReached(pointer: ScreenPoint, anchor: ScreenPoint, target: ScreenPoint) {
  return [pointer, anchor].some(point => Number.isFinite(point.x) && Number.isFinite(point.y)
    && Math.hypot(point.x - target.x, point.y - target.y) <= CRANE_TARGET_RADIUS);
}
