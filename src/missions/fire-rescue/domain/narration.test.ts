import assert from 'node:assert/strict';
import test from 'node:test';
import { advance, createFire, stages } from './fire.ts';
import { fireLines, fireInstructionId, fireStageVoice, fireTransitionVoice, fireVoiceSource } from './narration.ts';

test('every fire stage has a recorded instruction and exact cue provenance', () => {
  for (const stage of stages) {
    const id = fireStageVoice[stage];
    assert.ok(fireLines[id]); assert.ok(fireVoiceSource(id).cues.includes(stage));
  }
});
test('rescue hints name only the remaining passenger after either rescue order or resume', () => {
  const state = createFire('rescue');
  assert.equal(fireInstructionId(state), 'rescue-choice');
  assert.equal(fireInstructionId({ ...state, rescued: [true, false] }), 'rescue-cat');
  assert.equal(fireInstructionId({ ...state, rescued: [false, true] }), 'rescue-resident');
});

test('success cues are bound into source hashes and only fire at completed transitions', () => {
  assert.deepEqual(fireVoiceSource('fire-out').cues, ['groundFiresExtinguished', 'roofFireExtinguished']);
  assert.deepEqual(fireVoiceSource('picked-up').cues, ['passengerBoarded']);
  const partial = { ...createFire('ground-fire'), action: 'dragging' as const, wet: 0, fires: [0.01, 1, 1, 1] };
  assert.equal(fireTransitionVoice(partial, advance(partial, 0.1)), undefined, 'one fire is not the whole group');
  for (const phase of ['ground-fire', 'roof-fire'] as const) {
    const before = { ...createFire(phase), action: 'dragging' as const, wet: phase === 'ground-fire' ? 2 : 3,
      fires: phase === 'ground-fire' ? [0, 0, 0.01, 1] : [0, 0, 0, 0.01] };
    const after = advance(before, 0.1);
    assert.equal(fireTransitionVoice(before, after), 'fire-out');
    assert.equal(fireTransitionVoice(after, advance(after, 0.1)), undefined);
  }
  assert.equal(fireTransitionVoice(createFire('rescue'), { ...createFire('rescue'), action: 'returning' }), undefined, 'an empty basket is not a pickup');
});
