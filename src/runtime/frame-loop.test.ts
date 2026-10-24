import assert from 'node:assert/strict';
import test from 'node:test';
import { Cause, Effect, Exit } from 'effect';
import { browser } from '../../tests/helpers/lifecycle.ts';
import { FrameLoopError, runFrameLoop } from './frame-loop.ts';
import { missionFailureMessage } from './mission-lifecycle.ts';

function takeFrame(frames: Map<number, FrameRequestCallback>) {
  assert.equal(frames.size, 1);
  const [id, callback] = frames.entries().next().value!;
  frames.delete(id); return callback;
}

test('frame loop schedules one frame at a time and ignores stale callbacks after cancellation', async t => {
  const { frames, frameReady } = browser(t), controller = new AbortController(), times: number[] = [];
  const running = Effect.runPromiseExit(runFrameLoop('road-repair', now => { times.push(now); }), { signal: controller.signal });
  await frameReady;
  takeFrame(frames)(100); takeFrame(frames)(116);
  const stale = frames.values().next().value!;
  controller.abort(); const exit = await running;
  assert.equal(frames.size, 0);
  stale(132);
  assert.deepEqual(times, [100, 116]);
  assert.equal(frames.size, 0);
  assert.ok(Exit.isFailure(exit));
  assert.equal(missionFailureMessage(exit.cause), undefined);
});

test('frame failure is typed, preserves its cause and never schedules another frame', async t => {
  const { frames, frameReady } = browser(t), original = new Error('render failed');
  let calls = 0;
  const running = Effect.runPromiseExit(runFrameLoop('road-repair', () => { calls++; throw original; }));
  await frameReady;
  const callback = takeFrame(frames); callback(100);
  const exit = await running; callback(116);
  assert.ok(Exit.isFailure(exit));
  const failure = exit.cause.reasons.find(r => r._tag === 'Fail');
  assert.ok(failure?.error instanceof FrameLoopError);
  assert.equal(failure.error.cause, original);
  assert.equal(failure.error.stage, 'frame');
  assert.equal(failure.error.mission, 'road-repair');
  assert.match(missionFailureMessage(exit.cause)!, /關卡執行/);
  assert.equal(calls, 1); assert.equal(frames.size, 0);
});

for (const when of ['initial', 'next'] as const) {
  test(`frame ${when} scheduling failure terminates the loop`, async t => {
    const { frames, frameReady } = browser(t), original = new Error('request failed');
    const request = requestAnimationFrame;
    let calls = 0;
    t.mock.method(globalThis, 'requestAnimationFrame', (callback: FrameRequestCallback) => {
      if (++calls === (when === 'initial' ? 1 : 2)) throw original;
      return request(callback);
    });
    const running = Effect.runPromiseExit(runFrameLoop('road-repair', () => {}));
    if (when === 'next') { await frameReady; takeFrame(frames)(100); }
    const exit = await running;
    assert.ok(Exit.isFailure(exit));
    const failure = exit.cause.reasons.find(r => r._tag === 'Fail');
    assert.ok(failure?.error instanceof FrameLoopError);
    assert.equal(failure.error.stage, 'schedule'); assert.equal(failure.error.cause, original);
    assert.equal(frames.size, 0);
  });
}

test('failed frame cancellation still disables stale callbacks and releases the enclosing scope', async t => {
  const { frames, frameReady } = browser(t), controller = new AbortController();
  let released = false, calls = 0;
  t.mock.method(globalThis, 'cancelAnimationFrame', () => { throw new Error('cancel failed'); });
  const running = Effect.runPromiseExit(Effect.scoped(Effect.gen(function* () {
    yield* Effect.addFinalizer(() => Effect.sync(() => { released = true; }));
    yield* runFrameLoop('road-repair', () => { calls++; });
  })), { signal: controller.signal });
  await frameReady; const stale = takeFrame(frames);
  controller.abort(); const exit = await running; stale(100);
  assert.equal(calls, 0); assert.equal(released, true);
  assert.ok(Exit.isFailure(exit));
  assert.ok(Cause.hasInterrupts(exit.cause)); assert.ok(Cause.hasDies(exit.cause));
});
