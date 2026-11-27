import type { VoicePlan } from '../../../runtime/voice-script.ts';
import type { PoliceState, Stage } from './police.ts';
export const lines = {
  intro: '警察出動！一起幫忙臨檢，讓道路平安通行。',
  setup: '把警車拖到發亮的停車位。', guard: '選一台重機，沿著箭頭拖到出口。',
  continue: '繼續把這台重機，沿著箭頭拖到出口。', van: '把偵防車拖到前方的接送位。',
  door: '沿著箭頭，拉開側滑門。', transport: '沿著箭頭拖偵防車，平安回警局。',
  tow: '沿著箭頭，把拖吊車往後拖，對準小客車。',
  parked: '停好了！', guarded: '重機已經到達出口！', opened: '門打開了！', boarded: '大家坐好了！',
  loaded: '小車載好了！', complete: '任務完成了！謝謝你，讓道路平安通行。',
} as const;
type Id = keyof typeof lines;
const cues = {
  intro: [], setup: ['setup'], 'bikes-arrival': [], guard: ['guard', 'continue'], inspect: [], 'van-arrival': [],
  van: ['van'], door: ['door'], boarding: [], lead: [], transport: ['transport'], 'tow-arrival': [], tow: ['tow'],
  'tow-load': [], depart: [], complete: ['complete'],
} as const satisfies Record<Stage, readonly Id[]>;
export const voicePlan: VoicePlan<PoliceState, Id> = {
  mission: 'police-patrol', lines, cues,
  events: { introduction: 'intro', vehicleParked: 'parked', motorcycleAtExit: 'guarded', doorOpened: 'opened', passengersSeated: 'boarded', carLoaded: 'loaded' },
  initial: s => s.phase === 'intro', interacting: s => s.action === 'dragging',
  instruction(s) {
    if (s.phase === 'complete') return 'complete';
    if (s.action === 'working') return;
    if (s.phase === 'guard') return s.selected ? 'continue' : 'guard';
    return cues[s.phase][0];
  },
  feedback(a, b) {
    if (a.phase === b.phase) return;
    if (a.phase === 'setup' || a.phase === 'van') return 'parked';
    if (a.phase === 'guard') return 'guarded';
    if (a.phase === 'door') return 'opened';
    if (a.phase === 'boarding') return 'boarded';
    if (a.phase === 'tow-load') return 'loaded';
  },
};
