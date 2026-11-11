import assert from 'node:assert/strict';
import test from 'node:test';
import type { VoicePlan } from '../runtime/voice-script.ts';
import { voicePlan as house } from './house-build/domain/narration.ts';
import { createHouse, stages as houseStages } from './house-build/domain/house.ts';
import { voicePlan as road } from './road-repair/domain/narration.ts';
import { createRoad, advanceRoad, stages as roadStages } from './road-repair/domain/road.ts';

function coverage<S extends { phase: string }, Id extends string>(plan: VoicePlan<S, Id>, states: S[], phases: readonly string[], manual: (s: S) => boolean) {
  test(`${plan.mission}: every phase and configuration has an explicit narration policy`, () => {
    assert.deepEqual(Object.keys(plan.cues).sort(), [...new Set(phases)].sort());
    for (const s of states) {
      const id = plan.instruction(s);
      if (manual(s) || s.phase === 'complete') assert.ok(id, `${s.phase}: missing instruction`);
      if (id) { assert.ok(plan.cues[s.phase].includes(id), `${s.phase}/${id}: cue not hashed`); assert.ok(plan.lines[id]); }
      assert.equal(plan.feedback(s, structuredClone(s)), undefined, `${s.phase}: restored snapshots cannot synthesize success`);
    }
  });
}

coverage(road, roadStages.map(p => advanceRoad(createRoad(p), 4)), roadStages.filter(p => p !== 'roller-return'), s => !['traffic', 'complete'].includes(s.phase));

test('road keyboard selection and carrying choose the corresponding action without changing saved state', () => {
  const s = advanceRoad(createRoad(), 4);
  assert.equal(road.instruction(s), 'dig');
  assert.equal(road.instruction({ ...s, bucketSelected: true }), 'tap-dig');
  assert.equal(road.interacting({ ...s, bucketSelected: true }), true, 'keyboard/tap selection also interrupts an old announcement');
  const carry = { ...s, excavator: { ...s.excavator, action: 'carrying' as const, carried: 0 } };
  assert.equal(road.instruction(carry), 'drop');
  assert.equal(road.instruction({ ...carry, bucketSelected: true }), 'tap-drop');
  const dumping = { ...carry, excavator: { ...carry.excavator, action: 'unloading' as const, elapsed: 0.89 } };
  assert.equal(road.feedback(dumping, advanceRoad(dumping, 0.1)), 'loaded');
  assert.equal('bucketSelected' in s, false);
});

coverage(house, houseStages.map(p => ({ ...createHouse(p), action: 'ready' as const })), houseStages, s => !['roof-color', 'decorate', 'complete'].includes(s.phase));

test('house crane prompts distinguish pickup and placement; pickup alone is not installation', () => {
  const state = { ...createHouse('crane-one'), action: 'ready' as const };
  assert.equal(house.instruction({ ...state, attached: false }), 'pickup');
  assert.equal(house.instruction({ ...state, attached: true }), 'place');
  assert.equal(house.feedback(state, { ...state, attached: true }), undefined);
  assert.equal(house.feedback(state, { ...state, placed: state.placed + 1 }), 'placed');
});
