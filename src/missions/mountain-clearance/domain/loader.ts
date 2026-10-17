import { soilPoint, smooth, mix } from './site.ts';
import type { Point } from './site.ts';

export type SoilId = 0 | 1;
export interface LoaderState {
  soilLoaded: SoilId[];
  loaderSelected: SoilId | null;
  loaderCarrying: boolean;
  loaderDocked: boolean;
  loaderTravel: number;
}
interface PoseState extends LoaderState { phase: string; motion: string; elapsed: number }
export const LOADER_HOME: Point = { x: 7, y: 0, z: 5.4 };
// Offset toward the near side of the bed so its side wall cannot hide the pour.
export const LOADER_DOCK: Point = { x: 6.9, y: 0, z: -3.95 };
export const LOADER_TIP: Point = { x: 5.25, y: 0, z: -3.95 };
export const SCOOP_SECONDS = 2.2, PARK_SECONDS = 0.6, TIP_SECONDS = 2.5, RETURN_SECONDS = 4.2;
export const POUR_START = 1.1, POUR_END = 2.3;
const ground = (x: number, z: number): Point => ({ x, y: 0, z });
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.z - a.z);
const pickupHeading = (_id: SoilId) => Math.PI;
const offset = (p: Point, amount: number, id: SoilId) => ground(p.x + Math.cos(pickupHeading(id)) * amount, p.z - Math.sin(pickupHeading(id)) * amount);
export const loaderPickup = (id: SoilId) => offset(soilPoint(id), -2.15, id);
export const loaderCarry = (id: SoilId) => offset(loaderPickup(id), -0.65, id);

/** Round the corners inside the planned lane, without cutting across rocks. */
function rounded(points: Point[]) {
  const path = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const radius = Math.min(0.65, distance(a, b) / 3, distance(b, c) / 3);
    const start = mix(b, a, radius / distance(a, b)), end = mix(b, c, radius / distance(b, c));
    path.push(start);
    for (let j = 1; j <= 8; j++) { const t = j / 8; path.push(mix(mix(start, b, t), mix(b, end, t), t)); }
  }
  path.push(points[points.length - 1]); return path;
}
const waitingPoint = (id: SoilId) => ground(6.9, soilPoint(id).z);
export const loaderHome = (s: LoaderState): Point => s.soilLoaded.length === 1 ? waitingPoint((1 - s.soilLoaded[0]) as SoilId) : s.soilLoaded.length === 2 ? LOADER_DOCK : LOADER_HOME;
export const loaderReturnRoute = (s: LoaderState) => [LOADER_DOCK, loaderHome(s)];
export const loaderReturnSeconds = (s: LoaderState) => s.soilLoaded.length === 2 ? 1.4 : RETURN_SECONDS;
export function loaderRoute(s: LoaderState) {
  const id = s.loaderSelected ?? ([0, 1] as const).find(id => !s.soilLoaded.includes(id)) ?? 0;
  if (!s.loaderCarrying) {
    const end = loaderPickup(id);
    const start = loaderHome(s);
    return Math.abs(start.z - end.z) < 0.01 ? [start, end] : rounded([start, waitingPoint(id), end]);
  }
  const start = loaderCarry(id);
  return [start, LOADER_DOCK];
}
export const routeLength = (path: Point[]) => path.slice(1).reduce((sum, p, i) => sum + distance(path[i], p), 0);
export function routePose(path: Point[], amount: number) {
  let remaining = routeLength(path) * Math.max(0, Math.min(1, amount));
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], length = distance(a, b);
    if (remaining <= length || i === path.length - 1) return { point: mix(a, b, length ? remaining / length : 1), heading: Math.atan2(a.z - b.z, b.x - a.x) };
    remaining -= length;
  }
  return { point: path[0], heading: 0 };
}
export const scoopFraction = (s: PoseState) => s.motion === 'loader-scoop' ? smooth((s.elapsed - 0.3) / 0.7) : 0;
export const pourFraction = (s: PoseState) => s.motion === 'loader-tip' ? smooth((s.elapsed - POUR_START) / (POUR_END - POUR_START)) : 0;
export function soilRemaining(s: PoseState, id: SoilId) {
  return s.soilLoaded.includes(id) || s.loaderCarrying && s.loaderSelected === id ? 0 : s.loaderSelected === id ? 1 - scoopFraction(s) : 1;
}
export const soilInTruck = (s: PoseState) => (s.soilLoaded.length + pourFraction(s)) / 2;

/** One source for the renderer and real-model clearance tests. Camera stays fixed. */
export function loaderPose(s: PoseState, exit = 22.4) {
  let { point, heading } = routePose(loaderRoute(s), s.loaderTravel);
  let lift = s.loaderCarrying ? 0.12 : 0, tilt = s.loaderCarrying ? 0.28 : -0.06;
  const t = s.elapsed, id = s.loaderSelected ?? 0;
  if (s.loaderDocked) { point = LOADER_DOCK; heading = Math.PI; lift = 0.12 + 0.88 * smooth(s.loaderTravel); }
  if (s.phase === 'loader-arrival' || s.phase === 'loader-exit') {
    const origin = s.phase === 'loader-arrival' ? LOADER_HOME : LOADER_DOCK;
    point = { ...origin, x: origin.x + exit * (s.phase === 'loader-arrival' ? 1 - smooth(t / 2) : smooth(t / 2.7)) };
    heading = s.phase === 'loader-arrival' ? Math.PI + (heading - Math.PI) * smooth((t - 1.6) / 0.4) : 0;
  } else if (s.motion === 'loader-scoop') {
    const end = loaderPickup(id), into = offset(end, 0.3, id), carry = loaderCarry(id);
    point = t < 1 ? mix(end, into, smooth((t - 0.25) / 0.75)) : mix(into, carry, smooth((t - 1) / 0.65));
    heading = Math.PI - Math.PI / 2 * smooth((t - 1.65) / 0.55);
    lift = 0.12 * smooth((t - 0.9) / 0.65); tilt = -0.06 + 0.34 * scoopFraction(s);
  } else if (s.motion === 'loader-park') {
    point = LOADER_DOCK; heading += (Math.PI - heading) * smooth(t / PARK_SECONDS);
  } else if (s.motion === 'loader-tip') {
    point = mix(LOADER_DOCK, LOADER_TIP, smooth(t / 0.7)); heading = Math.PI;
    lift = 1; tilt = 0.28 - 0.83 * smooth((t - 0.7) / 0.45);
  } else if (s.motion === 'loader-return') {
    const last = s.soilLoaded.length === 2, route = loaderReturnRoute(s), moving = routePose(route, smooth((t - 1.4) / (RETURN_SECONDS - 1.75)));
    point = t < 0.8 ? mix(LOADER_TIP, LOADER_DOCK, smooth(t / 0.8)) : last ? LOADER_DOCK : moving.point;
    heading = last ? Math.PI * (1 - smooth((t - 0.8) / 0.6)) : t < 1.4 ? Math.PI + Math.PI / 2 * smooth((t - 0.8) / 0.6) : moving.heading + (-Math.PI - moving.heading) * smooth((t - RETURN_SECONDS + 0.35) / 0.35);
    lift = 1 - smooth((t - 0.8) / 0.6); tilt = -0.55 + 0.49 * smooth(t / 0.8);
  }
  const fill = s.motion === 'loader-scoop' ? scoopFraction(s) : s.loaderCarrying ? 1 - pourFraction(s) : 0;
  return { point, heading, lift, tilt, fill };
}
