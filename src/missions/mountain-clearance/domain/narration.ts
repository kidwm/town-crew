import type { VoicePlan } from '../../../runtime/voice-script.ts';
import type { MountainState, Stage } from './mountain.ts';
export const lines = {
  intro: '土石擋住山路了！一起開工程車，把山路清乾淨。',
  push: '沿著箭頭拖推土機，把土石推到旁邊。',
  excavate: '把挖斗拖到想搬的大石頭，停一下。',
  unload: '把挖斗或大石頭，拖到砂石車的車斗。',
  scoop: '把鏟裝機拖到想鏟的土堆。',
  park: '把鏟裝機拖到車斗後面的光圈。',
  lift: '往上拖，把鏟斗抬高，倒進車斗。',
  haul: '沿著箭頭拖砂石車，把土石載走。',
  sweep: '沿著箭頭拖清掃車，把山路刷乾淨。',
  pushed: '土石推開了！', picked: '挖起來了！', loaded: '成功了！',
  parked: '停好了！', clean: '山路好乾淨！',
  complete: '山路通了！謝謝你，大家又可以平安出發了。',
} as const;
type Id = keyof typeof lines;
const cues = {
  intro: [], push: ['push'], 'dozer-exit': [], 'truck-arrival': [], 'excavator-arrival': [], excavate: ['excavate', 'unload'],
  'excavator-exit': [], 'loader-arrival': [], 'load-soil': ['scoop', 'park', 'lift'], 'loader-exit': [], haul: ['haul'],
  'truck-exit': [], 'sweeper-arrival': [], sweep: ['sweep'], 'sweeper-exit': [], reopen: [], complete: ['complete'],
} as const satisfies Record<Stage, readonly Id[]>;
export const voicePlan: VoicePlan<MountainState, Id> = {
  mission: 'mountain-clearance', lines, cues,
  events: { introduction: 'intro', pushCommitted: 'pushed', rockLifted: 'picked', soilOrRockDelivered: 'loaded', loaderDocked: 'parked', sweepingFinished: 'clean' },
  initial: s => s.phase === 'intro', interacting: s => s.action === 'dragging',
  instruction(s) {
    if (s.phase === 'complete') return 'complete';
    if (s.action === 'auto') return;
    if (s.phase === 'excavate') return s.carried === null ? 'excavate' : 'unload';
    if (s.phase === 'load-soil') return s.loaderDocked ? 'lift' : s.loaderCarrying ? 'park' : 'scoop';
    return cues[s.phase][0];
  },
  feedback(a, b) {
    if (b.delivered.length + b.soilLoaded.length > a.delivered.length + a.soilLoaded.length) return 'loaded';
    if (a.motion === 'lift' && b.action === 'ready') return 'picked';
    if (!a.loaderDocked && b.loaderDocked) return 'parked';
    if (a.phase === 'push' && (a.motion !== 'push-return' && b.motion === 'push-return' || b.phase === 'dozer-exit')) return 'pushed';
    if (a.phase === 'sweep' && b.phase === 'sweeper-exit') return 'clean';
  },
};
