import assert from 'node:assert/strict';
import test from 'node:test';
import { Effect, Exit, Fiber } from 'effect';
import { TestClock } from 'effect/testing';
import { PwaRegistrationError, registerWithRetry, startPwaRegistration } from './pwa.ts';

for (const succeeds of [true, false]) test(`PWA ${succeeds ? 'recovers on third attempt' : 'stops after three failures'} with 1s/2s backoff`, async () => {
  let attempts = 0; const original = new TypeError('fetch failed');
  await Effect.runPromise(Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(registerWithRetry(async () => { attempts++; if (!succeeds || attempts < 3) throw original; }));
    yield* TestClock.adjust(0); assert.equal(attempts, 1);
    yield* TestClock.adjust(999); assert.equal(attempts, 1);
    yield* TestClock.adjust(1); assert.equal(attempts, 2);
    yield* TestClock.adjust(1999); assert.equal(attempts, 2);
    yield* TestClock.adjust(1); assert.equal(attempts, 3);
    const exit = yield* Fiber.await(fiber);
    assert.equal(Exit.isSuccess(exit), succeeds);
    if (Exit.isFailure(exit)) {
      const reason = exit.cause.reasons.find(r => r._tag === 'Fail');
      assert.ok(reason?.error instanceof PwaRegistrationError); assert.equal(reason.error.cause, original);
    }
    yield* TestClock.adjust(30000); assert.equal(attempts, 3);
  }).pipe(Effect.provide(TestClock.layer())));
});

for (const name of ['SecurityError', 'SyntaxError']) test(`PWA ${name} is not retried`, async () => {
  let attempts = 0; const original = new DOMException('registration denied', name);
  const exit = await Effect.runPromiseExit(registerWithRetry(async () => { attempts++; throw original; }));
  assert.ok(Exit.isFailure(exit)); assert.equal(attempts, 1);
});

test('PWA cancellation during backoff prevents later attempts', async () => {
  let attempts = 0;
  await Effect.runPromise(Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(registerWithRetry(async () => { attempts++; throw new TypeError('network'); }));
    yield* TestClock.adjust(500); assert.equal(attempts, 1);
    yield* Fiber.interrupt(fiber); yield* TestClock.adjust(10000); assert.equal(attempts, 1);
  }).pipe(Effect.provide(TestClock.layer())));
});

test('PWA pagehide removes pending load listener; completed documents register immediately', async () => {
  const events = new EventTarget(); let attempts = 0;
  const stop = startPwaRegistration(async () => { attempts++; }, events, () => false);
  events.dispatchEvent(new Event('pagehide')); await stop(); events.dispatchEvent(new Event('load'));
  assert.equal(attempts, 0);
  const immediate = startPwaRegistration(async () => { attempts++; }, events, () => true);
  assert.equal(attempts, 1); await immediate();
});

test('PWA late rejection after disposal is observed without warning or retry', async () => {
  const events = new EventTarget(); let reject!: (error: Error) => void, attempts = 0, warnings = 0;
  const pending = new Promise<void>((_, fail) => { reject = fail; });
  const stop = startPwaRegistration(() => { attempts++; return pending; }, events, () => true, () => { warnings++; });
  await stop(); reject(new TypeError('late network')); await pending.catch(() => {});
  assert.equal(attempts, 1); assert.equal(warnings, 0);
});

test('PWA reports a terminal failure once and a broken diagnostic sink stays optional', async () => {
  const events = new EventTarget(); let warnings = 0, reported!: () => void;
  const ready = new Promise<void>(resolve => { reported = resolve; });
  const stop = startPwaRegistration(async () => { throw new DOMException('denied', 'SecurityError'); }, events, () => true,
    () => { warnings++; reported(); throw new Error('logger broken'); });
  await ready; await stop(); assert.equal(warnings, 1);
});
