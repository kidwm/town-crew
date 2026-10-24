import assert from 'node:assert/strict';
import test from 'node:test';
import { Cause, Effect, Exit, Logger, Option, References, Tracer } from 'effect';
import { createStartupDiagnostics } from './mission-startup.ts';
import type { StartupReport } from './mission-startup.ts';
import { loadMissionModule, ModuleLoadError } from './mission-lifecycle.ts';

function capture() {
  const spans: Tracer.NativeSpan[] = [], reports: StartupReport[] = [];
  const tracer = Tracer.make({ span: options => { const span = new Tracer.NativeSpan(options); spans.push(span); return span; } });
  const diagnostics = createStartupDiagnostics('road-repair', true, value => { reports.push(value); });
  return { spans, reports, tracer, diagnostics };
}

test('startup spans preserve parallel loads and end before the returned frame loop', async () => {
  const { spans, reports, tracer, diagnostics: d } = capture();
  const release: Array<() => void> = [], started: string[] = [];
  let allStarted!: () => void; const ready = new Promise<void>(resolve => { allStarted = resolve; });
  const setup = d.startup(Effect.gen(function* () {
    yield* Effect.all((['scene', 'session', 'sounds'] as const).map(module => d.stage(`module.${module}`, loadMissionModule('road-repair', module, () => {
      started.push(module); if (started.length === 3) allStarted(); return new Promise<void>(resolve => { release.push(resolve); });
    }))), { concurrency: 'unbounded' });
    yield* d.stage('connect', Effect.void);
    return Effect.never;
  }));
  const result = Effect.runPromise(setup.pipe(Effect.provideService(Tracer.Tracer, tracer)));
  await ready; assert.equal(started.length, 3); release.forEach(resolve => resolve());
  await result; assert.equal(reports.length, 1); assert.equal(reports[0].outcome, 'success');
  assert.equal(spans.length, 5); const root = spans.find(span => span.name === 'mission.startup')!;
  assert.ok(Option.isNone(root.parent));
  for (const span of spans) {
    assert.equal(span.status._tag, 'Ended'); assert.equal(span.attributes.get('startupId'), d.startupId);
    assert.equal(span.attributes.get('mission'), 'road-repair');
    if (span !== root) { assert.ok(Option.isSome(span.parent)); assert.equal(span.parent.value.spanId, root.spanId); }
  }
  assert.equal(reports[0].stages.length, 4); assert.ok(reports[0].stages.every(stage => stage.durationMs >= 0));
});

test('cancelling a pending load ends spans without logging failure or mounting a late result', async () => {
  const { spans, reports, tracer, diagnostics: d } = capture(), controller = new AbortController();
  let started!: () => void, release!: () => void, mounted = false;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const pending = new Promise<void>(resolve => { release = resolve; });
  const running = Effect.runPromiseExit(d.startup(Effect.gen(function* () {
    yield* d.stage('module.scene', loadMissionModule('road-repair', 'scene', () => { started(); return pending; })); mounted = true;
  })).pipe(Effect.provideService(Tracer.Tracer, tracer)), { signal: controller.signal });
  await ready; controller.abort(); const exit = await running; release(); await pending;
  assert.ok(Exit.isFailure(exit)); assert.equal(mounted, false); assert.equal(reports[0].outcome, 'cancelled');
  assert.equal(reports[0].stages[0].outcome, 'cancelled'); assert.ok(spans.every(span => span.status._tag === 'Ended'));
  let logged = 0;
  Effect.runSync(d.failure(exit.cause).pipe(Effect.provideService(Logger.CurrentLoggers, new Set([Logger.make(() => { logged++; })]))));
  assert.equal(logged, 0);
});

test('module failure retains cause and logs one correlated stage after cleanup', async () => {
  const { diagnostics: d, reports } = capture(), original = new Error('module unavailable'), order: string[] = [];
  const exit = await Effect.runPromiseExit(Effect.scoped(d.startup(Effect.gen(function* () {
    yield* Effect.addFinalizer(() => Effect.sync(() => { order.push('cleanup'); }));
    yield* d.stage('module.scene', loadMissionModule('road-repair', 'scene', () => Promise.reject(original)));
  }))));
  assert.ok(Exit.isFailure(exit)); const reason = exit.cause.reasons.find(r => r._tag === 'Fail');
  assert.ok(reason?.error instanceof ModuleLoadError); assert.equal(reason.error.cause, original);
  const logs: Array<{ cause: Cause.Cause<unknown>; annotations: Readonly<Record<string, unknown>> }> = [];
  const logger = Logger.make(options => {
    order.push('log'); logs.push({ cause: options.cause, annotations: options.fiber.getRef(References.CurrentLogAnnotations) });
  });
  Effect.runSync(d.failure(exit.cause).pipe(Effect.provideService(Logger.CurrentLoggers, new Set([logger]))));
  assert.deepEqual(order, ['cleanup', 'log']); assert.equal(logs.length, 1);
  assert.equal(logs[0].annotations.startupId, d.startupId); assert.equal(logs[0].annotations.stage, 'module.scene');
  assert.ok(logs[0].cause.reasons.some(r => r._tag === 'Fail' && r.error instanceof ModuleLoadError && r.error.cause === original));
  assert.equal(reports[0].outcome, 'failure');
});

test('mixed cleanup defects remain failures and broken diagnostic sinks cannot replace the original exit', async () => {
  const original = new Error('cleanup');
  const d = createStartupDiagnostics('road-repair', false, () => { throw new Error('report'); });
  const exit = await Effect.runPromiseExit(Effect.scoped(d.startup(Effect.gen(function* () {
    yield* Effect.addFinalizer(() => Effect.die(original)); yield* Effect.interrupt;
  }))));
  assert.ok(Exit.isFailure(exit)); assert.ok(Cause.hasDies(exit.cause)); assert.ok(Cause.hasInterrupts(exit.cause));
  assert.equal(exit.cause.reasons.some(r => r._tag === 'Die' && r.defect === original), true);
  let logged = 0;
  const result = Effect.runSyncExit(d.failure(exit.cause).pipe(Effect.provideService(Logger.CurrentLoggers, new Set([Logger.make(() => { logged++; throw new Error('logger'); })]))));
  assert.equal(logged, 1); assert.ok(Exit.isSuccess(result));
});

for (const clock of ['throw', 'throw-on-stage-exit', 'NaN', 'Infinity'] as const) {
  test(`a ${clock} timing clock cannot change startup success, failure or cancellation`, async () => {
    for (const result of ['success', 'failure', 'cancelled'] as const) {
      const reports: StartupReport[] = [], original = new Error('scene failed');
      let calls = 0, ran = false, released = false;
      const d = createStartupDiagnostics('fire-rescue', true, report => reports.push(report), () => {
        calls++;
        if (clock === 'throw' || (clock === 'throw-on-stage-exit' && calls === 3)) throw new Error('clock failed');
        return clock === 'NaN' ? NaN : clock === 'Infinity' ? Infinity : calls;
      });
      const exit = await Effect.runPromiseExit(Effect.scoped(d.startup(d.stage('scene', Effect.gen(function* () {
        ran = true;
        yield* Effect.addFinalizer(() => Effect.sync(() => { released = true; }));
        if (result === 'failure') return yield* Effect.fail(original);
        if (result === 'cancelled') return yield* Effect.interrupt;
        return 'ready';
      })))));
      assert.equal(ran, true); assert.equal(released, true);
      if (result === 'success') { assert.ok(Exit.isSuccess(exit)); assert.equal(exit.value, 'ready'); }
      else {
        assert.ok(Exit.isFailure(exit));
        if (result === 'cancelled') assert.ok(Cause.hasInterruptsOnly(exit.cause));
        else { assert.equal(exit.cause.reasons.length, 1); assert.equal(exit.cause.reasons[0]._tag, 'Fail'); assert.equal(exit.cause.reasons[0].error, original); }
      }
      assert.equal(reports.length, 1); assert.equal(reports[0].outcome, result);
      assert.equal(reports[0].stages[0].outcome, result);
      assert.equal(reports[0].stages[0].durationMs, 0);
      assert.ok(Number.isFinite(reports[0].durationMs));
    }
  });
}
