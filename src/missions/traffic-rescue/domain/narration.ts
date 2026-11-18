import type { VoicePlan } from '../../../runtime/voice-script.ts';
import { towType, type TrafficState, type Stage } from './traffic.ts';

export const lines = {
  intro: '一起出動！幫助居民，讓道路恢復通車。',
  police: '把警車拖到發亮的停車位。',
  cones: '把交通錐拖到發亮的輪廓，停一下。',
  hook: '拖動掛鉤，靠近你想救的小客車。',
  lift: '拖動車後的架子，靠近你想救的小客車。',
  tow: '載好了，沿著箭頭，把拖吊車拖出去。',
  sweeper: '把清掃車拖到道路起點。',
  sweep: '拖動清掃車，跟著箭頭，把道路刷乾淨。',
  ambulance: '把救護車拖到發亮的停車位。',
  stretcher: '拖動救護擔架，來到居民身旁。',
  boarding: '拖動居民躺著的床，回到救護車後門。',
  parked: '停好了！',
  placed: '成功了！',
  loaded: '成功了！',
  clean: '道路好乾淨！',
  rescued: '成功接到居民！',
  departure: '安全帶扣好了，我們平安出發。',
  complete: '大家都平安了！謝謝你，讓小鎮恢復通車。',
} as const;
type Id = keyof typeof lines;
const cues = {
  collision: [], police: ['police'], cones: ['cones'], 'tow-arrival': [], hook: ['hook', 'lift'],
  'tow-exit': ['tow'], sweeper: ['sweeper'], sweep: ['sweep'], ambulance: ['ambulance'], stretcher: ['stretcher'],
  boarding: ['boarding'], departure: [], reopen: [], complete: ['complete'],
} as const satisfies Record<Stage, readonly Id[]>;
export const voicePlan: VoicePlan<TrafficState, Id> = {
  mission: 'traffic-rescue', lines, cues,
  events: { introduction: 'intro', vehicleParked: 'parked', conePlaced: 'placed', towLoaded: 'loaded', roadCleaned: 'clean', residentAboardStretcher: 'rescued', ambulanceDeparts: 'departure' },
  initial: s => s.phase === 'collision', interacting: s => s.action === 'dragging',
  instruction(s) {
    if (s.phase === 'complete') return 'complete';
    if (!['ready', 'dragging'].includes(s.action)) return;
    if (s.phase === 'hook') return towType(s) === 'flatbed' ? 'hook' : 'lift';
    return cues[s.phase][0];
  },
  feedback(a, b) {
    if (b.cones.filter(Boolean).length > a.cones.filter(Boolean).length) return 'placed';
    if (a.phase === b.phase) return;
    if (a.phase === 'hook' && b.phase === 'tow-exit') return 'loaded';
    if (a.phase === 'sweep' && b.phase === 'ambulance') return 'clean';
    if (a.phase === 'stretcher' && b.phase === 'boarding') return 'rescued';
    if (b.phase === 'departure') return 'departure';
    if (['police', 'sweeper', 'ambulance'].includes(a.phase)) return 'parked';
  },
};
