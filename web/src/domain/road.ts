import { advance as advanceTruck, createState, defaultTuning, pose as truckPose } from './dump-truck.ts';
import type { TruckState, Tuning } from './dump-truck.ts';
import { advanceExcavator, createExcavator, smooth } from './excavator.ts';
import type { ExcavatorState } from './excavator.ts';

export const stages = ['excavator', 'dump-truck', 'roller', 'roller-return', 'traffic', 'complete'] as const;
export type EntryStage = (typeof stages)[number];
export type MissionPhase = 'excavator' | 'dump-truck' | 'roller' | 'traffic' | 'complete';
export const ROLLER_LEFT = -1.2;
export const ROLLER_RIGHT = 5.4;
export const BARRIER_X = [-6.7, 7.9] as const;
export const BARRIER_CLEAR_Z = 3.9;
export const GATE_DURATION = 0.55;
export const DEPARTURE_DURATION = 1.1;
export const accessModes = ['opening-entry', 'entering', 'closing-entry', 'working', 'opening-exit', 'leaving'] as const;
export type SiteAccess = (typeof accessModes)[number];
export interface RollerState {
  action: 'entering' | 'ready' | 'dragging' | 'settling' | 'flattening' | 'complete';
  elapsed: number;
  x: number;
  passes: number;
}
export interface RoadState {
  phase: MissionPhase;
  access: SiteAccess;
  elapsed: number;
  excavator: ExcavatorState;
  truck: TruckState;
  roller: RollerState;
}
export function createRoad(stage: EntryStage = 'excavator'): RoadState {
  const phase = stage === 'roller-return' ? 'roller' : stage;
  return {
    phase, elapsed: 0,
    access: phase === 'traffic' || phase === 'complete' || stage === 'roller-return' ? 'working' : 'opening-entry',
    excavator: { ...createExcavator(), ...(phase === 'excavator' ? {} : { action: 'complete' as const, cleared: 3 }) },
    truck: createState(phase === 'excavator' || phase === 'dump-truck' ? 'entering' : 'complete'),
    roller: { action: phase === 'traffic' || phase === 'complete' ? 'complete' : stage === 'roller-return' ? 'ready' : 'entering', elapsed: 0, x: stage === 'roller-return' ? ROLLER_RIGHT : ROLLER_LEFT, passes: phase === 'traffic' || phase === 'complete' ? 2 : stage === 'roller-return' ? 1 : 0 },
  };
}
export function grabRoller(state: RollerState): RollerState {
  return state.action === 'ready' ? { ...state, action: 'dragging' } : state;
}
export function moveRoller(state: RollerState, x: number): RollerState {
  if (state.action !== 'dragging') return state;
  x = Math.max(ROLLER_LEFT, Math.min(ROLLER_RIGHT, x));
  if (state.passes === 0 && x >= ROLLER_RIGHT - 0.05) return { ...state, x: ROLLER_RIGHT, action: 'settling', passes: 1, elapsed: 0 };
  if (state.passes === 1 && x <= ROLLER_LEFT + 0.05) return { ...state, x: ROLLER_LEFT, action: 'flattening', passes: 2, elapsed: 0 };
  return { ...state, x };
}
export function releaseRoller(state: RollerState): RollerState {
  return state.action === 'dragging' ? { ...state, action: 'ready' } : state;
}
function tick(state: RoadState, delta: number, tuning: Tuning): RoadState {
  const construction = state.phase !== 'traffic' && state.phase !== 'complete';
  if (construction && (state.access === 'opening-entry' || state.access === 'closing-entry' || state.access === 'opening-exit')) {
    const elapsed = state.elapsed + delta;
    if (elapsed < GATE_DURATION) return { ...state, elapsed };
    const access = state.access === 'opening-entry' ? 'entering' : state.access === 'closing-entry' ? 'working' : 'leaving';
    return { ...state, access, elapsed: 0 };
  }
  if (construction && state.access === 'leaving') {
    const elapsed = state.elapsed + delta;
    if (elapsed < DEPARTURE_DURATION) return { ...state, elapsed };
    const phase = state.phase === 'excavator' ? 'dump-truck' : state.phase === 'dump-truck' ? 'roller' : 'traffic';
    // Keep the entrance open throughout the handoff to the next vehicle.
    return { ...state, phase, access: phase === 'traffic' ? 'working' : 'entering', elapsed: 0 };
  }
  if (state.phase === 'excavator') {
    const excavator = advanceExcavator(state.excavator, delta);
    const access = state.access === 'entering' && excavator.action === 'ready' ? 'closing-entry' : excavator.action === 'complete' ? 'opening-exit' : state.access;
    return { ...state, excavator, access, elapsed: 0 };
  }
  if (state.phase === 'dump-truck') {
    const truck = advanceTruck(state.truck, delta, tuning);
    const access = state.access === 'entering' && truck.phase === 'ready' ? 'closing-entry' : truck.phase === 'complete' ? 'opening-exit' : state.access;
    return { ...state, truck, access, elapsed: 0 };
  }
  if (state.phase === 'roller') {
    let roller = { ...state.roller, elapsed: state.roller.elapsed + delta };
    if (roller.action === 'entering' && roller.elapsed >= 1.15) roller = { ...roller, action: 'ready', elapsed: 0 };
    if (roller.action === 'settling' && roller.elapsed >= 0.42) roller = { ...roller, action: 'ready', elapsed: 0 };
    if (roller.action === 'flattening' && roller.elapsed >= 0.78) roller = { ...roller, action: 'complete', elapsed: 0 };
    const access = state.access === 'entering' && roller.action === 'ready' ? 'closing-entry' : roller.action === 'complete' ? 'opening-exit' : state.access;
    return { ...state, roller, access, elapsed: 0 };
  }
  if (state.phase === 'traffic') {
    const elapsed = state.elapsed + delta;
    return elapsed >= 4.8 ? { ...state, phase: 'complete', elapsed: 0 } : { ...state, elapsed };
  }
  return state;
}
export function advanceRoad(state: RoadState, delta: number, tuning: Tuning = defaultTuning): RoadState {
  // Small simulation steps keep contact detection stable at different display rates.
  let result = state;
  let remaining = Math.max(0, Math.min(delta, 10));
  while (remaining > 1e-8) { const dt = Math.min(1 / 60, remaining); result = tick(result, dt, tuning); remaining -= dt; }
  return result;
}
export function roadPose(state: RoadState, tuning: Tuning) {
  const { phase, excavator, truck, roller } = state;
  const fill = phase === 'excavator' ? 0 : phase === 'dump-truck' ? truckPose(truck, tuning).fill : 1;
  const flatten = phase === 'traffic' || phase === 'complete' || roller.action === 'complete' ? 1 : roller.action === 'flattening' ? smooth(roller.elapsed / 0.78) : 0;
  const compact = roller.passes === 0 ? 0 : roller.action === 'settling' ? smooth(roller.elapsed / 0.42) * 0.5 : 0.5 + flatten * 0.5;
  const rollerX = roller.action === 'entering' ? -9 + (ROLLER_LEFT + 9) * (1 - (1 - Math.min(roller.elapsed / 1.15, 1)) ** 2) : roller.x;
  const progress = phase === 'excavator' ? excavator.cleared / 9 : phase === 'dump-truck' ? (1 + fill) / 3 : phase === 'roller' ? (2 + roller.passes / 2) / 3 : 1;
  let entryGate = 0;
  if (state.access === 'opening-entry' || state.access === 'opening-exit') entryGate = smooth(state.elapsed / GATE_DURATION);
  if (state.access === 'entering' || state.access === 'leaving') entryGate = 1;
  if (state.access === 'closing-entry') entryGate = 1 - smooth(state.elapsed / GATE_DURATION);
  const barrierZ = phase === 'complete' ? [BARRIER_CLEAR_Z, BARRIER_CLEAR_Z]
    : phase === 'traffic' ? [BARRIER_CLEAR_Z, BARRIER_CLEAR_Z * smooth(state.elapsed / 0.85)]
    : [BARRIER_CLEAR_Z * entryGate, 0];
  return { fill, flatten, compact, rollerX, progress, barrierZ, departure: state.access === 'leaving' ? smooth(state.elapsed / DEPARTURE_DURATION) : 0 };
}
export function resumeRoad(state: RoadState, tuning: Tuning = defaultTuning): RoadState {
  // Upgrade pre-gate snapshots without discarding completed work. Restart an
  // interrupted entrance outside the gate instead of restoring a crossing pose.
  if (!accessModes.includes(state.access)) {
    const action = state.phase === 'excavator' ? state.excavator.action : state.phase === 'dump-truck' ? state.truck.phase : state.phase === 'roller' ? state.roller.action : undefined;
    state = {
      ...state,
      access: action === 'entering' ? 'opening-entry' : action === 'complete' ? 'opening-exit' : 'working',
      elapsed: state.phase === 'traffic' || state.phase === 'complete' ? state.elapsed : 0,
      excavator: state.excavator.action === 'entering' ? { ...state.excavator, elapsed: 0 } : state.excavator,
      truck: state.truck.phase === 'entering' ? { ...state.truck, elapsed: 0 } : state.truck,
      roller: state.roller.action === 'entering' ? { ...state.roller, elapsed: 0 } : state.roller,
    };
  }
  // Pointer capture never survives module replacement or document reload.
  return {
    ...state,
    excavator: state.excavator.action === 'dragging' ? { ...state.excavator, action: 'returning', elapsed: 0, from: state.excavator.bucket } : state.excavator,
    truck: state.truck.phase === 'dragging' ? { ...state.truck, phase: 'resetting', elapsed: 0, fromTilt: truckPose(state.truck, tuning).tilt } : state.truck,
    roller: releaseRoller(state.roller),
  };
}
