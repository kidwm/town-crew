/** The road-repair car's pace: 20 world units in three seconds, easing at both ends. */
export const passingDuration = (from: number, to: number) => Math.abs(to - from) * 3 / 20;

export function passingCarX(elapsed: number, from: number, to: number) {
  const t = Math.max(0, Math.min(1, elapsed / passingDuration(from, to)));
  return from + (to - from) * t * t * (3 - 2 * t);
}
