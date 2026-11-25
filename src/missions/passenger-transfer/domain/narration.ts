import type { VoicePlan } from '../../../runtime/voice-script.ts';
import { currentVehicle, type TransitState, type Stage } from './transit.ts';
export const lines = {
  intro: '公車、計程車、校車和遊覽車，一起接送乘客！',
  bus: '把公車拖到發亮的停車位。', taxi: '把計程車拖到發亮的載客區。',
  school: '把校車拖到發亮的停車位。', coach: '把遊覽車拖到發亮的停車位。',
  choose: '兩台車都可以，拖一台先接人。', next: '換另一台車，來接乘客吧。',
  door: '沿著箭頭，拉開車門。', exit: '沿著箭頭，把車子拖出去，平安出發。',
  luggage: '拖動行李箱，放進遊覽車側邊的行李格。',
  parked: '停好了！', opened: '門打開了！', loaded: '行李已經上車！', boarded: '大家坐好了！',
  complete: '每一位乘客都搭上車了！謝謝你，小小幫手。',
} as const;
type Id = keyof typeof lines;
const cues = {
  intro: [], 'bus-arrival': ['bus'], 'bus-door': ['door'], unloading: [], 'bus-exit': ['exit'], 'bus-departure': [],
  'transfer-entrance': [], choose: ['choose', 'next'], 'transfer-arrival': ['taxi', 'school', 'coach'], 'transfer-door': ['door'],
  boarding: [], 'transfer-exit': ['exit'], 'transfer-departure': [], 'coach-entrance': [], 'coach-arrival': ['school', 'coach'],
  'coach-door': ['door'], luggage: ['luggage'], loading: [], 'coach-boarding': [], 'coach-exit': ['exit'],
  'coach-departure': [], celebrate: [], complete: ['complete'],
} as const satisfies Record<Stage, readonly Id[]>;
export const voicePlan: VoicePlan<TransitState, Id> = {
  mission: 'passenger-transfer', lines, cues,
  events: { introduction: 'intro', vehicleParked: 'parked', doorOpened: 'opened', luggageLoaded: 'loaded', passengersSeated: 'boarded' },
  initial: s => s.phase === 'intro', interacting: s => s.action === 'dragging',
  instruction(s) {
    if (s.phase === 'complete') return 'complete';
    if (s.action === 'auto') return;
    if (s.phase === 'choose') return s.order.length ? 'next' : 'choose';
    if (s.phase.endsWith('-arrival')) return currentVehicle(s);
    return cues[s.phase][0];
  },
  feedback(a, b) {
    if (a.phase === b.phase) return;
    if (a.phase.endsWith('-arrival') && b.phase.endsWith('-door')) return 'parked';
    if (a.phase.endsWith('-door')) return 'opened';
    if (a.phase === 'loading') return 'loaded';
    if (a.phase === 'boarding' || a.phase === 'coach-boarding') return 'boarded';
  },
};
