import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, createHouse, grab, release, dragGravel, moveChute, drive, moveLoad, chooseColor, startRoofLift, resumeHouse, progress, PARTS, HOUSE, POUR_TARGETS, DELIVERY_STOP, DELIVERY_START } from './house.ts';
import type { HouseState } from './house.ts';
function tick(s: HouseState, seconds = 2) { for (let i = 0; i < Math.ceil(seconds * 60); i++) s = advance(s, 1 / 60); return s; }

test('four vehicles, two deliveries and six lifts produce a decorated two-storey home', () => {
  let s = tick(createHouse());
  s = tick(dragGravel(grab(s), 75), 4); assert.equal(s.phase, 'concrete');
  s = tick(s);
  for (const target of POUR_TARGETS) s = tick(moveChute(s.action === 'ready' ? grab(s) : s, target), 1.3);
  s = tick(s, 4); assert.equal(s.phase, 'delivery-one');
  for (let batch = 0; batch < 2; batch++) {
    s = tick(s); s = tick(drive(grab(s), DELIVERY_STOP), 2);
    for (let i = 0; i < 3; i++) {
      if (s.phase === 'roof-color') s = startRoofLift(chooseColor(s, 2));
      s = tick(s); assert.equal(s.action, 'ready');
      s = tick(release(moveLoad(grab(s), HOUSE)), 1.3);
      assert.equal(s.placed, batch * 3 + i + 1);
    }
    s = tick(s, 4);
  }
  assert.equal(s.phase, 'complete'); assert.equal(s.color, 2); assert.equal(progress(s), 1);
});
test('the roof waits for a colour choice before pickup and keeps that colour through reload and installation', () => {
  let s = tick(createHouse('crane-two'));
  for (let i = 0; i < 2; i++) s = tick(release(moveLoad(grab(s), HOUSE)), 3);
  assert.equal(s.phase, 'roof-color'); assert.equal(s.placed, 5);
  assert.deepEqual(tick(s, 10), s);
  assert.deepEqual(grab(s), s);
  assert.deepEqual(chooseColor(s, -1), s); assert.deepEqual(chooseColor(s, 3), s);
  s = resumeHouse(chooseColor(s, 2))!;
  assert.equal(s.phase, 'roof-color'); assert.equal(s.color, 2);
  s = startRoofLift(s); assert.equal(s.action, 'pickup'); assert.equal(s.color, 2);
  s = tick(resumeHouse(s)!);
  assert.equal(s.phase, 'crane-two'); assert.equal(s.placed, 5);
  s = tick(release(moveLoad(grab(s), HOUSE)), 4);
  assert.equal(s.phase, 'complete'); assert.equal(s.placed, 6); assert.equal(s.color, 2);
  assert.deepEqual(chooseColor(s, 0), s);
});
test('welcome completes without input only after the crane leaves, including restored doorbell saves', () => {
  let s = tick(startRoofLift(chooseColor(createHouse('roof-color'), 1)));
  s = tick(release(moveLoad(grab(s), HOUSE)), 1.3);
  assert.equal(s.placed, 6); assert.equal(s.action, 'leaving');
  s = tick(s, 2);
  assert.equal(s.phase, 'crane-two'); assert.ok(progress(s) < 1);
  s = tick(resumeHouse(s)!, 1);
  assert.equal(s.phase, 'complete'); assert.equal(s.color, 1); assert.equal(progress(s), 1);
  assert.deepEqual(tick(s), s);
  for (const version of [1, 2]) {
    const restored = resumeHouse({ ...createHouse('decorate'), version, color: 2 })!;
    assert.equal(advance(restored, 0).phase, 'decorate');
    const complete = tick(restored);
    assert.equal(complete.phase, 'complete'); assert.equal(complete.color, 2);
    assert.equal(complete.placed, 6); assert.equal(progress(complete), 1);
  }
});
test('old saves preserve completed homes and bring unfinished roofs back to colour selection', () => {
  const legacy = { ...createHouse('crane-two'), version: 1, placed: 5, action: 'ready', color: 1 };
  const restored = resumeHouse(legacy)!;
  assert.equal(restored.version, 2); assert.equal(restored.phase, 'roof-color'); assert.equal(restored.color, 1);
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
test('concrete fills only the current broad target, with partial work retained after cancellation', () => {
  let s = tick(createHouse('concrete'));
  s = tick(moveChute(grab(s), POUR_TARGETS[2]), 2); assert.deepEqual(s.pours, [0, 0, 0]);
  s = tick(moveChute(s, POUR_TARGETS[0]), 0.4); assert.ok(s.pours[0] > 0 && s.pours[0] < 1);
  const partial = s.pours[0]; s = tick(release(s, true), 3); assert.equal(s.pours[0], partial);
  s = tick(moveChute(grab(s), POUR_TARGETS[0]), 1); assert.equal(s.pours[0], 1);
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
  assert.equal(resumeHouse({ ...createHouse('concrete'), pours: [0, 1, 0] }), undefined);
  assert.equal(resumeHouse(createHouse('complete'))!.placed, 6);
});
