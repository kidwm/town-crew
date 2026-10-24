import assert from 'node:assert/strict';
import test from 'node:test';
import { Cause, Effect, Exit } from 'effect';
import { AudioCloseError, ModuleLoadError, SceneInitError, SessionInitError, closeMissionAudio, initializeScene, initializeSession, loadMissionModule, missionFailureMessage } from './mission-lifecycle.ts';
import { releaseAll } from './cleanup.ts';
import { createShapes } from './geometry.ts';

test('module rejection preserves mission, module and original cause', async () => {
  const original = new Error('chunk unavailable');
  const exit = await Effect.runPromiseExit(loadMissionModule('road-repair', 'scene', () => Promise.reject(original)));
  assert.ok(Exit.isFailure(exit));
  const failure = exit.cause.reasons.find(reason => reason._tag === 'Fail');
  assert.ok(failure?.error instanceof ModuleLoadError);
  assert.equal(failure.error.cause, original);
  assert.equal(failure.error.mission, 'road-repair');
  assert.equal(failure.error.module, 'scene');
  assert.match(missionFailureMessage(exit.cause)!, /關卡資料/);
});

test('scene and session startup errors retain their integration stage', async () => {
  const original = new Error('setup failed');
  for (const [effect, errorClass] of [
    [initializeScene('road-repair', Effect.die(original)), SceneInitError],
    [initializeSession('road-repair', 'prepare', Effect.die(original)), SessionInitError],
    [initializeSession('road-repair', 'connect', Effect.die(original)), SessionInitError],
  ] as const) {
    const exit = await Effect.runPromiseExit<never, SceneInitError | SessionInitError>(effect);
    assert.ok(Exit.isFailure(exit));
    const failure = exit.cause.reasons.find(reason => reason._tag === 'Fail');
    assert.ok(failure?.error instanceof errorClass);
    assert.equal(failure.error.cause, original);
    assert.ok(missionFailureMessage(exit.cause));
  }
});

test('late module resolution after cancellation never starts a scene', async () => {
  let loaded!: (value: string) => void;
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const pending = new Promise<string>(resolve => { loaded = resolve; });
  let mounted = false;
  const controller = new AbortController();
  const running = Effect.runPromiseExit(Effect.gen(function* () {
    yield* loadMissionModule('road-repair', 'scene', () => { started(); return pending; });
    mounted = true;
  }), { signal: controller.signal });
  await ready; controller.abort();
  const exit = await running;
  loaded('late chunk'); await pending;
  assert.equal(mounted, false);
  assert.ok(Exit.isFailure(exit));
  assert.equal(missionFailureMessage(exit.cause), undefined);
});

test('initialization wrappers preserve normal interruption', async () => {
  const exit = await Effect.runPromiseExit(initializeScene('road-repair', initializeSession('road-repair', 'connect', Effect.interrupt).pipe(Effect.orDie)));
  assert.ok(Exit.isFailure(exit));
  assert.equal(missionFailureMessage(exit.cause), undefined);
});

test('audio close rejection is reported during cancellation and scene cleanup still runs', async t => {
  const order: string[] = [];
  const original = new Error('audio close failed');
  const logged = t.mock.method(console, 'error', () => {});
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const controller = new AbortController();
  const running = Effect.runPromiseExit(Effect.scoped(Effect.gen(function* () {
    yield* Effect.addFinalizer(() => Effect.sync(() => { order.push('scene'); }));
    yield* Effect.acquireRelease(Effect.succeed({ dispose: async () => { order.push('audio'); throw original; } }), value => closeMissionAudio('road-repair', value));
    yield* Effect.addFinalizer(() => Effect.sync(() => { order.push('connection'); }));
    started(); yield* Effect.never;
  })), { signal: controller.signal });
  await ready; controller.abort();
  const exit = await running;
  assert.deepEqual(order, ['connection', 'audio', 'scene']);
  assert.equal(logged.mock.callCount(), 1);
  const error = logged.mock.calls[0].arguments[1] as AudioCloseError;
  assert.ok(error instanceof AudioCloseError);
  assert.equal(error.cause, original);
  assert.ok(Exit.isFailure(exit));
  assert.equal(missionFailureMessage(exit.cause), undefined);
});

test('cleanup defects combined with interruption are still reportable', async () => {
  const exit = await Effect.runPromiseExit(Effect.scoped(Effect.gen(function* () {
    yield* Effect.addFinalizer(() => Effect.die(new Error('cleanup defect')));
    yield* Effect.interrupt;
  })));
  assert.ok(Exit.isFailure(exit));
  assert.ok(Cause.hasInterrupts(exit.cause));
  assert.ok(Cause.hasDies(exit.cause));
  assert.ok(missionFailureMessage(exit.cause));
});

test('a broken audio cleanup logger preserves cancellation and still releases the scene', async t => {
  const original = new Error('close failed');
  const logged = t.mock.method(console, 'error', () => { throw new Error('logger failed'); });
  let released = false;
  const exit = await Effect.runPromiseExit(Effect.scoped(Effect.gen(function* () {
    yield* Effect.addFinalizer(() => Effect.sync(() => { released = true; }));
    yield* Effect.addFinalizer(() => closeMissionAudio('fire-rescue', { dispose: async () => { throw original; } }));
    yield* Effect.interrupt;
  })));
  assert.equal(released, true);
  assert.equal(logged.mock.callCount(), 1);
  assert.equal((logged.mock.calls[0].arguments[1] as AudioCloseError).cause, original);
  assert.ok(Exit.isFailure(exit));
  assert.ok(Cause.hasInterruptsOnly(exit.cause));
  assert.equal(missionFailureMessage(exit.cause), undefined);
});

test('all release steps and cached materials are attempted after a disposer throws', () => {
  const calls: string[] = [];
  const failure = new Error('dispose failed');
  assert.throws(() => releaseAll([
    () => { calls.push('first'); throw failure; },
    () => { calls.push('second'); },
  ]), error => error instanceof AggregateError && error.errors[0] === failure);
  assert.deepEqual(calls, ['first', 'second']);
  const shapes = createShapes();
  shapes.material('red').addEventListener('dispose', () => { throw failure; });
  shapes.material('blue').addEventListener('dispose', () => { calls.push('blue'); });
  assert.throws(() => shapes.disposeMaterials(), AggregateError);
  assert.equal(calls.at(-1), 'blue');
  assert.doesNotThrow(() => shapes.disposeMaterials());
});
