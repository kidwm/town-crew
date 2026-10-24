import assert from 'node:assert/strict';
import test from 'node:test';
import { Effect, Fiber, Layer } from 'effect';
import { TestClock } from 'effect/testing';
import { browser, Element } from '../../../tests/helpers/lifecycle.ts';
import { createStorageBoundary } from '../../runtime/storage.ts';
import { createProgressStore } from '../../app/progress.ts';
import { createStartupDiagnostics } from '../../runtime/mission-startup.ts';
import { createRoadPersistence, RoadPersistence } from './services.ts';
import { prepareRoadMission } from './startup.ts';
import type { createScene } from './scene.ts';

for (const dev of [false, true]) test(`road ${dev ? 'development' : 'formal'} scheduled save shares pagehide, visibility and final-save state`, async t => {
  const env = browser(t), disk = new Map<string, string>(), order: string[] = [];
  let denied = false;
  const storage = createStorageBoundary('sessionStorage', () => ({
    getItem: key => disk.get(key) ?? null,
    setItem: (key, value) => { if (denied) throw new Error('quota'); disk.set(key, value); },
    removeItem: key => { disk.delete(key); },
  }), () => {});
  const persistence = createRoadPersistence(createProgressStore(storage, storage), storage);
  const save = persistence.save;
  t.mock.method(persistence, 'save', (...args: Parameters<typeof save>) => { order.push('save'); save(...args); });
  const key = dev ? 'town-crew:road:v2:' : 'town-crew:play:v1:road-repair';
  const app = new Element(), stage = new Element(); app.queries.set('#stage', stage);
  const scene = (() => Effect.acquireRelease(Effect.succeed({ canvas: new Element() }), () => Effect.sync(() => { order.push('scene'); }))) as unknown as typeof createScene;
  const audio = () => ({ unlock: async () => {}, play() {}, setMuted() {}, dispose: async () => { order.push('audio'); } });
  const trace = createStartupDiagnostics('road-repair', dev, () => {});
  await Effect.runPromise(Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(Effect.scoped(Effect.gen(function* () {
      const run = yield* prepareRoadMission({ app: app as unknown as HTMLDivElement, dev, home() {}, fresh: false }, scene, audio, trace).pipe(
        Effect.provide(Layer.succeed(RoadPersistence, persistence)),
      );
      yield* run;
    })));
    yield* TestClock.adjust(799); assert.equal(order.length, 0);
    yield* TestClock.adjust(1); assert.deepEqual(order, ['save']); assert.ok(disk.get(key));
    // Freeze rendering (no fake rAF callbacks are executed), yet later input is saved.
    stage.value = 'complete'; stage.dispatchEvent(new Event('change'));
    assert.equal(persistence.load(dev, key)?.state.phase, 'complete');
    const before = order.length;
    env.window.dispatchEvent(new Event('pagehide')); assert.equal(order.length, before + 1);
    assert.equal(JSON.parse(disk.get(key)!).state.phase, 'complete');
    env.document.hidden = true; env.document.dispatchEvent(new Event('visibilitychange'));
    const hidden = order.length; yield* TestClock.adjust(8000); assert.equal(order.length, hidden);
    env.document.hidden = false; denied = true;
    stage.value = 'roller-return'; stage.dispatchEvent(new Event('change'));
    yield* TestClock.adjust(800);
    assert.equal(persistence.load(dev, key)?.state.roller.passes, 1);
    assert.equal(JSON.parse(disk.get(key)!).state.phase, 'complete', 'failed disk writes do not lose newer memory');
    yield* Fiber.interrupt(fiber);
    assert.deepEqual(order.slice(-3), ['save', 'audio', 'scene']); assert.equal(env.frames.size, 0);
    const closed = order.length; yield* TestClock.adjust(8000); assert.equal(order.length, closed);
  }).pipe(Effect.provide(TestClock.layer())));
});
