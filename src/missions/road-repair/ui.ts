export const icons = {
  excavator: '<svg viewBox="0 0 48 40" aria-hidden="true"><rect x="3" y="29" width="26" height="8" rx="4" fill="#536665"/><rect x="6" y="20" width="23" height="10" rx="2" fill="#e9b24d"/><rect x="7" y="10" width="11" height="13" rx="2" fill="#edc367"/><path d="M23 22L25 5L37 13L40 27" fill="none" stroke="#d89b35" stroke-width="4" stroke-linecap="round"/><path d="M35 26L44 25L43 32L36 32Z" fill="#e9b24d"/></svg>',
  'haul-away': '<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M4 14H17V29H4Z" fill="#74a28b"/><path d="M7 16H14V22H7Z" fill="#c3e6e3"/><rect x="3" y="27" width="41" height="5" rx="2" fill="#4b6864"/><path d="M19 12H44L40 26H19Z" fill="#ad7761"/><path d="M22 12l6-4 6 3 7-2 2 4Z" fill="#535f65"/><circle cx="11" cy="32" r="5" fill="#536665"/><circle cx="35" cy="32" r="5" fill="#536665"/></svg>',
  'dump-truck': '<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M4 14H17V29H4Z" fill="#489aba"/><path d="M7 16H14V22H7Z" fill="#c3e6e3"/><rect x="3" y="27" width="41" height="5" rx="2" fill="#4b7485"/><path d="M19 12H44L40 26H19Z" fill="#edb34f"/><circle cx="11" cy="32" r="5" fill="#536665"/><circle cx="35" cy="32" r="5" fill="#536665"/></svg>',
  roller: '<svg viewBox="0 0 48 40" aria-hidden="true"><rect x="4" y="20" width="29" height="10" rx="2" fill="#dba344"/><path d="M16 23V9H29" fill="none" stroke="#6e8074" stroke-width="3"/><rect x="12" y="6" width="22" height="4" rx="2" fill="#ecc367"/><circle cx="12" cy="31" r="7" fill="#536665"/><rect x="31" y="23" width="14" height="14" rx="6" fill="#91a9a9"/></svg>',
};
export function mountUI(app: HTMLElement, dev: boolean) {
  app.innerHTML = `
  <main class="world" aria-label="小小城市隊修路任務">
    <div class="canvas-host"></div>
    <header class="masthead"><span class="brand-symbol" aria-hidden="true">▰</span><div><strong>小小城市隊</strong><span>TOWN CREW</span></div></header>
    <div class="controls"><button class="home" aria-label="回到選關">⌂</button><button class="sound" aria-label="關閉音效" aria-pressed="false">♪</button><button class="restart" aria-label="重新開始修路任務">↻</button></div>
    <div class="gesture-caption" hidden><span class="gesture-instruction"></span></div>
    <div class="mission-badge"><span class="badge-icon">${icons.excavator}</span><div><span class="eyebrow">道路修復</span><strong id="vehicle-name">挖土機</strong></div></div>
    <div class="mission-steps" aria-label="修路四階段">${Object.entries(icons).map(([key, icon]) => `<span data-step="${key}" aria-label="${key === 'excavator' ? '清除舊路面' : key === 'haul-away' ? '裝車清運' : key === 'dump-truck' ? '填入材料' : '整平路面'}">${icon}</span>`).join('')}</div>
    <div class="progress" aria-label="修路進度" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
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
