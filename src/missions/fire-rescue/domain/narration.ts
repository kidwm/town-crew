import { createVoiceProfile } from '../../../runtime/voice-script.ts';
import type { FireState, Stage } from './fire.ts';

// This is the source of both visible instructions and recorded speech.
export const fireVoiceProfile = createVoiceProfile('幼兒消防遊戲');

export const fireLines = {
  intro: '消防隊出動！一起把火滅掉，接大家下來。',
  dispatch: '按住消防車，拖到發亮的停車位。',
  'dispatch-help': '手指放在消防車上，按住，再慢慢移過去。',
  hose: '把水管頭拖到消防栓，接好水管。',
  'ground-fire': '按住火苗，讓水柱慢慢把火澆熄。',
  'fire-out': '火熄滅了！',
  'ladder-arrival': '雲梯車來幫忙了！',
  'roof-reach': '把雲梯上的籃子，拖到屋簷旁邊。',
  'roof-fire': '按住屋簷的火苗，慢慢把火澆熄。',
  'rescue-choice': '先接小貓，或先接人，都可以喔。',
  'rescue-cat': '把雲梯上的籃子，拖到小貓旁邊。',
  'rescue-resident': '把雲梯上的籃子，拖到居民旁邊。',
  'picked-up': '接到了，我們慢慢下來。',
  stowing: '大家都下來了，收好雲梯，準備接送。',
  ambulance: '把救護車拖到發亮的停車位。',
  stretcher: '把擔架拖到居民身旁。',
  boarding: '把擔架拖回救護車後面。',
  departure: '繫好安全帶，我們平安出發。',
  complete: '大家都平安了！謝謝你，小小幫手。',
} as const;
export type FireVoiceId = keyof typeof fireLines;
export const firePronunciation: Partial<Record<FireVoiceId, string>> = {
  intro: '讀音提示：「接大家下來」的「接」是接送的接，讀作 ㄐㄧㄝ，一聲，jiē，保持平穩的第一聲，不是第三聲的「解」。只念台詞，不念這段提示。',
  'picked-up': '讀音提示：「接到了」的「接」是接送的接，讀作 ㄐㄧㄝ，一聲，jiē，保持平穩的第一聲，不是第三聲的「解」。只念台詞，不念這段提示。',
  'roof-fire': '讀音提示：「屋簷」讀作 ㄨ ㄧㄢˊ，wū yán。「屋」是第一聲，「簷」是第二聲。只念台詞，不念這段提示。',
  stowing: '逐字讀音提示：「下來了」最後一字念輕聲 le，不是「囉」lo。「收好雲梯」讀作 shōu hǎo yún tī，「收」是一聲，「雲」是二聲。不要替換或增添任何字。只念台詞，不念這段提示。',
};
export const fireStageVoice = {
  dispatch: 'dispatch', hose: 'hose', 'ground-fire': 'ground-fire', 'ladder-arrival': 'ladder-arrival',
  'roof-reach': 'roof-reach', 'roof-fire': 'roof-fire', rescue: 'rescue-choice', stowing: 'stowing',
  ambulance: 'ambulance', stretcher: 'stretcher', boarding: 'boarding', departure: 'departure', complete: 'complete',
} as const satisfies Record<Stage, FireVoiceId>;
export const fireExtraVoice = {
  introduction: 'intro', dispatchIdleHelp: 'dispatch-help', onlyCatRemaining: 'rescue-cat', onlyResidentRemaining: 'rescue-resident',
  groundFiresExtinguished: 'fire-out', roofFireExtinguished: 'fire-out', passengerBoarded: 'picked-up',
} as const satisfies Record<string, FireVoiceId>;

export function fireInstructionId(state: Pick<FireState, 'phase' | 'rescued'>): FireVoiceId {
  if (state.phase === 'rescue') {
    if (state.rescued[0] && !state.rescued[1]) return fireExtraVoice.onlyCatRemaining;
    if (state.rescued[1] && !state.rescued[0]) return fireExtraVoice.onlyResidentRemaining;
  }
  return fireStageVoice[state.phase];
}

/** Success belongs to a live state transition, not to a frame or restored snapshot. */
export function fireTransitionVoice(previous: FireState, next: FireState): FireVoiceId | undefined {
  if (previous.phase === 'ground-fire' && next.phase === 'ladder-arrival'
    && previous.fires.slice(0, 3).some(heat => heat > 0) && next.fires.slice(0, 3).every(heat => heat === 0)) return fireExtraVoice.groundFiresExtinguished;
  if (previous.phase === 'roof-fire' && next.phase === 'rescue'
    && previous.fires[3] > 0 && next.fires[3] === 0) return fireExtraVoice.roofFireExtinguished;
  if (previous.phase === 'rescue' && next.phase === 'rescue' && previous.action === 'working'
    && next.action === 'returning' && next.passenger !== null && next.passenger === previous.passenger) return fireExtraVoice.passengerBoarded;
}

/** Include cue bindings so moving an instruction to another phase requires review too. */
export function fireVoiceSource(id: FireVoiceId) {
  return {
    version: 1, ...fireVoiceProfile, text: fireLines[id], pronunciation: firePronunciation[id] ?? '',
    cues: [...Object.entries(fireStageVoice), ...Object.entries(fireExtraVoice)].filter(([, value]) => value === id).map(([key]) => key).sort(),
  };
}
