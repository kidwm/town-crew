import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFire, stages, advance, grab, drive, moveHandle, spray, accept, release, goals, resumeFire, progress, ENGINE_STOP, STREET_STOP, FIRES, HYDRANT, RESCUES, BASKET_HOME, AMBULANCE_REAR } from './fire.ts';
import type { FireState, RescueId } from './fire.ts';
const tick = (state: FireState, seconds = 2) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) state = advance(state, 1 / 60); return state; };

for (const order of [['resident', 'cat'], ['cat', 'resident']] as RescueId[][]) {
  test(`the full fire response rescues ${order.join(' then ')} and transports the resident`, () => {
    let s = tick(createFire());
    s = tick(drive(grab(s), ENGINE_STOP)); assert.equal(s.phase, 'hose');
    s = tick(accept(moveHandle(grab(s), HYDRANT), 'hydrant')); assert.equal(s.phase, 'ground-fire');
    for (let i = 0; i < 3; i++) s = tick(spray(grab(s), FIRES[i], i), 1.9);
    s = tick(s, 3); assert.equal(s.phase, 'roof-reach');
    s = tick(accept(grab(s), 'roof')); assert.equal(s.phase, 'roof-fire');
    s = tick(spray(grab(s), FIRES[3], 3), 4); assert.equal(s.phase, 'rescue');
    assert.deepEqual(goals(s), ['resident', 'cat']);
    for (const id of order) {
      s = tick(accept(grab(s), id), 3.6);
      assert.equal(s.rescued[RESCUES.findIndex(r => r.id === id)], true);
      assert.equal(s.passenger, null);
      assert.equal(goals(s).includes(id), false);
    }
    s = tick(s, 4); assert.equal(s.phase, 'ambulance');
    s = tick(drive(grab(s), STREET_STOP)); assert.equal(s.phase, 'stretcher');
    s = tick(accept(grab(s), 'patient')); assert.equal(s.phase, 'boarding');
    s = tick(accept(moveHandle(grab(s), AMBULANCE_REAR), 'ambulance'), 5);
    assert.equal(s.phase, 'complete'); assert.equal(progress(s), 1); assert.deepEqual(s.fires, [0, 0, 0, 0]);
    assert.equal(progress(createFire()), 0);
  });
}
test('spraying preserves partial extinguishing and cannot burn again or reach the roof early', () => {
  let s = tick(spray(grab(createFire('ground-fire')), FIRES[0], 0), 0.6);
  assert.ok(s.fires[0] > 0 && s.fires[0] < 1);
  const partial = [...s.fires];
  s = tick(release(s, true), 5); assert.deepEqual(s.fires, partial);
  s = tick(spray(grab(s), FIRES[3], 3), 4); assert.deepEqual(s.fires, partial);
  s = tick(spray(s, FIRES[0], 0), 3); assert.equal(s.fires[0], 0);
  s = tick(spray(s, FIRES[0], 0), 5); assert.equal(s.fires[1], 1);
});
test('rescue boarding, lowering and unloading finish once, independent of continued pointer input', () => {
  let s = accept(grab(createFire('rescue')), 'cat');
  assert.equal(s.passenger, 'cat');
  assert.deepEqual(accept(s, 'resident'), s);
  assert.deepEqual(moveHandle(s, { x: 6, y: 6, z: 2.4 }), s);
  s = tick(s, 1.2); assert.equal(s.action, 'returning'); assert.equal(s.rescued[1], false);
  s = tick(resumeFire(s)!, 2.4); assert.equal(s.rescued[1], true); assert.deepEqual(s.basket, BASKET_HOME);
  assert.equal(s.action, 'ready'); assert.deepEqual(goals(s), ['resident']);
  const again = accept(grab(s), 'cat'); assert.equal(again.action, 'dragging'); assert.equal(again.rescued[0], false);
});
test('targets belong to their stage and cancelled drags never connect or rescue', () => {
  const s = grab(createFire('hose'));
  assert.deepEqual(accept(s, 'cat'), s);
  assert.equal(release(s, true, 'hydrant').action, 'ready');
  assert.equal(release(s, false, 'cat').action, 'ready');
  assert.equal(release(s, false, 'hydrant').action, 'working');
  assert.equal(accept(grab(createFire('rescue')), 'ambulance').action, 'dragging');
});
test('vehicles can pause before parking, invalid input is ignored, and stage entries restore consistently', () => {
  const start = grab(tick(createFire()));
  assert.deepEqual(drive(start, NaN), start);
  const partial = release(drive(start, -8)); assert.equal(partial.truckX, -8); assert.equal(partial.phase, 'dispatch');
  const parked = drive(grab(partial), ENGINE_STOP); assert.equal(parked.action, 'working');
  assert.equal(tick(parked).phase, 'hose');
  for (const stage of stages) assert.ok(resumeFire(createFire(stage)), stage);
});
test('reload cancels spraying or dragging while retaining fire, rescue and vehicle progress', () => {
  let s = tick(spray(grab(createFire('ground-fire')), FIRES[1], 1), 0.5);
  const restored = resumeFire(s)!; assert.equal(restored.action, 'ready'); assert.equal(restored.wet, null); assert.deepEqual(restored.fires, s.fires);
  s = tick(accept(grab(createFire('rescue')), 'resident'), 3.6);
  const moving = moveHandle(grab(s), { x: 4, y: 4.8, z: 2.4 });
  assert.deepEqual(resumeFire(moving)?.rescued, [true, false]); assert.deepEqual(resumeFire(moving)?.basket, BASKET_HOME);
});
test('malformed or contradictory saves cannot skip extinguishing, repeat rescues or skip transport', () => {
  for (const value of [null, { version: 1, phase: 'complete' }, { ...createFire('complete'), fires: [1, 0, 0, 0] },
    { ...createFire('ambulance'), rescued: [false, true] }, { ...createFire('rescue'), passenger: 'cat', action: 'working', rescued: [false, true] },
    { ...createFire('rescue'), action: 'unloading', passenger: null }, { ...createFire('ground-fire'), action: 'dragging', wet: 3 },
    { ...createFire(), aim: { x: Infinity, y: 1, z: 0 } },
    { ...createFire('ground-fire'), fires: [0, 0, 0, 1] }, { ...createFire('roof-fire'), fires: [0, 0, 0, 0] },
    { ...createFire('rescue'), rescued: [true, true] }]) assert.equal(resumeFire(value), undefined);
});
