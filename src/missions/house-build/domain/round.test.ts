import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseRound, DEFAULT_ROUND, ROOF_TYPES, siteX, validRound } from './round.ts';
import { createHouse, resumeHouse, stages, partFor, PARTS } from './house.ts';

test('successive houses change roof, layout and palette even with a constant random source', () => {
  for (const sample of [0, 0.4, 0.75, 0.999]) {
    let previous = { ...DEFAULT_ROUND };
    for (let i = 0; i < 30; i++) {
      const next = chooseRound(previous, () => sample);
      assert.ok(validRound(next)); assert.notEqual(next.roof, previous.roof);
      assert.notEqual(next.layout, previous.layout); assert.notEqual(next.palette, previous.palette);
      previous = next;
    }
  }
  assert.equal(new Set([0, 0.4, 0.99].map(sample => chooseRound(undefined, () => sample).roof)).size, 3);
  assert.deepEqual([0, 0.6, 0.99].map(sample => chooseRound(undefined, () => sample).pet), ['none', 'cat', 'dog']);
});
test('every roof/layout preserves its round, player colour and work across snapshot restoration', () => {
  for (const roof of ROOF_TYPES) for (const layout of [0, 1] as const) for (const phase of stages) {
    const round = { ...DEFAULT_ROUND, roof, layout, palette: 3, family: 2 as const, pet: 'dog' as const };
    const state = createHouse(phase, round); state.color = 2;
    assert.deepEqual(resumeHouse(JSON.parse(JSON.stringify(state))), state);
    const roofPart = partFor(round, 5);
    assert.ok(roofPart.lift > PARTS[4].base + PARTS[4].height + 0.2);
    for (const x of [-21, -6, -3.1, 0.5, 2, 15]) assert.equal(siteX(round, siteX(round, x)), x);
  }
});
test('legacy saves keep the original home and partial work; invalid round fields are rejected', () => {
  const legacy = { ...createHouse('concrete'), version: 2, pours: [1, 0.4, 0], color: 2 };
  delete (legacy as { round?: unknown }).round;
  const restored = resumeHouse(legacy)!;
  assert.deepEqual(restored.round, DEFAULT_ROUND); assert.deepEqual(restored.pours, legacy.pours); assert.equal(restored.color, 2);
  for (const field of [{ roof: 'unknown' }, { layout: 2 }, { palette: NaN }, { family: -1 }, { pet: 'lion' }]) {
    assert.equal(resumeHouse({ ...createHouse(), round: { ...DEFAULT_ROUND, ...field } }), undefined);
  }
  assert.equal(resumeHouse({ ...createHouse(), round: null }), undefined);
});
