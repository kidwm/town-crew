import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, createHouse, grab, release, dragGravel, moveChute, drive, moveLoad, resumeHouse, progress, PARTS, HOUSE, POUR_TARGETS, DELIVERY_STOP, DELIVERY_START } from './house.ts';
import type { HouseState } from './house.ts';
import { DEFAULT_ROUND, ROOF_TYPES } from './round.ts';
import { ARRIVAL, SITE_FINISH_SECONDS, arrivalStep, arrivalTime } from './arrival.ts';
function tick(s: HouseState, seconds = 2) { for (let i = 0; i < Math.ceil(seconds * 60); i++) s = advance(s, 1 / 60); return s; }

const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
for (const roof of ROOF_TYPES) for (const layout of [0, 1] as const) for (const order of orders)
test(`${roof}/${layout}: four vehicles and six lifts complete after pouring ${order}`, () => {
  const round = { ...DEFAULT_ROUND, roof, layout };
  let s = tick(createHouse('gravel', round));
  s = tick(dragGravel(grab(s), 75), 4 + SITE_FINISH_SECONDS); assert.equal(s.phase, 'concrete');
  s = tick(s);
  for (const i of order) {
    s = tick(moveChute(grab(s), POUR_TARGETS[i]), 1.3);
    s = resumeHouse(s)!; assert.ok(s); assert.equal(s.pours[i], 1); assert.deepEqual(s.round, round);
  }
  s = tick(s, 4); assert.equal(s.phase, 'delivery-one');
  for (let batch = 0; batch < 2; batch++) {
    s = tick(s); s = tick(drive(grab(s), DELIVERY_STOP), 2);
    for (let i = 0; i < 3; i++) {
      s = tick(s); assert.equal(s.action, 'ready');
      s = tick(release(moveLoad(grab(s), HOUSE)), 1.3);
      assert.equal(s.placed, batch * 3 + i + 1);
    }
    s = tick(s, 4);
  }
  assert.equal(s.phase, 'decorate');
  s = tick(s, ARRIVAL.duration);
  assert.equal(s.phase, 'complete'); assert.equal(s.color, 0); assert.equal(progress(s), 1);
});
test('the fifth placement picks up the roof automatically and preserves its matched colour through reload', () => {
  let s = tick(createHouse('crane-two', { ...DEFAULT_ROUND, palette: 2 }));
  for (let i = 0; i < 2; i++) s = tick(release(moveLoad(grab(s), HOUSE)), 3);
  assert.equal(s.phase, 'crane-two'); assert.equal(s.placed, 5); assert.equal(s.action, 'ready');
  s = tick(resumeHouse(s)!);
  assert.equal(s.phase, 'crane-two'); assert.equal(s.placed, 5); assert.equal(s.color, 2);
  s = tick(release(moveLoad(grab(s), HOUSE)), 4 + SITE_FINISH_SECONDS + ARRIVAL.duration);
  assert.equal(s.phase, 'complete'); assert.equal(s.placed, 6); assert.equal(s.color, 2);
});
test('parking and walking finish without input after the crane leaves, including old doorbell saves', () => {
  let s = tick({ ...createHouse('roof-color'), color: 1 });
  s = tick(release(moveLoad(grab(s), HOUSE)), 1.3);
  assert.equal(s.placed, 6); assert.equal(s.action, 'leaving');
  s = tick(s, 2);
  assert.equal(s.phase, 'crane-two'); assert.ok(progress(s) < 1);
  s = tick(resumeHouse(s)!, 1);
  assert.equal(s.phase, 'crane-two'); assert.equal(s.action, 'finishing'); assert.equal(arrivalStep(arrivalTime(s)), 'waiting');
  s = tick(resumeHouse(s)!, SITE_FINISH_SECONDS);
  assert.equal(s.phase, 'decorate'); assert.equal(arrivalStep(arrivalTime(s)), 'driving'); assert.ok(progress(s) < 1);
  s = tick(s, ARRIVAL.duration);
  assert.equal(s.phase, 'complete'); assert.equal(s.color, 1); assert.equal(progress(s), 1);
  assert.deepEqual(tick(s), s);
  for (const version of [1, 2, 3]) {
    const restored = resumeHouse({ ...createHouse('decorate'), version, color: 2, elapsed: 42 })!;
    assert.equal(restored.elapsed, 0);
    assert.equal(advance(restored, 0).phase, 'decorate');
    const complete = tick(restored, ARRIVAL.duration + 0.1);
    assert.equal(complete.phase, 'complete'); assert.equal(complete.color, 2);
    assert.equal(complete.placed, 6); assert.equal(progress(complete), 1);
  }
});
test('old colour-selection saves continue automatically with their existing colour', () => {
  const legacy = { ...createHouse('crane-two'), version: 1, placed: 5, action: 'ready', color: 1 };
  const restored = resumeHouse(legacy)!;
  assert.equal(restored.version, 5); assert.equal(restored.phase, 'roof-color'); assert.equal(restored.color, 1);
  const ready = tick(restored); assert.equal(ready.phase, 'crane-two'); assert.equal(ready.placed, 5); assert.equal(ready.color, 1);
  for (const version of [1, 2]) {
    const legacyChoice = { ...createHouse('roof-color'), version, color: 2 };
    const pickedUp = tick(resumeHouse(legacyChoice)!);
    assert.equal(pickedUp.phase, 'crane-two'); assert.equal(pickedUp.action, 'ready'); assert.equal(pickedUp.color, 2);
  }
  const complete = resumeHouse({ ...createHouse('complete'), version: 1, color: 2 })!;
  assert.equal(complete.phase, 'complete'); assert.equal(complete.color, 2);
  assert.equal(resumeHouse({ ...createHouse('roof-color'), placed: 6 }), undefined);
  assert.equal(resumeHouse({ ...createHouse('roof-color'), action: 'dragging' }), undefined);
});
test('short or cancelled tipping does not fill gravel', () => {
  let s = tick(createHouse());
  s = release(dragGravel(grab(s), 25), true); s = tick(s, 3);
  assert.equal(s.gravel, 0); assert.equal(s.phase, 'gravel'); assert.equal(s.dragPx, 0);
});
test('concrete can switch between unfinished regions, retaining each partial fill after cancellation and reload', () => {
  let s = tick(createHouse('concrete'));
  s = tick(moveChute(grab(s), POUR_TARGETS[2]), 0.4); assert.ok(s.pours[2] > 0 && s.pours[2] < 1);
  s = tick(moveChute(s, POUR_TARGETS[0]), 0.4); assert.ok(s.pours[0] > 0 && s.pours[0] < 1);
  const partial = [...s.pours]; s = tick(resumeHouse(release(s, true))!, 3); assert.deepEqual(s.pours, partial);
  s = tick(moveChute(grab(s), POUR_TARGETS[1]), 1.3); assert.equal(s.pours[1], 1);
  assert.equal(s.phase, 'concrete'); assert.equal(s.pours[0], partial[0]); assert.equal(s.pours[2], partial[2]);
  s = tick(moveChute(s, POUR_TARGETS[1]), 2); assert.equal(s.phase, 'concrete'); // A filled zone cannot complete the others.
  s = tick(moveChute(s, POUR_TARGETS[2]), 1); s = tick(moveChute(s, POUR_TARGETS[0]), 1);
  assert.deepEqual(s.pours, [1, 1, 1]); assert.equal(s.action, 'working');
});
test('transport can pause and never unloads before it reaches the parking position', () => {
  let s = tick(createHouse('delivery-one'));
  s = tick(release(drive(grab(s), -2)), 3); assert.equal(s.truckX, -2); assert.equal(s.phase, 'delivery-one');
  s = drive(grab(s), -999); assert.equal(s.truckX, DELIVERY_START);
  s = tick(drive(s, 999)); assert.equal(s.phase, 'crane-one'); assert.equal(s.placed, 0);
});
test('missed and cancelled crane placement reset gently without attaching a part', () => {
  const ready = tick(createHouse('crane-one'));
  for (const [point, cancelled] of [[{ x: -1, z: 2 }, false], [HOUSE, true]] as const) {
    const next = tick(release(moveLoad(grab(ready), point), cancelled));
    assert.equal(next.placed, 0); assert.equal(next.action, 'ready'); assert.equal(next.load.x, -3.1);
  }
  const placed = tick(release(moveLoad(grab(ready), { x: HOUSE.x + 0.6, z: HOUSE.z })), 1.3);
  assert.equal(placed.placed, 1);
});
test('an off-centre grip can install from the highlighted target, while cancellation still resets', () => {
  const dragged = moveLoad(grab(tick(createHouse('crane-one'))), { x: HOUSE.x, z: HOUSE.z - 1.6 });
  const placing = release(dragged, false, true);
  assert.equal(placing.action, 'placing');
  assert.deepEqual(placing.from, dragged.load);
  assert.deepEqual(placing.load, dragged.load);
  assert.equal(tick(placing, 1.3).placed, 1);
  const cancelled = tick(release(dragged, true, true));
  assert.equal(cancelled.action, 'ready');
  assert.equal(cancelled.placed, 0);
  assert.equal(release(moveLoad(dragged, HOUSE), false, false).action, 'resetting');
});
test('all transported parts clear the already built structure before automatic lowering', () => {
  for (let i = 0; i < PARTS.length; i++) {
    const previousTop = Math.max(0.35, ...PARTS.slice(0, i).map(p => p.base + p.height));
    assert.ok(PARTS[i].lift > previousTop + 0.2, PARTS[i].name);
  }
});
test('snapshots recover dragging, reject malformed values and preserve completed work', () => {
  let s = tick(createHouse('crane-two')); s = moveLoad(grab(s), HOUSE);
  const restored = resumeHouse(JSON.parse(JSON.stringify(s)))!;
  assert.equal(restored.action, 'resetting'); assert.equal(restored.placed, 3);
  assert.equal(resumeHouse({ ...s, placed: 99 }), undefined);
  assert.equal(resumeHouse({ ...s, placed: 6, action: 'ready' }), undefined);
  assert.equal(resumeHouse({ ...s, pours: [1, NaN, 0] }), undefined);
  assert.equal(resumeHouse({ version: 0 }), undefined);
  assert.equal(resumeHouse(null), undefined);
  assert.equal(resumeHouse({ ...createHouse('complete'), gravel: 0 }), undefined);
  assert.equal(resumeHouse({ ...createHouse('crane-one'), action: 'leaving' }), undefined);
  assert.equal(resumeHouse({ ...createHouse('concrete'), version: 2, pours: [0, 1, 0] }), undefined);
  assert.deepEqual(resumeHouse({ ...createHouse('concrete'), pours: [0, 1, 0] })!.pours, [0, 1, 0]);
  assert.equal(resumeHouse(createHouse('complete'))!.placed, 6);
});
