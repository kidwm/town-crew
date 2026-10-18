import { stages, currentVehicle } from './domain/transit.ts';
import type { Stage, TransitState, Vehicle, Round } from './domain/transit.ts';
import { companion, finalVehicle } from './domain/terminal.ts';
import { transferIcons } from '../../app/transfer-art.ts';
export const vehicleNames: Record<Vehicle, string> = { bus: '公車', taxi: '計程車', school: '校車', coach: '遊覽車' };
export const names: Record<Stage, string> = {
  intro: '轉運站，準備接客！', 'bus-arrival': '公車 · 載大家到站', 'bus-door': '公車 · 打開車門', unloading: '大家下車，準備轉乘', 'bus-exit': '公車 · 離站', 'bus-departure': '公車離站中',
  'transfer-entrance': '計程車與校車 · 開進等候位', choose: '兩台都可以先接人！', 'transfer-arrival': '接送車 · 進站', 'transfer-door': '接送車 · 打開車門', boarding: '乘客上車囉', 'transfer-exit': '接送車 · 出發', 'transfer-departure': '接送車離站中',
  'coach-entrance': '遊覽車 · 開進等候點', 'coach-arrival': '遊覽車 · 進站', 'coach-door': '遊覽車 · 打開車門', luggage: '遊覽車 · 放好行李', loading: '行李放進車裡', 'coach-boarding': '旅客上車囉', 'coach-exit': '遊覽車 · 出遊囉', 'coach-departure': '遊覽車離站中', celebrate: '大家都順利出發了！', complete: '轉乘完成，謝謝小小幫手！',
};
export function stageName(phase: Stage, round: Round) {
  if (phase === 'transfer-entrance') return `計程車與${vehicleNames[companion(round)]} · 開進等候位`;
  if (phase.startsWith('coach-')) {
    const vehicle = finalVehicle(round), name = vehicleNames[vehicle];
    const action = { entrance: '開進等候點', arrival: '進站', door: '打開車門', boarding: '乘客上車囉', exit: '出發', departure: '離站中' }[phase.slice(6)];
    return `${name} · ${action}`;
  }
  return names[phase];
}
export function instruction(s: TransitState) {
  const name = vehicleNames[currentVehicle(s)];
  if (s.phase.endsWith('-arrival')) return `把${name}拖到發亮的${currentVehicle(s) === 'taxi' ? '專屬載客區' : '停靠位'}`;
  if (s.phase.endsWith('-door')) return `沿箭頭拉開${name}的車門`;
  if (s.phase.endsWith('-exit')) return `拖${name}往前出發`;
  if (s.phase.endsWith('-departure')) return '等車子離站，再接下一組乘客';
  if (s.phase === 'coach-entrance') return `${name}開進來，準備接${currentVehicle(s) === 'school' ? '學童' : '旅客'}`;
  const boarding = currentVehicle(s) === 'school' ? '學童沿月台上車，坐好再出發' : currentVehicle(s) === 'coach' ? '旅客上車，準備出遊' : '居民上車，準備回家';
  const descriptions: Partial<Record<Stage, string>> = { intro: '公車、計程車、校車、遊覽車，一起接送', unloading: '下車後，沿月台走到候車區', 'transfer-entrance': `${vehicleNames[companion(s.round)]}開進等候位，計程車進入專屬區`, choose: s.order.length ? '換另一台來接乘客吧' : '兩台都可以，拖一台先接人', boarding, luggage: '把行李拖進打開的行李艙', loading: '放好行李，再讓旅客上車', 'coach-boarding': boarding, celebrate: '站務員向大家揮手說再見', complete: '每一位乘客都搭上車了！' };
  return descriptions[s.phase] ?? '';
}
export function mountTransferUI(app: HTMLElement, dev: boolean) {
  app.innerHTML = `<main class="world transfer-world" aria-label="乘客轉運站任務"><div class="canvas-host"></div><div class="transfer-targets"><div class="transfer-choice-ring" data-choice="taxi" hidden></div><div class="transfer-choice-ring" data-choice="school" hidden></div><div class="transfer-choice-ring" data-choice="coach" hidden></div><div class="transfer-grip" hidden></div><div class="transfer-goal" hidden><span></span></div></div><header class="masthead"><span class="brand-symbol" aria-hidden="true">▰</span><div><strong>小小城市隊</strong><span>TOWN CREW</span></div></header><div class="controls"><button class="home" aria-label="回到選關">⌂</button><button class="sound" aria-label="關閉音效" aria-pressed="false">♪</button><button class="restart" aria-label="重新開始轉運站任務">↻</button></div><div class="house-caption"><span class="house-instruction"></span><span class="house-detail"></span></div><div class="mission-badge"><span class="badge-icon">${transferIcons.bus}</span><div><span class="eyebrow">乘客轉運站，一起接送</span><strong id="vehicle-name"></strong></div></div><div class="mission-steps" aria-label="公車、計程車、校車、遊覽車">${(['bus', 'taxi', 'school', 'coach'] as const).map(v => `<span data-step="${v}">${transferIcons[v]}</span>`).join('')}</div><div class="progress" role="progressbar" aria-label="轉運站任務進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div><div class="transfer-picker" hidden><button data-vehicle="taxi" aria-label="先派計程車">${transferIcons.taxi}<span>計程車<small>拖我先接居民</small></span></button><button data-vehicle="school" aria-label="先派校車">${transferIcons.school}<span>校車<small>拖我先接學童</small></span></button><button data-vehicle="coach" aria-label="先派遊覽車" hidden>${transferIcons.coach}<span>遊覽車<small>拖我先接旅客</small></span></button></div><div class="transfer-finish" hidden><span aria-hidden="true">✓</span><strong>每一位乘客都出發了！</strong></div><div class="finish-actions" hidden><button class="finish-restart">↻ 再玩一次</button><button class="finish-home">⌂ 回到選關</button></div><div class="loading" role="status">轉運站準備接客…</div></main>${dev ? `<aside class="dev-panel"><div class="dev-heading">開發工具 · 乘客轉運站</div><h1>進站、開門，一起出發。</h1><p class="dev-intro">公車 → 計程車＋隨機大型車 → 另一台大型車</p><label class="field">直達階段<select id="stage">${stages.map(p => `<option value="${p}">${names[p]}</option>`).join('')}</select></label><button class="reset-stage">重設目前階段</button><label class="field">接送配置<select id="layout"><option value="0">左側月台</option><option value="1">右側月台</option></select></label><label class="field">與計程車同行<select id="companion"><option value="school">校車</option><option value="coach">遊覽車</option></select></label><label class="field">客車配色<select id="palette">${[0, 1, 2, 3].map(n => `<option value="${n}">配色 ${n + 1}</option>`).join('')}</select></label><dl class="telemetry"><div><dt>目前階段</dt><dd id="phase"></dd></div><div><dt>動作</dt><dd id="action"></dd></div></dl><p class="dev-note">重設保留配置；重載與 HMR 接續本局。</p></aside>` : ''}`;
}
