// Mission rules deliberately use no renderer objects or Effect runtime values.
export const phases = ['entering', 'ready', 'dragging', 'resetting', 'dumping', 'lowering', 'complete'] as const;
export type Phase = (typeof phases)[number];
export interface Tuning {
  dragThreshold: number;
  dragTilt: number;
  dumpTilt: number;
  dumpDuration: number;
}
export const defaultTuning: Tuning = {
  dragThreshold: 60,
  dragTilt: 0.62,
  dumpTilt: 0.92,
  dumpDuration: 1.75,
};
export interface TruckState {
  phase: Phase;
  elapsed: number;
  dragPx: number;
  fromTilt: number;
}
export type TruckInput =
  | { type: 'grab' }
  | { type: 'drag'; upwardPx: number }
  | { type: 'release' }
  | { type: 'cancel' };

export function createState(phase: Phase = 'entering'): TruckState {
  return { phase, elapsed: 0, dragPx: 0, fromTilt: 0 };
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => value * value * (3 - 2 * value);

export function input(state: TruckState, event: TruckInput, tuning: Tuning): TruckState {
  if (event.type === 'grab') {
    return state.phase === 'ready' ? createState('dragging') : state;
  }
  if (state.phase !== 'dragging') return state;
  if (event.type === 'drag') {
    const dragPx = Math.max(0, event.upwardPx);
    if (dragPx >= tuning.dragThreshold) {
      return { ...createState('dumping'), fromTilt: tuning.dragTilt };
    }
    return { ...state, dragPx };
  }
  const tilt = pose(state, tuning).tilt;
  return {
    ...createState('resetting'),
    fromTilt: event.type === 'release' && state.dragPx < 4 ? 0.14 : tilt,
  };
}

function duration(phase: Phase, tuning: Tuning): number {
  switch (phase) {
    case 'entering': return 1.15;
    case 'resetting': return 0.28;
    case 'dumping': return tuning.dumpDuration;
    case 'lowering': return 0.75;
    default: return Infinity;
  }
}

// Consume remaining time across transitions, so a long frame cannot lose time.
export function advance(state: TruckState, delta: number, tuning: Tuning): TruckState {
  let result = state;
  let remaining = Math.max(0, delta);
  for (let transitions = 0; transitions < 5 && remaining > 0; transitions++) {
    const length = duration(result.phase, tuning);
    if (!Number.isFinite(length)) return result;
    const step = Math.min(remaining, Math.max(0, length - result.elapsed));
    result = { ...result, elapsed: result.elapsed + step };
    remaining -= step;
    if (result.elapsed < length) return result;
    switch (result.phase) {
      case 'entering':
      case 'resetting': result = createState('ready'); break;
      case 'dumping': result = { ...createState('lowering'), fromTilt: tuning.dumpTilt }; break;
      case 'lowering': result = createState('complete'); break;
    }
  }
  return result;
}

export function pose(state: TruckState, tuning: Tuning) {
  let tilt = 0;
  let fill = 0;
  let x = -1.3;
  switch (state.phase) {
    case 'entering': x = -9 + 7.7 * (1 - (1 - clamp(state.elapsed / 1.15)) ** 2); break;
    case 'dragging': tilt = tuning.dragTilt * clamp(state.dragPx / tuning.dragThreshold); break;
    case 'resetting': tilt = state.fromTilt * (1 - ease(clamp(state.elapsed / 0.28))); break;
    case 'dumping': {
      const progress = clamp(state.elapsed / tuning.dumpDuration);
      tilt = state.fromTilt + (tuning.dumpTilt - state.fromTilt) * ease(clamp(progress / 0.25));
      fill = clamp((progress - 0.24) / 0.55);
      break;
    }
    case 'lowering': tilt = state.fromTilt * (1 - ease(clamp(state.elapsed / 0.75))); fill = 1; break;
    case 'complete': fill = 1; break;
  }
  return { x, tilt, fill, hint: state.phase === 'ready' };
}
