import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dragHintCycleLength } from '../../../runtime/drag-hint.ts';
import { advanceBikeHint, choosingBike, createBikeHintClock } from './choice-hint.ts';
import { advance, available, createPolice, drive, grab, release, resumePolice } from './police.ts';

const cycles = { bike0: dragHintCycleLength({}), bike1: dragHintCycleLength({ via: [{ x: 0, y: 0 }] }) };
test('each choice gets a full straight or bent demonstration, with mirrored opening order and no gameplay changes', () => {
  for (const layout of [0, 1]) {
    const state = createPolice('guard', { layout, color: 0, traffic: 'taxi-first' }), saved = structuredClone(state);
    let clock = advanceBikeHint(createBikeHintClock(layout), state, 0, cycles, false);
    assert.equal(clock.bike, layout ? 'bike1' : 'bike0');
    for (let n = 0; n < 4; n++) {
      const first: keyof typeof cycles = clock.bike;
      clock = advanceBikeHint(clock, state, cycles[first] - .01, cycles, false);
      assert.equal(clock.bike, first, 'must finish the endpoint dwell and fade');
      clock = advanceBikeHint(clock, state, .02, cycles, false);
      assert.notEqual(clock.bike, first); assert.equal(clock.elapsed, 0);
      assert.deepEqual(available(state), ['bike0', 'bike1']); assert.deepEqual(state, saved);
    }
  }
});
test('grabbing either bike stops rotation; a zero-progress cancellation restarts that bike, partial work never reopens choice', () => {
  const initial = createPolice('guard');
  for (const bike of ['bike0', 'bike1'] as const) {
    let clock = createBikeHintClock(0, bike), state = grab(initial, bike);
    clock = advanceBikeHint(clock, state, 10, cycles, false);
    assert.equal(clock.running, false); assert.equal(choosingBike(state), false);
    state = release(state); assert.equal(choosingBike(state), true);
    clock = advanceBikeHint(clock, state, 10, cycles, false);
    assert.equal(clock.bike, bike); assert.equal(clock.elapsed, 0);
    state = drive(grab(state, bike), .4);
    for (let n = 0; n < 40; n++) state = advance(state, .05);
    state = resumePolice(release(state))!;
    assert.ok(state.work.guard > 0); assert.equal(state.selected, bike);
    clock = advanceBikeHint(clock, state, 10, cycles, false);
    assert.equal(clock.running, false); assert.deepEqual(available(state), [bike]);
  }
  assert.equal(choosingBike(createPolice('bikes-arrival')), false);
  assert.equal(choosingBike(createPolice('inspect')), false);
});
test('reduced motion and a hidden-frame zero delta cannot rotate; restart always grants a full demonstration', () => {
  const state = createPolice('guard');
  let clock = advanceBikeHint(createBikeHintClock(0), state, 0, cycles, false);
  clock = advanceBikeHint(clock, state, 2, cycles, false);
  assert.equal(advanceBikeHint(clock, state, 0, cycles, false), clock);
  clock = advanceBikeHint(clock, state, 100, cycles, true);
  const still = clock;
  assert.equal(advanceBikeHint(clock, state, 100, cycles, true), still);
  clock = advanceBikeHint(clock, state, 100, cycles, false);
  assert.equal(clock.elapsed, 0); assert.equal(clock.bike, 'bike0');
  // Resizing/re-entering restarts the current bike instead of cutting its next route short.
  clock = advanceBikeHint(createBikeHintClock(0, 'bike1'), state, 100, cycles, false);
  assert.equal(clock.elapsed, 0); assert.equal(clock.bike, 'bike1');
});
