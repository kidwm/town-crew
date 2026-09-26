import type { HouseState, Point } from './house.ts';

// Coordinates are local to the site: the existing site transform mirrors the
// garage, car, passengers and walking paths together.
export const GARAGE = { x: -5.65, z: 0.15, width: 4, depth: 3.9, floor: 0.12, height: 2.35 };
export const FAMILY_CAR_SCALE = 0.82;
export const ARRIVAL = { parked: 3.8, doors: 4.05, exit: 4.45, walk: 5.25, shut: 5.9, duration: 10 };
export const SITE_FINISH_SECONDS = 0.7;
export const FAMILIES = [[1, 1, 0.65], [1, 0.65, 0.5], [1, 1, 0.65, 0.5]] as const;
const clamp = (t: number) => Math.max(0, Math.min(1, t));
const ease = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const arrivalTime = (s: HouseState) => s.phase === 'complete' ? ARRIVAL.duration : s.phase === 'decorate' ? s.elapsed : -1;
export const arrivalStep = (t: number) => t < 0 ? 'waiting' : t < ARRIVAL.parked ? 'driving' : t < ARRIVAL.exit ? 'parked' : t < ARRIVAL.walk + 0.3 ? 'unloading' : t < ARRIVAL.duration ? 'walking' : 'home';
export const arrivalDoors = (t: number) => ease((t - ARRIVAL.doors) / 0.4) * (1 - ease((t - ARRIVAL.shut) / 0.4));

export function arrivalCar(t: number) {
  const radius = 1.9, startX = -14, turnX = GARAGE.x - radius, turnZ = 5.1 - radius, parkZ = 0.25;
  const approach = turnX - startX, arc = radius * Math.PI / 2, final = turnZ - parkZ;
  const distance = (approach + arc + final) * ease(t / ARRIVAL.parked);
  const pose = (x: number, z: number, yaw: number) => ({ x, z, yaw, distance, y: -0.085 + (GARAGE.floor + 0.085) * ease((3.8 - z) / 1.75) });
  if (distance <= approach) return pose(startX + distance, 5.1, 0);
  if (distance < approach + arc) {
    const angle = (distance - approach) / radius;
    return pose(turnX + radius * Math.sin(angle), turnZ + radius * Math.cos(angle), angle);
  }
  return pose(GARAGE.x, turnZ - (distance - approach - arc), Math.PI / 2);
}

function along(points: Point[], fraction: number) {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.z - points[i].z));
  let remaining = clamp(fraction) * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const a = points[i], b = points[i + 1], u = clamp(remaining / lengths[i]);
      return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
    }
    remaining -= lengths[i];
  }
  return { ...points[0], yaw: 0 };
}

export function arrivingResident(t: number, index: number) {
  const car = arrivalCar(t), side = index % 2 ? -1 : 1, row = index < 2 ? 0.08 : -0.78;
  const localZ = side * 0.33, c = Math.cos(car.yaw), s = Math.sin(car.yaw);
  const seat = { x: car.x + (row * c + localZ * s) * FAMILY_CAR_SCALE, z: car.z + (-row * s + localZ * c) * FAMILY_CAR_SCALE };
  const out = { x: GARAGE.x + side * 1.22, z: 0.25 - row * FAMILY_CAR_SCALE };
  const end = { x: 1.1 + index * 0.65, z: 2.55 };
  const delay = index * 0.08;
  const exit = ease((t - ARRIVAL.exit - delay) / 0.65);
  const walk = clamp((t - ARRIVAL.walk - delay) / (4.45 - delay));
  if (t < ARRIVAL.walk + delay) return {
    x: seat.x + (out.x - seat.x) * exit, z: seat.z + (out.z - seat.z) * exit,
    y: car.y, yaw: exit > 0 ? side * Math.PI / 2 : car.yaw + Math.PI / 2,
    walking: exit > 0 && exit < 1, seated: exit === 0, home: false,
  };
  const p = along([out, { x: out.x, z: 2.75 }, { x: GARAGE.x + 2.6, z: 2.75 }, end], ease(walk));
  return { ...p, y: GARAGE.floor * (1 - ease(walk)), yaw: walk >= 1 ? 0 : p.yaw, walking: walk > 0 && walk < 1, seated: false, home: walk >= 1 };
}

export function arrivingPet(t: number) {
  const passenger = arrivingResident(t - 0.15, 2);
  // Follow the child's route through the open garage entrance, then settle
  // beside the family. The pet stays in the car until the doors open.
  const settle = ease((t - 9.35) / 0.65);
  return { ...passenger, x: passenger.x + (3.7 - passenger.x) * settle, z: passenger.z + (2.65 - passenger.z) * settle, home: t >= ARRIVAL.duration };
}

export function garageBuild(s: HouseState) {
  // Each addition belongs to a vehicle handoff, never to active pouring or a
  // crane placement. The next vehicle waits until the addition is complete.
  const step = ({ gravel: 0, concrete: 1, 'delivery-one': 2, 'crane-one': 2,
    'delivery-two': 3, 'crane-two': 3, 'roof-color': 3, decorate: 4, complete: 4 })[s.phase];
  const amount = s.action === 'finishing' ? ease(s.elapsed / SITE_FINISH_SECONDS) : 0;
  const finished = (index: number) => step > index ? 1 : step === index ? amount : 0;
  return { gravel: finished(0), slab: finished(1), walls: [finished(2), finished(2)], roof: finished(3) };
}
