import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, createState, defaultTuning as tuning, input, pose } from './dump-truck.ts';

test('bed follows the finger, and only crossing the threshold starts dumping', () => {
  let state = input(createState('ready'), { type: 'grab' }, tuning);
  state = input(state, { type: 'drag', upwardPx: 30 }, tuning);
  assert.equal(state.phase, 'dragging');
  assert.equal(pose(state, tuning).tilt, 0.31);
  state = input(state, { type: 'drag', upwardPx: 59 }, tuning);
  assert.equal(state.phase, 'dragging');
  state = input(state, { type: 'drag', upwardPx: 60 }, tuning);
  assert.equal(state.phase, 'dumping');
  assert.equal(pose(state, tuning).tilt, tuning.dragTilt);
});

test('a tap gives feedback but cannot complete the task', () => {
  const grabbed = input(createState('ready'), { type: 'grab' }, tuning);
  const released = input(grabbed, { type: 'release' }, tuning);
  assert.equal(pose(released, tuning).tilt, 0.14);
  assert.equal(advance(released, 3, tuning).phase, 'ready');
  assert.equal(pose(advance(released, 3, tuning), tuning).fill, 0);
});

test('cancel and early release both restore the bed without advancing', () => {
  for (const type of ['cancel', 'release'] as const) {
    let state = input(createState('ready'), { type: 'grab' }, tuning);
    state = input(state, { type: 'drag', upwardPx: 40 }, tuning);
    state = input(state, { type }, tuning);
    state = advance(state, 0.3, tuning);
    assert.equal(state.phase, 'ready');
    assert.equal(pose(state, tuning).tilt, 0);
    assert.equal(pose(state, tuning).fill, 0);
  }
});

test('downward drag and input during automatic animation cannot advance the mission', () => {
  const grabbed = input(createState('ready'), { type: 'grab' }, tuning);
  assert.equal(pose(input(grabbed, { type: 'drag', upwardPx: -100 }, tuning), tuning).tilt, 0);
  const entering = createState();
  assert.deepEqual(input(entering, { type: 'grab' }, tuning), entering);
});

test('automatic sequence fills the road and returns the bed, independent of frame size', () => {
  let state = input(createState('ready'), { type: 'grab' }, tuning);
  state = input(state, { type: 'drag', upwardPx: 60 }, tuning);
  const oneFrame = advance(state, 3, tuning);
  for (let i = 0; i < 180; i++) state = advance(state, 1 / 60, tuning);
  assert.deepEqual(state, oneFrame);
  assert.equal(state.phase, 'complete');
  assert.equal(pose(state, tuning).fill, 1);
  assert.equal(pose(state, tuning).tilt, 0);
  assert.equal(pose(createState(), tuning).fill, 0);
});
