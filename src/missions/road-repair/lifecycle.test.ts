import assert from 'node:assert/strict';
import test from 'node:test';
import { Element, browser, renderer } from '../../../tests/helpers/lifecycle.ts';
import { Effect, Exit } from 'effect';
import * as THREE from 'three';
import { createScene, type RoadScene } from './scene.ts';
import { createRoadSession } from './session.ts';
import { initializeScene, initializeSession, SceneInitError, SessionInitError } from '../../runtime/mission-lifecycle.ts';
import { bindPrimaryDrag } from '../../runtime/pointer.ts';
import { FrameLoopError } from '../../runtime/frame-loop.ts';
import { closeMissionAudio, missionFailureMessage } from '../../runtime/mission-lifecycle.ts';

test('failure after renderer attachment removes canvas and releases renderer even if dispose fails', async t => {
  browser(t);
  const { fake, calls, canvas, make } = renderer();
  const host = new Element();
  const setupFailure = new Error('append failed after attachment');
  t.mock.method(host, 'append', (child: Element) => { host.children.push(child); throw setupFailure; });
  t.mock.method(fake, 'dispose', () => { calls.push('dispose'); throw new Error('dispose failed'); });
  const exit = await Effect.runPromiseExit(Effect.scoped(initializeScene('road-repair', createScene(host as unknown as HTMLElement, make))));
  assert.ok(Exit.isFailure(exit));
  const failure = exit.cause.reasons.find(reason => reason._tag === 'Fail');
  assert.ok(failure?.error instanceof SceneInitError);
  assert.equal(failure.error.cause, setupFailure);
  assert.deepEqual(calls, ['dispose', 'context-loss']);
  assert.equal(host.children[0], canvas);
  assert.equal(canvas.removed, true);
  assert.ok(exit.cause.reasons.some(reason => reason._tag === 'Die'));
});

test('late scene initialization failure disconnects observer and disposes built geometry and materials', async t => {
  const { resize } = browser(t);
  const original = new Error('observe failed');
  t.mock.method(resize, 'observe', () => { throw original; });
  const geometry = t.mock.method(THREE.BufferGeometry.prototype, 'dispose', () => {});
  const material = t.mock.method(THREE.Material.prototype, 'dispose', () => {});
  const { make, canvas, calls } = renderer();
  const exit = await Effect.runPromiseExit(Effect.scoped(initializeScene('road-repair', createScene(new Element() as unknown as HTMLElement, make))));
  assert.ok(Exit.isFailure(exit));
  const failure = exit.cause.reasons.find(reason => reason._tag === 'Fail');
  assert.ok(failure?.error instanceof SceneInitError);
  assert.equal(failure.error.cause, original);
  assert.equal(resize.disconnected, true);
  assert.ok(geometry.mock.callCount() > 0);
  assert.ok(material.mock.callCount() > 0);
  assert.deepEqual(calls, ['dispose', 'context-loss']);
  assert.equal(canvas.removed, true);
});

function connection() {
  const app = new Element();
  const canvas = new Element();
  const session = createRoadSession(app as unknown as HTMLDivElement, false, undefined, () => {}, true);
  const audio = { setMuted() {}, unlock: async () => {}, play() {}, dispose: async () => {} };
  return { app, canvas, session, audio, effect: () => session.connect({ canvas } as unknown as RoadScene, audio) };
}

test('connect failure after pointer listeners were added removes listeners and hint', async t => {
  const { document, window, frames } = browser(t);
  const { app, canvas, effect } = connection();
  const original = new Error('sound control failed');
  t.mock.method(app.querySelector('.sound')!, 'addEventListener', () => { throw original; });
  const exit = await Effect.runPromiseExit(Effect.scoped(initializeSession('road-repair', 'connect', effect())));
  assert.ok(Exit.isFailure(exit));
  const failure = exit.cause.reasons.find(reason => reason._tag === 'Fail');
  assert.ok(failure?.error instanceof SessionInitError);
  assert.equal(failure.error.stage, 'connect');
  assert.equal(failure.error.cause, original);
  const signals = [...canvas.signals, ...document.signals, ...window.signals];
  assert.ok(signals.length > 0);
  assert.ok(signals.every(signal => signal.aborted));
  assert.equal(app.querySelector('.world')!.children[0].removed, true);
  assert.equal(frames.size, 0);
});

test('failed final save cannot leave an animation frame, hint or event listeners alive', async t => {
  const { document, window, frames, frameReady } = browser(t);
  const { app, canvas, effect } = connection();
  const original = new Error('snapshot clone failed');
  const controller = new AbortController();
  const running = Effect.runPromiseExit(Effect.scoped(Effect.gen(function* () {
    const run = yield* effect();
    t.mock.method(globalThis, 'structuredClone', () => { throw original; });
    yield* run;
  })), { signal: controller.signal });
  await frameReady; assert.equal(frames.size, 1);
  controller.abort(); const exit = await running;
  assert.ok(Exit.isFailure(exit));
  assert.ok(exit.cause.reasons.some(reason => reason._tag === 'Die' && reason.defect === original));
  assert.equal(frames.size, 0);
  assert.ok([...canvas.signals, ...document.signals, ...window.signals].every(signal => signal.aborted));
  assert.equal(app.querySelector('.world')!.children[0].removed, true);
});

test('final snapshot is saved before listeners are removed', async t => {
  const { frames } = browser(t);
  const { canvas, effect } = connection();
  const order: string[] = [];
  const originalClone = structuredClone;
  t.mock.method(globalThis, 'structuredClone', (value: unknown) => { order.push('save'); return originalClone(value); });
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    yield* effect();
    canvas.signals[0].addEventListener('abort', () => { order.push('listeners'); });
  })));
  assert.deepEqual(order, ['save', 'listeners']);
  assert.equal(frames.size, 0);
});

test('pointer capture is released even if cancelling a gesture throws', t => {
  browser(t);
  const canvas = new Element(), controller = new AbortController();
  const original = new Error('gesture cancellation failed');
  const pointer = bindPrimaryDrag(canvas as unknown as HTMLCanvasElement, {
    start: () => ({}), move() {}, end() { throw original; },
  }, controller.signal);
  canvas.dispatchEvent(Object.assign(new Event('pointerdown', { cancelable: true }), { isPrimary: true, button: 0, pointerId: 1 }));
  assert.equal(canvas.captured, true);
  assert.throws(() => pointer.cancel(), error => error === original);
  assert.equal(canvas.captured, false);
  assert.equal(pointer.context(), undefined);
  controller.abort();
});

for (const boundary of ['render', 'hud'] as const) {
  test(`road ${boundary} failure ends the running mission and releases input, audio and scene`, async t => {
    const env = browser(t), app = new Element(), host = new Element();
    app.queries.set('#excavator-keyboard-help', new Element());
    const { make, fake, canvas, calls } = renderer();
    const original = new Error(`${boundary} failed`);
    Object.assign(fake, { render() { if (boundary === 'render') throw original; } });
    if (boundary === 'hud') t.mock.method(app.querySelector('.progress')!, 'setAttribute', () => { throw original; });
    const audio = { setMuted() {}, unlock: async () => {}, play() {}, dispose: async () => { calls.push('audio'); } };
    const running = Effect.runPromiseExit(Effect.scoped(Effect.gen(function* () {
      const session = createRoadSession(app as unknown as HTMLDivElement, false, undefined, () => {}, true);
      const scene = yield* initializeScene('road-repair', createScene(host as unknown as HTMLElement, make));
      yield* Effect.acquireRelease(Effect.succeed(audio), value => closeMissionAudio('road-repair', value));
      const run = yield* initializeSession('road-repair', 'connect', session.connect(scene, audio));
      yield* run;
    })));
    await env.frameReady;
    const [id, frame] = env.frames.entries().next().value!; env.frames.delete(id);
    frame(performance.now()); const exit = await running;
    assert.ok(Exit.isFailure(exit));
    const failure = exit.cause.reasons.find(r => r._tag === 'Fail');
    assert.ok(failure?.error instanceof FrameLoopError);
    assert.equal(failure.error.cause, original);
    assert.match(missionFailureMessage(exit.cause)!, /關卡執行/);
    assert.deepEqual(calls, ['audio', 'dispose', 'context-loss']);
    assert.equal(env.frames.size, 0); assert.equal(canvas.removed, true); assert.equal(env.resize.disconnected, true);
    assert.ok([...canvas.signals, ...env.document.signals, ...env.window.signals].every(s => s.aborted));
    assert.equal(app.querySelector('.world')!.children[0].removed, true);
  });
}

test('road gesture audio failures leave the frame loop running and handlers stop after disposal', async t => {
  const env = browser(t), { app, canvas, audio, effect } = connection();
  app.queries.set('#excavator-keyboard-help', new Element());
  let unlocks = 0;
  t.mock.method(audio, 'unlock', () => {
    if (++unlocks === 1) throw new Error('synchronous unlock failure');
    return Promise.reject(new Error('asynchronous unlock failure'));
  });
  const controller = new AbortController();
  const running = Effect.runPromiseExit(Effect.scoped(Effect.gen(function* () {
    const run = yield* effect(); yield* run;
  })), { signal: controller.signal });
  await env.frameReady;
  const sound = app.querySelector('.sound')!;
  sound.dispatchEvent(new Event('click')); assert.equal(unlocks, 1);
  await new Promise<void>(resolve => { setImmediate(resolve); });
  sound.dispatchEvent(new Event('click')); await new Promise<void>(resolve => { setImmediate(resolve); });
  assert.equal(unlocks, 2); assert.equal(env.frames.size, 1); assert.ok(canvas.signals.every(s => !s.aborted));
  controller.abort(); const exit = await running;
  assert.ok(Exit.isFailure(exit)); assert.equal(missionFailureMessage(exit.cause), undefined);
  sound.dispatchEvent(new Event('click')); assert.equal(unlocks, 2); assert.equal(env.frames.size, 0);
});
