import type { Train } from './rail.ts';

/** The inward-facing cab is the station anchor; the rest of each consist extends outward. */
export const CAB_TIP = 3.65, WIDTH = 1.7;
export const profiles = {
  'high-speed': { cars: 8, headLength: 5.7, coachLength: 4.4, gap: 0.16, floor: 0.65, roof: 2.04, nose: 2.35, door: -0.25, doorWidth: 0.7 },
  regional: { cars: 6, headLength: 4.3, coachLength: 4.1, gap: 0.14, floor: 0.65, roof: 2.28, nose: 0.16, door: 1.05, doorWidth: 0.76 },
  metro: { cars: 6, headLength: 4.1, coachLength: 4.1, gap: 0.14, floor: 0.65, roof: 2.12, nose: 0.32, door: 2.12, doorWidth: 1.08 },
  tram: { cars: 2, headLength: 3.52, coachLength: 3.52, gap: 0.26, floor: 0.4, roof: 1.91, nose: 0.36, door: 1.72, doorWidth: 1.02 },
} as const;
export interface CarSegment { index: number; front: number; rear: number; cab: 1 | 0 | -1; doors: number[] }
export function carSegments(kind: Train): CarSegment[] {
  const spec = profiles[kind], result: CarSegment[] = [];
  let front = CAB_TIP;
  for (let index = 0; index < spec.cars; index++) {
    const cab = index === 0 ? 1 : index === spec.cars - 1 ? -1 : 0;
    const rear = front - (cab ? spec.headLength : spec.coachLength), centre = (front + rear) / 2;
    const doors = index === 0 ? kind === 'metro' ? [0.35, spec.door] : [spec.door]
      : kind === 'metro' ? [rear + 0.95, front - 0.95]
      : kind === 'tram' ? [centre] : [centre];
    result.push({ index, front, rear, cab, doors }); front = rear - spec.gap;
  }
  return result;
}
export function trainExtent(kind: Train) {
  const cars = carSegments(kind);
  return { front: CAB_TIP + 0.1, rear: cars[cars.length - 1].rear - 0.1 };
}
