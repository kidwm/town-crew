import type { VoicePlan } from '../../../runtime/voice-script.ts';
import { hasBucketLoad } from './excavator.ts';
import type { RoadState, MissionPhase } from './road.ts';
export type RoadVoiceState = RoadState & { bucketSelected?: boolean };
export const lines = {
  intro: '工程車出動！一起把破損的道路修好。',
  dig: '把挖斗拖到破損的路面，慢慢挖起來。',
  drop: '把裝好舊路面的挖斗，拖到車斗，再放開。',
  'tap-dig': '點一下破損的路面，挖起來。', 'tap-drop': '點一下車斗，把舊路面倒進去。',
  haul: '沿著箭頭拖車子，把舊路面運走。',
  dump: '按住車斗前端，往上拉。', roller: '沿著箭頭拖壓路機，把路面壓平。',
  picked: '挖起來了！', loaded: '成功了！', poured: '新路面鋪好了！', flat: '路面壓平了！',
  complete: '道路修好了！謝謝你，大家可以平安通行了。',
} as const;
type Id = keyof typeof lines;
const cues = {
  excavator: ['dig', 'drop', 'tap-dig', 'tap-drop'], 'haul-away': ['haul'], 'dump-truck': ['dump'], roller: ['roller'],
  traffic: [], complete: ['complete'],
} as const satisfies Record<MissionPhase, readonly Id[]>;
const action = (s: RoadState) => s.phase === 'excavator' ? s.excavator.action : s.phase === 'haul-away' ? s.hauler.action : s.phase === 'dump-truck' ? s.truck.phase : s.roller.action;
export const voicePlan: VoicePlan<RoadVoiceState, Id> = {
  mission: 'road-repair', lines, cues,
  pronunciation: {
    dig: '讀音提示：「挖斗」讀作 wā dǒu；「拖到」讀作 tuō dào；「破損」讀作 pò sǔn，不是「破碎」。慢慢、清楚地念出這些字，不替換字詞。只念台詞，不念這段提示。',
  },
  events: { introduction: 'intro', bucketRaised: 'picked', oldSurfaceDelivered: 'loaded', newSurfacePoured: 'poured', rollingFinished: 'flat' },
  initial: s => s.phase === 'excavator' && s.excavator.cleared === 0,
  interacting: s => !!s.bucketSelected || ['dragging', 'carrying-drag'].includes(action(s)),
  instruction(s) {
    if (s.phase === 'complete') return 'complete';
    if (s.access !== 'working' || !['ready', 'dragging', 'carrying', 'carrying-drag'].includes(action(s))) return;
    if (s.phase === 'excavator') return s.bucketSelected ? hasBucketLoad(s.excavator) ? 'tap-drop' : 'tap-dig' : hasBucketLoad(s.excavator) ? 'drop' : 'dig';
    return cues[s.phase][0];
  },
  feedback(a, b) {
    if (b.excavator.cleared > a.excavator.cleared) return 'loaded';
    if (a.excavator.action === 'scooping' && ['carrying', 'carrying-drag'].includes(b.excavator.action)) return 'picked';
    if (a.truck.phase === 'dumping' && b.truck.phase === 'lowering') return 'poured';
    if (a.roller.action === 'flattening' && b.roller.action === 'complete') return 'flat';
  },
};
