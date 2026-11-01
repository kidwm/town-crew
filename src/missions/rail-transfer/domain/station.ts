import { destinations, origins, smooth, type RailState, type Round, type Train } from './rail.ts';
export interface Point { x: number; y: number; z: number }
import { profiles } from './formation.ts';
export { WIDTH } from './formation.ts';
import { WIDTH } from './formation.ts';
export function bay(r: Round, t: Train) {
  const side = ((t === 'high-speed' || t === 'metro') ? -1 : 1) * (r.layout ? -1 : 1);
  const z = ['high-speed', 'regional'].includes(t) ? -4.2 : 3.6;
  return { side, z, x: side * 6.6, waitX: side * 7.9, floor: profiles[t].floor };
}
export function trainPose(s: RailState, t: Train, outside = 22) {
  const b = bay(s.round, t), first = origins(s.round).includes(t), second = s.order.length >= 2;
  let x = b.waitX, visible = !s.order.includes(t) && s.phase !== 'intro' && (first || second);
  if (s.phase === 'entrance' && first === !second) x = b.side * (outside + (Math.abs(b.waitX) - outside) * smooth((s.elapsed - (t === (second ? destinations(s.round) : origins(s.round))[1] ? 0.35 : 0)) / 3.15));
  if (s.selected === t) {
    x = s.phase === 'approach' ? b.waitX + (b.x - b.waitX) * s.travel : s.phase === 'exit' ? b.x + b.side * 1.7 * s.travel : s.phase === 'departure' ? b.side * (Math.abs(b.x) + 1.7 + (outside - Math.abs(b.x) - 1.7) * smooth(s.elapsed / 3.8)) : b.x;
  }
  if (['celebrate', 'complete'].includes(s.phase)) visible = false;
  return { x, y: 0.08, z: b.z, visible, direction: s.selected === t && ['exit', 'departure'].includes(s.phase) ? b.side : -b.side };
}
export function doorPoint(s: RailState, t: Train, outside = 22): Point {
  const b = bay(s.round, t), pose = trainPose(s, t, outside);
  return { x: pose.x - b.side * profiles[t].door, y: b.floor + 0.65, z: b.z + WIDTH / 2 + 0.08 };
}
export function sourceTrain(r: Round, id: number) { return origins(r)[Math.floor(id / 3)]; }
export function destinationTrain(r: Round, id: number) { return destinations(r)[id % 2]; }
export function waitingPoint(r: Round, id: number): Point {
  const b = bay(r, destinationTrain(r, id));
  return { x: b.x + b.side * (Math.floor(id / 2) - 1) * 0.75, y: b.floor, z: b.z + 2.12 };
}
export function seatPoint(s: RailState, t: Train, id: number, outside = 22): Point {
  const b = bay(s.round, t), pose = trainPose(s, t, outside);
  return { x: pose.x - b.side * profiles[t].door + ((id % 3) - 1) * 0.7, y: b.floor + 0.13, z: b.z - 0.25 };
}
export function walkPose(points: Point[], fraction: number): Point & { heading: number } {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y, p.z - points[i].z));
  let remaining = Math.max(0, Math.min(1, fraction)) * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const a = points[i], b = points[i + 1], f = lengths[i] ? Math.min(1, remaining / lengths[i]) : 0;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, heading: Math.atan2(b.x - a.x, b.z - a.z) };
    }
    remaining -= lengths[i];
  }
  return { ...points[0], heading: 0 };
}
export function transferRoute(s: RailState, id: number): Point[] {
  const t = sourceTrain(s.round, id), b = bay(s.round, t), d = doorPoint(s, t), wait = waitingPoint(s.round, id);
  // Both elevated platforms ramp down to the same unobstructed central concourse.
  return [seatPoint(s, t, id), { ...d, y: b.floor }, { x: d.x, y: b.floor, z: b.z + 2.12 }, { x: b.side * 3.0, y: b.floor, z: b.z + 2.12 }, { x: b.side * 1.9, y: 0.25, z: b.z + 2.12 }, { x: 0, y: 0.25, z: wait.z }, { x: bay(s.round, destinationTrain(s.round, id)).side * 1.9, y: 0.25, z: wait.z }, { x: bay(s.round, destinationTrain(s.round, id)).side * 3.0, y: wait.y, z: wait.z }, wait];
}
export function boardingRoute(s: RailState, id: number): Point[] {
  const t = destinationTrain(s.round, id), wait = waitingPoint(s.round, id), d = doorPoint(s, t);
  return [wait, { x: d.x, y: wait.y, z: wait.z }, { ...d, y: wait.y }, seatPoint(s, t, id)];
}
