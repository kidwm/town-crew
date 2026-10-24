import { Data, Effect, Fiber, Schedule } from 'effect';
import type { MissionId } from '../app/progress.ts';

export class AutosaveError extends Data.TaggedError('AutosaveError')<{
  readonly mission: MissionId; readonly cause: unknown;
}> {}

/** The loop supervises the scheduled worker; both stop before connection finalizers run. */
export function withAutosave<E, R>(mission: MissionId, loop: Effect.Effect<never, E, R>, save: () => void, intervalMs: number) {
  return Effect.scoped(Effect.gen(function* () {
    const worker = yield* Effect.forkScoped(Effect.try({
      // Hidden pages already flush synchronously on visibilitychange/pagehide.
      // No catch-up writes when a throttled browser timer resumes.
      try: () => { if (!document.hidden) save(); },
      catch: cause => new AutosaveError({ mission, cause }),
    }).pipe(Effect.schedule(Schedule.spaced(intervalMs))));
    // Joining observes worker failures; a bare fork would silently lose supervision.
    return yield* Effect.raceFirst(loop, Fiber.join(worker).pipe(Effect.andThen(Effect.never)));
  }));
}
