export interface Point { x: number; z: number }
export interface RoutePoint extends Point { yaw?: number }
export interface Position extends Point { y: number }
export type Vehicle = 'bus' | 'taxi' | 'school' | 'coach';
export type Transfer = Exclude<Vehicle, 'bus'>;
export type Companion = 'school' | 'coach';
export interface Round { layout: 0 | 1; palette: number; cast: number; companion?: Companion }
export const companion = (r: Round): Companion => r.companion ?? 'school';
export const finalVehicle = (r: Round): Companion => companion(r) === 'school' ? 'coach' : 'school';
export const transferPair = (r: Round): Transfer[] => ['taxi', companion(r)];
export const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ROAD = { back: -6.6, front: -1.6, centre: -4.1, outbound: -4.1 } as const;
export const STATION = { x: 7, z: -11.5 } as const;
export const ENTRANCE = { companionStart: 0, companionSeconds: 3.4, taxiStart: 2.8, taxiSeconds: 3.2, duration: 6.4 } as const;
export const FINAL_ENTRANCE_SECONDS = 3.4;
export const MAIN_PLATFORM = { left: -19, right: 6, curbZ: 1.65, outerZ: 6.775, walkZ: 2.8 } as const;
export const TAXI_BAY = { centreX: -13.3, holdingX: -15.5, z: 0.4, left: -19, right: -10.3 } as const;
export const HOLDING_BAYS = { schoolX: -16.5, coachX: -8.2, z: -8.3, back: -10.1, length: 7.9 } as const;
export const BAY_DIVIDER = { left: -8.5, right: -7.3, back: -0.95, front: MAIN_PLATFORM.curbZ } as const;
export const loadingOutline = (): Point[] => [{ x: -26, z: ROAD.front }, { x: 11, z: ROAD.front }, { x: 6, z: MAIN_PLATFORM.curbZ }, { x: -20, z: MAIN_PLATFORM.curbZ }];
export const holdingOutline = (): Point[] => [{ x: -29, z: ROAD.back }, { x: -25, z: HOLDING_BAYS.back }, { x: -4, z: HOLDING_BAYS.back }, { x: -1, z: ROAD.back }];
export const platformOutline = (): Point[] => [
  { x: MAIN_PLATFORM.left, z: MAIN_PLATFORM.outerZ }, { x: MAIN_PLATFORM.right, z: MAIN_PLATFORM.outerZ },
  { x: MAIN_PLATFORM.right, z: MAIN_PLATFORM.curbZ }, { x: MAIN_PLATFORM.left, z: MAIN_PLATFORM.curbZ },
];
export const dock = (r: Round): Point => ({ x: r.layout ? 7 : 6.4, z: 0 });
export const berth = (r: Round, v: Vehicle): Point => v === 'taxi' ? { x: dock(r).x + TAXI_BAY.centreX, z: TAXI_BAY.z } : dock(r);
export const waiting = (r: Round, id: number): Position => ({ x: dock(r).x + [-14.7, -13.5, -3, -1.9, 1, 2.1][id], y: 0.16, z: id === 2 || id === 3 ? 4.7 : 3.7 });
export const suitcaseHome = (r: Round): Position => ({ x: dock(r).x + 2.1, y: 0.16, z: 5.3 });
export const cargoTarget = (r: Round): Position => ({ x: dock(r).x - 0.6, y: 0.83, z: 1.23 });
export const holding = (r: Round, v: Exclude<Vehicle, 'bus'>): Point => ({ x: dock(r).x + (v === 'taxi' ? TAXI_BAY.holdingX : v === 'school' ? HOLDING_BAYS.schoolX : HOLDING_BAYS.coachX), z: v === 'taxi' ? TAXI_BAY.z : HOLDING_BAYS.z });
export const LENGTH: Record<Vehicle, number> = { bus: 6.6, taxi: 3.52, school: 6.4, coach: 7.2 };
export const WIDTH: Record<Vehicle, number> = { bus: 2.4, taxi: 1.6, school: 2.35, coach: 2.5 };
export const doorLocal: Record<Vehicle, Position> = {
  bus: { x: 2, y: 0.78, z: 1.2 }, taxi: { x: -0.55, y: 0.48, z: 0.87 },
  school: { x: 1.5, y: 0.86, z: 1.18 }, coach: { x: 2.55, y: 1.2, z: 1.25 },
};

export function pathLength(path: Point[]) { return path.slice(1).reduce((d, p, i) => d + Math.hypot(p.x - path[i].x, p.z - path[i].z), 0); }
export function pathPose(path: RoutePoint[], fraction: number) {
  const distance = pathLength(path) * clamp(fraction); let remaining = distance;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], length = Math.hypot(b.x - a.x, b.z - a.z);
    if (remaining <= length || i === path.length - 1) {
      const t = length ? clamp(remaining / length) : 0;
      const yaw = a.yaw !== undefined && b.yaw !== undefined ? lerp(a.yaw, b.yaw, t) : -Math.atan2(b.z - a.z, b.x - a.x);
      return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), yaw, distance };
    }
    remaining -= length;
  }
  return { ...path[0], yaw: 0, distance: 0 };
}
/** A forward-only lane change; the swept body, including mirrors, fits between both curb limits. */
function laneChange(from: Point, to: Point, v: Vehicle): RoutePoint[] {
  const dx = to.x - from.x, dz = to.z - from.z, sign = Math.sign(dz);
  const hx = (LENGTH[v] + 0.5) / 2, hz = (WIDTH[v] + 0.6) / 2;
  let maxYaw = Math.PI / 3;
  while (hx * Math.sin(maxYaw) + hz * Math.cos(maxYaw) - hz > Math.abs(dz) / 2) maxYaw -= 0.01;
  return Array.from({ length: 65 }, (_, n) => {
    const t = n / 64, s = smooth(t);
    const angle = Math.min(maxYaw, Math.atan2(Math.abs(dz) * 1.5 * Math.sin(Math.PI * t) ** 2, dx));
    const extra = hx * Math.sin(angle) + hz * Math.cos(angle) - hz;
    return { x: lerp(from.x, to.x, t), z: lerp(from.z, to.z, s) + sign * extra * (1 - 2 * s), yaw: -sign * angle };
  });
}
export function arrivalRoute(r: Round, v: Vehicle): RoutePoint[] {
  const end = berth(r, v);
  if (v === 'taxi') return [{ ...holding(r, v), yaw: 0 }, { ...end, yaw: 0 }];
  if (v === 'coach') return laneChange(holding(r, v), end, v);
  const merge = { x: dock(r).x - 9.8, z: ROAD.outbound, yaw: 0 };
  const approach = laneChange(merge, end, v);
  return v === 'bus' ? [{ x: dock(r).x - 13.6, z: ROAD.outbound, yaw: 0 }, ...approach] : [...laneChange(holding(r, v), merge, v), ...approach.slice(1)];
}
export function exitRoute(r: Round, v: Vehicle = 'bus'): RoutePoint[] {
  const p = berth(r, v);
  const end = { x: dock(r).x + 6.5, z: ROAD.outbound, yaw: 0 };
  const merge = laneChange(p, v === 'taxi' ? { x: dock(r).x - 6.8, z: ROAD.outbound } : end, v);
  return v === 'taxi' ? [...merge, end] : merge;
}
export function entranceRoute(r: Round, v: Exclude<Vehicle, 'bus'>, edge = 30): RoutePoint[] {
  const p = holding(r, v), start = { x: p.x - 12, z: ROAD.outbound };
  return [{ x: -edge, z: ROAD.outbound, yaw: 0 }, ...laneChange(start, p, v)];
}
export function entrancePose(r: Round, v: Transfer, elapsed: number, edge = 30) {
  const start = v === 'taxi' ? ENTRANCE.taxiStart : ENTRANCE.companionStart;
  const seconds = v === 'taxi' ? ENTRANCE.taxiSeconds : ENTRANCE.companionSeconds;
  return { ...pathPose(entranceRoute(r, v, edge), smooth((elapsed - start) / seconds)), visible: elapsed >= start };
}
export function finalEntrancePose(r: Round, elapsed: number, edge = 30) {
  return { ...pathPose(entranceRoute(r, finalVehicle(r), edge), smooth(elapsed / FINAL_ENTRANCE_SECONDS)), visible: true };
}
/** Luggage remains at a local point inside the coach through every turn and departure. */
export function stowedLuggage(p: Point & { yaw: number }) {
  return { x: p.x - 0.6 * Math.cos(p.yaw) + 0.03 * Math.sin(p.yaw), y: 0.9, z: p.z + 0.6 * Math.sin(p.yaw) + 0.03 * Math.cos(p.yaw), yaw: p.yaw, tilt: Math.PI / 2 };
}
export function seat(v: Vehicle, id: number): Position {
  if (v === 'taxi') return { x: -0.55, y: 0.5, z: id % 2 ? -0.38 : 0.38 };
  return { x: v === 'bus' ? -1.8 + Math.floor(id / 2) * 1.25 : -0.6, y: v === 'coach' ? 1.2 : 0.78, z: id % 2 ? -0.5 : 0.5 };
}
export function walkPose(path: Position[], fraction: number) {
  const length = path.slice(1).reduce((n, b, i) => n + Math.hypot(b.x - path[i].x, b.y - path[i].y, b.z - path[i].z), 0);
  let remaining = length * clamp(fraction);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (remaining <= d || i === path.length - 1) {
      const t = d ? clamp(remaining / d) : 0;
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t), yaw: Math.atan2(b.x - a.x, b.z - a.z) };
    }
    remaining -= d;
  }
  return { ...path[0], yaw: 0 };
}
export function passengerRoute(r: Round, v: Vehicle, id: number): Position[] {
  const p = berth(r, v), local = seat(v, id), door = doorLocal[v], home = waiting(r, id);
  const aboard: Position = { x: p.x + local.x, y: local.y, z: p.z + local.z };
  if (v === 'taxi') return [home, { x: home.x, y: 0.16, z: MAIN_PLATFORM.walkZ }, { x: p.x + door.x, y: 0.16, z: MAIN_PLATFORM.walkZ }, { x: p.x + door.x, y: 0.16, z: MAIN_PLATFORM.curbZ + 0.05 }, { x: p.x + door.x, y: 0.06, z: MAIN_PLATFORM.curbZ - 0.15 }, { x: p.x + door.x, y: door.y, z: p.z + door.z }, { x: p.x + door.x, y: door.y, z: p.z }, aboard];
  const exit = [aboard, { x: aboard.x, y: aboard.y, z: 0 }, { x: p.x + door.x, y: door.y, z: 0 }, { x: p.x + door.x, y: 0.16, z: 2.1 }, { x: p.x + door.x, y: 0.16, z: 3.1 }, { x: home.x, y: 0.16, z: 3.1 }, home];
  return v === 'bus' ? exit : exit.reverse();
}
