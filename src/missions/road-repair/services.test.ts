import assert from 'node:assert/strict';
import test from 'node:test';
import { Effect, Exit, Layer } from 'effect';
import { createProgressStore } from '../../app/progress.ts';
import { createStorageBoundary } from '../../runtime/storage.ts';
import { createStartupDiagnostics } from '../../runtime/mission-startup.ts';
import type { StartupReport } from '../../runtime/mission-startup.ts';
import { missionFailureMessage, SessionInitError } from '../../runtime/mission-lifecycle.ts';
import { browser, Element } from '../../../tests/helpers/lifecycle.ts';
import { createRoadPersistence, RoadPersistence } from './services.ts';
import { prepareRoadMission } from './startup.ts';
import { createRoad } from './domain/road.ts';
import { defaultTuning } from './domain/dump-truck.ts';
import type { RoadScene, createScene } from './scene.ts';

function isolated() {
  const data = new Map<string, string>(), writes: string[] = [], denied = { value: false };
  const storage = createStorageBoundary('sessionStorage', () => {
    if (denied.value) throw new Error('storage denied');
    return { getItem: key => data.get(key) ?? null, setItem: (key, value) => { writes.push(key); data.set(key, value); }, removeItem: key => { data.delete(key); } };
  }, () => {});
  const progress = createProgressStore(storage, storage);
  return { data, writes, denied, progress, service: createRoadPersistence(progress, storage) };
}
const snapshot = (key = 'play') => ({ key, state: createRoad('roller-return'), tuning: { ...defaultTuning }, targetStage: 'roller-return' as const });

test('injected persistence isolates memory, keys and preferences without changing browser storage', () => {
  const a = isolated(), b = isolated();
  a.service.save(false, snapshot()); a.service.save(true, snapshot('dev:a')); a.service.setMuted(true); a.service.markCompleted();
  assert.equal(b.service.load(false, 'unused'), undefined); assert.equal(b.service.load(true, 'dev:a'), undefined);
  assert.equal(b.service.isMuted(), false); assert.equal(b.progress.isCompleted('road-repair'), false);
  a.denied.value = true;
  assert.equal(a.service.load(false, 'unused')?.state.roller.passes, 1);
  assert.equal(a.service.load(true, 'dev:a')?.state.roller.passes, 1);
  assert.equal(a.service.isMuted(), true); assert.equal(a.progress.isCompleted('road-repair'), true);
  a.progress.clearProgress('road-repair');
  assert.equal(a.service.load(false, 'unused'), undefined);
  a.denied.value = false;
  assert.equal(a.service.load(false, 'unused'), undefined, 'failed removal is still masked');
  assert.equal(a.service.load(true, 'dev:a')?.state.roller.passes, 1);
});

test('injected development stores copy snapshots and preserve HMR priority and current-only recovery', () => {
  const { service, denied } = isolated(), hot = { data: {} } as NonNullable<ImportMeta['hot']>;
  const value = snapshot('dev'); service.save(true, value, hot); value.state.roller.passes = 0;
  denied.value = true;
  assert.equal(service.load(true, 'dev', hot)?.state.roller.passes, 1);
  assert.equal(service.load(true, 'dev')?.state.roller.passes, 1);
  assert.equal(service.load(true, 'other'), undefined);
  service.save(true, { ...snapshot('dev'), state: createRoad() });
  assert.equal(service.load(true, 'dev', hot)?.state.phase, 'roller');
  assert.equal(service.load(true, 'dev')?.state.phase, 'excavator');
  hot.data.snapshot = { ...snapshot('dev'), state: { ...createRoad(), version: 0 } };
  assert.equal(service.load(true, 'dev', hot), undefined);
});

for (const dev of [false, true]) test(`injected ${dev ? 'development' : 'formal'} session saves synchronously and releases audio after connection`, async t => {
  const env = browser(t), store = isolated(), reports: StartupReport[] = [], order: string[] = [];
  const trace = createStartupDiagnostics('road-repair', dev, report => { reports.push(report); });
  const controller = new AbortController(), app = new Element(), canvas = new Element();
  const service = { ...store.service, save: (...args: Parameters<typeof store.service.save>) => { order.push('save'); store.service.save(...args); } };
  const scene = (() => Effect.acquireRelease(Effect.succeed({ canvas } as unknown as RoadScene), () => Effect.sync(() => { order.push('scene'); }))) as typeof createScene;
  const audio = { unlock: async () => {}, play() {}, setMuted() {}, dispose: async () => { order.push('audio'); } };
  const running = Effect.runPromiseExit(Effect.scoped(Effect.gen(function* () {
    const run = yield* trace.startup(prepareRoadMission({ app: app as unknown as HTMLDivElement, dev, home() {}, fresh: true }, scene, () => audio, trace).pipe(
      Effect.provide(Layer.succeed(RoadPersistence, service)),
    ));
    assert.equal(reports.length, 1); assert.equal(reports[0].outcome, 'success'); assert.equal(order.includes('audio'), false);
    yield* run;
  })), { signal: controller.signal });
  await env.frameReady;
  const count = store.writes.length; env.window.dispatchEvent(new Event('pagehide')); assert.equal(store.writes.length, count + 1);
  store.denied.value = true; env.window.dispatchEvent(new Event('pagehide'));
  assert.ok(store.service.load(dev, 'town-crew:road:v2:'));
  controller.abort(); const exit = await running;
  assert.ok(Exit.isFailure(exit)); assert.equal(missionFailureMessage(exit.cause), undefined);
  assert.deepEqual(order.slice(-3), ['save', 'audio', 'scene']); assert.equal(order.filter(x => x === 'audio').length, 1);
  assert.equal(env.frames.size, 0); assert.ok([...canvas.signals, ...env.window.signals].every(signal => signal.aborted));
  assert.equal(reports.length, 1, 'normal runtime cancellation does not reclassify startup');
});

for (const fault of ['prepare', 'scene', 'audio', 'connect'] as const) test(`injected startup ${fault} failure keeps original cause and cleans acquired services`, async t => {
  const env = browser(t), store = isolated(), order: string[] = [], reports: StartupReport[] = [];
  const original = new Error(`${fault} fault`), app = new Element();
  const trace = createStartupDiagnostics('road-repair', false, report => { reports.push(report); });
  if (fault === 'prepare') t.mock.method(store.service, 'load', () => { throw original; });
  const scene = (() => Effect.gen(function* () {
    yield* Effect.addFinalizer(() => Effect.sync(() => { order.push('scene'); }));
    if (fault === 'scene') yield* Effect.die(original);
    return { canvas: new Element() } as unknown as RoadScene;
  })) as typeof createScene;
  const audio = () => {
    if (fault === 'audio') throw original;
    return { unlock: async () => {}, play() {}, setMuted() { if (fault === 'connect') throw original; }, dispose: async () => { order.push('audio'); } };
  };
  const exit = await Effect.runPromiseExit(Effect.scoped(trace.startup(prepareRoadMission({ app: app as unknown as HTMLDivElement, dev: false, home() {}, fresh: false }, scene, audio, trace).pipe(
    Effect.provide(Layer.succeed(RoadPersistence, store.service)),
  ))));
  assert.ok(Exit.isFailure(exit));
  assert.ok(exit.cause.reasons.some(reason => reason._tag === 'Die' ? reason.defect === original : reason._tag === 'Fail' && (reason.error as { cause?: unknown }).cause === original));
  if (fault === 'connect') assert.ok(exit.cause.reasons.some(r => r._tag === 'Fail' && r.error instanceof SessionInitError && r.error.stage === 'connect'));
  assert.deepEqual(order, fault === 'prepare' ? [] : fault === 'connect' ? ['audio', 'scene'] : ['scene']);
  assert.equal(env.frames.size, 0); assert.equal(reports[0].outcome, 'failure');
  assert.equal(reports[0].stages.at(-1)?.stage, fault); assert.equal(reports[0].stages.at(-1)?.outcome, 'failure');
});

test('two mission scopes acquire independent audio objects while sharing chosen persistence', async t => {
  browser(t); const store = isolated(), made: number[] = [], closed: number[] = [];
  const trace = () => createStartupDiagnostics('road-repair', true, () => {});
  for (let visit = 0; visit < 2; visit++) {
    const diagnostics = trace();
    await Effect.runPromise(Effect.scoped(prepareRoadMission({ app: new Element() as unknown as HTMLDivElement, dev: true, home() {}, fresh: visit === 0 },
      (() => Effect.succeed({ canvas: new Element() } as unknown as RoadScene)) as typeof createScene,
      () => { made.push(visit); return { unlock: async () => {}, play() {}, setMuted() {}, dispose: async () => { closed.push(visit); } }; }, diagnostics,
    ).pipe(Effect.provide(Layer.succeed(RoadPersistence, store.service)))));
  }
  assert.deepEqual(made, [0, 1]); assert.deepEqual(closed, [0, 1]); assert.ok(store.service.load(true, 'town-crew:road:v2:'));
});

test('audio Layer waits for asynchronous close and still releases scene after close rejection', async t => {
  const env = browser(t), store = isolated(), order: string[] = [], controller = new AbortController();
  let closing!: () => void, finish!: () => void;
  const closeStarted = new Promise<void>(resolve => { closing = resolve; });
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const original = new Error('audio close failed'), logged = t.mock.method(console, 'error', () => {});
  const diagnostics = createStartupDiagnostics('road-repair', false, () => {});
  const scene = (() => Effect.acquireRelease(Effect.succeed({ canvas: new Element() } as unknown as RoadScene), () => Effect.sync(() => { order.push('scene'); }))) as typeof createScene;
  const running = Effect.runPromiseExit(Effect.scoped(Effect.gen(function* () {
    const run = yield* prepareRoadMission({ app: new Element() as unknown as HTMLDivElement, dev: false, home() {}, fresh: true }, scene,
      () => ({ unlock: async () => {}, play() {}, setMuted() {}, dispose: async () => { order.push('audio'); closing(); await pending; throw original; } }), diagnostics,
    ).pipe(Effect.provide(Layer.succeed(RoadPersistence, store.service)));
    yield* run;
  })), { signal: controller.signal });
  await env.frameReady; controller.abort(); await closeStarted;
  assert.deepEqual(order, ['audio']); assert.equal(env.frames.size, 0);
  finish(); const exit = await running;
  assert.deepEqual(order, ['audio', 'scene']); assert.equal(logged.mock.callCount(), 1);
  assert.equal((logged.mock.calls[0].arguments[1] as { cause: unknown }).cause, original);
  assert.ok(Exit.isFailure(exit)); assert.equal(missionFailureMessage(exit.cause), undefined);
});
