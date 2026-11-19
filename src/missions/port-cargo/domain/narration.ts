import type { VoicePlan } from '../../../runtime/voice-script.ts';
import { isCraneStage, type PortState, type Stage } from './port.ts';

export const lines = {
  intro: '一起到碼頭，幫忙運送貨物。',
  boat: '把貨船拖到發亮的泊位。',
  truck: '把平板車拖到發亮的停車位。',
  'crane-ship': '選一個船上的貨箱，把吊鉤拖過去，停一下。',
  'crane-quay': '選一個岸上的貨箱，把吊鉤拖過去，停一下。',
  'place-ship': '把吊鉤或貨箱拖到船上的光圈，停一下。',
  'place-quay': '把吊鉤或貨箱拖到碼頭的光圈，停一下。',
  'fork-truck': '選一個車上的貨箱，把堆高機拖到箱子前面。',
  'fork-quay': '把堆高機拖到岸上的任一貨箱前。',
  'deliver-quay': '把堆高機拖到碼頭的光圈，放好貨箱。',
  'deliver-truck': '把堆高機拖到平板車側邊的光圈。',
  transport: '沿著箭頭拖平板車，把物資送進小鎮。',
  'ship-transport': '沿著箭頭拖貨船，把物資送往對岸。',
  parked: '停好了！', attached: '看，箱子在半空中！', loaded: '成功了！',
  complete: '物資送到了！謝謝你，一起完成任務。',
} as const;
type Id = keyof typeof lines;
const cues = {
  boat: ['boat'], truck: ['truck'], unload: ['crane-ship', 'place-quay'], 'crane-exit': [],
  forklift: ['fork-truck', 'fork-quay', 'deliver-quay', 'deliver-truck'], 'forklift-exit': [],
  transport: ['transport'], departure: [], arrival: [], complete: ['complete'], 'crane-ready': [],
  'load-ship': ['crane-quay', 'place-ship'], 'ship-transport': ['ship-transport'],
} as const satisfies Record<Stage, readonly Id[]>;
export const voicePlan: VoicePlan<PortState, Id> = {
  mission: 'port-cargo', lines, cues,
  events: { introduction: 'intro', boatOrTruckParked: 'parked', cranePickupFinished: 'attached', cargoDelivered: 'loaded' },
  initial: s => s.phase === 'boat', interacting: s => s.action === 'dragging',
  instruction(s) {
    if (s.phase === 'complete') return 'complete';
    if (!['ready', 'dragging'].includes(s.action)) return;
    const loading = s.round.direction === 'load';
    if (isCraneStage(s)) return s.craneAttached ? loading ? 'place-ship' : 'place-quay' : loading ? 'crane-quay' : 'crane-ship';
    if (s.phase === 'forklift') return s.carrying ? loading ? 'deliver-quay' : 'deliver-truck' : loading ? 'fork-truck' : 'fork-quay';
    return cues[s.phase][0];
  },
  feedback(a, b) {
    if (b.unloaded.length + b.loaded.length > a.unloaded.length + a.loaded.length) return 'loaded';
    if (a.action === 'hoisting' && b.action === 'ready' && b.craneAttached) return 'attached';
    if (a.phase !== b.phase && ['boat', 'truck'].includes(a.phase)) return 'parked';
  },
};
