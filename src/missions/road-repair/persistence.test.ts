import assert from 'node:assert/strict';
import test from 'node:test';
import { Effect, Result } from 'effect';
import { browser, Element } from '../../../tests/helpers/lifecycle.ts';
import { defaultTuning } from './domain/dump-truck.ts';
import { createRoad, stages } from './domain/road.ts';
import { decodeRoadSnapshot } from './persistence.ts';
import { restoreDevelopment, saveDevelopment } from './devtools.ts';
import { createRoadSession } from './session.ts';
import { loadProgress, clearProgress } from '../../app/progress.ts';
import type { RoadScene } from './scene.ts';

function installStorage(t: Parameters<typeof browser>[0], storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'sessionStorage', previous); else Reflect.deleteProperty(globalThis, 'sessionStorage'); });
}

const snapshot = () => ({ key: 'play', state: createRoad(), tuning: { ...defaultTuning }, targetStage: 'excavator' as const });

test('schema preserves every entry stage, strips unknown fields and never trusts numeric strings', () => {
  for (const stage of stages) {
    const value = { ...snapshot(), state: createRoad(stage), targetStage: stage, extra: true };
    const result = decodeRoadSnapshot(value, 'play'); assert.ok(Result.isSuccess(result));
    assert.equal(result.success.state.phase, value.state.phase); assert.equal(result.success.targetStage, stage);
    assert.equal('extra' in result.success, false);
  }
  const value = snapshot();
  for (const bad of [NaN, Infinity, -Infinity, '60', null, 29, 141]) {
    const result = decodeRoadSnapshot({ ...value, tuning: { ...value.tuning, dragThreshold: bad } }, 'play');
    assert.ok(Result.isFailure(result)); assert.equal(result.failure.stage, 'schema');
    assert.match(String(result.failure.cause), /dragThreshold/);
  }
  for (const bad of [NaN, Infinity, '1', -1, 0.5, 4]) {
    assert.ok(Result.isFailure(decodeRoadSnapshot({ ...value, state: { ...value.state, excavator: { ...value.state.excavator, cleared: bad } } }, 'play')));
  }
});

test('schema rejects malformed versions, coordinates and access without throwing', () => {
  for (const value of [null, [], {}, { ...snapshot(), key: 'other' }, { ...snapshot(), state: { ...createRoad(), version: 2 } },
    { ...snapshot(), state: { ...createRoad(), access: 'teleport' } },
    { ...snapshot(), state: { ...createRoad(), excavator: { ...createRoad().excavator, bucket: { x: Infinity, y: 1, z: 0 } } } },
    { get state() { throw new Error('bad getter'); } }]) assert.ok(Result.isFailure(decodeRoadSnapshot(value, 'play')));
  const result = decodeRoadSnapshot({ ...snapshot(), targetStage: 'obsolete', tuning: { ...defaultTuning, dragTilt: 999 } }, 'play');
  assert.ok(Result.isSuccess(result)); assert.equal(result.success.targetStage, 'excavator');
  assert.equal(result.success.tuning.dragTilt, defaultTuning.dragTilt);
});

test('cross-field invariants reject contradictory cargo and completed phases', () => {
  const state = createRoad('complete');
  for (const candidate of [
    { ...state, excavator: { ...state.excavator, delivered: [0, 0, 1] } },
    { ...state, roller: { ...state.roller, passes: 1 } },
    { ...state, truck: { ...state.truck, phase: 'ready' } },
    { ...state, hauler: { ...state.hauler, action: 'ready' } },
  ]) {
    const result = decodeRoadSnapshot({ ...snapshot(), state: candidate }, 'play');
    assert.ok(Result.isFailure(result)); assert.equal(result.failure.stage, 'invariant');
  }
});

test('current road snapshots require version, round, gate, hauler and cargo fields', () => {
  const state = createRoad();
  for (const field of ['version', 'round', 'access', 'hauler'] as const) {
    const value: Record<string, unknown> = { ...state }; delete value[field];
    assert.ok(Result.isFailure(decodeRoadSnapshot({ ...snapshot(), state: value }, 'play')));
  }
  for (const field of ['control', 'delivered', 'carried', 'aimed'] as const) {
    const excavator: Record<string, unknown> = { ...state.excavator }; delete excavator[field];
    assert.ok(Result.isFailure(decodeRoadSnapshot({ ...snapshot(), state: { ...state, excavator } }, 'play')));
  }
});

test('development memory and HMR snapshots survive storage failure with independent keys and copies', t => {
  browser(t);
  const key = 'dev:test:memory', another = 'dev:test:other';
  const hot = { data: {} } as NonNullable<ImportMeta['hot']>;
  const value = { ...snapshot(), key, state: createRoad('roller-return'), targetStage: 'roller-return' as const };
  saveDevelopment(value, hot); value.state.roller.passes = 0;
  assert.equal(restoreDevelopment(key)?.state.roller.passes, 1);
  assert.equal(restoreDevelopment(key, hot)?.state.roller.passes, 1);
  assert.equal(restoreDevelopment(another), undefined);
  const fresh = { ...snapshot(), key }; saveDevelopment(fresh, hot);
  assert.equal(restoreDevelopment(key, hot)?.state.phase, 'excavator');
});

test('road save stays synchronous and formal/development snapshots stay separate', t => {
  browser(t); clearProgress('road-repair');
  const app = new Element(), session = createRoadSession(app as unknown as HTMLDivElement, false, undefined, () => {}, true);
  session.save();
  assert.equal((loadProgress('road-repair') as { key: string }).key, 'play');
  const dev = createRoadSession(new Element() as unknown as HTMLDivElement, true, undefined, () => {}, true);
  dev.save();
  assert.ok(restoreDevelopment('town-crew:road:v2:'));
  assert.equal((loadProgress('road-repair') as { key: string }).key, 'play');
});

for (const dev of [false, true]) {
  test(`road ${dev ? 'development' : 'formal'} pagehide writes before the event returns`, async t => {
    const env = browser(t), writes: Array<{ key: string; value: string }> = [];
    installStorage(t, { getItem: () => null, setItem: (key, value) => { writes.push({ key, value }); }, removeItem() {} });
    const session = createRoadSession(new Element() as unknown as HTMLDivElement, dev, undefined, () => {}, true);
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      yield* session.connect({ canvas: new Element() } as unknown as RoadScene, { setMuted() {}, unlock: async () => {}, play() {}, dispose: async () => {} });
      const before = writes.length;
      env.window.dispatchEvent(new Event('pagehide'));
      assert.equal(writes.length, before + 1);
      const saved = writes.at(-1)!;
      assert.equal(saved.key, dev ? 'town-crew:road:v2:' : 'town-crew:play:v1:road-repair');
      assert.equal(JSON.parse(saved.value).state.version, 1);
    })));
  });
}

test('failed last-round writes cannot replace a newer memory round with stale storage', t => {
  browser(t);
  installStorage(t, { getItem: () => JSON.stringify({ pattern: 'staggered', layout: 0 }), setItem() { throw new Error('quota'); }, removeItem() {} });
  const next = () => {
    createRoadSession(new Element() as unknown as HTMLDivElement, false, undefined, () => {}, true).save();
    return (loadProgress('road-repair') as ReturnType<typeof snapshot>).state.round;
  };
  const first = next(), second = next();
  assert.notEqual(second.layout, first.layout); assert.notEqual(second.pattern, first.pattern);
});
