import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTraffic, chooseColors, resumeTraffic, grab, drive, accept, release, advance, goals, progress, moveHandle, driveEnd, DEBRIS, stages, chooseTowTypes, towDirection, towHome, towType, chooseFirstTow, reopeningCarX, REOPEN_PASS_START, durations } from './traffic.ts';
import type { TrafficState, Stage, Goal, TowPair } from './traffic.ts';
function settle(s: TrafficState) { for (let i = 0; i < 220 && (s.action === 'working' || s.action === 'entering'); i++) s = advance(s, 0.1); return s; }
function driving(s: TrafficState) { return settle(drive(grab(s), driveEnd(s))); }
function place(s: TrafficState, goal: Goal) { return settle(accept(grab(s), goal)); }
function complete(order: [Goal, Goal], pair: TowPair, firstTow: 0 | 1) {
  let s = settle(createTraffic('collision', [0, 2], pair, firstTow)), high = 0;
  const check = () => { assert.ok(progress(s) >= high); high = progress(s); assert.deepEqual(resumeTraffic(s), s); };
  check(); s = driving(s); check(); s = place(s, 'cone-right'); check(); s = place(s, 'cone-left'); check();
  for (const goal of order) { assert.equal(s.phase, 'hook'); check(); s = place(s, goal); check(); s = driving(s); check(); }
  s = driving(s); check(); s = driving(s); check(); s = driving(s); check();
  s = place(s, 'patient'); check(); s = place(s, 'ambulance'); check();
  assert.equal(s.phase, 'complete'); assert.equal(progress(s), 1); assert.equal(s.cleaned, DEBRIS.length); assert.deepEqual(s.towed, [true, true]); return s;
}
test('both type assignments and both child-selected orders complete every service', () => {
  for (const pair of [chooseTowTypes(() => 0), chooseTowTypes(() => 1)]) {
    for (const firstTow of [0, 1] as const) { complete(['car-0', 'car-1'], pair, firstTow); complete(['car-1', 'car-0'], pair, firstTow); }
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
  let s = accept(grab(createTraffic('hook', [1, 3], ['flatbed', 'wheel-lift'], 1)), 'car-1');
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
  for (const bad of [null, {}, { ...done, colors: [1, 1] }, { ...done, towed: [true, false] }, { ...done, cleaned: 0 }, { ...done, cones: [false, false] }, { ...done, handle: { x: NaN, y: 0, z: 0 } }, { ...done, action: 'dragging' }, { ...createTraffic('hook'), action: 'working', selected: null }, { ...createTraffic('hook'), selected: 1 }, { ...createTraffic('hook'), firstTow: 2 }, { ...createTraffic('tow-exit'), selected: null }, { ...createTraffic('police'), action: 'working' }]) assert.equal(resumeTraffic(bad), undefined);
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
    const s = createTraffic('hook', [0, 2], pair);
    assert.deepEqual(resumeTraffic(s)?.towTypes, pair);
    for (const bad of [[], ['flatbed', 'flatbed'], ['wheel-lift', 'wheel-lift'], ['crane', 'flatbed']]) assert.equal(resumeTraffic({ ...s, towTypes: bad }), undefined);
  }
});
test('truck arrives before selection; either car accepts the tool without changing the rig', () => {
  assert.equal(chooseFirstTow(() => 0), 0); assert.equal(chooseFirstTow(() => 1), 1);
  for (const firstTow of [0, 1] as const) {
    let s = createTraffic('cones', [0, 2], ['flatbed', 'wheel-lift'], firstTow);
    s = place(place(s, 'cone-left'), 'cone-right');
    assert.equal(s.phase, 'hook'); assert.equal(s.selected, null);
    assert.deepEqual(goals(s), ['car-0', 'car-1']); assert.deepEqual(s.handle, towHome(s));
    s = resumeTraffic(moveHandle(grab(s), { x: 0, y: 0.7, z: 1 }))!;
    assert.equal(s.selected, null); assert.deepEqual(s.handle, towHome(s));
    assert.equal(release(grab(s), true, 'car-0').selected, null);
    for (const goal of goals(s)) {
      const loaded = release(grab(s), false, goal);
      assert.equal(loaded.selected, goal === 'car-0' ? 0 : 1);
      assert.equal(towType(loaded), towType(s)); assert.equal(towDirection(loaded), towDirection(s));
      assert.deepEqual(resumeTraffic(loaded), loaded);
    }
  }
});
test('both departures retain their own rig and side regardless of the chosen car', () => {
  for (const firstTow of [0, 1] as const) for (const goal of ['car-0', 'car-1'] as Goal[]) {
    let s = place(createTraffic('hook', [0, 2], ['flatbed', 'wheel-lift'], firstTow), goal);
    const direction = towDirection(s), type = towType(s);
    assert.equal(s.truckX, 8 * direction); assert.equal(driveEnd(s), 11 * direction);
    assert.equal(drive(grab(s), -20 * direction).truckX, 8 * direction);
    s = resumeTraffic(drive(grab(s), 9 * direction))!;
    assert.equal(s.truckX, 9 * direction); assert.equal(s.action, 'ready');
    assert.equal(s.selected, goal === 'car-0' ? 0 : 1);
    s = driving(s); assert.equal(s.phase, 'hook'); assert.equal(s.selected, null);
    assert.equal(s.towed.filter(Boolean).length, 1);
    assert.equal(towDirection(s), -direction); assert.notEqual(towType(s), type);
    assert.deepEqual(goals(s), [goal === 'car-0' ? 'car-1' : 'car-0']);
    assert.equal(accept(grab(s), goal).action, 'dragging');
  }
});
test('version 1 preserves completed work and dispatches a hook for the remaining car', () => {
  const state = { ...createTraffic('tow-exit', [3, 4]), version: 1, selected: 1, towed: [true, false], truckX: 10 };
  const migrated = resumeTraffic(state)!;
  assert.equal(migrated.version, 3); assert.equal(migrated.phase, 'tow-arrival');
  assert.equal(migrated.selected, null); assert.deepEqual(migrated.colors, [3, 4]); assert.deepEqual(migrated.towed, [true, false]);
  assert.deepEqual(goals(settle(migrated)), ['car-1']); assert.equal(towType(migrated), 'wheel-lift');
  assert.deepEqual(resumeTraffic(migrated), migrated);
  const sweeping = createTraffic('sweep', [3, 4]); sweeping.cleaned = 4; sweeping.truckX = 0;
  assert.equal(resumeTraffic({ ...sweeping, version: 1 })?.cleaned, 4);
});
test('version 2 preserves loading clocks and rig identity while removing uncommitted car choices', () => {
  for (const selected of [0, 1] as const) for (const second of [false, true]) {
    const towed: [boolean, boolean] = [second && selected === 1, second && selected === 0];
    for (const phase of ['tow-arrival', 'hook', 'tow-exit'] as const) {
      for (const action of phase === 'tow-arrival' ? ['working'] as const : ['ready', 'working'] as const) {
        const loaded = phase === 'tow-exit' || phase === 'hook' && action === 'working';
        const snapshot = { ...createTraffic(phase, [1, 3], ['wheel-lift', 'flatbed']), version: 2, selected, towed,
          action, elapsed: 0.5, truckX: (selected === 0 ? -1 : 1) * (action === 'working' ? 11 : 9) };
        const restored = resumeTraffic(snapshot)!;
        assert.ok(restored); assert.equal(restored.selected, loaded ? selected : null);
        assert.equal(restored.elapsed, 0.5); assert.equal(towDirection(restored), selected === 0 ? -1 : 1);
        assert.equal(towType(restored), snapshot.towTypes[selected]); assert.deepEqual(resumeTraffic(restored), restored);
      }
    }
  }
  for (const towed of [[false, false], [false, true], [true, false]] as [boolean, boolean][]) {
    const pending = { ...createTraffic('hook'), version: 2, phase: 'tow-choice', towed };
    const restored = resumeTraffic(pending)!;
    assert.equal(restored.phase, 'tow-arrival'); assert.equal(restored.selected, null);
    assert.equal(goals(settle(restored)).length, towed.some(Boolean) ? 1 : 2);
  }
});
test('reopening uses road-repair pacing and cannot finish while the car is still crossing', () => {
  const start = REOPEN_PASS_START, end = durations.reopen!;
  assert.equal(end - start, 6.6);
  assert.equal(reopeningCarX(start), -22); assert.ok(Math.abs(reopeningCarX(start + 3.3)) < 1e-10);
  assert.equal(reopeningCarX(end), 22);
  assert.equal(advance({ ...createTraffic('reopen'), elapsed: 4 }, 0.1).phase, 'reopen');
  const mid = { ...createTraffic('reopen'), elapsed: start + 3.3 };
  assert.deepEqual(resumeTraffic(mid), mid); assert.equal(settle(mid).phase, 'complete');
  const legacy = resumeTraffic({ ...mid, version: 2, elapsed: start + 0.7 })!;
  assert.ok(Math.abs(reopeningCarX(legacy.elapsed)) < 1e-10);
  assert.equal(resumeTraffic({ ...mid, version: 2, elapsed: 4.1 }), undefined);
});
