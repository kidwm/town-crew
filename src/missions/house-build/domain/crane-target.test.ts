import { test } from 'node:test';
import assert from 'node:assert/strict';
import { craneTargetReached, convexOutline, advanceCraneSettle, CRANE_TARGET_RADIUS, CRANE_TARGET_PADDING, CRANE_SETTLE_SECONDS } from './crane-target.ts';

const away = { x: -100, y: 400 };
const assembly = convexOutline([{ x: 100, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 300 }, { x: 100, y: 300 }, { x: 200, y: 250 }]);
const target = { assembly, raised: { x: 200, y: 100 } };

test('the final assembly accepts its base, visible part and nearby fingers or material anchors', () => {
  assert.equal(assembly.length, 4);
  for (const point of [{ x: 200, y: 300 }, { x: 250, y: 230 }, { x: 100 - CRANE_TARGET_PADDING, y: 250 }]) {
    assert.equal(craneTargetReached(point, away, target, away), true);
    assert.equal(craneTargetReached({ x: -80, y: 400 }, point, target, away), true);
  }
  assert.equal(craneTargetReached({ x: 99 - CRANE_TARGET_PADDING, y: 250 }, away, target, away), false);
  assert.equal(craneTargetReached({ x: 400, y: 400 }, away, target, away), false);
});
test('the elevated position still works, but taps and tiny movements cannot install overlapping loads', () => {
  for (const [x, y] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const edge = { x: target.raised.x + x * CRANE_TARGET_RADIUS, y: target.raised.y + y * CRANE_TARGET_RADIUS };
    assert.equal(craneTargetReached(edge, away, target, away), true);
    assert.equal(craneTargetReached({ x: edge.x + x, y: edge.y + y }, away, target, away), false);
  }
  const inside = { x: 200, y: 250 };
  assert.equal(craneTargetReached(inside, inside, target, inside), false);
  assert.equal(craneTargetReached({ x: 217, y: 250 }, inside, target, inside), false);
  assert.equal(craneTargetReached({ x: 218, y: 250 }, inside, target, inside), true);
  assert.equal(craneTargetReached({ x: NaN, y: 250 }, inside, target, away), false);
});
test('a projected sloping edge accepts its corners without accepting the empty bounding-box corner', () => {
  const diamond = { assembly: convexOutline([{ x: 200, y: 200 }, { x: 400, y: 300 }, { x: 200, y: 400 }, { x: 0, y: 300 }]), raised: target.raised };
  assert.equal(craneTargetReached({ x: 200, y: 400 }, away, diamond, away), true);
  assert.equal(craneTargetReached({ x: 400, y: 400 }, away, diamond, away), false);
});
test('automatic placement requires a continuous short dwell; leaving or a stalled frame cannot complete it', () => {
  let dwell = 0;
  for (let i = 0; i < 3; i++) dwell = advanceCraneSettle(dwell, 0.1, true);
  assert.ok(dwell < CRANE_SETTLE_SECONDS);
  dwell = advanceCraneSettle(dwell, 0.1, false);
  assert.equal(dwell, 0);
  assert.equal(advanceCraneSettle(dwell, 10, true), 0.1);
  assert.equal(advanceCraneSettle(dwell, 0, true), 0);
  assert.equal(advanceCraneSettle(dwell, NaN, true), 0);
  for (let i = 0; i < 4; i++) dwell = advanceCraneSettle(dwell, 0.1, true);
  assert.equal(dwell, CRANE_SETTLE_SECONDS);
});
