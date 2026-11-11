import type { VoicePlan } from '../../../runtime/voice-script.ts';
import { isCrane, isDelivery, type HouseState, type Stage } from './house.ts';

export const lines = {
  intro: '工程車出動！一起蓋一間溫暖的新家。',
  gravel: '按住車斗前端，往上拉。',
  concrete: '拖動出料口，對準光圈，慢慢填滿三個地方。',
  delivery: '沿著箭頭，把平板車拖到停車位。',
  pickup: '把吊鉤拖到車上的材料，停一下。',
  place: '把吊鉤或材料拖到房子上的光圈，停一下。',
  poured: '這一區填好了！',
  placed: '成功了！',
  parked: '停好了！',
  complete: '新家蓋好了！謝謝你，一起歡迎大家搬進來。',
} as const;
type Id = keyof typeof lines;
const cues = {
  gravel: ['gravel'], concrete: ['concrete'], 'delivery-one': ['delivery'], 'crane-one': ['pickup', 'place'],
  'delivery-two': ['delivery'], 'crane-two': ['pickup', 'place'], 'roof-color': [], decorate: [], complete: ['complete'],
} as const satisfies Record<Stage, readonly Id[]>;
export const voicePlan: VoicePlan<HouseState, Id> = {
  mission: 'house-build', lines, cues,
  pronunciation: {
    concrete: '讀音提示：「出料口」讀作 chū liào kǒu，「出」是第一聲，平穩地念 chū，不是第二聲的「除」。慢慢、清楚地念出這三個字。只念台詞，不念這段提示。',
  },
  events: { introduction: 'intro', concreteRegionFilled: 'poured', materialInstalled: 'placed', deliveryParked: 'parked' },
  initial: s => s.phase === 'gravel', interacting: s => s.action === 'dragging',
  instruction(s) {
    if (s.phase === 'complete') return 'complete';
    if (!['ready', 'dragging'].includes(s.action)) return;
    if (isCrane(s)) return s.attached ? 'place' : 'pickup';
    if (isDelivery(s)) return 'delivery';
    if (s.phase === 'gravel' || s.phase === 'concrete') return s.phase;
  },
  feedback(a, b) {
    if (b.placed > a.placed) return 'placed';
    if (b.pours.filter(v => v === 1).length > a.pours.filter(v => v === 1).length) return 'poured';
    if (isDelivery(a) && isCrane(b)) return 'parked';
  },
};
