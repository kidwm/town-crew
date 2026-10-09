export interface Point { x: number; y: number; z: number }
export const BOOM = 3.6;
export const STICK = 4;
export const PIVOT: Point = { x: -4, y: 2.35, z: 0 };

export function reachable(target: Point, pivot: Point = PIVOT, boom = BOOM, stick = STICK): Point {
  const dx = target.x - pivot.x, dy = target.y - pivot.y, dz = target.z - pivot.z;
  const distance = Math.hypot(dx, dy, dz);
  const length = Math.max(Math.abs(boom - stick) + 0.04, Math.min(boom + stick - 0.04, distance));
  if (distance < 1e-6) return { x: pivot.x + length, y: pivot.y, z: pivot.z };
  return { x: pivot.x + dx / distance * length, y: pivot.y + dy / distance * length, z: pivot.z + dz / distance * length };
}
export function elbow(target: Point, pivot: Point = PIVOT, boom = BOOM, stick = STICK): Point {
  const end = reachable(target, pivot, boom, stick);
  const d = Math.hypot(end.x - pivot.x, end.y - pivot.y, end.z - pivot.z);
  const unit = { x: (end.x - pivot.x) / d, y: (end.y - pivot.y) / d, z: (end.z - pivot.z) / d };
  const along = (boom * boom - stick * stick + d * d) / (2 * d);
  const height = Math.sqrt(Math.max(0, boom * boom - along * along));
  const up = { x: -unit.x * unit.y, y: 1 - unit.y * unit.y, z: -unit.z * unit.y };
  const upLength = Math.hypot(up.x, up.y, up.z);
  const bend = upLength < 1e-6 ? { x: 1, y: 0, z: 0 } : { x: up.x / upLength, y: up.y / upLength, z: up.z / upLength };
  return { x: pivot.x + unit.x * along + bend.x * height, y: pivot.y + unit.y * along + bend.y * height, z: pivot.z + unit.z * along + bend.z * height };
}
