import { createNarration, type NarrationMedia, type NarrationStatus } from './narration.ts';
import type { VoicePlan } from './voice-script.ts';

/** Pure cue selection plus one optional player, owned by the connection's Scope. */
export function createMissionNarration<S, Id extends string>(plan: VoicePlan<S, Id>, initial: S,
  urls: Readonly<Partial<Record<Id, string>>>, options: {
    muted: boolean; hidden: boolean; restored?: boolean; media?: NarrationMedia; onStatus?: (status: NarrationStatus) => void;
  }) {
  const introId = plan.events.introduction;
  let state = initial, intro = !!urls[introId] && !options.restored && !options.muted && !options.hidden && plan.initial(initial), feedback: Id | undefined;
  let muted = options.muted, hidden = options.hidden;
  const player = createNarration<Id>(urls, { media: options.media, onStatus: options.onStatus,
    onEnded(id) { if (id === introId) intro = false; if (id === feedback) feedback = undefined; },
  });
  player.setMuted(muted); player.setHidden(hidden);
  function queue() {
    const instruction = plan.instruction(state);
    return [...(intro ? [introId] : []), ...(feedback ? [feedback] : []), ...(instruction ? [instruction] : [])];
  }
  function clearEvents() { intro = false; feedback = undefined; }
  return {
    start() { player.setQueue(queue()); },
    update(next: S) {
      // Snapshot restoration/reset uses restart, never this event path. A fresh
      // gesture abandons the previous announcement; automatic handoffs do not.
      if (!plan.interacting(state) && plan.interacting(next)) clearEvents();
      const event = plan.feedback(state, next);
      if (event && urls[event] && !muted && !hidden) feedback = event;
      state = next;
      player.setQueue(queue());
    },
    restart(next: S) { state = next; intro = !!urls[introId] && !muted && !hidden && plan.initial(next); feedback = undefined; player.setQueue(queue(), true); },
    replay() { player.setQueue(queue(), true); },
    text() { const id = queue()[0]; return id ? plan.lines[id] : undefined; },
    unlock: player.unlock,
    setMuted(value: boolean) {
      muted = value;
      // Drop event announcements before resuming; never replay hidden successes.
      if (value) { clearEvents(); player.setMuted(true); player.setQueue(queue()); }
      else player.setMuted(false);
    },
    setHidden(value: boolean) {
      hidden = value;
      if (value) { clearEvents(); player.setHidden(true); player.setQueue(queue()); }
      else player.setHidden(false);
    },
    dispose: player.dispose,
  };
}
