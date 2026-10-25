import { towDirection } from './traffic.ts';
import type { TrafficState } from './traffic.ts';

// Saved tow travel remains 8..11; the visible 8..10 route hands off earlier.
// This keeps existing partial saves and the same domain completion contract.
export function driveWorldX(s: TrafficState, x = s.truckX) {
  return s.phase === 'tow-exit' ? towDirection(s) * 8 + (x - towDirection(s) * 8) * 2 / 3 : x;
}
export function driveStateX(s: TrafficState, x: number) {
  return s.phase === 'tow-exit' ? towDirection(s) * 8 + (x - towDirection(s) * 8) * 3 / 2 : x;
}
