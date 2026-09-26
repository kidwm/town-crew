import { bindPrimaryDrag } from '../../runtime/pointer.ts';
import { createDragHint } from '../../runtime/drag-hint.ts';
import type { createAudio } from '../../runtime/audio.ts';
import { loadProgress, saveProgress, markCompleted, isMuted, setMuted } from '../../app/progress.ts';
import { icons as roadIcons } from '../road-repair/ui.ts';
import { createHouse, resumeHouse, grab, release, dragGravel, moveChute, drive, moveLoad, advance, progress, stages, PARTS, partFor, isCrane, isDelivery } from './domain/house.ts';
import { advanceCraneSettle, CRANE_SETTLE_SECONDS } from './domain/crane-target.ts';
import { chooseRound, validRound, DEFAULT_ROUND, ROOF_TYPES, ROOF_NAMES, HOUSE_PALETTES } from './domain/round.ts';
import type { HouseRound } from './domain/round.ts';
import { arrivalTime, arrivalStep } from './domain/arrival.ts';
import { housePlan } from './round-card.ts';
import type { ScreenPoint } from './domain/crane-target.ts';
import type { HouseState, Stage, Point } from './domain/house.ts';
import type { createHouseScene } from './scene.ts';

export const houseSounds = { grab: [330], pour: [247, 330], delivered: [330, 440], placed: [392, 494, 587], floor: [392, 494, 587, 784], complete: [392, 494, 587, 784, 988] } as const;
const icons = {
  gravel: roadIcons['dump-truck'],
  concrete: '<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M3 17h12v15H3Z" fill="#d99b78"/><path d="M5 19h7v7H5Z" fill="#c7e4dd"/><path d="M2 29h44v4H2Z" fill="#66827d"/><ellipse cx="30" cy="20" rx="13" ry="10" fill="#e8c38a"/><path d="M22 12l7 17m3-18 7 15" stroke="#fff0c8" stroke-width="5"/><circle cx="9" cy="33" r="5" fill="#526c66"/><circle cx="34" cy="33" r="5" fill="#526c66"/></svg>',
  flatbed: '<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M3 15h12v16H3Z" fill="#7aab93"/><path d="M5 17h7v7H5Z" fill="#c7e4dd"/><path d="M2 29h44v4H2Z" fill="#a78564"/><path d="M18 18h26v10H18Z" fill="#dfc999"/><path d="M22 18v10m17-10v10" stroke="#9a9f83" stroke-width="3"/><circle cx="9" cy="33" r="5" fill="#526c66"/><circle cx="36" cy="33" r="5" fill="#526c66"/></svg>',
  crane: '<svg viewBox="0 0 48 40" aria-hidden="true"><path d="M3 22h37v11H3Z" fill="#e0af54"/><path d="M5 12h12v14H5Z" fill="#ecc874"/><path d="M21 24L28 4l15 5" fill="none" stroke="#d3a04e" stroke-width="4"/><path d="M43 9v12q-6 6-6 0" fill="none" stroke="#607970" stroke-width="2"/><circle cx="10" cy="33" r="5" fill="#526c66"/><circle cx="33" cy="33" r="5" fill="#526c66"/></svg>',
};
const names: Record<Stage, string> = { gravel: '砂石車 · 鋪好基底', concrete: '水泥車 · 澆灌地基', 'delivery-one': '平板車 · 第一批材料', 'crane-one': '吊車 · 蓋好一樓', 'delivery-two': '平板車 · 第二批材料', 'crane-two': '吊車 · 蓋好二樓', 'roof-color': '吊車 · 準備屋頂', decorate: '新家蓋好了！', complete: '兩層小樓蓋好了！' };
const instructions: Record<Stage, string> = { gravel: '按住車斗前端，往上拉', concrete: '把出料口拖到任一光圈，三區都填滿', 'delivery-one': '按住車子，往右拖到停車位', 'crane-one': '把材料拖到房子上，吊車幫你放好', 'delivery-two': '按住車子，往右拖到停車位', 'crane-two': '把材料拖到房子上，吊車幫你放好', 'roof-color': '吊車正在吊起屋頂', decorate: '歡迎入住！', complete: '歡迎搬進新家！' };
function iconFor(phase: Stage) { return phase === 'gravel' ? icons.gravel : phase === 'concrete' ? icons.concrete : phase.startsWith('delivery') ? icons.flatbed : icons.crane; }

const roundKey = 'town-crew:house:last-round:v1';
let previousRound: HouseRound | undefined;
function rememberRound(round: HouseRound) {
  previousRound = { ...round };
  try { sessionStorage.setItem(roundKey, JSON.stringify(round)); } catch { /* Optional storage. */ }
}
function newRound(previous?: HouseRound) {
  try { const saved: unknown = JSON.parse(sessionStorage.getItem(roundKey) ?? 'null'); if (validRound(saved)) previousRound = saved; } catch { /* Optional storage. */ }
  const round = chooseRound(previous ?? previousRound); rememberRound(round); return round;
}

export function createHouseSession(app: HTMLDivElement, dev: boolean, onHome: () => void, fresh = false) {
  const params = new URLSearchParams(location.search), query = params.get('stage');
  const stage: Stage = dev && !fresh && stages.includes(query as Stage) ? query as Stage : 'gravel';
  const devKey = `town-crew:house:dev:v1:${location.search}`;
  let restored: HouseState | undefined;
  try { if (!fresh) restored = resumeHouse(dev ? JSON.parse(sessionStorage.getItem(devKey) ?? 'null') : loadProgress('house-build')); } catch { /* Optional storage. */ }
  const configured = { ...DEFAULT_ROUND, roof: params.get('roof') ?? DEFAULT_ROUND.roof, layout: Number(params.get('layout') ?? 0), palette: Number(params.get('palette') ?? 0), family: Number(params.get('family') ?? 0), pet: params.get('pet') ?? 'none' };
  let state = restored ?? createHouse(stage, dev ? validRound(configured) ? configured : DEFAULT_ROUND : newRound());
  if (!dev) rememberRound(state.round);
  function save() {
    if (dev) { try { sessionStorage.setItem(devKey, JSON.stringify(state)); } catch { /* Optional storage. */ } }
    else saveProgress('house-build', state);
  }
  app.innerHTML = `<main class="world house-world" aria-label="小小城市隊蓋房子任務"><div class="canvas-host"></div><svg class="crane-footprint" aria-hidden="true" hidden><polygon/></svg><div class="crane-target" role="img" aria-label="吊車放置位置" data-ready="false" hidden><svg class="crane-target-progress" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" pathLength="1"/></svg><svg class="crane-target-arrow" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 5v21M7 17l9 9 9-9"/></svg><svg class="crane-target-check" viewBox="0 0 32 32" aria-hidden="true"><path d="M6 16l7 7L27 8"/></svg><span class="crane-drop-label" role="status">拖到房子上</span></div><header class="masthead"><span class="brand-symbol" aria-hidden="true">▰</span><div><strong>小小城市隊</strong><span>TOWN CREW</span></div></header><div class="controls"><button class="home" aria-label="回到選關">⌂</button><button class="sound" aria-label="關閉音效" aria-pressed="false">♪</button><button class="restart" aria-label="重新開始蓋房子任務">↻</button></div><div class="house-plan" role="img" aria-label="這次要蓋的兩層小樓"></div><div class="house-caption"><span class="house-instruction"></span><span class="house-detail"></span></div><div class="mission-badge"><span class="badge-icon">${icons.gravel}</span><div><span class="eyebrow">一起蓋兩層小樓</span><strong id="vehicle-name"></strong></div></div><div class="mission-steps house-steps" aria-label="蓋房子四種工程車">${Object.entries(icons).map(([id, icon]) => `<span data-step="${id}">${icon}</span>`).join('')}</div><div class="progress" role="progressbar" aria-label="蓋房子進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div><div class="finish-actions" hidden><button class="finish-restart">↻ 再玩一次</button><button class="finish-home">⌂ 回到選關</button></div><div class="loading" role="status">工程車準備出發…</div></main>${dev ? `<aside class="dev-panel"><div class="dev-heading">開發工具 · 蓋房子</div><h1>一起，蓋兩層小樓。</h1><p class="dev-intro">鋪基底 → 澆灌 → 兩次送貨 → 六次吊裝</p><label class="field">直達階段<select id="stage">${stages.filter(id => id !== 'roof-color').map(id => `<option value="${id}">${names[id]}</option>`).join('')}</select></label><button class="reset-stage">重設目前階段</button><label class="field">屋型<select id="house-roof">${ROOF_TYPES.map(roof => `<option value="${roof}">${ROOF_NAMES[roof]}</option>`).join('')}</select></label><label class="field">工地配置<select id="house-layout"><option value="0">房子在右，材料在左</option><option value="1">房子在左，材料在右</option></select></label><label class="field">房屋配色<select id="house-palette">${HOUSE_PALETTES.map((_, i) => `<option value="${i}">${['奶油', '青草', '天空', '珊瑚'][i]}</option>`).join('')}</select></label><label class="field">入住家庭<select id="house-family"><option value="0">兩位大人、一位小孩</option><option value="1">一位大人、兩位小孩</option><option value="2">兩位大人、兩位小孩</option></select></label><label class="field">寵物<select id="house-pet"><option value="none">沒有寵物</option><option value="cat">小貓</option><option value="dog">小狗</option></select></label><dl class="telemetry"><div><dt>目前階段</dt><dd id="phase"></dd></div><div><dt>動作</dt><dd id="action"></dd></div><div><dt>吊裝完成</dt><dd id="placed"></dd></div></dl><p class="dev-note">重載和 HMR 保留進度；拖曳取消後可接著玩。</p></aside>` : ''}`;
  function connect(scene: ReturnType<typeof createHouseScene>, audio: ReturnType<typeof createAudio<keyof typeof houseSounds>>) {
    const events = new AbortController(), options = { signal: events.signal };
    const dragHint = createDragHint(app.querySelector<HTMLElement>('.world')!);
    let frame = 0, previous = performance.now(), time = 0, saved = 0, muted = isMuted(); audio.setMuted(muted);
    function unlock() { try { void audio.unlock().catch(() => {}); } catch { /* Audio is optional. */ } }
    function update(next: HouseState) {
      if (next.placed > state.placed) audio.play(next.placed === 3 ? 'floor' : 'placed');
      if (next.pours.filter(v => v === 1).length > state.pours.filter(v => v === 1).length) audio.play('pour');
      if (isCrane(next) && isDelivery(state)) audio.play('delivered');
      const checkpoint = next.phase !== state.phase || next.placed !== state.placed;
      const completed = next.phase === 'complete' && state.phase !== 'complete';
      if (completed) { audio.play('complete'); if (!dev) markCompleted('house-build'); }
      state = next;
      if (checkpoint) save();
    }
    const height = () => isCrane(state) ? partFor(state.round, state.placed).lift + partFor(state.round, state.placed).height / 2 : state.phase === 'concrete' ? 1.1 : 1.5;
    const pointer = bindPrimaryDrag<{ phase: Stage; y: number; plane: number; offset: Point; screen: ScreenPoint; origin: ScreenPoint; settle: number }>(scene.canvas, {
      start(event) {
        unlock();
        if (state.action !== 'ready' || !scene.hit(event.clientX, event.clientY, state)) return;
        const plane = height(), p = scene.onPlane(event.clientX, event.clientY, plane); if (!p) return;
        const anchor = isCrane(state) ? state.load : state.phase === 'concrete' ? state.chute : { x: state.truckX, z: 5.1 };
        update(grab(state)); audio.play('grab');
        const screen = { x: event.clientX, y: event.clientY };
        return { phase: state.phase, y: event.clientY, plane, screen, origin: screen, settle: 0, offset: { x: anchor.x - p.x, z: anchor.z - p.z } };
      },
      move(event, context) {
        if (state.phase !== context.phase || state.action !== 'dragging') return;
        context.screen = { x: event.clientX, y: event.clientY };
        if (state.phase === 'gravel') { update(dragGravel(state, context.y - event.clientY)); return; }
        const p = scene.onPlane(event.clientX, event.clientY, context.plane); if (!p) return;
        const target = { x: p.x + context.offset.x, z: p.z + context.offset.z };
        update(state.phase === 'concrete' ? moveChute(state, scene.concreteAim(event.clientX, event.clientY, state, target)) : isDelivery(state) ? drive(state, target.x) : moveLoad(state, target));
      },
      end(context, cancelled) {
        const targetReached = isCrane(state) && scene.craneDropTarget(state, context.screen, context.origin).accepted;
        update(release(state, cancelled, targetReached)); save();
      },
    }, events.signal);
    const restart = () => { unlock(); pointer.cancel(); state = createHouse('gravel', dev ? chooseRound(state.round) : newRound(state.round)); save(); };
    app.querySelectorAll('.restart, .finish-restart').forEach(button => button.addEventListener('click', restart, options));
    app.querySelectorAll('.home, .finish-home').forEach(button => button.addEventListener('click', () => { pointer.cancel(); save(); onHome(); }, options));
    const sound = app.querySelector<HTMLButtonElement>('.sound')!;
    const syncSound = () => { sound.textContent = muted ? '♩' : '♪'; sound.setAttribute('aria-pressed', String(muted)); sound.setAttribute('aria-label', muted ? '開啟音效' : '關閉音效'); };
    syncSound(); sound.addEventListener('click', () => { unlock(); muted = !muted; setMuted(muted); audio.setMuted(muted); syncSound(); }, options);
    const select = app.querySelector<HTMLSelectElement>('#stage');
    const fields = ['roof', 'layout', 'palette', 'family', 'pet'] as const;
    const resetStage = () => {
      pointer.cancel();
      const round = Object.fromEntries(fields.map(key => {
        const value = app.querySelector<HTMLSelectElement>(`#house-${key}`)!.value;
        return [key, ['layout', 'palette', 'family'].includes(key) ? Number(value) : value];
      }));
      const next = createHouse(select!.value as Stage, validRound(round) ? round : state.round);
      state = { ...next, color: next.round.palette === state.round.palette ? state.color : next.color }; save();
    };
    select?.addEventListener('change', resetStage, options);
    app.querySelector('.reset-stage')?.addEventListener('click', resetStage, options);
    fields.forEach(key => app.querySelector(`#house-${key}`)?.addEventListener('change', resetStage, options));
    document.addEventListener('visibilitychange', () => { previous = performance.now(); if (document.hidden) save(); }, options);
    window.addEventListener('pagehide', save, options);
    app.querySelector('.loading')!.remove();
    function label(selector: string, text: string) { const node = app.querySelector(selector); if (node && node.textContent !== text) node.textContent = text; }
    const craneTarget = app.querySelector<HTMLElement>('.crane-target')!;
    const footprint = app.querySelector<SVGSVGElement>('.crane-footprint')!;
    const settleRing = app.querySelector<SVGCircleElement>('.crane-target-progress circle')!;
    let displayed: Stage | undefined, planKey = '';
    const plan = app.querySelector<HTMLElement>('.house-plan')!;
    function animate(now: number) {
      const dt = document.hidden ? 0 : Math.min((now - previous) / 1000, 0.1); previous = now; time += dt;
      update(advance(state, dt));
      if (pointer.context() && pointer.context()!.phase !== state.phase) pointer.cancel();
      const held = pointer.context();
      if (held && isCrane(state) && state.action === 'dragging') {
        const accepted = scene.craneDropTarget(state, held.screen, held.origin).accepted;
        held.settle = advanceCraneSettle(held.settle, dt, accepted);
        if (held.settle >= CRANE_SETTLE_SECONDS) {
          update(release(state, false, true));
          // Commit first, then release ownership. The still-held finger cannot
          // move this animation or pick up the next part without a new press.
          pointer.cancel();
        }
      }
      scene.render(state, time);
      dragHint.update(scene.dragHint(state), time);
      const drop = isCrane(state) && ['ready', 'dragging'].includes(state.action)
        ? scene.craneDropTarget(state, pointer.context()?.screen, pointer.context()?.origin) : undefined;
      craneTarget.hidden = !drop;
      footprint.toggleAttribute('hidden', !drop);
      if (drop) {
        craneTarget.style.left = `${drop.x}px`; craneTarget.style.top = `${drop.y}px`;
        craneTarget.style.width = craneTarget.style.height = `${drop.radius * 2}px`;
        craneTarget.dataset.ready = String(drop.accepted);
        footprint.dataset.ready = String(drop.accepted);
        footprint.querySelector('polygon')!.setAttribute('points', drop.footprint.map(p => `${p.x},${p.y}`).join(' '));
        settleRing.style.strokeDashoffset = String(1 - (pointer.context()?.settle ?? 0) / CRANE_SETTLE_SECONDS);
        label('.crane-drop-label', drop.accepted ? '停一下，幫你放好！' : '拖到房子上');
      }
      label('.house-instruction', state.phase === 'crane-two' && state.action === 'leaving'
        ? '房子蓋好了！工程車收工囉'
        : state.phase === 'decorate' ? ({ driving: '一家人開車來囉！', parked: '停好車，準備下車', unloading: '一起下車，搬進新家', walking: '走到門口，歡迎回家！', waiting: '', home: '歡迎搬進新家！' })[arrivalStep(arrivalTime(state))]
        : state.action === 'placing' ? '吊車正在幫忙放好'
        : drop?.accepted ? '對準了！吊車幫你放好' : isDelivery(state) ? `按住車子，往${state.round.layout === 0 ? '右' : '左'}拖到停車位` : instructions[state.phase]);
      app.dataset.phase = state.phase; app.dataset.action = state.action; app.dataset.placed = String(state.placed);
      app.dataset.pours = String(state.pours.filter(v => v === 1).length); app.dataset.color = String(state.color);
      app.dataset.layout = String(state.round.layout); app.dataset.roof = state.round.roof;
      app.dataset.palette = String(state.round.palette); app.dataset.family = String(state.round.family); app.dataset.pet = state.round.pet;
      app.dataset.pourValues = JSON.stringify(state.pours);
      app.dataset.arrival = arrivalStep(arrivalTime(state));
      app.dataset.arrivalTime = String(arrivalTime(state));
      const nextPlanKey = `${state.round.roof}/${state.round.palette}/${state.color}/${state.round.layout}`;
      if (planKey !== nextPlanKey) { plan.innerHTML = housePlan(state); plan.setAttribute('aria-label', `這次蓋${ROOF_NAMES[state.round.roof]}兩層小樓`); planKey = nextPlanKey; }
      const value = progress(state);
      app.querySelector<HTMLElement>('.progress span')!.style.transform = `scaleX(${value})`;
      app.querySelector('.progress')!.setAttribute('aria-valuenow', String(Math.round(value * 100)));
      app.querySelector<HTMLElement>('.finish-actions')!.hidden = state.phase !== 'complete';
      scene.canvas.style.cursor = state.action === 'dragging' ? 'grabbing' : state.action === 'ready' && !['roof-color', 'decorate', 'complete'].includes(state.phase) ? 'grab' : 'default';
      label('.house-detail', state.phase === 'roof-color' ? '屋頂 · 6 / 6' : isCrane(state) && state.action !== 'leaving' ? `${PARTS[state.placed]?.name ?? ''} · ${state.placed + 1} / 6` : state.phase === 'concrete' ? `${state.pours.filter(v => v === 1).length} / 3` : state.phase === 'crane-one' && state.action === 'leaving' ? '一樓完成了！二樓的材料正在路上' : '');
      if (displayed !== state.phase) {
        label('#vehicle-name', names[state.phase]);
        app.querySelector('.badge-icon')!.innerHTML = iconFor(state.phase);
        const active = state.phase === 'gravel' ? 0 : state.phase === 'concrete' ? 1 : isDelivery(state) ? 2 : 3;
        app.querySelectorAll<HTMLElement>('[data-step]').forEach((el, i) => { el.dataset.state = state.phase === 'complete' || state.phase === 'decorate' || i < active ? 'done' : i === active ? 'active' : 'upcoming'; });
        if (select) select.value = state.phase;
        displayed = state.phase;
      }
      if (dev) { fields.forEach(key => { app.querySelector<HTMLSelectElement>(`#house-${key}`)!.value = String(state.round[key]); }); label('#phase', names[state.phase]); label('#action', state.action); label('#placed', `${state.placed} / 6`); }
      if (now - saved > 800) { save(); saved = now; }
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => { pointer.cancel(); save(); cancelAnimationFrame(frame); events.abort(); dragHint.dispose(); };
  }
  return { connect, save };
}
