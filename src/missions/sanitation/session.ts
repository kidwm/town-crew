import { Effect } from 'effect';
import { sanitationPersistence } from './services.ts';
import { createAudioUnlocker } from '../../runtime/audio-unlock.ts';
import { runFrameLoop } from '../../runtime/frame-loop.ts';
import { withAutosave } from '../../runtime/autosave.ts';
import { bindPrimaryDrag } from '../../runtime/pointer.ts';
import { createDragHint } from '../../runtime/drag-hint.ts';
import { createAudio } from '../../runtime/audio.ts';
import { createSanitation, chooseRound, validRound, stages, available, currentVehicle, driving, lifting, grab, drive, moveItem, release, advance, progress, vehicles, cargoPairs, vehicleOrder, stageOrder } from './domain/sanitation.ts';
import type { Stage, SanitationState, Item, Service } from './domain/sanitation.ts';
import type { SanitationScene } from './scene.ts';
import { mountSanitationUI, names, instruction, vehicleNames } from './ui.ts';
import { sanitationIcons } from '../../app/sanitation-art.ts';
export const createSanitationAudio = () => createAudio({ parked: [440, 660], load: [392, 523, 659], lift: [330, 440, 550], depart: [392, 523], complete: [523, 659, 784, 1047] });
export function createSanitationSession(app: HTMLDivElement, dev: boolean, onHome: () => void, fresh = false, persistence = sanitationPersistence) {
  const params = new URLSearchParams(location.search), query = params.get('stage'), phase: Stage = dev && !fresh && stages.includes(query as Stage) ? query as Stage : 'intro';
  const devKey = `town-crew:sanitation:dev:v1:${location.search}`, restored = fresh ? undefined : persistence.load(dev, devKey);
  const configured = { layout: Number(params.get('layout') ?? 0), palette: Number(params.get('palette') ?? 0), cast: Number(params.get('cast') ?? 0), service: params.get('service') === 'food-first' ? 'food-first' as const : 'recycle-first' as const, cargo: cargoPairs[Number(params.get('cargo') ?? 0)] ?? cargoPairs[0] };
  let state = restored ?? createSanitation(phase, dev && validRound(configured) ? configured : dev ? undefined : persistence.newRound());
  if (!dev && restored) persistence.rememberRound(state.round);
  function save() { persistence.save(dev, devKey, state); }
  mountSanitationUI(app, dev);
  const connect = (scene: SanitationScene, audio: ReturnType<typeof createSanitationAudio>) => Effect.gen(function* () {
    const events = yield* Effect.acquireRelease(Effect.sync(() => new AbortController()), value => Effect.sync(() => value.abort()));
    const options = { signal: events.signal };
    const hint = yield* Effect.acquireRelease(Effect.sync(() => createDragHint(app.querySelector<HTMLElement>('.world')!)), value => Effect.sync(value.dispose));
    let previous = performance.now(), time = 0, muted = persistence.isMuted();
    yield* Effect.addFinalizer(() => Effect.sync(save)); audio.setMuted(muted);
    const unlock = createAudioUnlocker('sanitation', audio, events.signal, dev);
    function update(next: SanitationState) {
      if (next === state) return;
      const changed = next.phase !== state.phase;
      state = next;
      if (changed) {
        audio.play(next.phase === 'complete' ? 'complete' : next.phase.endsWith('-tip') ? 'lift' : next.phase.endsWith('-exit') ? 'depart' : next.phase === 'bags' || next.phase === 'recycling' || next.phase === 'food-dock' ? 'parked' : 'load');
        if (next.phase === 'complete' && !dev) persistence.markCompleted(); save();
      }
    }
    interface Held { phase: Stage; origin: { x: number; y: number }; offset: { x: number; y: number }; value: number; liftDistance: number; item?: Item; objectOffset: { x: number; z: number }; height: number }
    const pointer = bindPrimaryDrag<Held>(scene.canvas, {
      start(event) {
        unlock(); const selected = scene.hit({ x: event.clientX, y: event.clientY }, state); if (!selected) return;
        const item = selected === 'vehicle' ? undefined : selected, t = scene.task(state, item), r = scene.canvas.getBoundingClientRect();
        const height = item ? state.positions[item].y : 0.55, p = scene.world({ x: event.clientX, y: event.clientY }, height);
        update(grab(state, item, t.kind === 'item' && Math.hypot(t.to.x - t.from.x, t.to.y - t.from.y) <= 28)); if (state.action !== 'dragging') return;
        return { phase: state.phase, origin: { x: event.clientX, y: event.clientY }, offset: { x: r.x + t.from.x - event.clientX, y: r.y + t.from.y - event.clientY }, value: state.travel, liftDistance: Math.max(85, Math.min(130, scene.canvas.clientHeight * 0.16)), item, objectOffset: { x: item ? state.positions[item].x - p.x : 0, z: item ? state.positions[item].z - p.z : 0 }, height };
      },
      move(event, held) {
        if (state.phase !== held.phase || state.action !== 'dragging') return;
        const dx = event.clientX - held.origin.x, dy = event.clientY - held.origin.y;
        if (Math.hypot(dx, dy) < 10 && !state.moved) return;
        if (lifting(state)) update(drive(state, held.value - dy / held.liftDistance));
        else if (driving(state)) update(drive(state, scene.target(state, { x: event.clientX + held.offset.x, y: event.clientY + held.offset.y })));
        else {
          const p = scene.world({ x: event.clientX, y: event.clientY }, held.height); p.x += held.objectOffset.x; p.z += held.objectOffset.z;
          update(moveItem(state, p, scene.near(state, { x: event.clientX, y: event.clientY }, p)));
        }
      },
      end(held, cancelled) { if (held.phase === state.phase) update(release(state, cancelled)); save(); },
    }, events.signal);
    yield* Effect.addFinalizer(() => Effect.sync(pointer.cancel));
    const restart = () => { unlock(); pointer.cancel(); state = createSanitation('intro', dev ? chooseRound(state.round) : persistence.newRound(state.round)); save(); };
    app.querySelectorAll('.restart, .finish-restart').forEach(b => b.addEventListener('click', restart, options));
    app.querySelectorAll('.home, .finish-home').forEach(b => b.addEventListener('click', () => { pointer.cancel(); save(); onHome(); }, options));
    const sound = app.querySelector<HTMLButtonElement>('.sound')!;
    function syncSound() { sound.textContent = muted ? '♩' : '♪'; sound.setAttribute('aria-pressed', String(muted)); sound.setAttribute('aria-label', muted ? '開啟音效' : '關閉音效'); }
    syncSound(); sound.addEventListener('click', () => { unlock(); muted = !muted; persistence.setMuted(muted); audio.setMuted(muted); syncSound(); }, options);
    const select = app.querySelector<HTMLSelectElement>('#stage'), layout = app.querySelector<HTMLSelectElement>('#layout'), palette = app.querySelector<HTMLSelectElement>('#palette'), service = app.querySelector<HTMLSelectElement>('#service'), cargo = app.querySelector<HTMLSelectElement>('#cargo');
    const reset = () => { pointer.cancel(); state = createSanitation(select!.value as Stage, { ...state.round, layout: Number(layout!.value) as 0 | 1, palette: Number(palette!.value), service: service!.value as Service, cargo: cargoPairs[Number(cargo!.value)] }); save(); };
    select?.addEventListener('change', reset, options); layout?.addEventListener('change', reset, options); palette?.addEventListener('change', reset, options); service?.addEventListener('change', reset, options); cargo?.addEventListener('change', reset, options); app.querySelector('.reset-stage')?.addEventListener('click', reset, options);
    document.addEventListener('visibilitychange', () => { previous = performance.now(); if (document.hidden) save(); }, options); window.addEventListener('pagehide', save, options);
    app.querySelector('.loading')!.remove();
    const goal = app.querySelector<HTMLElement>('.sanitation-goal')!;
    const label = (selector: string, text: string) => { const node = app.querySelector(selector)!; if (node.textContent !== text) node.textContent = text; };
    let displayed = '', displayedService = '';
    function animate(now: number) {
      const dt = document.hidden ? 0 : Math.min((now - previous) / 1000, 0.1); previous = now; time += dt; update(advance(state, dt));
      const held = pointer.context(); if (held && (held.phase !== state.phase || state.action !== 'dragging')) pointer.cancel();
      scene.render(state, time); hint.update(scene.hint(state), time);
      const eligible = available(state), interactive = state.action !== 'auto' && state.phase !== 'complete', t = interactive ? scene.task(state) : undefined;
      goal.hidden = !t;
      if (t) { goal.style.left = `${t.to.x}px`; goal.style.top = `${t.to.y}px`; goal.dataset.kind = t.kind; goal.dataset.ready = String(state.near); label('.sanitation-goal span', t.kind === 'lift' ? '往上抬' : t.kind === 'drive' ? state.phase === 'sweep' ? '刷乾淨' : state.phase.endsWith('-exit') ? '出發' : '收運停車彎' : state.phase === 'bags' ? '投入口' : state.phase === 'recycling' ? '回收車斗' : '掛架'); }
      app.querySelectorAll<HTMLElement>('.sanitation-source').forEach(node => { const id = node.dataset.item as Item; node.hidden = !eligible.includes(id); if (!node.hidden) { const p = scene.task(state, id).from; node.style.left = `${p.x}px`; node.style.top = `${p.y}px`; } });
      app.dataset.phase = state.phase; app.dataset.action = state.action; app.dataset.layout = String(state.round.layout); app.dataset.palette = String(state.round.palette); app.dataset.vehicle = currentVehicle(state); app.dataset.travel = String(state.travel); app.dataset.bags = state.bags.join(','); app.dataset.recycled = state.recycled.join(','); app.dataset.binEmpty = String(state.binEmpty); app.dataset.foodEmpty = String(state.foodEmpty); app.dataset.swept = String(state.swept); app.dataset.elapsed = String(state.elapsed); app.dataset.service = state.round.service; app.dataset.cargo = state.round.cargo.join(',');
      app.querySelector<HTMLElement>('.progress span')!.style.transform = `scaleX(${progress(state)})`; app.querySelector('.progress')!.setAttribute('aria-valuenow', String(Math.round(progress(state) * 100)));
      label('.house-instruction', instruction(state)); label('.house-detail', lifting(state) ? '放手會停在原高度，可以接著抬' : state.phase === 'bin-dock' || state.phase === 'food-dock' ? '掛好後，再用新的向上拖曳抬桶' : state.phase === 'bags' || state.phase === 'recycling' ? '對準停一下，就會自動放好' : '');
      const complete = state.phase === 'complete'; app.querySelector<HTMLElement>('.finish-actions')!.hidden = !complete; app.querySelector<HTMLElement>('.sanitation-finish')!.hidden = !complete;
      const order = vehicleOrder(state.round), active = order.indexOf(currentVehicle(state)); app.querySelectorAll<HTMLElement>('[data-step]').forEach(node => { const i = order.indexOf(node.dataset.step as typeof vehicles[number]); node.style.order = String(i); node.dataset.state = complete || i < active ? 'done' : i === active ? 'active' : 'upcoming'; });
      scene.canvas.style.cursor = state.action === 'dragging' ? 'grabbing' : interactive ? 'grab' : 'default';
      if (displayedService !== state.round.service) {
        if (select) { select.innerHTML = stageOrder(state.round).map(p => `<option value="${p}">${names[p]}</option>`).join(''); select.value = state.phase; }
        app.querySelector('.mission-steps')!.setAttribute('aria-label', order.map(v => vehicleNames[v]).join('、')); displayedService = state.round.service;
      }
      if (displayed !== state.phase) { label('#vehicle-name', names[state.phase]); app.querySelector('.badge-icon')!.innerHTML = sanitationIcons[currentVehicle(state)]; if (select) select.value = state.phase; displayed = state.phase; }
      if (dev) { label('#phase', names[state.phase]); label('#action', state.action); layout!.value = String(state.round.layout); palette!.value = String(state.round.palette); service!.value = state.round.service; cargo!.value = String(cargoPairs.findIndex(pair => pair.every(id => state.round.cargo.includes(id)))); }
    }
    return withAutosave('sanitation', runFrameLoop('sanitation', animate), save, 700);
  });
  return { connect, save };
}
