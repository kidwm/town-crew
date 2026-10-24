import { Data, Effect } from 'effect';
import type { MissionId } from '../app/progress.ts';

export class AudioUnlockError extends Data.TaggedError('AudioUnlockError')<{
  readonly mission: MissionId; readonly cause: unknown;
}> {}

/** Call the returned function directly inside a pointer/click/keyboard gesture. */
export function createAudioUnlocker(mission: MissionId, audio: { unlock(): Promise<void> }, signal: AbortSignal, diagnostics = false) {
  let pending = false, reported = false;
  return () => {
    if (signal.aborted || pending) return;
    pending = true;
    let completion: Promise<Effect.Effect<void, AudioUnlockError>>;
    try {
      const promise = audio.unlock(); // Keep browser activation in this synchronous gesture stack.
      // Observe rejection immediately, even if unlock itself caused navigation/abort.
      completion = promise.then(() => Effect.void, cause => Effect.fail(new AudioUnlockError({ mission, cause })));
    } catch (cause) {
      completion = Promise.resolve(Effect.fail(new AudioUnlockError({ mission, cause })));
    }
    const attempt = Effect.promise(() => completion).pipe(
      Effect.flatten,
      Effect.catchTag('AudioUnlockError', error => Effect.sync(() => {
        if (!diagnostics || reported || signal.aborted) return;
        reported = true;
        console.warn('Mission audio unlock failed', error);
      })),
    );
    // Exit also absorbs diagnostic defects; optional audio never rejects into a DOM handler.
    void Effect.runPromiseExit(attempt, { signal }).then(() => { pending = false; });
  };
}
