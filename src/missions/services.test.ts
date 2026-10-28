import { createSanitationPersistence, SanitationPersistence } from './sanitation/services.ts';
import { prepareSanitationMission } from './sanitation/startup.ts';
import type { createSanitationScene } from './sanitation/scene.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { Effect, Exit, Fiber, Layer } from 'effect';
import { TestClock } from 'effect/testing';
import { AutosaveError } from '../runtime/autosave.ts';
import { FrameLoopError } from '../runtime/frame-loop.ts';
import type { Scope } from 'effect';
import { createProgressStore } from '../app/progress.ts';
import { createDevelopmentStore } from '../app/development.ts';
import { createStorageBoundary } from '../runtime/storage.ts';
import { createStartupDiagnostics } from '../runtime/mission-startup.ts';
import type { StartupDiagnostics, StartupReport } from '../runtime/mission-startup.ts';
import { missionFailureMessage } from '../runtime/mission-lifecycle.ts';
import { browser, Element } from '../../tests/helpers/lifecycle.ts';
import { snapshotFixtures } from '../../tests/helpers/snapshots.ts';
import { createHousePersistence, HousePersistence } from './house-build/services.ts';
import { prepareHouseMission } from './house-build/startup.ts';
import type { createHouseScene } from './house-build/scene.ts';
import { createFirePersistence, FirePersistence } from './fire-rescue/services.ts';
import { prepareFireMission } from './fire-rescue/startup.ts';
import type { createFireScene } from './fire-rescue/scene.ts';
import { createTrafficPersistence, TrafficPersistence } from './traffic-rescue/services.ts';
import { prepareTrafficMission } from './traffic-rescue/startup.ts';
import type { createTrafficScene } from './traffic-rescue/scene.ts';
import { createPolicePersistence, PolicePersistence } from './police-patrol/services.ts';
import { preparePoliceMission } from './police-patrol/startup.ts';
import type { createPoliceScene } from './police-patrol/scene.ts';
import { createPortPersistence, PortPersistence } from './port-cargo/services.ts';
import { preparePortMission } from './port-cargo/startup.ts';
import type { createPortScene } from './port-cargo/scene.ts';
import { createMountainPersistence, MountainPersistence } from './mountain-clearance/services.ts';
import { prepareMountainMission } from './mountain-clearance/startup.ts';
import type { createMountainScene } from './mountain-clearance/scene.ts';
import { createTransferPersistence, TransferPersistence } from './passenger-transfer/services.ts';
import { prepareTransferMission } from './passenger-transfer/startup.ts';
import type { createTransferScene } from './passenger-transfer/scene.ts';

function isolated() {
  const data = new Map<string, string>(), writes: string[] = [], denied = { value: false };
  const storage = createStorageBoundary('sessionStorage', () => {
    if (denied.value) throw new Error('storage denied');
    return { getItem: key => data.get(key) ?? null, setItem: (key, value) => { writes.push(key); data.set(key, value); }, removeItem: key => { data.delete(key); } };
  }, () => {});
  return { data, writes, denied, storage, progress: createProgressStore(storage, storage), development: createDevelopmentStore(storage) };
}
type Store = ReturnType<typeof isolated>;
type Options = { app: HTMLDivElement; dev: boolean; home: () => void; fresh: boolean };
type FakeScene = () => Effect.Effect<{ canvas: Element }, never, Scope.Scope>;
type FakeAudio = () => { unlock: () => Promise<void>; play: () => void; setMuted: () => void; setSpraying: (active: boolean) => void; dispose: () => Promise<void> };
const adapters = {
  sanitation: {
    create: (store: Store) => createSanitationPersistence(store.progress, store.storage, store.development),
    prepare: (store: Store, options: Options, scene: FakeScene, audio: FakeAudio, trace: StartupDiagnostics) => prepareSanitationMission(options, scene as unknown as typeof createSanitationScene, audio, trace).pipe(Effect.provide(Layer.succeed(SanitationPersistence, createSanitationPersistence(store.progress, store.storage, store.development)))),
  },
  'house-build': {
    create: (store: Store) => createHousePersistence(store.progress, store.storage, store.development),
    prepare: (store: Store, options: Options, scene: FakeScene, audio: FakeAudio, trace: StartupDiagnostics) =>
      prepareHouseMission(options, scene as unknown as typeof createHouseScene, audio, trace).pipe(
        Effect.provide(Layer.succeed(HousePersistence, createHousePersistence(store.progress, store.storage, store.development))),
      ),
  },
  'fire-rescue': {
    create: (store: Store) => createFirePersistence(store.progress, store.storage, store.development),
    prepare: (store: Store, options: Options, scene: FakeScene, audio: FakeAudio, trace: StartupDiagnostics) =>
      prepareFireMission(options, scene as unknown as typeof createFireScene, audio, trace).pipe(
        Effect.provide(Layer.succeed(FirePersistence, createFirePersistence(store.progress, store.storage, store.development))),
      ),
  },
  'traffic-rescue': {
    create: (store: Store) => createTrafficPersistence(store.progress, store.storage, store.development),
    prepare: (store: Store, options: Options, scene: FakeScene, audio: FakeAudio, trace: StartupDiagnostics) =>
      prepareTrafficMission(options, scene as unknown as typeof createTrafficScene, audio, trace).pipe(
        Effect.provide(Layer.succeed(TrafficPersistence, createTrafficPersistence(store.progress, store.storage, store.development))),
      ),
  },
  'police-patrol': {
    create: (store: Store) => createPolicePersistence(store.progress, store.storage, store.development),
    prepare: (store: Store, options: Options, scene: FakeScene, audio: FakeAudio, trace: StartupDiagnostics) =>
      preparePoliceMission(options, scene as unknown as typeof createPoliceScene, audio, trace).pipe(
        Effect.provide(Layer.succeed(PolicePersistence, createPolicePersistence(store.progress, store.storage, store.development))),
      ),
  },
  'port-cargo': {
    create: (store: Store) => createPortPersistence(store.progress, store.storage, store.development),
    prepare: (store: Store, options: Options, scene: FakeScene, audio: FakeAudio, trace: StartupDiagnostics) =>
      preparePortMission(options, scene as unknown as typeof createPortScene, audio, trace).pipe(
        Effect.provide(Layer.succeed(PortPersistence, createPortPersistence(store.progress, store.storage, store.development))),
      ),
  },
  'mountain-clearance': {
    create: (store: Store) => createMountainPersistence(store.progress, store.storage, store.development),
    prepare: (store: Store, options: Options, scene: FakeScene, audio: FakeAudio, trace: StartupDiagnostics) =>
      prepareMountainMission(options, scene as unknown as typeof createMountainScene, audio, trace).pipe(
        Effect.provide(Layer.succeed(MountainPersistence, createMountainPersistence(store.progress, store.storage, store.development))),
      ),
  },
  'passenger-transfer': {
    create: (store: Store) => createTransferPersistence(store.progress, store.storage, store.development),
    prepare: (store: Store, options: Options, scene: FakeScene, audio: FakeAudio, trace: StartupDiagnostics) =>
      prepareTransferMission(options, scene as unknown as typeof createTransferScene, audio, trace).pipe(
        Effect.provide(Layer.succeed(TransferPersistence, createTransferPersistence(store.progress, store.storage, store.development))),
      ),
  },
};

for (const fixture of snapshotFixtures) {
  const adapter = adapters[fixture.id];
  test(`${fixture.id}: injected stores isolate current snapshots, preferences, tombstones and development memory`, t => {
    const a = isolated(), b = isolated(), first = adapter.create(a), second = adapter.create(b);
    const value = fixture.valid(), key = `dev:${fixture.id}`;
    a.progress.saveProgress(fixture.id, value); a.development.saveDevelopment(key, value);
    const expected = first.load(false, key); assert.ok(expected);
    (value as { elapsed: number }).elapsed = 99;
    first.setMuted(true); first.markCompleted(); a.denied.value = true;
    assert.deepEqual(first.load(false, key), expected); assert.deepEqual(first.load(true, key), expected);
    assert.equal(second.load(false, key), undefined); assert.equal(second.load(true, key), undefined);
    assert.equal(first.isMuted(), true); assert.equal(second.isMuted(), false);
    assert.equal(a.progress.isCompleted(fixture.id), true); assert.equal(b.progress.isCompleted(fixture.id), false);
    a.progress.clearProgress(fixture.id); a.denied.value = false;
    assert.equal(first.load(false, key), undefined); assert.deepEqual(first.load(true, key), expected);
    assert.equal(first.load(true, 'other-query'), undefined);
    t.mock.method(console, 'warn', () => {});
    a.progress.saveProgress(fixture.id, { ...fixture.valid(), version: 0 });
    assert.equal(first.load(false, key), undefined, 'older versions do not migrate');
  });

  for (const dev of [false, true]) test(`${fixture.id}: injected ${dev ? 'development' : 'formal'} scope restores, synchronously saves, and closes in order`, async t => {
    const env = browser(t), store = isolated(), order: string[] = [], reports: StartupReport[] = [];
    const key = dev ? `town-crew:${fixture.prefix}:dev:v1:` : `town-crew:play:v1:${fixture.id}`;
    store.data.set(key, JSON.stringify(fixture.valid()));
    const expected = adapter.create(store).load(dev, key), controller = new AbortController(), canvas = new Element();
    const original = dev ? store.development.saveDevelopment : store.progress.saveProgress;
    if (dev) t.mock.method(store.development, 'saveDevelopment', (...args: Parameters<typeof original>) => { order.push('save'); original(...args); });
    else t.mock.method(store.progress, 'saveProgress', (...args: Parameters<typeof original>) => { order.push('save'); original(...args); });
    const trace = createStartupDiagnostics(fixture.id, dev, report => { reports.push(report); });
    const scene: FakeScene = () => Effect.acquireRelease(Effect.succeed({ canvas }), () => Effect.sync(() => { order.push('scene'); }));
    const audio: FakeAudio = () => ({ unlock: async () => {}, play() {}, setMuted() {}, setSpraying(active) { if (!active) order.push('stop-spraying'); }, dispose: async () => { order.push('audio'); } });
    const running = Effect.runPromiseExit(Effect.scoped(Effect.gen(function* () {
      const run = yield* trace.startup(adapter.prepare(store, { app: new Element() as unknown as HTMLDivElement, dev, home() {}, fresh: false }, scene, audio, trace));
      assert.equal(reports.length, 1); assert.equal(reports[0].mission, fixture.id); assert.equal(reports[0].mode, dev ? 'development' : 'play');
      assert.equal(reports[0].outcome, 'success'); assert.equal(order.includes('audio'), false);
      yield* run;
    })), { signal: controller.signal });
    await env.frameReady;
    const count = store.writes.length; env.window.dispatchEvent(new Event('pagehide'));
    assert.equal(store.writes.length, count + 1); assert.deepEqual(JSON.parse(store.data.get(key)!), expected);
    store.denied.value = true; env.window.dispatchEvent(new Event('pagehide'));
    assert.deepEqual(adapter.create(store).load(dev, key), expected);
    controller.abort(); const exit = await running;
    assert.ok(Exit.isFailure(exit)); assert.equal(missionFailureMessage(exit.cause), undefined);
    assert.deepEqual(order.slice(fixture.id === 'fire-rescue' ? -4 : -3), fixture.id === 'fire-rescue' ? ['save', 'stop-spraying', 'audio', 'scene'] : ['save', 'audio', 'scene']);
    assert.equal(order.filter(x => x === 'audio').length, 1); assert.equal(env.frames.size, 0);
    assert.ok([...canvas.signals, ...env.window.signals].every(signal => signal.aborted));
    assert.equal(reports.length, 1, 'cancelling the game does not reclassify startup');
  });

  for (const fault of ['prepare', 'scene', 'audio', 'connect'] as const) test(`${fixture.id}: ${fault} failure retains cause and finalizes acquired resources`, async t => {
    const env = browser(t), store = isolated(), order: string[] = [], reports: StartupReport[] = [];
    const original = new Error(`${fixture.id}/${fault}`), trace = createStartupDiagnostics(fixture.id, false, report => { reports.push(report); });
    if (fault === 'prepare') t.mock.method(store.progress, 'loadProgress', () => { throw original; });
    const scene: FakeScene = () => Effect.gen(function* () {
      yield* Effect.addFinalizer(() => Effect.sync(() => { order.push('scene'); }));
      if (fault === 'scene') yield* Effect.die(original);
      return { canvas: new Element() };
    });
    const audio: FakeAudio = () => {
      if (fault === 'audio') throw original;
      return { unlock: async () => {}, play() {}, setMuted() { if (fault === 'connect') throw original; }, setSpraying() {}, dispose: async () => { order.push('audio'); } };
    };
    const exit = await Effect.runPromiseExit(Effect.scoped(trace.startup(adapter.prepare(store,
      { app: new Element() as unknown as HTMLDivElement, dev: false, home() {}, fresh: false }, scene, audio, trace,
    ))));
    assert.ok(Exit.isFailure(exit));
    assert.ok(exit.cause.reasons.some(reason => reason._tag === 'Die' ? reason.defect === original : reason._tag === 'Fail' && (reason.error as { cause?: unknown }).cause === original));
    assert.deepEqual(order, fault === 'prepare' ? [] : fault === 'connect' ? ['audio', 'scene'] : ['scene']);
    assert.equal(env.frames.size, 0); assert.equal(reports[0].outcome, 'failure');
    assert.equal(reports[0].stages.at(-1)?.stage, fault); assert.equal(reports[0].stages.at(-1)?.outcome, 'failure');
  });

  test(`${fixture.id}: revisits acquire new audio and await close before scene cleanup`, async t => {
    browser(t); const store = isolated(), order: string[] = [];
    for (let visit = 0; visit < 2; visit++) {
      let finish!: () => void, closing!: () => void;
      const pending = new Promise<void>(resolve => { finish = resolve; }), started = new Promise<void>(resolve => { closing = resolve; });
      const trace = createStartupDiagnostics(fixture.id, false, () => {});
      const audio: FakeAudio = () => { order.push(`make${visit}`); return { unlock: async () => {}, play() {}, setMuted() {}, setSpraying() {}, dispose: async () => { order.push(`close${visit}`); closing(); await pending; } }; };
      const scene: FakeScene = () => Effect.acquireRelease(Effect.succeed({ canvas: new Element() }), () => Effect.sync(() => { order.push(`scene${visit}`); }));
      const running = Effect.runPromise(Effect.scoped(adapter.prepare(store,
        { app: new Element() as unknown as HTMLDivElement, dev: false, home() {}, fresh: visit === 0 }, scene, audio, trace,
      )));
      await started; assert.equal(order.at(-1), `close${visit}`); finish(); await running;
      assert.ok(adapter.create(store).load(false, 'unused'));
    }
    assert.deepEqual(order, ['make0', 'close0', 'scene0', 'make1', 'close1', 'scene1']);
  });
}

// Exercise each real session/startup with its actual cadence, independent of rAF.
const saveIntervals = { 'house-build': 800, 'fire-rescue': 800, 'traffic-rescue': 800,
  'police-patrol': 700, 'port-cargo': 700, 'mountain-clearance': 700, 'passenger-transfer': 700, sanitation: 700 };
function scheduledMission(t: TestContext, fixture: typeof snapshotFixtures[number], dev: boolean) {
  const env = browser(t), store = isolated(), order: string[] = [], app = new Element(), stage = new Element();
  const key = dev ? `town-crew:${fixture.prefix}:dev:v1:` : `town-crew:play:v1:${fixture.id}`;
  const initial = fixture.valid(); store.data.set(key, JSON.stringify(initial)); app.queries.set('#stage', stage);
  const round = 'round' in initial ? initial.round : {};
  for (const [name, value] of Object.entries(round)) {
    const control = new Element(); control.value = String(value);
    app.queries.set(`#${name}`, control); app.queries.set(`#house-${name}`, control);
  }
  if (fixture.id === 'police-patrol') { const control = new Element(); control.value = 'bike1'; app.queries.set('#lead-bike', control); const inspection = new Element(); inspection.value = '0'; app.queries.set('#inspection', inspection); }
  const original = dev ? store.development.saveDevelopment : store.progress.saveProgress;
  const observe = (...args: Parameters<typeof original>) => { order.push('save'); original(...args); };
  if (dev) t.mock.method(store.development, 'saveDevelopment', observe);
  else t.mock.method(store.progress, 'saveProgress', observe);
  const scene: FakeScene = () => Effect.acquireRelease(Effect.succeed({ canvas: new Element() }), () => Effect.sync(() => { order.push('scene'); }));
  const audio: FakeAudio = () => ({ unlock: async () => {}, play() {}, setMuted() {},
    setSpraying(active) { if (!active) order.push('stop-spraying'); }, dispose: async () => { order.push('audio'); } });
  const trace = createStartupDiagnostics(fixture.id, dev, () => {});
  const program = Effect.scoped(Effect.gen(function* () {
    const run = yield* trace.startup(adapters[fixture.id].prepare(store,
      { app: app as unknown as HTMLDivElement, dev, home() {}, fresh: false }, scene, audio, trace));
    yield* run;
  }));
  return { env, store, order, stage, key, program, interval: saveIntervals[fixture.id] };
}

for (const fixture of snapshotFixtures) {
  for (const dev of [false, true]) test(`${fixture.id}: ${dev ? 'development' : 'formal'} autosave cadence, hidden skips, latest state and final cleanup`, async t => {
    const { env, store, order, stage, key, program, interval } = scheduledMission(t, fixture, dev);
    await Effect.runPromise(Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(program);
      yield* TestClock.adjust(interval - 1); assert.deepEqual(order, []);
      yield* TestClock.adjust(1); assert.deepEqual(order, ['save']); assert.equal(env.frames.size, 1);
      stage.value = 'complete'; stage.dispatchEvent(new Event('change'));
      store.data.delete(key); // The next periodic save must use the changed session state.
      yield* TestClock.adjust(interval);
      assert.equal(JSON.parse(store.data.get(key)!).phase, 'complete');
      env.document.hidden = true;
      const beforeHide = order.length; env.document.dispatchEvent(new Event('visibilitychange'));
      assert.equal(order.length, beforeHide + 1, 'visibility flush is synchronous');
      const hidden = order.length; yield* TestClock.adjust(interval * 10); assert.equal(order.length, hidden);
      env.window.dispatchEvent(new Event('pagehide')); assert.equal(order.length, hidden + 1);
      env.document.hidden = false;
      const visible = order.length; yield* TestClock.adjust(interval - 1); assert.equal(order.length, visible);
      yield* TestClock.adjust(1); assert.equal(order.length, visible + 1, 'no catch-up burst');
      store.denied.value = true; stage.value = fixture.initial; stage.dispatchEvent(new Event('change'));
      yield* TestClock.adjust(interval);
      assert.equal(adapters[fixture.id].create(store).load(dev, key)?.phase, fixture.initial);
      assert.equal(JSON.parse(store.data.get(key)!).phase, 'complete', 'newer memory wins after rejected writes');
      yield* Fiber.interrupt(fiber);
      const exit = yield* Fiber.await(fiber); assert.ok(Exit.isFailure(exit)); assert.equal(missionFailureMessage(exit.cause), undefined);
      const cleanup = fixture.id === 'fire-rescue' ? ['save', 'stop-spraying', 'audio', 'scene'] : ['save', 'audio', 'scene'];
      assert.deepEqual(order.slice(-cleanup.length), cleanup); assert.equal(env.frames.size, 0);
      const closed = order.length; yield* TestClock.adjust(interval * 10); assert.equal(order.length, closed);
    }).pipe(Effect.provide(TestClock.layer())));
  });

  for (const fault of ['save', 'frame'] as const) test(`${fixture.id}: ${fault} failure stops both scheduled work and frames before cleanup`, async t => {
    const { env, store, order, program, interval } = scheduledMission(t, fixture, false);
    const original = new Error(`${fixture.id}/${fault}`);
    if (fault === 'save') {
      const save = store.progress.saveProgress; let fail = true;
      t.mock.method(store.progress, 'saveProgress', (...args: Parameters<typeof save>) => {
        if (fail) { fail = false; throw original; } save(...args);
      });
    } else t.mock.method(globalThis, 'requestAnimationFrame', () => { throw original; });
    await Effect.runPromise(Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(program);
      yield* TestClock.adjust(interval);
      const exit = yield* Fiber.await(fiber); assert.ok(Exit.isFailure(exit));
      const reason = exit.cause.reasons.find(r => r._tag === 'Fail');
      assert.ok(reason?.error instanceof (fault === 'save' ? AutosaveError : FrameLoopError));
      assert.equal(reason.error.cause, original); assert.equal(reason.error.mission, fixture.id);
      assert.equal(env.frames.size, 0);
      const cleanup = fixture.id === 'fire-rescue' ? ['save', 'stop-spraying', 'audio', 'scene'] : ['save', 'audio', 'scene'];
      assert.deepEqual(order.slice(-cleanup.length), cleanup);
      const closed = order.length; yield* TestClock.adjust(interval * 10); assert.equal(order.length, closed);
    }).pipe(Effect.provide(TestClock.layer())));
  });
}
