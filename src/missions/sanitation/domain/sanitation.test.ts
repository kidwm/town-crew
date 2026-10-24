import assert from 'node:assert/strict';
import test from 'node:test';
import { Result } from 'effect';
import * as THREE from 'three';
import { createSanitation, chooseRound, stages, grab, drive, moveItem, release, advance, resumeSanitation, available, driving, lifting, progress } from './sanitation.ts';
import type { SanitationState, Stage, Item, Round, Bag, Recyclable } from './sanitation.ts';
import { destination, binPose, home, vehiclePoint, cargoLocal, parked, restingBin } from './site.ts';
import { decodeSanitationSnapshot } from '../persistence.ts';
import { createSanitationCamera, resizeSanitationCamera } from '../view.ts';
import { createShapes } from '../../../runtime/geometry.ts';
import { createGarbageTruck, createRecyclingTruck, createFoodTruck, createBin } from '../vehicles.ts';
function auto(s: SanitationState) { for (let i = 0; i < 100 && s.action === 'auto'; i++) { s = advance(s, 0.1); assert.ok(resumeSanitation(s), s.phase); } return s; }
function travel(s: SanitationState) { const phase = s.phase; s = drive(grab(s, lifting(s) ? s.phase === 'bin-lift' ? 'bin' : 'food' : undefined), 1); for (let i = 0; i < 100 && s.phase === phase; i++) s = advance(s, 0.1); assert.notEqual(s.phase, phase); return s; }
function deliver(s: SanitationState, id: Item) { s = moveItem(grab(s, id), destination(s.round, id), true); return advance(s, 0.41); }
for (const layout of [0, 1] as const) for (const bags of [['bag-0', 'bag-1'], ['bag-1', 'bag-0']] as Bag[][]) for (const recycling of [['cardboard', 'bottles'], ['bottles', 'cardboard']] as Recyclable[][]) {
  test(`four-vehicle flow, layout ${layout}, bags ${bags.join('/')}, recycling ${recycling.join('/')}`, () => {
    let s = auto(createSanitation('intro', { layout, palette: 1, cast: 2 })); assert.equal(s.phase, 'garbage-arrival');
    s = travel(s); assert.equal(s.phase, 'bags');
    for (const id of bags) s = auto(deliver(s, id));
    assert.deepEqual(s.bags, bags); assert.equal(s.phase, 'bin-dock');
    s = auto(deliver(s, 'bin')); assert.equal(s.phase, 'bin-lift');
    assert.equal(drive(s, 1), s, 'dock consumes the old gesture');
    s = travel(s); assert.equal(s.phase, 'bin-tip'); s = auto(s); assert.ok(s.binEmpty); assert.equal(s.phase, 'garbage-exit');
    s = auto(travel(s)); assert.equal(s.phase, 'recycle-arrival'); s = travel(s);
    for (const id of recycling) s = auto(deliver(s, id));
    assert.deepEqual(s.recycled, recycling); assert.equal(s.phase, 'recycle-exit');
    s = auto(travel(s)); assert.equal(s.phase, 'food-arrival'); s = travel(s);
    s = auto(deliver(s, 'food')); assert.equal(s.phase, 'food-lift');
    s = auto(travel(s)); assert.equal(s.phase, 'food-exit'); assert.ok(s.foodEmpty);
    s = auto(travel(s)); assert.equal(s.phase, 'sweep'); s = auto(travel(s));
    assert.equal(s.phase, 'complete'); assert.equal(s.swept, 1); assert.equal(progress(s), 1);
    assert.deepEqual(advance(s, 30), s, 'completed saves never replay departure');
  });
}
test('both bin lifts preserve height after cancel and reload, and need a new upward gesture', () => {
  for (const phase of ['bin-lift', 'food-lift'] as const) {
    let s = createSanitation(phase), id: Item = phase === 'bin-lift' ? 'bin' : 'food';
    s = advance(drive(grab(s, id), 0.43), 1); assert.equal(s.travel, 0.43);
    const pose = binPose(s, id === 'food'); s = release(s, true); assert.equal(s.travel, 0.43);
    const restored = resumeSanitation(s)!; assert.ok(restored); assert.deepEqual(binPose(restored, id === 'food'), pose);
    assert.equal(advance(restored, 5).travel, 0.43); assert.equal(drive(restored, 1), restored);
    assert.equal(travel(restored).phase, id === 'bin' ? 'bin-tip' : 'food-tip');
  }
});
test('taps, brief target crossing and cancelled dwell do not load; valid early release does', () => {
  let s = createSanitation('bags'); s = release(grab(s, 'bag-1')); assert.deepEqual(s.bags, []);
  s = moveItem(grab(s, 'bag-1'), destination(s.round, 'bag-1'), true); s = advance(s, 0.12); s = release(s, true);
  assert.equal(s.phase, 'bags'); assert.deepEqual(s.bags, []);
  assert.deepEqual(s.positions['bag-1'], destination(s.round, 'bag-1'));
  s = grab(s, 'bag-1'); s = moveItem(s, { ...s.positions['bag-1'], x: s.positions['bag-1'].x + 0.02 }, true); s = release(s);
  assert.equal(s.phase, 'bag-loading'); assert.equal(s.action, 'auto');
  const restored = resumeSanitation(advance(s, 0.3))!; assert.ok(restored); assert.deepEqual(auto(restored).bags, ['bag-1']);
});
test('pickup candidates keep the child order independent and refuse unrelated props', () => {
  for (const phase of ['bags', 'recycling', 'bin-dock', 'food-dock'] as Stage[]) {
    const s = createSanitation(phase); for (const id of ['bag-0', 'bag-1', 'bin', 'cardboard', 'bottles', 'food'] as Item[]) assert.equal(grab(s, id) !== s, available(s).includes(id));
  }
});
test('cleaned strips stay clean through reversing, cancellation and reload', () => {
  let s = advance(drive(grab(createSanitation('sweep')), 0.6), 2); assert.equal(s.swept, 0.6);
  s = advance(drive(s, 0.2), 1); assert.equal(s.travel, 0.2); assert.equal(s.swept, 0.6);
  s = resumeSanitation(release(s, true))!; assert.equal(s.swept, 0.6); assert.equal(s.action, 'ready');
});
test('every development stage and layout has a valid complete current snapshot', () => {
  for (const layout of [0, 1] as const) for (const phase of stages) {
    const state = createSanitation(phase, { layout, palette: 3, cast: 1 });
    const decoded = decodeSanitationSnapshot(JSON.parse(JSON.stringify(state)), 'entry'); assert.ok(Result.isSuccess(decoded), phase);
    if (state.action === 'auto') { const halfway = advance(state, 0.3); assert.ok(resumeSanitation(halfway), `${phase} mid-animation`); }
  }
});
test('restore rejects missing fields, duplicate cargo, skipped work, bad timers and stale versions', () => {
  const good = createSanitation('complete');
  for (const field of Object.keys(good)) { const bad: Record<string, unknown> = { ...good }; delete bad[field]; assert.ok(Result.isFailure(decodeSanitationSnapshot(bad, 'missing')), field); }
  for (const bad of [{ ...good, version: 0 }, { ...good, binEmpty: false }, { ...good, foodEmpty: false }, { ...good, bags: ['bag-0', 'bag-0'] }, { ...good, swept: 0.5 }, { ...createSanitation('intro'), elapsed: 8 }, { ...createSanitation('bags'), recycled: ['bottles'] }, { ...good, travel: NaN }]) assert.ok(Result.isFailure(decodeSanitationSnapshot(bad, 'invalid')));
});
test('new rounds change full layout and palette, while restores keep the same round', () => {
  for (const value of [0, 0.4, 0.99]) { const first = chooseRound(undefined, () => value), next = chooseRound(first, () => value); assert.notEqual(next.layout, first.layout); assert.notEqual(next.palette, first.palette); assert.deepEqual(resumeSanitation(createSanitation('bags', next))!.round, next); }
});
test('fixed camera exposes all bins, loading points and full parked vehicles on desktop and portrait phone', () => {
  const shapes = createShapes();
  const models = { 'garbage-arrival': createGarbageTruck(shapes), 'recycle-arrival': createRecyclingTruck(shapes, 0), 'food-arrival': createFoodTruck(shapes) };
  models['garbage-arrival'].pose(0, 0); models['food-arrival'].pose(0, 0);
  const bounds = Object.fromEntries(Object.entries(models).map(([id, v]) => [id, new THREE.Box3().setFromObject(v.root)]));
  const camera = createSanitationCamera(), original = camera.position.clone(), q = camera.quaternion.clone();
  for (const [width, height] of [[1280, 800], [390, 844], [1024, 768]]) for (const layout of [0, 1] as const) {
    resizeSanitationCamera(camera, width / height); const round: Round = { layout, palette: 0, cast: 0 };
    for (const phase of ['garbage-arrival', 'recycle-arrival', 'food-arrival', 'sweep'] as Stage[]) for (let t = 0; t <= 1; t += 0.1) {
      const p = vehiclePoint(round, phase, t);
      const b = bounds[phase] ?? new THREE.Box3(new THREE.Vector3(-2.6, 0, -2.1), new THREE.Vector3(2.9, 3.1, 2.1));
      for (const x of [b.min.x, b.max.x]) for (const z of [b.min.z, b.max.z]) {
        const v = new THREE.Vector3(p.x + x, 3.1, p.z + z).project(camera); assert.ok(Math.abs(v.x) < 1, `${phase} layout ${layout} viewport ${width}: ${v.x}`); assert.ok(Math.abs(v.y) < 0.75);
      }
    }
    for (const id of ['bin', 'food', 'bag-0', 'bag-1', 'cardboard', 'bottles'] as Item[]) for (const point of [home(round, id), destination(round, id)]) { const v = new THREE.Vector3(point.x, point.y, point.z).project(camera); assert.ok(Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.75); }
    assert.deepEqual(camera.position, original); assert.deepEqual(camera.quaternion.toArray(), q.toArray());
  }
  Object.values(models).forEach(v => v.root.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); })); shapes.disposeMaterials();
});
test('recycling cargo fits inside the original flatbed and bins tip above actual openings', () => {
  for (const id of ['cardboard', 'bottles'] as const) { const p = cargoLocal(id); assert.ok(p.x - 0.65 > -2.08 && p.x + 0.65 < 1.35); }
  const shapes = createShapes(), garbage = createGarbageTruck(shapes), recycle = createRecyclingTruck(shapes, 0), food = createFoodTruck(shapes), bin = createBin(shapes);
  assert.equal(garbage.root.name, 'garbage-truck'); assert.equal(recycle.root.children[0].name, 'flatbed-transporter'); assert.equal(food.root.name, 'food-waste-truck');
  for (const phase of ['bin-tip', 'food-tip'] as const) {
    const s = advance(createSanitation(phase), 0.8), pose = binPose(s, phase === 'food-tip'), p = parked(s.round);
    assert.ok(pose.y > 2.4 && Math.abs(pose.tilt) > 2); assert.ok(phase === 'bin-tip' ? pose.x < p.x - 2.7 : pose.z > p.z + 0.9);
  }
  const scene = new THREE.Scene(); scene.add(garbage.root, recycle.root, food.root, bin.root); scene.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); shapes.disposeMaterials();
});

test('a paused item already at its target accepts a fresh hold, while a short tap still cannot load', () => {
  let s = createSanitation('bags'); s.positions['bag-0'] = destination(s.round, 'bag-0');
  s = grab(s, 'bag-0', true); s = advance(s, 0.1); assert.equal(release(s).phase, 'bags');
  s = grab(release(s, true), 'bag-0', true); assert.equal(advance(s, 0.41).phase, 'bag-loading');
});
test('returned empty bins sit on the pavement clear of the full sweeper brush span', () => {
  for (const layout of [0, 1] as const) for (const item of ['bin', 'food'] as const) {
    const round: Round = { layout, palette: 0, cast: 0 }, p = restingBin(round, item);
    assert.ok(p.z - 0.55 > 2 + 1.35 + 0.72);
    const s = auto(createSanitation(item === 'bin' ? 'bin-tip' : 'food-tip', round)); assert.deepEqual(s.positions[item], p);
  }
});

test('loading the first package does not move the progress bar backwards', () => {
  for (const [phase, item] of [['bags', 'bag-0'], ['recycling', 'cardboard']] as [Stage, Item][]) {
    let s = deliver(createSanitation(phase), item), last = progress(s);
    for (let i = 0; i < 10; i++) { s = advance(s, 0.1); const value = progress(s); assert.ok(value >= last); last = value; }
  }
});
