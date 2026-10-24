import { Cause, Data, Effect } from 'effect';
import type { MissionId } from '../app/progress.ts';
import { FrameLoopError } from './frame-loop.ts';
import { AutosaveError } from './autosave.ts';

export class ModuleLoadError extends Data.TaggedError('ModuleLoadError')<{
  readonly mission: MissionId; readonly module: string; readonly cause: unknown;
}> {}
export class SceneInitError extends Data.TaggedError('SceneInitError')<{
  readonly mission: MissionId; readonly cause: unknown;
}> {}
export class SessionInitError extends Data.TaggedError('SessionInitError')<{
  readonly mission: MissionId; readonly stage: 'prepare' | 'connect'; readonly cause: unknown;
}> {}
export class AudioCloseError extends Data.TaggedError('AudioCloseError')<{
  readonly mission: MissionId; readonly cause: unknown;
}> {}

export const loadMissionModule = <A>(mission: MissionId, module: string, load: () => Promise<A>) =>
  Effect.tryPromise({ try: load, catch: cause => new ModuleLoadError({ mission, module, cause }) });

// Translate thrown integration errors without converting interruption into failure.
export const initializeScene = <A, R>(mission: MissionId, setup: Effect.Effect<A, never, R>) =>
  setup.pipe(Effect.catchDefect(cause => Effect.fail(new SceneInitError({ mission, cause }))));

export const initializeSession = <A, R>(mission: MissionId, stage: 'prepare' | 'connect', setup: Effect.Effect<A, never, R>) =>
  setup.pipe(Effect.catchDefect(cause => Effect.fail(new SessionInitError({ mission, stage, cause }))));

export const closeMissionAudio = (mission: MissionId, audio: { dispose(): Promise<void> }) =>
  Effect.tryPromise({ try: () => audio.dispose(), catch: cause => new AudioCloseError({ mission, cause }) }).pipe(
    Effect.catchTag('AudioCloseError', error => Effect.sync(() => {
      try { console.error('Mission audio cleanup failed', error); } catch { /* Diagnostics must not turn cancellation into failure. */ }
    })),
  );

/** Undefined only for normal interruption; mixed cleanup defects remain reportable. */
export function missionFailureMessage(cause: Cause.Cause<unknown>): string | undefined {
  if (Cause.hasInterruptsOnly(cause)) return;
  for (const reason of cause.reasons) {
    if (reason._tag !== 'Fail') continue;
    if (reason.error instanceof ModuleLoadError) return '關卡資料暫時無法載入，請確認連線後重新整理，或回到選關再試一次。';
    if (reason.error instanceof SceneInitError) return '關卡畫面暫時無法建立，請重新整理或使用支援 WebGL2 的瀏覽器。';
    if (reason.error instanceof SessionInitError) return '關卡操作暫時無法準備完成，請回到選關再試一次。';
    if (reason.error instanceof AutosaveError) return '關卡進度暫時無法保存，請回到選關再試一次。';
    if (reason.error instanceof FrameLoopError) return '關卡執行暫時發生問題，請回到選關再試一次。';
  }
  return '畫面暫時無法啟動，請重新整理或回到選關再試一次。';
}
