import test from 'node:test';
import assert from 'node:assert/strict';
import { createGesture, gestureValue } from './gesture.ts';

test('an initial touch keeps the eight pixel activation threshold', () => {
  const g = createGesture({ value: 0, from: { x: 20, y: 50 }, to: { x: 100, y: 50 } }, { x: 25, y: 55 });
  assert.equal(gestureValue(g, { x: 32, y: 55 }, false), undefined);
  assert.equal(gestureValue(g, { x: 105, y: 55 }, false), 1);
});
test('the actual endpoint remains reachable with less than eight pixels left in either direction', () => {
  for (const direction of [-1, 1]) for (const value of [0.75, 0.99, 0.999]) {
    const remaining = (1 - value) * 20 * direction;
    const g = createGesture({ value, from: { x: 100, y: 80 }, to: { x: 100 + remaining, y: 80 } }, { x: 103, y: 82 });
    // Overshoot by half a pixel at subpixel distances, as real pointer coordinates may round.
    assert.ok(gestureValue(g, { x: 103 + remaining + direction * 0.5, y: 82 }, false)! >= 1);
    assert.equal(gestureValue(g, { x: 103, y: 82 }, false), undefined);
  }
});
test('a completed interrupted task has no vector and uses the domain release rule', () => {
  const g = createGesture({ value: 1, from: { x: 20, y: 50 }, to: { x: 20, y: 50 } }, { x: 20, y: 50 });
  assert.equal(gestureValue(g, { x: 30, y: 50 }, false), undefined);
});
