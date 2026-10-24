import assert from 'node:assert/strict';
import test from 'node:test';
import { Effect, Exit } from 'effect';
import { createNavigation } from './navigation.ts';

function gate() {
  let open!: () => void;
  const promise = new Promise<void>(resolve => { open = resolve; });
  return { promise, open };
}

test('rapid navigation skips intermediate routes and waits for the original async cleanup', async () => {
  const nav = createNavigation(), started = gate(), closing = gate(), release = gate(), latest = gate(), order: string[] = [];
  void nav.show(current => Effect.gen(function* () {
    order.push('old'); started.open();
    yield* Effect.addFinalizer(() => Effect.promise(async () => {
      assert.equal(current(), false); closing.open(); await release.promise; order.push('saved-old');
    }));
    yield* Effect.never;
  }));
  await started.promise;
  void nav.show(() => Effect.sync(() => { order.push('obsolete'); }));
  void nav.show(() => Effect.gen(function* () { order.push('clear-new'); latest.open(); yield* Effect.never; }));
  await closing.promise; assert.deepEqual(order, ['old']);
  release.open(); await latest.promise;
  assert.deepEqual(order, ['old', 'saved-old', 'clear-new']);
  await nav.dispose();
});

test('HMR cleanup handoff waits through cancelled pending requests and blocks old owners', async () => {
  const nav = createNavigation(), started = gate(), release = gate(), nextStarted = gate(); let obsolete = 0, disposed = false;
  void nav.show(() => Effect.gen(function* () {
    yield* Effect.addFinalizer(() => Effect.promise(async () => { await release.promise; disposed = true; }));
    started.open(); yield* Effect.never;
  }));
  await started.promise;
  void nav.show(() => Effect.sync(() => { obsolete++; }));
  const cleanup = nav.dispose(), next = createNavigation(cleanup);
  void nav.show(() => Effect.sync(() => { obsolete++; }));
  void next.show(() => Effect.gen(function* () { assert.equal(disposed, true); nextStarted.open(); yield* Effect.never; }));
  assert.equal(disposed, false); release.open(); await nextStarted.promise;
  assert.equal(obsolete, 0); await next.dispose();
});

test('late module results after cancellation never mount or replace the latest view', async () => {
  const nav = createNavigation(), started = gate(), late = gate(), latest = gate(); const mounted: string[] = [];
  void nav.show(() => Effect.gen(function* () {
    yield* Effect.promise(() => { started.open(); return late.promise; }); mounted.push('old');
  }));
  await started.promise;
  void nav.show(() => Effect.gen(function* () { mounted.push('new'); latest.open(); yield* Effect.never; }));
  await latest.promise; late.open(); await late.promise; await nav.dispose(); assert.deepEqual(mounted, ['new']);
});

test('mixed interruption/cleanup failure is observed after release and cannot overwrite the new UI', async () => {
  const nav = createNavigation(), started = gate(), latest = gate(), original = new Error('cleanup failed');
  const order: string[] = []; let recorded = false;
  void nav.show(current => Effect.scoped(Effect.gen(function* () {
    yield* Effect.addFinalizer(() => Effect.sync(() => { order.push('cleanup'); throw original; }));
    started.open(); yield* Effect.never;
  })).pipe(Effect.onExit(exit => Effect.sync(() => {
    assert.ok(Exit.isFailure(exit));
    assert.ok(exit.cause.reasons.some(r => r._tag === 'Die' && r.defect === original));
    recorded = true; order.push('log'); if (current()) order.push('stale-error-ui');
  }))));
  await started.promise;
  void nav.show(() => Effect.sync(() => { order.push('new'); latest.open(); }));
  await latest.promise; await nav.dispose();
  assert.equal(recorded, true); assert.deepEqual(order, ['cleanup', 'log', 'new']);
});

test('menu resources are disposed exactly once before the next mission starts', async () => {
  const nav = createNavigation(), menu = gate(), mission = gate(), order: string[] = [];
  void nav.show(() => Effect.gen(function* () {
    yield* Effect.acquireRelease(Effect.sync(() => { menu.open(); }), () => Effect.sync(() => { order.push('menu-dispose'); }));
    yield* Effect.never;
  }));
  await menu.promise;
  void nav.show(() => Effect.sync(() => { order.push('mission'); mission.open(); }));
  await mission.promise; await nav.dispose(); await nav.dispose();
  assert.deepEqual(order, ['menu-dispose', 'mission']);
});
