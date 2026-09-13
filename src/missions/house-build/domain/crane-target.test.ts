import { test } from 'node:test';
import assert from 'node:assert/strict';
import { craneTargetReached, CRANE_TARGET_RADIUS } from './crane-target.ts';

test('the visible circle accepts either the finger or the material anchor', () => {
  const target = { x: 200, y: 100 }, away = { x: 100, y: 200 };
  assert.equal(craneTargetReached(target, away, target), true);
  assert.equal(craneTargetReached(away, target, target), true);
  assert.equal(craneTargetReached(away, away, target), false);
  for (const [x, y] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const edge = { x: target.x + x * CRANE_TARGET_RADIUS, y: target.y + y * CRANE_TARGET_RADIUS };
    const outside = { x: edge.x + x, y: edge.y + y };
    assert.equal(craneTargetReached(edge, away, target), true);
    assert.equal(craneTargetReached(outside, away, target), false);
  }
  assert.equal(craneTargetReached({ x: NaN, y: 100 }, away, target), false);
});
