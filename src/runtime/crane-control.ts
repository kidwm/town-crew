export const CRANE_GRAB_RADIUS = 48;
export const CRANE_PICKUP_RADIUS = 0.65;
export const CRANE_PICKUP_SCREEN_RADIUS = 36;
export const CRANE_SETTLE_SECONDS = 0.4;
export const CRANE_ATTACH_SECONDS = 0.4;
export const CRANE_RELEASE_SECONDS = 0.5;
export function nearCraneHook(pointer: { x: number; y: number }, hook: { x: number; y: number }) {
  return Math.hypot(pointer.x - hook.x, pointer.y - hook.y) <= CRANE_GRAB_RADIUS;
}
export function nearCranePickup(hook: { x: number; z: number }, cargo: { x: number; z: number }) {
  return Math.hypot(hook.x - cargo.x, hook.z - cargo.z) <= CRANE_PICKUP_RADIUS;
}
