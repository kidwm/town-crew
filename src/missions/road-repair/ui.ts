import { DAMAGE, DAMAGE_PATTERNS } from './domain/round.ts';

import { icons } from '../../app/road-vehicle-art.ts';
export { icons } from '../../app/road-vehicle-art.ts';
export function mountUI(app: HTMLElement, dev: boolean) {
  app.innerHTML = `
  <main class="world road-world" aria-label="小小城市隊修路任務">
    <div class="canvas-host"></div>
    <div class="excavator-grip" aria-hidden="true" hidden></div>
    <div class="excavator-drop" aria-hidden="true" hidden><span>↓</span></div>
    <span id="excavator-keyboard-help" class="visually-hidden">按 Enter 或空白鍵選取挖斗，再按一次前往亮起的目的地。Escape 取消選取。</span>
    <header class="masthead"><span class="brand-symbol" aria-hidden="true">▰</span><div><strong>小小城市隊</strong><span>TOWN CREW</span></div></header>
    <div class="controls"><button class="home" aria-label="回到選關">⌂</button><button class="sound" aria-label="關閉音效" aria-pressed="false">♪</button><button class="restart" aria-label="重新開始修路任務">↻</button></div>
    <div class="gesture-caption" hidden><span class="gesture-instruction"></span></div>
    <div class="mission-badge"><span class="badge-icon">${icons.excavator}</span><div><span class="eyebrow">道路修復</span><strong id="vehicle-name">挖土機</strong></div></div>
    <div class="road-progress">
      <div class="mission-steps" aria-label="修路四階段">${Object.entries(icons).map(([key, icon]) => `<span data-step="${key}" aria-label="${key === 'excavator' ? '清除舊路面' : key === 'haul-away' ? '裝車清運' : key === 'dump-truck' ? '填入材料' : '整平路面'}">${icon}</span>`).join('')}</div>
      <div class="progress" aria-label="修路進度" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
    </div>
    <div class="success" role="status" aria-label="道路修復完成" hidden><span aria-hidden="true">✓</span></div>
    <div class="finish-actions" hidden><button class="finish-restart">↻ 再玩一次</button><button class="finish-home">⌂ 回到選關</button></div>
    <div class="loading" role="status">準備出發…</div>
  </main>
  ${dev ? `<aside class="dev-panel" aria-label="開發工具">
    <div class="dev-heading"><span class="dev-dot"></span> 開發工具 <span class="dev-version">WEB</span></div>
    <h1>一起，把路修好。</h1>
    <p class="dev-intro">挖除 → 清運 → 填料 → 壓平 → 通車<br>各階段可直接進入與重設。</p>
    <label class="field">直達階段<select id="stage"><option value="excavator">挖土機 · 清除舊路面</option><option value="haul-away">清運車 · 載走舊路面</option><option value="dump-truck">運料車 · 填補路基</option><option value="roller">壓路機 · 第一趟</option><option value="roller-return">壓路機 · 回程</option><option value="traffic">完工通車</option><option value="complete">慶祝完成</option></select></label>
    <button class="reset-stage">重設目前階段</button>
    <label class="field">破損配置<select id="road-pattern">${DAMAGE_PATTERNS.map(pattern => `<option value="${pattern}">${DAMAGE[pattern].name}</option>`).join('')}</select></label>
    <label class="field">施工方向<select id="road-layout"><option value="0">怪手在左</option><option value="1">怪手在右</option></select></label>
    <div class="divider"></div>
    <label class="field">車斗拖曳門檻 <output id="threshold-value"></output><input id="threshold" type="range" min="30" max="140" step="5"></label>
    <label class="field">車斗最大傾角 <output id="tilt-value"></output><input id="tilt" type="range" min="40" max="70" step="1"></label>
    <label class="field">倒料時間 <output id="duration-value"></output><input id="duration" type="range" min="1" max="3" step="0.05"></label>
    <button class="reset-tuning">還原參數</button>
    <div class="divider"></div>
    <dl class="telemetry"><div><dt>目前階段</dt><dd id="phase"></dd></div><div><dt>動作</dt><dd id="action"></dd></div><div><dt>清除舊路面</dt><dd id="rocks"></dd></div><div><dt>整平趟數</dt><dd id="passes"></dd></div><div><dt>車斗角度</dt><dd id="angle"></dd></div><div><dt>首次可操作</dt><dd id="boot-time">—</dd></div></dl>
    <p class="dev-note">開發模式會保留進度與參數。<br>重載後可接著試，不必從頭玩。</p>
  </aside>` : ''}`;
}
