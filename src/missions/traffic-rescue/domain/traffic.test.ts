import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTraffic, chooseColors, resumeTraffic, grab, drive, accept, release, advance, goals, progress, moveHandle, driveEnd, DEBRIS, stages, chooseTowTypes, towDirection, towHome } from './traffic.ts';
import type { TrafficState, Stage, Goal, TowPair } from './traffic.ts';
function settle(s: TrafficState) { for (let i = 0; i < 120 && (s.action === 'working' || s.action === 'entering'); i++) s = advance(s, 0.1); return s; }
function driving(s: TrafficState) { return settle(drive(grab(s), driveEnd(s))); }
function place(s: TrafficState, goal: Goal) { return settle(accept(grab(s), goal)); }
function complete(order: [Goal, Goal], pair: TowPair) {
  let s = settle(createTraffic('collision', [0, 2], pair)), high = 0;
  const check = () => { assert.ok(progress(s) >= high); high = progress(s); assert.deepEqual(resumeTraffic(s), s); };
  check(); s = driving(s); check(); s = place(s, 'cone-right'); check(); s = place(s, 'cone-left'); check();
  for (const goal of order) { if (s.phase === 'tow-choice') s = place(s, goal); assert.equal(s.phase, 'hook'); check(); s = place(s, goal); check(); s = driving(s); check(); }
  s = driving(s); check(); s = driving(s); check(); s = driving(s); check();
  s = place(s, 'patient'); check(); s = place(s, 'ambulance'); check();
  assert.equal(s.phase, 'complete'); assert.equal(progress(s), 1); assert.equal(s.cleaned, DEBRIS.length); assert.deepEqual(s.towed, [true, true]); return s;
}
test('both type assignments and both child-selected orders complete every service', () => {
  for (const pair of [chooseTowTypes(() => 0), chooseTowTypes(() => 1)]) {
    complete(['car-0', 'car-1'], pair); complete(['car-1', 'car-0'], pair);
  }
});
test('new colours differ from one another and both preceding cars without simply swapping', () => {
  let last: [number, number] = [0, 2];
  for (let i = 0; i < 300; i++) { const next = chooseColors(last, () => i / 300); assert.notEqual(next[0], next[1]); assert.notEqual(next[0], last[0]); assert.notEqual(next[1], last[1]); assert.notDeepEqual(next, [last[1], last[0]]); last = next; }
});
test('interrupted loose equipment resets; valid release works; a held gesture cannot start the next cone', () => {
  let s = createTraffic('cones', [0, 1]); s = moveHandle(grab(s), { x: 2, y: 0.7, z: -2 });
  const recovered = resumeTraffic(s)!; assert.equal(recovered.action, 'ready'); assert.deepEqual(recovered.cones, [false, false]); assert.notDeepEqual(recovered.handle, s.handle);
  assert.equal(release(s, true, 'cone-left').cones[0], false);
  s = settle(release(s, false, 'cone-left')); assert.deepEqual(s.cones, [true, false]);
  assert.deepEqual(accept(s, 'cone-right'), s); assert.deepEqual(moveHandle(s, { x: 7, y: 0.7, z: 0 }), s);
});
test('towed flag is recorded only after loaded truck departs; reload retains current load', () => {
  let s = accept(grab(place(createTraffic('tow-choice', [1, 3]), 'car-1')), 'car-1');
  s = advance(s, 0.1); assert.deepEqual(resumeTraffic(s), s); assert.deepEqual(s.towed, [false, false]);
  s = settle(s); assert.equal(s.phase, 'tow-exit'); assert.equal(s.selected, 1);
  s = drive(grab(s), 10); s = resumeTraffic(s)!; assert.equal(s.action, 'ready'); assert.equal(s.truckX, 10); assert.equal(s.selected, 1);
  s = driving(s); assert.deepEqual(s.towed, [false, true]); assert.deepEqual(goals(s), ['car-0']);
});
test('sweeping retains partial cleaning on reverse, cancellation and reload', () => {
  let s = createTraffic('sweep', [0, 2]); s = drive(grab(s), -1); const cleaned = s.cleaned;
  assert.ok(cleaned > 0 && cleaned < DEBRIS.length);
  s = drive(s, -4); assert.equal(s.cleaned, cleaned); s = release(s, true); s = resumeTraffic(s)!;
  assert.equal(s.cleaned, cleaned); assert.equal(s.truckX, -4); assert.equal(s.phase, 'sweep');
  s = driving(s); assert.equal(s.phase, 'ambulance'); assert.equal(s.cleaned, DEBRIS.length);
});
test('all development entries round trip and interruptions cannot bypass a stage', () => {
  for (const phase of stages) { const s = createTraffic(phase, [0, 2]); assert.deepEqual(resumeTraffic(s), s, phase); assert.equal(accept(s, 'ambulance'), s); }
  assert.equal(advance(createTraffic(), Number.NaN).elapsed, 0);
  assert.equal(moveHandle(grab(createTraffic('hook')), { x: NaN, y: 0, z: 0 }).action, 'dragging');
});
test('contradictory and malformed saves are rejected without changing fresh progress', () => {
  const done = createTraffic('complete', [0, 2]);
  for (const bad of [null, {}, { ...done, colors: [1, 1] }, { ...done, towed: [true, false] }, { ...done, cleaned: 0 }, { ...done, cones: [false, false] }, { ...done, handle: { x: NaN, y: 0, z: 0 } }, { ...done, action: 'dragging' }, { ...createTraffic('hook'), selected: null }, { ...createTraffic('tow-exit'), selected: null }, { ...createTraffic('police'), action: 'working' }]) assert.equal(resumeTraffic(bad), undefined);
  assert.equal(createTraffic().phase, 'collision');
});
test('animation snapshots resume at their exact elapsed progress', () => {
  for (const phase of ['collision', 'tow-arrival', 'departure', 'reopen'] as Stage[]) { let s = createTraffic(phase, [2, 4]); s = advance(s, 0.09); assert.deepEqual(resumeTraffic(s), s); }
});

test('one truck of each type is randomly assigned to the two approach sides', () => {
  assert.deepEqual(chooseTowTypes(() => 0), ['flatbed', 'wheel-lift']);
  assert.deepEqual(chooseTowTypes(() => 0.499), ['flatbed', 'wheel-lift']);
  assert.deepEqual(chooseTowTypes(() => 0.5), ['wheel-lift', 'flatbed']);
  for (const pair of [chooseTowTypes(() => 0), chooseTowTypes(() => 1)]) {
    const s = createTraffic('tow-choice', [0, 2], pair);
    assert.deepEqual(resumeTraffic(s)?.towTypes, pair);
    for (const bad of [[], ['flatbed', 'flatbed'], ['wheel-lift', 'wheel-lift'], ['crane', 'flatbed']]) assert.equal(resumeTraffic({ ...s, towTypes: bad }), undefined);
  }
});
test('selection needs a completed tap; only the chosen car accepts the arriving tool', () => {
  const s = createTraffic('tow-choice', [0, 2], ['flatbed', 'wheel-lift']);
  assert.equal(release(grab(s), true, 'car-0').selected, null);
  assert.equal(resumeTraffic(grab(s))?.selected, null);
  const arriving = release(grab(s), false, 'car-1');
  assert.equal(arriving.phase, 'tow-arrival'); assert.equal(arriving.selected, 1);
  const ready = settle(arriving); assert.deepEqual(goals(ready), ['car-1']);
  assert.deepEqual(ready.handle, towHome(ready));
  assert.equal(accept(grab(ready), 'car-0').action, 'dragging');
  assert.equal(release(grab(ready), true).selected, 1);
});
test('left and right departures clamp toward their own exit and retain partial travel', () => {
  for (const goal of ['car-0', 'car-1'] as Goal[]) {
    let s = place(place(createTraffic('tow-choice'), goal), goal);
    const direction = towDirection(s);
    assert.equal(s.truckX, 8 * direction); assert.equal(driveEnd(s), 11 * direction);
    assert.equal(drive(grab(s), -20 * direction).truckX, 8 * direction);
    s = drive(grab(s), 9 * direction); s = resumeTraffic(s)!;
    assert.equal(s.truckX, 9 * direction); assert.equal(s.action, 'ready');
    assert.equal(s.selected, goal === 'car-0' ? 0 : 1);
    s = driving(s); assert.equal(s.phase, 'hook'); assert.equal(s.towed.filter(Boolean).length, 1); assert.equal(s.selected, goal === 'car-0' ? 1 : 0);
  }
});
test('legacy rounds preserve colours and completed work and automatically dispatch the last remaining car', () => {
  const state = { ...createTraffic('tow-exit', [3, 4]), version: 1, selected: 1, towed: [true, false], truckX: 10 };
  const migrated = resumeTraffic(state)!;
  assert.equal(migrated.version, 2); assert.equal(migrated.phase, 'tow-arrival');
  assert.equal(migrated.selected, 1); assert.deepEqual(migrated.colors, [3, 4]); assert.deepEqual(migrated.towed, [true, false]);
  assert.deepEqual(goals(settle(migrated)), ['car-1']); assert.deepEqual(resumeTraffic(migrated), migrated);
  const pending = { ...createTraffic('tow-choice'), towed: [false, true] };
  assert.equal(resumeTraffic(pending)?.selected, 0); assert.equal(resumeTraffic(pending)?.phase, 'tow-arrival');
  const sweeping = createTraffic('sweep', [3, 4]); sweeping.cleaned = 4; sweeping.truckX = 0;
  assert.equal(resumeTraffic({ ...sweeping, version: 1 })?.cleaned, 4);
});
