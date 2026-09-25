export const HAUL_START = 1.8;
export const HAUL_EXIT = -3.8;
export const HAUL_OFFSCREEN = -13;
export const HAUL_Z = -2;
export const HAUL_SCALE = 0.72;
export const HAUL_DURATION = 1.3;
export function cargoLocal(index: number) {
  return { x: -0.05 + (index - 1) * 0.46, y: 1.72 + index * 0.1, z: index % 2 ? 0.22 : -0.18 };
}
export function cargoLanding(index: number) {
  const p = cargoLocal(index);
  return { x: HAUL_START + p.x * HAUL_SCALE, y: p.y * HAUL_SCALE, z: HAUL_Z + p.z * HAUL_SCALE };
}
