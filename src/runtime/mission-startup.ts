import { Cause, Effect, Exit } from 'effect';
import type { MissionId } from '../app/progress.ts';

export type StartupStage = 'module.scene' | 'module.session' | 'module.sounds' | 'prepare' | 'scene' | 'audio' | 'connect';
export type StartupOutcome = 'success' | 'failure' | 'cancelled';
export interface StartupTiming { stage: StartupStage; durationMs: number; outcome: StartupOutcome }
export interface StartupReport {
  mission: MissionId; startupId: number; mode: 'development' | 'play'; outcome: StartupOutcome;
  durationMs: number; stages: readonly StartupTiming[];
}
let sequence = 0;
const outcome = (exit: Exit.Exit<unknown, unknown>): StartupOutcome => Exit.isSuccess(exit) ? 'success'
  : Cause.hasInterruptsOnly(exit.cause) ? 'cancelled' : 'failure';

/** One bounded report per startup, never per frame; no snapshots or URL parameters are logged. */
export function createStartupDiagnostics(mission: MissionId, dev: boolean,
  report: (value: StartupReport) => void = import.meta.env?.DEV ? value => console.debug('Mission startup', value) : () => {},
  now = () => performance.now(),
) {
  const startupId = ++sequence, mode = dev ? 'development' as const : 'play' as const;
  const attributes = { mission, startupId, mode }, stages: StartupTiming[] = [];
  let failedStage: StartupStage | undefined;
  function timestamp() {
    try { const value = now(); return Number.isFinite(value) ? value : undefined; } catch { return undefined; }
  }
  function duration(start: number | undefined) {
    const end = timestamp();
    return start === undefined || end === undefined ? 0 : Math.max(0, end - start);
  }
  function stage<A, E, R>(stage: StartupStage, effect: Effect.Effect<A, E, R>) {
    return Effect.suspend(() => {
      const start = timestamp();
      return effect.pipe(Effect.onExit(exit => Effect.sync(() => {
        const result = outcome(exit);
        if (result === 'failure') failedStage ??= stage;
        stages.push({ stage, outcome: result, durationMs: duration(start) });
      })), Effect.withSpan(`mission.${stage}`, { attributes }));
    });
  }
  return {
    startupId, stage,
    startup<A, E, R>(effect: Effect.Effect<A, E, R>) {
      return Effect.suspend(() => {
        const start = timestamp();
        return effect.pipe(Effect.onExit(exit => Effect.sync(() => {
          // A diagnostic sink must never change startup or prevent scope cleanup.
          try { report({ ...attributes, outcome: outcome(exit), durationMs: duration(start), stages: [...stages] }); } catch {}
        })), Effect.withSpan('mission.startup', { attributes, root: true }));
      });
    },
    failure(cause: Cause.Cause<unknown>) {
      if (Cause.hasInterruptsOnly(cause)) return Effect.void;
      return Effect.logError('Mission failed', cause).pipe(
        Effect.annotateLogs({ ...attributes, stage: failedStage ?? 'runtime-or-cleanup' }),
        Effect.catchCause(() => Effect.void),
      );
    },
  };
}
export type StartupDiagnostics = ReturnType<typeof createStartupDiagnostics>;
