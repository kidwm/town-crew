import assert from 'node:assert/strict';
import test from 'node:test';
import { Effect, Exit, Fiber, Logger } from 'effect';
import { TestClock } from 'effect/testing';
import { browser } from '../../tests/helpers/lifecycle.ts';
import { AutosaveError, withAutosave } from './autosave.ts';
import { runFrameLoop } from './frame-loop.ts';
import { missionFailureMessage } from './mission-lifecycle.ts';

const controlled = <A, E, R>(program: Effect.Effect<A, E, R>) => program.pipe(Effect.provide(TestClock.layer()));

test('autosave waits 800 ms, runs without frames, and never writes after cancellation', async t => {
  const env = browser(t); let saves = 0;
  await Effect.runPromise(controlled(Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(withAutosave('road-repair', runFrameLoop('road-repair', () => {}), () => { saves++; }, 800));
    yield* TestClock.adjust(799); assert.equal(saves, 0); assert.equal(env.frames.size, 1);
    yield* TestClock.adjust(1); assert.equal(saves, 1);
    yield* TestClock.adjust(2400); assert.equal(saves, 4);
    yield* Fiber.interrupt(fiber); assert.equal(env.frames.size, 0);
    yield* TestClock.adjust(8000); assert.equal(saves, 4);
    const exit = yield* Fiber.await(fiber);
    assert.ok(Exit.isFailure(exit)); assert.equal(missionFailureMessage(exit.cause), undefined);
  })));
});

test('hidden pages skip scheduled writes and visibility resumes without a catch-up burst', async t => {
  const env = browser(t); let saves = 0;
  await Effect.runPromise(controlled(Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(withAutosave('road-repair', Effect.never, () => { saves++; }, 800));
    yield* TestClock.adjust(800); assert.equal(saves, 1);
    env.document.hidden = true;
    yield* TestClock.adjust(8000); assert.equal(saves, 1);
    env.document.hidden = false;
    yield* TestClock.adjust(799); assert.equal(saves, 1);
    yield* TestClock.adjust(1); assert.equal(saves, 2);
    yield* Fiber.interrupt(fiber);
  })));
});

test('worker failure stops frames and reaches the caller once with its original cause', async t => {
  const env = browser(t), original = new Error('snapshot clone failed');
  let finalized = 0, unobserved = 0;
  await Effect.runPromise(controlled(Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(withAutosave('road-repair', runFrameLoop('road-repair', () => {}), () => { throw original; }, 800).pipe(
      Effect.ensuring(Effect.sync(() => { finalized++; })),
    ));
    yield* TestClock.adjust(800);
    const exit = yield* Fiber.await(fiber); assert.ok(Exit.isFailure(exit));
    const failures = exit.cause.reasons.filter(r => r._tag === 'Fail');
    assert.equal(failures.length, 1); assert.ok(failures[0].error instanceof AutosaveError);
    assert.equal(failures[0].error.cause, original); assert.equal(failures[0].error.mission, 'road-repair');
    assert.match(missionFailureMessage(exit.cause)!, /進度暫時無法保存/);
    assert.equal(env.frames.size, 0); assert.equal(finalized, 1);
    yield* TestClock.adjust(8000); assert.equal(finalized, 1);
  }).pipe(Effect.provideService(Logger.CurrentLoggers, new Set([Logger.make(() => { unobserved++; })])))));
  assert.equal(unobserved, 0, 'the joined worker does not emit an independent error log');
});

test('frame failure cancels the sleeping worker before mission finalizers', async t => {
  const env = browser(t), original = new Error('render failed'), order: string[] = [];
  await Effect.runPromise(controlled(Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(withAutosave('road-repair', runFrameLoop('road-repair', () => { throw original; }), () => { order.push('periodic'); }, 800).pipe(
      Effect.ensuring(Effect.sync(() => { order.push('final-save'); })),
    ));
    yield* TestClock.adjust(0);
    const [id, frame] = env.frames.entries().next().value!; env.frames.delete(id); frame(16);
    const exit = yield* Fiber.await(fiber); assert.ok(Exit.isFailure(exit));
    assert.ok(exit.cause.reasons.some(r => r._tag === 'Fail' && (r.error as { cause: unknown }).cause === original));
    yield* TestClock.adjust(8000); assert.deepEqual(order, ['final-save']); assert.equal(env.frames.size, 0);
  })));
});

test('repeat mission runs have exactly one worker and cleanup defects do not leave it alive', async t => {
  browser(t); let saves = 0;
  await Effect.runPromise(controlled(Effect.gen(function* () {
    for (let visit = 0; visit < 2; visit++) {
      const fiber = yield* Effect.forkChild(withAutosave('road-repair', Effect.never, () => { saves++; }, 800).pipe(
        Effect.ensuring(visit === 0 ? Effect.die('failed cleanup') : Effect.void),
      ));
      yield* TestClock.adjust(1600); assert.equal(saves, (visit + 1) * 2);
      yield* Fiber.interrupt(fiber);
      const exit = yield* Fiber.await(fiber); assert.ok(Exit.isFailure(exit));
      if (visit === 0) assert.ok(exit.cause.reasons.some(r => r._tag === 'Die' && r.defect === 'failed cleanup'));
      yield* TestClock.adjust(1600); assert.equal(saves, (visit + 1) * 2);
    }
  })));
});
