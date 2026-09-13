export const stages = ['dispatch', 'hose', 'ground-fire', 'ladder-arrival', 'roof-reach', 'roof-fire', 'rescue', 'stowing', 'ambulance', 'stretcher', 'boarding', 'departure', 'complete'] as const;
export type Stage = typeof stages[number];
export type Action = 'entering' | 'ready' | 'dragging' | 'working' | 'returning' | 'unloading';
export type RescueId = 'resident' | 'cat';
export type Goal = 'hydrant' | 'roof' | RescueId | 'patient' | 'ambulance';
export interface Point { x: number; y: number; z: number }
export const DRIVE_START = -10;
export const ENGINE_STOP = -5.6;
export const STREET_STOP = 6.5;
export const STREET_Z = 5.9;
export const HOSE_HOME: Point = { x: -7, y: 0.95, z: 3.5 };
export const HYDRANT: Point = { x: -9, y: 0.95, z: 3.7 };
export const BASKET_HOME: Point = { x: -1.9, y: 0.25, z: 2.4 };
export const BASKET_STOWED: Point = { x: STREET_STOP - 1.8, y: 2.65, z: STREET_Z };
export const ROOF_DOCK: Point = { x: 3.2, y: 5.05, z: 2.4 };
export const RESCUES = [
  { id: 'resident' as const, name: '居民', at: { x: 1.35, y: 2.85, z: 1.25 }, dock: { x: 1.35, y: 2.7, z: 2.4 }, ground: { x: -2.1, y: 0, z: 0.8 } },
  { id: 'cat' as const, name: '小貓', at: { x: 5.05, y: 5.2, z: 0.85 }, dock: { x: 5.05, y: 5.05, z: 2.4 }, ground: { x: -0.6, y: 0, z: 1.1 } },
] as const;
export const FIRES: readonly Point[] = [{ x: 0.4, y: 0.45, z: 1.4 }, { x: 3.15, y: 0.9, z: 1.35 }, { x: 5.65, y: 0.45, z: 1.4 }, { x: 3.2, y: 5.35, z: 0.9 }];
export const STRETCHER_HOME: Point = { x: STREET_STOP - 2.95, y: 0.7, z: 4.35 };
export const PATIENT: Point = { x: -2.1, y: 0.7, z: 0.8 };
export const AMBULANCE_REAR: Point = { x: STREET_STOP - 2.95, y: 0.95, z: STREET_Z };
export const SETTLE_SECONDS = 0.4;
export interface FireState {
  version: 1; phase: Stage; action: Action; elapsed: number; truckX: number;
  hose: Point; basket: Point; stretcher: Point; from: Point; aim: Point;
  fires: number[]; wet: number | null; rescued: boolean[]; passenger: RescueId | null;
}
export const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
export const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
export const isSpraying = (s: FireState) => s.phase === 'ground-fire' || s.phase === 'roof-fire';
export const isDriving = (s: FireState) => s.phase === 'dispatch' || s.phase === 'ambulance';
export const isBasket = (s: FireState) => s.phase === 'roof-reach' || s.phase === 'rescue';
const pointOK = (p: Point) => p && [p.x, p.y, p.z].every(n => Number.isFinite(n) && Math.abs(n) < 30);
export function createFire(phase: Stage = 'dispatch'): FireState {
  const index = stages.indexOf(phase);
  return { version: 1, phase, action: ['dispatch', 'ladder-arrival', 'ambulance'].includes(phase) ? 'entering' : ['stowing', 'departure'].includes(phase) ? 'working' : 'ready', elapsed: 0,
    truckX: DRIVE_START, hose: { ...(index >= 2 ? HYDRANT : HOSE_HOME) },
    basket: { ...(phase === 'roof-fire' ? ROOF_DOCK : BASKET_HOME) },
    stretcher: { ...(index >= 10 ? PATIENT : STRETCHER_HOME) }, from: { ...BASKET_HOME }, aim: { ...FIRES[phase === 'roof-fire' ? 3 : 0] },
    fires: [index >= 3 ? 0 : 1, index >= 3 ? 0 : 1, index >= 3 ? 0 : 1, index >= 6 ? 0 : 1], wet: null, rescued: [index >= 7, index >= 7], passenger: null };
}
const enter = (s: FireState, phase: Stage, action: Action = 'ready'): FireState => ({ ...s, phase, action, elapsed: 0, wet: null });
export function grab(s: FireState): FireState {
  return s.action === 'ready' && !['complete', 'stowing', 'departure', 'ladder-arrival'].includes(s.phase) ? { ...s, action: 'dragging', elapsed: 0 } : s;
}
export function drive(s: FireState, x: number): FireState {
  if (!isDriving(s) || s.action !== 'dragging' || !Number.isFinite(x)) return s;
  const end = s.phase === 'dispatch' ? ENGINE_STOP : STREET_STOP;
  const truckX = clamp(x, DRIVE_START, end);
  return { ...s, truckX: truckX > end - 0.2 ? end : truckX, action: truckX > end - 0.2 ? 'working' : 'dragging', elapsed: 0 };
}
export function moveHandle(s: FireState, p: Point): FireState {
  if (s.action !== 'dragging' || !pointOK(p)) return s;
  if (s.phase === 'hose') return { ...s, hose: { x: clamp(p.x, -10.5, -4), y: HOSE_HOME.y, z: clamp(p.z, 2.9, 4.5) } };
  if (isBasket(s)) return { ...s, basket: { x: clamp(p.x, -2.4, 6.5), y: clamp(p.y, 0.25, 6.4), z: 2.4 } };
  if (s.phase === 'stretcher' || s.phase === 'boarding') return { ...s, stretcher: { x: clamp(p.x, -3.5, AMBULANCE_REAR.x), y: 0.7, z: clamp(p.z, 0.5, 6.4) } };
  return s;
}
export function spray(s: FireState, aim: Point, wet: number | null): FireState {
  if (!isSpraying(s) || s.action !== 'dragging' || !pointOK(aim)) return s;
  const valid = wet !== null && Number.isInteger(wet) && (s.phase === 'ground-fire' ? wet >= 0 && wet < 3 : wet === 3);
  return { ...s, aim: { ...aim }, wet: valid ? wet : null };
}
export function goals(s: FireState): Goal[] {
  if (!['ready', 'dragging'].includes(s.action)) return [];
  if (s.phase === 'hose') return ['hydrant'];
  if (s.phase === 'roof-reach') return ['roof'];
  if (s.phase === 'rescue') return RESCUES.filter((_, i) => !s.rescued[i]).map(r => r.id);
  if (s.phase === 'stretcher') return ['patient'];
  if (s.phase === 'boarding') return ['ambulance'];
  return [];
}
export function accept(s: FireState, goal: Goal): FireState {
  if (s.action !== 'dragging' || !goals(s).includes(goal)) return s;
  const from = s.phase === 'hose' ? s.hose : isBasket(s) ? s.basket : s.stretcher;
  return { ...s, action: 'working', elapsed: 0, from: { ...from }, passenger: s.phase === 'rescue' ? goal as RescueId : null };
}
export function release(s: FireState, cancelled = false, goal?: Goal): FireState {
  if (s.action !== 'dragging') return s;
  if (!cancelled && goal && goals(s).includes(goal)) return accept(s, goal);
  // Return loose equipment to a visible pickup point after an interrupted
  // gesture. Parking and extinguishing progress remain where the child left it.
  return { ...s, action: 'ready', elapsed: 0, wet: null,
    hose: s.phase === 'hose' ? { ...HOSE_HOME } : s.hose,
    basket: isBasket(s) ? { ...BASKET_HOME } : s.basket,
    stretcher: s.phase === 'boarding' ? { ...PATIENT } : s.phase === 'stretcher' ? { ...STRETCHER_HOME } : s.stretcher };
}
export function advance(s: FireState, delta: number): FireState {
  if (!Number.isFinite(delta) || delta <= 0 || s.phase === 'complete') return s;
  const dt = Math.min(delta, 0.1), elapsed = s.elapsed + dt;
  let next = { ...s, elapsed };
  if (isDriving(s)) {
    if (s.action === 'entering' && elapsed >= 1.1) return { ...next, action: 'ready', elapsed: 0 };
    if (s.action === 'working' && elapsed >= 0.7) return enter(next, s.phase === 'dispatch' ? 'hose' : 'stretcher');
  }
  if (s.phase === 'hose' && s.action === 'working') {
    next.hose = mix(s.from, HYDRANT, smooth(elapsed / 0.45));
    if (elapsed >= 0.7) return enter(next, 'ground-fire');
  }
  if (isSpraying(s) && s.action === 'dragging' && s.wet !== null) {
    next.fires = s.fires.map((heat, i) => i === s.wet ? Math.max(0, heat - dt / 1.8) : heat);
    if (s.phase === 'ground-fire' && next.fires.slice(0, 3).every(n => n === 0)) return enter(next, 'ladder-arrival', 'entering');
    if (s.phase === 'roof-fire' && next.fires[3] === 0) return { ...enter(next, 'rescue', 'returning'), from: { ...s.basket } };
  }
  if (s.phase === 'ladder-arrival' && elapsed >= 2.6) return { ...enter(next, 'roof-reach'), basket: { ...BASKET_HOME } };
  if (s.phase === 'roof-reach' && s.action === 'working') {
    next.basket = mix(s.from, ROOF_DOCK, smooth(elapsed / 0.75));
    if (elapsed >= 0.8) return enter(next, 'roof-fire');
  }
  if (s.phase === 'rescue') {
    const destination = RESCUES.find(r => r.id === s.passenger);
    if (s.action === 'working' && destination) {
      next.basket = mix(s.from, destination.dock, smooth(elapsed / 0.5));
      if (elapsed >= 1.1) return { ...next, action: 'returning', elapsed: 0, from: { ...next.basket } };
    }
    if (s.action === 'returning') {
      next.basket = mix(s.from, BASKET_HOME, smooth(elapsed / 1.45));
      if (elapsed >= 1.5) return { ...next, basket: { ...BASKET_HOME }, action: destination ? 'unloading' : 'ready', elapsed: 0 };
    }
    if (s.action === 'unloading' && destination && elapsed >= 0.8) {
      next.rescued = s.rescued.map((done, i) => done || RESCUES[i].id === s.passenger);
      next.passenger = null;
      return next.rescued.every(Boolean) ? enter(next, 'stowing', 'working') : enter(next, 'rescue');
    }
  }
  if (s.phase === 'stowing' && elapsed >= 2.8) return { ...enter(next, 'ambulance', 'entering'), truckX: DRIVE_START };
  if (s.phase === 'stretcher' && s.action === 'working') {
    next.stretcher = mix(s.from, PATIENT, smooth(elapsed / 0.4));
    if (elapsed >= 1.1) return enter(next, 'boarding');
  }
  if (s.phase === 'boarding' && s.action === 'working') {
    const dock = mix(s.from, AMBULANCE_REAR, smooth(elapsed / 0.5));
    next.stretcher = elapsed < 0.5 ? dock : mix(AMBULANCE_REAR, { ...AMBULANCE_REAR, x: STREET_STOP - 1.3 }, smooth((elapsed - 0.5) / 0.7));
    if (elapsed >= 1.3) return enter(next, 'departure', 'working');
  }
  if (s.phase === 'departure' && elapsed >= 3.2) return enter(next, 'complete');
  return next;
}
export function progress(s: FireState) {
  const index = stages.indexOf(s.phase);
  return ((index >= 1 ? 1 : 0) + (index >= 2 ? 1 : 0) + s.fires.reduce((n, heat) => n + 1 - heat, 0)
    + (index >= 5 ? 1 : 0) + s.rescued.filter(Boolean).length + (index >= 9 ? 1 : 0) + (index >= 10 ? 1 : 0) + (index >= 11 ? 1 : 0) + (index >= 12 ? 1 : 0)) / 13;
}
export function resumeFire(value: unknown): FireState | undefined {
  if (!value || typeof value !== 'object') return;
  const s = value as FireState, index = stages.indexOf(s.phase);
  if (s.version !== 1 || index < 0 || !['entering', 'ready', 'dragging', 'working', 'returning', 'unloading'].includes(s.action)
    || !Number.isFinite(s.elapsed) || s.elapsed < 0 || s.elapsed > 1e7 || !Number.isFinite(s.truckX) || s.truckX < DRIVE_START || s.truckX > STREET_STOP
    || ![s.hose, s.basket, s.stretcher, s.from, s.aim].every(pointOK)
    || !Array.isArray(s.fires) || s.fires.length !== 4 || !s.fires.every(n => Number.isFinite(n) && n >= 0 && n <= 1)
    || !Array.isArray(s.rescued) || s.rescued.length !== 2 || !s.rescued.every(v => typeof v === 'boolean')
    || (s.passenger !== null && !['resident', 'cat'].includes(s.passenger))
    || (s.wet !== null && (!Number.isInteger(s.wet) || s.wet < 0 || s.wet > 3))) return;
  const allowed: readonly Action[] = isDriving(s) ? ['entering', 'ready', 'dragging', 'working']
    : s.phase === 'ladder-arrival' ? ['entering'] : ['stowing', 'departure'].includes(s.phase) ? ['working']
    : s.phase === 'complete' ? ['ready'] : s.phase === 'rescue' ? ['ready', 'dragging', 'working', 'returning', 'unloading']
    : isSpraying(s) ? ['ready', 'dragging'] : ['ready', 'dragging', 'working'];
  if (!allowed.includes(s.action) || (index < 2 && s.fires.some(n => n !== 1))
    || (index < 5 && s.fires[3] !== 1) || (index >= 3 && s.fires.slice(0, 3).some(n => n !== 0))
    || (index >= 6 && s.fires.some(n => n !== 0)) || (index < 6 && s.rescued.some(Boolean))
    || (s.phase === 'ground-fire' && s.fires.slice(0, 3).every(n => n === 0)) || (s.phase === 'roof-fire' && s.fires[3] === 0)
    || (s.phase === 'rescue' && s.rescued.every(Boolean))
    || (index >= 7 && s.rescued.some(v => !v)) || (s.phase !== 'rescue' && s.passenger !== null)
    || (s.passenger !== null && (s.rescued[RESCUES.findIndex(r => r.id === s.passenger)] || !['working', 'returning', 'unloading'].includes(s.action)))
    || (s.phase === 'rescue' && ['working', 'unloading'].includes(s.action) && !s.passenger)
    || (s.wet !== null && (!isSpraying(s) || s.action !== 'dragging' || (s.phase === 'ground-fire' ? s.wet > 2 : s.wet !== 3)))) return;
  return release(structuredClone(s), true);
}
