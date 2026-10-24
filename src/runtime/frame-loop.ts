import { Data, Effect } from 'effect';
import type { MissionId } from '../app/progress.ts';

export class FrameLoopError extends Data.TaggedError('FrameLoopError')<{
  readonly mission: MissionId; readonly stage: 'frame' | 'schedule'; readonly cause: unknown;
}> {}

/** One waiting effect owns the loop; ordinary frame work stays synchronous. */
export const runFrameLoop = (mission: MissionId, onFrame: (now: number) => void) => Effect.suspend(() => {
  let active = true, frame: number | undefined;
  return Effect.callback<never, FrameLoopError>(resume => {
    function fail(stage: FrameLoopError['stage'], cause: unknown) {
      active = false;
      resume(Effect.fail(new FrameLoopError({ mission, stage, cause })));
    }
    function schedule() {
      try { frame = requestAnimationFrame(tick); }
      catch (cause) { fail('schedule', cause); }
    }
    function tick(now: number) {
      if (!active) return;
      frame = undefined;
      try { onFrame(now); }
      catch (cause) { fail('frame', cause); return; }
      if (active) schedule();
    }
    schedule();
  }).pipe(Effect.ensuring(Effect.sync(() => {
    active = false;
    const pending = frame; frame = undefined;
    if (pending !== undefined) cancelAnimationFrame(pending);
  })));
});
