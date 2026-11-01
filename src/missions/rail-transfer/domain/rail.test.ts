import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, available, chooseRound, createRail, drive, grab, release, resumeRail, stages, directions, origins, destinations, type RailState, type Train } from './rail.ts';
import { CAB_TIP } from './formation.ts';
import { bay, boardingRoute, destinationTrain, doorPoint, sourceTrain, trainPose, transferRoute, waitingPoint, walkPose, WIDTH } from './station.ts';
function ticks(s: RailState, seconds: number) { for (let i = 0; i < Math.ceil(seconds * 100); i++) s = advance(s, 0.01); return s; }
function perform(s: RailState, t: Train) { return ticks(drive(grab(s, t), 1), 1.2); }
for (const direction of directions) for (const layout of [0, 1] as const) for (const first of [0, 1]) for (const second of [0, 1]) {
  test(`rail ${direction}/${layout}, independent orders ${first}/${second}: four trains and six transfers complete`, () => {
    let s = ticks(createRail('intro', { direction, layout, palette: 1, cast: 2 }), 4.6);
    assert.equal(s.phase, 'choose'); assert.equal(available(s).length, 2);
    const chosen: Train[] = [];
    for (let visit = 0; visit < 4; visit++) {
      const options = available(s), t = options[visit % 2 === 0 ? visit === 0 ? first : second : 0]; chosen.push(t);
      s = perform(s, t); assert.equal(s.phase, 'door'); assert.equal(s.selected, t);
      s = drive(grab(s, t), 1); assert.equal(s.phase, 'passengers');
      assert.deepEqual(grab(s, t), s, 'a held pointer cannot start the next action');
      s = ticks(s, 8); assert.equal(s.phase, 'exit'); assert.equal(s.door, 0);
      s = perform(s, t); assert.equal(s.phase, 'departure');
      s = ticks(s, visit === 1 ? 7.5 : visit === 3 ? 6.1 : 4);
      assert.deepEqual(s.order, chosen); assert.ok(resumeRail(s));
    }
    assert.equal(s.phase, 'complete'); assert.equal(new Set(chosen).size, 4);
  });
}
test('rail cancelled gestures preserve partial travel and doors, but discard uncommitted choice and dwell', () => {
  const initial = createRail('choose');
  assert.equal(release(grab(initial, 'regional'), true).selected, null);
  let s = ticks(drive(grab(initial, 'regional'), 0.5), 0.4); s = release(s, true);
  assert.ok(s.travel > 0.1); assert.equal(s.selected, 'regional'); assert.deepEqual(available(s), ['regional']);
  const partial = structuredClone(s); s = ticks(s, 2); assert.deepEqual(s, partial);
  const held = ticks(drive(grab(s, 'regional'), 1), 0.4), restored = resumeRail(held)!;
  assert.equal(restored.travel, held.travel); assert.equal(restored.action, 'ready'); assert.equal(restored.dwell, 0);
  s = createRail('door'); s = release(drive(grab(s, 'high-speed'), 0.43), true);
  assert.equal(s.door, 0.43); assert.equal(resumeRail(s)!.door, 0.43); assert.equal(ticks(s, 10).door, 0.43);
  assert.equal(drive(grab(s, 'high-speed'), 1).phase, 'passengers');
});
test('rail reload resumes automatic clocks and rejects incomplete or contradictory formats', () => {
  for (const phase of stages) for (let visit = 0; visit < 4; visit++) assert.ok(resumeRail(createRail(phase, undefined, visit)), `${phase}/${visit}`);
  const s = ticks(createRail('passengers'), 2.1), restored = resumeRail(s)!;
  assert.equal(restored.elapsed, s.elapsed); assert.equal(restored.selected, s.selected);
  assert.equal(ticks(restored, 6).phase, 'exit');
  for (const version of [0, 2, undefined]) assert.equal(resumeRail({ ...s, version }), undefined);
  for (const key of Object.keys(s)) { const broken = { ...s } as Record<string, unknown>; delete broken[key]; assert.equal(resumeRail(broken), undefined, key); }
  for (const broken of [{ ...s, order: ['metro'] }, { ...s, selected: 'tram' }, { ...s, elapsed: 100 }, { ...s, door: 0 }, { ...s, round: { ...s.round, layout: 2 } }, { ...createRail('complete'), order: [] }]) assert.equal(resumeRail(broken), undefined);
  assert.deepEqual(ticks(createRail('complete'), 10), createRail('complete'));
});
test('rail fresh rounds vary the incoming pair and palette without changing gesture rules', () => {
  let round = createRail().round;
  for (const random of [() => 0, () => 0.999]) for (let n = 0; n < 8; n++) {
    const next = chooseRound(round, random); assert.notEqual(next.direction, round.direction); assert.notEqual(next.palette, round.palette); round = next;
  }
});
test('rail isolated tracks, platform floors and pedestrian ramps stay clear in both layouts and flows', () => {
  for (const layout of [0, 1] as const) for (const direction of directions) {
    const round = { layout, direction, palette: 0, cast: 0 };
    for (let id = 0; id < 6; id++) {
      const origin = sourceTrain(round, id), dest = destinationTrain(round, id), s = createRail('passengers', round, origins(round).indexOf(origin));
      const b = bay(round, origin), door = doorPoint(s, origin), wait = waitingPoint(round, id);
      assert.ok(Math.abs(b.x) - CAB_TIP > 2.65, 'whole train stays outside the buffer and central concourse');
      assert.ok(door.z > b.z + WIDTH / 2); assert.equal(wait.y, bay(round, dest).floor);
      const route = transferRoute(s, id);
      for (let n = 0; n <= 100; n++) {
        const p = walkPose(route.slice(2), n / 100);
        if (Math.abs(p.x) > 3.01) assert.ok(Math.abs(p.z - (b.z + 2.12)) < 0.01 || Math.abs(p.z - wait.z) < 0.01, 'walking outside the concourse stays on a platform');
        else assert.ok(p.z >= -3.23 && p.z <= 6.87, 'central ramp is connected');
      }
      const destinationState = createRail('passengers', round, 2 + destinations(round).indexOf(dest));
      const boarding = boardingRoute(destinationState, id); assert.deepEqual(boarding[0], wait);
      assert.equal(boarding[2].z, bay(round, dest).z + WIDTH / 2 + 0.08);
    }
    for (const t of ['high-speed', 'regional', 'metro', 'tram'] as const) {
      const s = createRail('entrance', round, origins(round).includes(t) ? 0 : 2);
      const start = trainPose(s, t, 30); assert.ok(Math.abs(start.x) > 25);
      const end = trainPose({ ...s, elapsed: 3.6 }, t, 30); assert.ok(Math.abs(end.x - bay(round, t).waitX) < 1e-8);
    }
  }
});

test('rail valid early release visibly finishes parking and resumes its automatic movement', () => {
  let s = ticks(drive(grab(createRail('choose'), 'regional'), 1), 0.1);
  s = release(s); assert.equal(s.action, 'auto'); assert.deepEqual(available(s), []);
  const restored = resumeRail(s)!; assert.equal(restored.travel, s.travel); assert.equal(restored.action, 'auto');
  assert.equal(ticks(restored, 1.3).phase, 'door');
});

test('tram departure can finish after interruption in its last one percent or exactly at the endpoint', () => {
  for (const travel of [0.99, 1]) {
    let s = { ...createRail('exit', { direction: 'city', layout: 0, palette: 0, cast: 0 }, 3), travel, aim: travel };
    s = release(drive(grab(s, 'tram'), 1)); s = ticks(s, 1.2);
    assert.equal(s.phase, 'departure', `paused at ${travel}`);
  }
});

test('a fully opened but interrupted current-version door accepts a new release without losing the round', () => {
  let s = { ...createRail('door'), door: 1, aim: 1 };
  const resumed = resumeRail(s)!; assert.equal(resumed.door, 1);
  s = release(grab(resumed, 'high-speed'));
  assert.equal(s.phase, 'passengers'); assert.equal(s.round.direction, 'city');
});

test('cancelled endpoints remain pending and ordinary taps do not start travel', () => {
  for (const phase of ['approach', 'exit', 'door'] as const) {
    const base = createRail(phase), selected = base.selected!;
    const partial = { ...base, travel: phase === 'door' ? 0 : 1, door: phase === 'door' ? 1 : 0, aim: 1 };
    const saved = resumeRail(release(grab(partial, selected), true))!;
    assert.equal(saved.phase, phase); assert.equal(saved.action, 'ready');
    const resumed = release(grab(saved, selected));
    assert.equal(ticks(resumed, 1.2).phase, phase === 'door' ? 'passengers' : phase === 'exit' ? 'departure' : 'door');
    const untouched = release(grab(base, selected));
    assert.equal(ticks(untouched, 1.2).travel, 0);
    assert.notEqual(untouched.action, 'auto');
  }
});

test('all six unordered incoming pairs are sampled with an independent mirrored layout', () => {
  const pairs = new Set<string>();
  for (let n = 0; n < directions.length; n++) {
    const round = chooseRound(undefined, () => (n + 0.5) / directions.length);
    pairs.add(origins(round).join(','));
    assert.equal(origins(round).length, 2); assert.equal(destinations(round).length, 2);
    assert.equal(new Set([...origins(round), ...destinations(round)]).size, 4);
  }
  assert.equal(pairs.size, 6);
  for (const direction of directions) for (const layout of [0, 1]) {
    const samples = [directions.indexOf(direction) / directions.length + 0.01, layout ? 0.9 : 0.1, 0.1, 0.1];
    const round = chooseRound(undefined, () => samples.shift()!);
    assert.equal(round.direction, direction); assert.equal(round.layout, layout);
  }
});
