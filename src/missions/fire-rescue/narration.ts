import { createNarration, type NarrationMedia, type NarrationStatus } from '../../runtime/narration.ts';
import { fireInstructionId, fireTransitionVoice, type FireVoiceId } from './domain/narration.ts';
import type { FireState } from './domain/fire.ts';
import assets from './voice-assets.json' with { type: 'json' };

export function createFireNarration(initial: FireState, options: {
  muted: boolean; hidden: boolean; media?: NarrationMedia; onStatus?: (status: NarrationStatus) => void;
}) {
  let state = initial, introPending = initial.phase === 'dispatch', idle = 0, helped = false;
  let feedback: FireVoiceId | undefined, muted = options.muted, hidden = options.hidden;
  const urls = Object.fromEntries(Object.entries(assets.clips).map(([id, clip]) => [id, `/${clip.file}`])) as Record<FireVoiceId, string>;
  const player = createNarration<FireVoiceId>(urls, { media: options.media, onStatus: options.onStatus,
    // These announcements remain true across the short automatic animations.
    finishCurrent: ['ladder-arrival', 'stowing', 'departure'],
    onEnded: id => {
      if (id === 'intro') introPending = false;
      if (id === feedback) feedback = undefined;
    },
  });
  player.setMuted(options.muted); player.setHidden(options.hidden);
  function queue() {
    // During a committed pickup/return, the child has no new action to perform.
    const active = state.action === 'ready' || state.action === 'dragging'
      || ['ladder-arrival', 'stowing', 'departure'].includes(state.phase);
    return [...(introPending ? ['intro' as const] : []), ...(feedback ? [feedback] : []), ...(active ? [fireInstructionId(state)] : [])];
  }
  return {
    start() { player.setQueue(queue()); },
    update(next: FireState, dt = 0) {
      if (next.phase !== state.phase) { idle = 0; helped = false; }
      // A new manual action makes the previous success message obsolete. Do not
      // accumulate success events while muted/hidden or replay them on resume.
      if (next.action === 'dragging' || (feedback === 'fire-out' && !['ladder-arrival', 'roof-reach', 'rescue'].includes(next.phase))
        || (feedback === 'picked-up' && !['rescue', 'stowing'].includes(next.phase))) feedback = undefined;
      const transition = fireTransitionVoice(state, next);
      if (transition && !muted && !hidden) feedback = transition;
      state = next;
      if (state.phase !== 'dispatch' || state.action === 'working') introPending = false;
      player.setQueue(queue());
      if (state.phase === 'dispatch' && state.action === 'ready' && player.status() === 'idle') idle += dt;
      else idle = 0;
      if (!helped && idle >= 12) { helped = true; player.playOnce('dispatch-help'); }
    },
    restart(next: FireState) {
      state = next; introPending = next.phase === 'dispatch'; idle = 0; helped = false; feedback = undefined;
      player.setQueue(queue(), true);
    },
    replay() { idle = 0; player.setQueue(queue(), true); },
    unlock: player.unlock,
    setMuted(value: boolean) {
      muted = value; player.setMuted(value);
      if (value && feedback) { feedback = undefined; player.setQueue(queue()); }
    },
    setHidden(value: boolean) {
      hidden = value; player.setHidden(value);
      if (value && feedback) { feedback = undefined; player.setQueue(queue()); }
    },
    dispose: player.dispose,
  };
}
