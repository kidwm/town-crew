import { Effect } from 'effect';
import { createMissionNarration } from './mission-narration.ts';
import type { VoicePlan } from './voice-script.ts';

export const voiceButtonMarkup = '<button class="voice-replay" type="button" aria-label="再聽一次提示" title="再聽一次提示"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z M15 8a6 6 0 0 1 0 8 M18 5a10 10 0 0 1 0 14"/></svg></button>';

/** Acquires media independently of the already-scoped DOM listeners. */
export function acquireVoiceControls<S, Id extends string>(app: HTMLElement, plan: VoicePlan<S, Id>, state: S,
  assets: { clips: Record<string, { file: string }> }, settings: { muted: boolean; restored: boolean; signal: AbortSignal }) {
  return Effect.gen(function* () {
    const button = app.querySelector<HTMLButtonElement>('.voice-replay')!;
    const urls = Object.fromEntries(Object.entries(assets.clips).map(([id, clip]) => [id, `/${clip.file}`])) as Partial<Record<Id, string>>;
    const narration = yield* Effect.acquireRelease(Effect.sync(() => createMissionNarration(plan, state, urls, {
      muted: settings.muted, hidden: document.hidden, restored: settings.restored,
      onStatus(status) { button.dataset.status = status; },
    })), value => Effect.sync(value.dispose));
    const options = { signal: settings.signal };
    document.addEventListener('visibilitychange', () => narration.setHidden(document.hidden), options);
    window.addEventListener('pagehide', () => narration.setHidden(true), options);
    window.addEventListener('pageshow', () => narration.setHidden(document.hidden), options);
    return narration;
  });
}
