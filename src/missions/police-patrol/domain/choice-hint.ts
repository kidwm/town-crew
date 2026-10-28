import type { Bike, PoliceState } from './police.ts';

export const choosingBike = (s: PoliceState) => s.phase === 'guard' && s.action === 'ready' && s.selected === null && s.work.guard === 0;
export interface BikeHintClock { bike: Bike; elapsed: number; running: boolean; reduced: boolean }
export const createBikeHintClock = (layout: number, first?: Bike): BikeHintClock => ({ bike: first ?? (layout === 0 ? 'bike0' : 'bike1'), elapsed: 0, running: false, reduced: false });

/** Presentation only: no mutation of selection, work, or the saved mission clock. */
export function advanceBikeHint(clock: BikeHintClock, state: PoliceState, delta: number, cycles: Record<Bike, number>, reduced: boolean): BikeHintClock {
  if (!choosingBike(state)) return { ...clock, elapsed: 0, running: false, reduced };
  if (!clock.running || reduced !== clock.reduced) return { ...clock, elapsed: 0, running: true, reduced };
  if (reduced || !Number.isFinite(delta) || delta <= 0) return clock;
  const elapsed = clock.elapsed + delta;
  // Drop overshoot so the newly displayed hand receives its complete first cycle.
  return elapsed >= cycles[clock.bike] ? { ...clock, bike: clock.bike === 'bike0' ? 'bike1' : 'bike0', elapsed: 0 } : { ...clock, elapsed };
}
