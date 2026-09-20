import { CARS, TOW_LANE, mix, smooth, towDirection, towType } from './traffic.ts';
import type { TrafficState } from './traffic.ts';

export const LIFT_AXLE_X = -3.85;
export const LIFT_HEIGHT = 0.62;
export const CAR_AXLE = 1.05;
export const CAR_WHEEL = 0.33;

/** Both trucks back into the apron, then drive outward along their own route. */
export function towingPose(s: TrafficState) {
  const direction = towDirection(s), working = s.action === 'working', t = s.elapsed;
  const loading = s.phase === 'hook' && working, departing = s.phase === 'tow-exit';
  const x = s.phase === 'tow-arrival' ? direction * (8 + 18 * (1 - smooth(t / 2)))
    : departing ? s.truckX + (working ? direction * 18 * smooth(t / 1.5) : 0) : direction * 8;
  const raised = departing ? 1 : loading ? smooth((t - 3.6) / 0.9) : 0;
  const lowered = s.phase === 'tow-arrival' ? smooth(t / 2) : s.phase === 'hook' ? 1 - raised : 0;
  return { x, z: TOW_LANE, direction, yaw: direction < 0 ? Math.PI : 0, raised, lowered, loading, departing, type: towType(s) };
}

export function towedCarPose(s: TrafficState, i: number) {
  const rig = towingPose(s), startYaw = i === 0 ? -0.12 : Math.PI - 0.12;
  if (s.selected !== i || !(rig.loading || rig.departing)) return { position: { ...CARS[i] }, yaw: startYaw, pitch: 0 };
  const t = s.elapsed, amount = rig.departing ? 1 : smooth((t - 1.3) / 2.3);
  const pitch = rig.type === 'flatbed' ? rig.lowered * 0.19 * amount : Math.asin(LIFT_HEIGHT * rig.raised / (2 * CAR_AXLE));
  // Rotate around the trailing axle's ground contact: its tyres never float.
  const localX = rig.type === 'flatbed' ? -1.15 : LIFT_AXLE_X - CAR_AXLE * Math.cos(pitch) + CAR_WHEEL * Math.sin(pitch);
  const y = rig.type === 'flatbed' ? 1.06 - 2 * Math.sin(rig.lowered * 0.19)
    : CAR_WHEEL + CAR_AXLE * Math.sin(pitch) - CAR_WHEEL * Math.cos(pitch);
  const end = { x: rig.x + rig.direction * localX, y, z: rig.z }, edge = { ...CARS[i], z: rig.z };
  const position = rig.departing ? end : t < 1.3 ? mix(CARS[i], edge, smooth(t / 0.8)) : mix(edge, end, amount);
  const yaw = rig.departing ? rig.yaw : startYaw + (rig.yaw - startYaw) * smooth((t - 0.8) / 0.5);
  return { position, yaw, pitch };
}
