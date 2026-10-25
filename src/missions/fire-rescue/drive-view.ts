import { DRIVE_START, ENGINE_STOP, STREET_STOP } from './domain/fire.ts';
import type { FireState } from './domain/fire.ts';

// Preserve saved driving coordinates while fitting the visible approach inside
// the frame. Input uses the exact inverse, so the truck stays under the finger.
const visibleStart = (s: FireState) => s.phase === 'dispatch' ? -7.5 : -6.5;
const end = (s: FireState) => s.phase === 'dispatch' ? ENGINE_STOP : STREET_STOP;
export function driveWorldX(s: FireState, x = s.truckX) {
  const stop = end(s);
  return stop + (x - stop) * (stop - visibleStart(s)) / (stop - DRIVE_START);
}
export function driveStateX(s: FireState, x: number) {
  const stop = end(s);
  return stop + (x - stop) * (stop - DRIVE_START) / (stop - visibleStart(s));
}
