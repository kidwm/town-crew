interface Point { x: number; y: number }
export interface RailGesture { value: number; origin: Point; vector: Point; activation: number }
/** Keep the physical endpoint reachable after a partial drag, including on small screens. */
export function createGesture(task: { value: number; from: Point; to: Point }, origin: Point): RailGesture {
  const x = task.to.x - task.from.x, y = task.to.y - task.from.y;
  const remaining = Math.hypot(x, y), fraction = Math.max(1e-6, 1 - task.value);
  return { value: task.value, origin, vector: { x: x / fraction, y: y / fraction }, activation: task.value === 0 ? 8 : Math.min(8, Math.max(0.5, remaining / 4)) };
}
export function gestureValue(held: RailGesture, point: Point, moved: boolean): number | undefined {
  const dx = point.x - held.origin.x, dy = point.y - held.origin.y;
  if (!moved && Math.hypot(dx, dy) < held.activation) return;
  const v = held.vector, length = v.x * v.x + v.y * v.y;
  if (length > 1e-8) return held.value + (dx * v.x + dy * v.y) / length;
}
