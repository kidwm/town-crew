import { Effect, Fiber } from 'effect';
import type { Scope } from 'effect';

/** Latest request wins, but every earlier cleanup remains part of the mounting barrier. */
export function createNavigation(previousCleanup: Promise<unknown> = Promise.resolve()) {
  let revision = 0, closed = false;
  let active: Fiber.Fiber<unknown, unknown> | undefined;
  let running: Promise<unknown> = previousCleanup;
  const interrupt = () => active ? Effect.runPromise(Fiber.interrupt(active)) : Promise.resolve();
  return {
    show(render: (isCurrent: () => boolean) => Effect.Effect<unknown, unknown, Scope.Scope>): Promise<unknown> {
      if (closed) return running;
      const current = ++revision, before = running, interrupted = interrupt();
      const isCurrent = () => !closed && current === revision;
      active = Effect.runFork(Effect.scoped(Effect.gen(function* () {
        yield* Effect.promise(() => before);
        if (isCurrent()) yield* render(isCurrent);
      })));
      // Cancelling a waiting request must not discard the older mission's async cleanup.
      running = Promise.all([before, interrupted, Effect.runPromise(Fiber.await(active))]).then(() => {});
      return running;
    },
    dispose(): Promise<unknown> {
      closed = true; revision++;
      running = Promise.all([running, interrupt()]).then(() => {});
      return running;
    },
  };
}
