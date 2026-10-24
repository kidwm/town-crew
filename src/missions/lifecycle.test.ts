import { createSanitationScene, type SanitationScene } from './sanitation/scene.ts';
import { createSanitationSession } from './sanitation/session.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Cause, Effect, Exit, type Scope } from 'effect';
import * as THREE from 'three';
import type { MissionId } from '../app/progress.ts';
import { AudioCloseError, SceneInitError, SessionInitError, closeMissionAudio, initializeScene, initializeSession, missionFailureMessage } from '../runtime/mission-lifecycle.ts';
import { FrameLoopError } from '../runtime/frame-loop.ts';
import type { AutosaveError } from '../runtime/autosave.ts';
import { acquireScene } from '../runtime/scene-lifecycle.ts';
import { Element, browser, renderer } from '../../tests/helpers/lifecycle.ts';
import { createHouseScene, type HouseScene } from './house-build/scene.ts';
import { createHouseSession } from './house-build/session.ts';
import { createFireScene, type FireScene } from './fire-rescue/scene.ts';
import { createFireSession } from './fire-rescue/session.ts';
import { createFireAudio } from './fire-rescue/sounds.ts';
import { createTrafficScene, type TrafficScene } from './traffic-rescue/scene.ts';
import { createTrafficSession } from './traffic-rescue/session.ts';
import { createPoliceScene, type PoliceScene } from './police-patrol/scene.ts';
import { createPoliceSession } from './police-patrol/session.ts';
import { createPortScene, type PortScene } from './port-cargo/scene.ts';
import { createPortSession } from './port-cargo/session.ts';
import { createMountainScene, type MountainScene } from './mountain-clearance/scene.ts';
import { createMountainSession } from './mountain-clearance/session.ts';
import { createTransferScene, type TransferScene } from './passenger-transfer/scene.ts';
import { createTransferSession } from './passenger-transfer/session.ts';

const audioFake = () => ({ setMuted() {}, setSpraying(_value: boolean) {}, unlock: async () => {}, play(_cue: string) {}, dispose: async () => {} });
type MissionCase = {
  id: MissionId;
  scene: (host: HTMLElement, make: () => THREE.WebGLRenderer) => Effect.Effect<{ canvas: HTMLCanvasElement }, never, Scope.Scope>;
  connect: (app: HTMLDivElement, scene: { canvas: HTMLCanvasElement }, audio: ReturnType<typeof audioFake>) => Effect.Effect<Effect.Effect<never, FrameLoopError | AutosaveError>, never, Scope.Scope>;
};
const missions: MissionCase[] = [
  { id: 'sanitation', scene: createSanitationScene, connect: (app, scene, audio) => createSanitationSession(app, false, () => {}, true).connect(scene as SanitationScene, audio) },
  { id: 'house-build', scene: createHouseScene, connect: (app, scene, audio) => createHouseSession(app, false, () => {}, true).connect(scene as HouseScene, audio) },
  { id: 'fire-rescue', scene: createFireScene, connect: (app, scene, audio) => createFireSession(app, false, () => {}, true).connect(scene as FireScene, audio) },
  { id: 'traffic-rescue', scene: createTrafficScene, connect: (app, scene, audio) => createTrafficSession(app, false, () => {}, true).connect(scene as TrafficScene, audio) },
  { id: 'police-patrol', scene: createPoliceScene, connect: (app, scene, audio) => createPoliceSession(app, false, () => {}, true).connect(scene as PoliceScene, audio) },
  { id: 'port-cargo', scene: createPortScene, connect: (app, scene, audio) => createPortSession(app, false, () => {}, true).connect(scene as PortScene, audio) },
  { id: 'mountain-clearance', scene: createMountainScene, connect: (app, scene, audio) => createMountainSession(app, false, () => {}, true).connect(scene as MountainScene, audio) },
  { id: 'passenger-transfer', scene: createTransferScene, connect: (app, scene, audio) => createTransferSession(app, false, () => {}, true).connect(scene as TransferScene, audio) },
];

for (const mission of missions) {
  test(`${mission.id}: failed attachment still removes canvas after renderer disposal fails`, async t => {
    browser(t);
    const { fake, calls, canvas, make } = renderer();
    const host = new Element(), original = new Error('attachment failed');
    t.mock.method(host, 'append', (child: Element) => { host.children.push(child); throw original; });
    t.mock.method(fake, 'dispose', () => { calls.push('dispose'); throw new Error('renderer release failed'); });
    const exit = await Effect.runPromiseExit(Effect.scoped(initializeScene(mission.id, mission.scene(host as unknown as HTMLElement, make))));
    assert.ok(Exit.isFailure(exit));
    const failure = exit.cause.reasons.find(r => r._tag === 'Fail');
    assert.ok(failure?.error instanceof SceneInitError);
    assert.equal(failure.error.cause, original);
    assert.equal(failure.error.mission, mission.id);
    assert.match(missionFailureMessage(exit.cause)!, /關卡畫面/);
    assert.deepEqual(calls, ['dispose', 'context-loss']);
    assert.equal(host.children[0], canvas);
    assert.equal(canvas.removed, true);
    assert.ok(Cause.hasDies(exit.cause));
  });

  test(`${mission.id}: observer failure releases built scene even when a geometry throws`, async t => {
    const env = browser(t), original = new Error('observer failed');
    t.mock.method(env.resize, 'observe', () => { throw original; });
    const geometry = t.mock.method(THREE.BufferGeometry.prototype, 'dispose', () => {
      if (geometry.mock.callCount() === 1) throw new Error('geometry release failed');
    });
    const material = t.mock.method(THREE.Material.prototype, 'dispose', () => {});
    const { canvas, make, calls } = renderer();
    const exit = await Effect.runPromiseExit(Effect.scoped(initializeScene(mission.id, mission.scene(new Element() as unknown as HTMLElement, make))));
    assert.ok(Exit.isFailure(exit));
    const failure = exit.cause.reasons.find(r => r._tag === 'Fail');
    assert.ok(failure?.error instanceof SceneInitError);
    assert.equal(failure.error.cause, original);
    assert.equal(env.resize.disconnected, true);
    assert.ok(geometry.mock.callCount() > 1);
    assert.ok(material.mock.callCount() > 0);
    assert.deepEqual(calls, ['dispose', 'context-loss']);
    assert.equal(canvas.removed, true);
    assert.ok(Cause.hasDies(exit.cause));
  });

  test(`${mission.id}: partial connection aborts installed listeners and removes its hint`, async t => {
    const env = browser(t), app = new Element(), canvas = new Element();
    const original = new Error('sound listener failed');
    t.mock.method(app.querySelector('.sound')!, 'addEventListener', () => { throw original; });
    const exit = await Effect.runPromiseExit(Effect.scoped(initializeSession(mission.id, 'connect', mission.connect(app as unknown as HTMLDivElement, { canvas: canvas as unknown as HTMLCanvasElement }, audioFake()))));
    assert.ok(Exit.isFailure(exit));
    const failure = exit.cause.reasons.find(r => r._tag === 'Fail');
    assert.ok(failure?.error instanceof SessionInitError);
    assert.equal(failure.error.cause, original);
    assert.equal(failure.error.mission, mission.id);
    assert.equal(failure.error.stage, 'connect');
    assert.match(missionFailureMessage(exit.cause)!, /關卡操作/);
    const signals = [...canvas.signals, ...env.window.signals, ...env.document.signals];
    assert.ok(signals.length > 0);
    assert.ok(signals.every(s => s.aborted));
    assert.equal(app.querySelector('.world')!.children[0].removed, true);
    assert.equal(env.frames.size, 0);
  });

  test(`${mission.id}: cancellation survives failed final save and audio close in resource order`, async t => {
    const env = browser(t), app = new Element(), host = new Element();
    const { canvas, make, calls, fake } = renderer(), audio = audioFake();
    const order: string[] = [];
    const saveFailure = new Error('final save failed'), closeFailure = new Error('audio close failed');
    t.mock.method(fake, 'dispose', () => { order.push('scene'); });
    t.mock.method(audio, 'dispose', async () => { order.push('audio'); throw closeFailure; });
    t.mock.method(audio, 'setSpraying', (value: boolean) => { assert.equal(value, false); order.push('water'); });
    const logged = t.mock.method(console, 'error', () => {});
    const controller = new AbortController();
    const running = Effect.runPromiseExit(Effect.scoped(Effect.gen(function* () {
      const scene = yield* initializeScene(mission.id, mission.scene(host as unknown as HTMLElement, make));
      yield* Effect.acquireRelease(Effect.succeed(audio), value => closeMissionAudio(mission.id, value));
      const run = yield* initializeSession(mission.id, 'connect', mission.connect(app as unknown as HTMLDivElement, scene, audio));
      canvas.signals[0].addEventListener('abort', () => { order.push('listeners'); });
      t.mock.method(globalThis, 'structuredClone', () => { order.push('save'); throw saveFailure; });
      yield* run;
    })), { signal: controller.signal });
    await env.frameReady;
    assert.equal(env.frames.size, 1);
    controller.abort(); const exit = await running;
    assert.ok(Exit.isFailure(exit));
    assert.ok(Cause.hasInterrupts(exit.cause));
    assert.ok(exit.cause.reasons.some(r => r._tag === 'Die' && r.defect === saveFailure));
    assert.ok(missionFailureMessage(exit.cause));
    assert.deepEqual(order, mission.id === 'fire-rescue' ? ['save', 'water', 'listeners', 'audio', 'scene'] : ['save', 'listeners', 'audio', 'scene']);
    assert.equal(env.frames.size, 0);
    assert.ok([...canvas.signals, ...env.document.signals, ...env.window.signals].every(s => s.aborted));
    assert.equal(app.querySelector('.world')!.children[0].removed, true);
    assert.equal(canvas.removed, true);
    assert.equal(env.resize.disconnected, true);
    assert.deepEqual(calls, ['context-loss']);
    assert.equal(logged.mock.callCount(), 1);
    const error = logged.mock.calls[0].arguments[1] as AudioCloseError;
    assert.ok(error instanceof AudioCloseError);
    assert.equal(error.mission, mission.id); assert.equal(error.cause, closeFailure);
  });
  for (const boundary of ['render', 'hud'] as const) {
    test(`${mission.id}: ${boundary} failure stops frames and releases the running mission`, async t => {
      const env = browser(t), app = new Element(), host = new Element(), audio = audioFake();
      const { make, fake, canvas, calls } = renderer(), original = new Error(`${boundary} failed`);
      Object.assign(fake, { render() { if (boundary === 'render') throw original; } });
      if (boundary === 'hud') t.mock.method(app.querySelector('.progress')!, 'setAttribute', () => { throw original; });
      t.mock.method(audio, 'dispose', async () => { calls.push('audio'); });
      const water = t.mock.method(audio, 'setSpraying', () => {});
      const running = Effect.runPromiseExit(Effect.scoped(Effect.gen(function* () {
        const scene = yield* initializeScene(mission.id, mission.scene(host as unknown as HTMLElement, make));
        yield* Effect.acquireRelease(Effect.succeed(audio), value => closeMissionAudio(mission.id, value));
        const run = yield* initializeSession(mission.id, 'connect', mission.connect(app as unknown as HTMLDivElement, scene, audio));
        yield* run;
      })));
      await env.frameReady;
      const [id, frame] = env.frames.entries().next().value!; env.frames.delete(id);
      frame(performance.now()); const exit = await running; frame(performance.now());
      assert.ok(Exit.isFailure(exit));
      const failure = exit.cause.reasons.find(r => r._tag === 'Fail');
      assert.ok(failure?.error instanceof FrameLoopError);
      assert.equal(failure.error.mission, mission.id); assert.equal(failure.error.stage, 'frame');
      assert.equal(failure.error.cause, original);
      assert.match(missionFailureMessage(exit.cause)!, /關卡執行/);
      assert.deepEqual(calls, ['audio', 'dispose', 'context-loss']);
      assert.equal(env.frames.size, 0); assert.equal(canvas.removed, true); assert.equal(env.resize.disconnected, true);
      assert.ok([...canvas.signals, ...env.document.signals, ...env.window.signals].every(s => s.aborted));
      assert.equal(app.querySelector('.world')!.children[0].removed, true);
      if (mission.id === 'fire-rescue') assert.deepEqual(water.mock.calls.at(-1)!.arguments, [false]);
    });
  }

  test(`${mission.id}: gesture audio failures preserve rendering and normal cancellation`, async t => {
    const env = browser(t), app = new Element(), host = new Element(), audio = audioFake();
    app.queries.set('#vehicle-name', new Element());
    const { make, fake, canvas } = renderer(), controller = new AbortController();
    let unlocks = 0, renders = 0;
    Object.assign(fake, { render() { renders++; } });
    t.mock.method(audio, 'unlock', () => {
      if (++unlocks === 1) throw new Error('synchronous unlock failure');
      return Promise.reject(new Error('asynchronous unlock failure'));
    });
    const running = Effect.runPromiseExit(Effect.scoped(Effect.gen(function* () {
      const scene = yield* initializeScene(mission.id, mission.scene(host as unknown as HTMLElement, make));
      yield* Effect.acquireRelease(Effect.succeed(audio), value => closeMissionAudio(mission.id, value));
      const run = yield* initializeSession(mission.id, 'connect', mission.connect(app as unknown as HTMLDivElement, scene, audio));
      yield* run;
    })), { signal: controller.signal });
    await env.frameReady;
    const sound = app.querySelector('.sound')!;
    for (let attempt = 1; attempt <= 2; attempt++) {
      sound.dispatchEvent(new Event('click')); assert.equal(unlocks, attempt);
      await new Promise<void>(resolve => { setImmediate(resolve); });
      const [id, frame] = env.frames.entries().next().value!; env.frames.delete(id); frame(performance.now());
      assert.equal(env.frames.size, 1); assert.equal(renders, attempt);
      assert.ok(canvas.signals.every(s => !s.aborted));
    }
    const stale = env.frames.values().next().value!;
    controller.abort(); const exit = await running;
    assert.ok(Exit.isFailure(exit)); assert.equal(missionFailureMessage(exit.cause), undefined);
    sound.dispatchEvent(new Event('click')); stale(performance.now());
    assert.equal(unlocks, 2); assert.equal(renders, 2); assert.equal(env.frames.size, 0);
    assert.equal(canvas.removed, true); assert.equal(env.resize.disconnected, true);
  });
}

test('scene cleanup includes shared mesh, line and point resources after a release fails', async () => {
  const calls: string[] = [];
  const geometry = new THREE.BufferGeometry(), material = new THREE.MeshBasicMaterial();
  const lineGeometry = new THREE.BufferGeometry(), lineMaterial = new THREE.LineBasicMaterial();
  const pointsGeometry = new THREE.BufferGeometry(), pointsMaterial = new THREE.PointsMaterial();
  geometry.addEventListener('dispose', () => { calls.push('mesh'); throw new Error('mesh dispose failed'); });
  material.addEventListener('dispose', () => { calls.push('material'); });
  lineGeometry.addEventListener('dispose', () => { calls.push('line'); });
  lineMaterial.addEventListener('dispose', () => { calls.push('line-material'); });
  pointsGeometry.addEventListener('dispose', () => { calls.push('points'); });
  pointsMaterial.addEventListener('dispose', () => { calls.push('points-material'); });
  const exit = await Effect.runPromiseExit(Effect.scoped(Effect.gen(function* () {
    const scene = yield* acquireScene();
    scene.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material), new THREE.LineSegments(lineGeometry, lineMaterial), new THREE.Points(pointsGeometry, pointsMaterial));
  })));
  assert.ok(Exit.isFailure(exit));
  assert.deepEqual(calls, ['mesh', 'material', 'line', 'line-material', 'points', 'points-material']);
});

test('fire water shutdown failure does not prevent listener, hint or audio cleanup', async t => {
  const env = browser(t), app = new Element(), canvas = new Element(), audio = audioFake();
  const original = new Error('water shutdown failed');
  t.mock.method(audio, 'setSpraying', () => { throw original; });
  const close = t.mock.method(audio, 'dispose', async () => {});
  const exit = await Effect.runPromiseExit(Effect.scoped(Effect.gen(function* () {
    yield* Effect.acquireRelease(Effect.succeed(audio), value => closeMissionAudio('fire-rescue', value));
    yield* createFireSession(app as unknown as HTMLDivElement, false, () => {}, true).connect({ canvas } as unknown as FireScene, audio);
  })));
  assert.ok(Exit.isFailure(exit));
  assert.ok(exit.cause.reasons.some(r => r._tag === 'Die' && r.defect === original));
  assert.equal(env.frames.size, 0);
  assert.ok(canvas.signals.every(s => s.aborted));
  assert.equal(app.querySelector('.world')!.children[0].removed, true);
  assert.equal(close.mock.callCount(), 1);
});

test('fire audio closes its context after noise.stop fails and retains both failures', async t => {
  const calls: string[] = [], stopFailure = new Error('stop failed'), closeFailure = new Error('close failed');
  const node = { connect() { return node; }, disconnect() { calls.push('disconnect'); }, gain: { value: 0, setTargetAtTime() {} } };
  const context = {
    state: 'running', sampleRate: 1, currentTime: 0, destination: {},
    createBuffer: () => ({ getChannelData: () => new Float32Array(2) }),
    createBufferSource: () => ({ ...node, start() {}, stop() { calls.push('stop'); throw stopFailure; } }),
    createBiquadFilter: () => ({ ...node, frequency: { value: 0 } }),
    createGain: () => node,
    async close() { calls.push('close'); throw closeFailure; },
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: function () { return context; } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'AudioContext', previous); else Reflect.deleteProperty(globalThis, 'AudioContext'); });
  const audio = createFireAudio(); await audio.unlock();
  await assert.rejects(audio.dispose(), error => error instanceof AggregateError && error.errors[0].errors[0] === stopFailure && error.errors[1] === closeFailure);
  assert.deepEqual(calls, ['stop', 'disconnect', 'disconnect', 'disconnect', 'close']);
});

for (const failureAt of ['gain', 'start'] as const) {
  test(`fire water audio rolls back a partial ${failureAt} failure and retries on the next gesture`, async t => {
    const original = new Error('water initialization failed'), calls: string[] = [];
    let contexts = 0, sources = 0, gains = 0;
    const node = (name: string) => ({ connect(next: unknown) { return next; }, disconnect() { calls.push(`${name}.disconnect`); } });
    const context = {
      state: 'running', sampleRate: 1, currentTime: 0, destination: {},
      createBuffer: () => ({ getChannelData: () => new Float32Array(2) }),
      createBufferSource: () => {
        const id = ++sources;
        return { ...node(`noise${id}`), start() { if (failureAt === 'start' && id === 1) throw original; calls.push(`noise${id}.start`); }, stop() { calls.push(`noise${id}.stop`); } };
      },
      createBiquadFilter: () => ({ ...node(`filter${sources}`), frequency: { value: 0 } }),
      createGain: () => {
        if (++gains === 1 && failureAt === 'gain') throw original;
        return { ...node(`water${sources}`), gain: { value: 0, setTargetAtTime() {} } };
      },
      async close() { calls.push('close'); },
    };
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
    Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: function () { contexts++; return context; } });
    t.after(() => { if (previous) Object.defineProperty(globalThis, 'AudioContext', previous); else Reflect.deleteProperty(globalThis, 'AudioContext'); });
    const audio = createFireAudio();
    assert.throws(() => audio.unlock(), error => error === original);
    assert.deepEqual(calls, ['noise1.disconnect', 'filter1.disconnect', ...(failureAt === 'start' ? ['water1.disconnect'] : [])]);
    await audio.unlock(); await audio.unlock();
    assert.equal(contexts, 1); assert.equal(sources, 2);
    assert.equal(calls.filter(call => call === 'noise2.start').length, 1);
    await audio.dispose();
    assert.deepEqual(calls.slice(-5), ['noise2.stop', 'noise2.disconnect', 'filter2.disconnect', 'water2.disconnect', 'close']);
  });
}
