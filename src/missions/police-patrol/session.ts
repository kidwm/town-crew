import { Effect } from 'effect';
import { policePersistence } from './services.ts';
import { createAudioUnlocker } from '../../runtime/audio-unlock.ts';
import { runFrameLoop } from '../../runtime/frame-loop.ts';
import { withAutosave } from '../../runtime/autosave.ts';
import { bindPrimaryDrag } from '../../runtime/pointer.ts';
import { createDragHint, dragHintCycleLength } from '../../runtime/drag-hint.ts';
import { createChoiceMarkers } from './choice-markers.ts';
import { choosingBike, createBikeHintClock, advanceBikeHint } from './domain/choice-hint.ts';
import { createAudio } from '../../runtime/audio.ts';
import { createPolice, chooseRound, stages, crewStatus, inspectionKind, inspectionCheckVisible, CHECKPOINT, direction, available, grab, drive, release, advance, progress } from './domain/police.ts';
import type { Stage, Vehicle, PoliceState, Bike } from './domain/police.ts';
import type { PoliceScene } from './scene.ts';
import { mountPoliceUI, names, instruction, doorIcon, towIcon, inspectionIcons } from './ui.ts';
import { patrolIcon, bikeIcon, vanIcon } from '../../app/police-art.ts';
export const createPoliceAudio = () => createAudio({ arrival: [440, 554, 440], parked: [440, 660], depart: [392, 523], complete: [523, 659, 784, 1047] });
export function createPoliceSession(app: HTMLDivElement, dev: boolean, onHome: () => void, fresh = false, persistence = policePersistence) {
  const params = new URLSearchParams(location.search), query = params.get('stage'), phase: Stage = dev && !fresh && stages.includes(query as Stage) ? query as Stage : 'intro';
  const devKey = `town-crew:police:dev:v1:${location.search}`;
  const restored = fresh ? undefined : persistence.load(dev, devKey);
  const configured = Number(params.get('layout') ?? 0);
  let state = restored ?? createPolice(phase, dev ? { layout: Number.isInteger(configured) && configured >= 0 && configured < 2 ? configured : 0, color: 0, traffic: params.get('traffic') === 'freight-first' ? 'freight-first' : 'taxi-first' } : persistence.newRound(), params.get('bike') === 'bike1' ? 'bike1' : 'bike0', Math.max(0, Math.min(2, Number(params.get('inspection')) || 0)));
  if (!dev && restored) persistence.rememberRound(state.round);
  function save() { persistence.save(dev, devKey, state); }
  mountPoliceUI(app, dev);
  const connect = (scene: PoliceScene, audio: ReturnType<typeof createPoliceAudio>) => Effect.gen(function* () {
    const events = yield* Effect.acquireRelease(Effect.sync(() => new AbortController()), value => Effect.sync(() => value.abort()));
    const options = { signal: events.signal };
    const hint = yield* Effect.acquireRelease(Effect.sync(() => createDragHint(app.querySelector<HTMLElement>('.world')!)), value => Effect.sync(() => value.dispose()));
    const choices = yield* Effect.acquireRelease(Effect.sync(() => createChoiceMarkers(app.querySelector<HTMLElement>('.world')!)), value => Effect.sync(() => value.dispose()));
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let previous = performance.now(), time = 0, muted = persistence.isMuted(), preferred: Vehicle = 'bike0';
    let bikeHint = createBikeHintClock(state.round.layout), choiceSize = '';
    yield* Effect.addFinalizer(() => Effect.sync(save));
    audio.setMuted(muted);
    const unlock = createAudioUnlocker('police-patrol', audio, events.signal, dev);
    function update(next: PoliceState) {
      if (next === state) return;
      if (next.phase !== state.phase) audio.play(next.phase === 'complete' ? 'complete' : next.phase === 'transport' ? 'depart' : 'parked');
      if (next.phase === 'complete' && state.phase !== 'complete' && !dev) persistence.markCompleted();
      state = next;
    }
    const pointer = bindPrimaryDrag<{ phase: Stage; vehicle: Vehicle; value: number; origin: { x: number; y: number }; offset: { x: number; y: number } }>(scene.canvas, {
      start(event) {
        unlock(); const vehicle = scene.hit(event.clientX, event.clientY, state); if (!vehicle) return;
        const { from, value } = scene.task(state, vehicle), r = scene.canvas.getBoundingClientRect();
        update(grab(state, vehicle)); preferred = vehicle;
        // Even a tap that starts and ends between frames must restart a full demonstration.
        hint.update(undefined, time);
        if (vehicle === 'bike0' || vehicle === 'bike1') bikeHint = createBikeHintClock(state.round.layout, vehicle);
        return { phase: state.phase, vehicle, value, origin: { x: event.clientX, y: event.clientY }, offset: { x: r.x + from.x - event.clientX, y: r.y + from.y - event.clientY } };
      },
      move(event, held) {
        if (state.phase !== held.phase || state.active !== held.vehicle || state.action !== 'dragging') return;
        // A paused vehicle may be less than 10 px from its destination; let its last short stroke finish.
        if (held.value === 0 && Math.hypot(event.clientX - held.origin.x, event.clientY - held.origin.y) < 10) return;
        update(drive(state, scene.target(state, held.vehicle, { x: event.clientX + held.offset.x, y: event.clientY + held.offset.y }, held.value)));
      },
      end(held, cancelled) { if (state.phase === held.phase && state.active === held.vehicle) update(release(state, cancelled)); save(); },
    }, events.signal);
    yield* Effect.addFinalizer(() => Effect.sync(pointer.cancel));
    const restart = () => { unlock(); pointer.cancel(); state = createPolice('intro', dev ? chooseRound(state.round) : persistence.newRound(state.round)); preferred = 'bike0'; bikeHint = createBikeHintClock(state.round.layout); save(); };
    app.querySelectorAll('.restart, .finish-restart').forEach(b => b.addEventListener('click', restart, options));
    app.querySelectorAll('.home, .finish-home').forEach(b => b.addEventListener('click', () => { pointer.cancel(); save(); onHome(); }, options));
    const sound = app.querySelector<HTMLButtonElement>('.sound')!;
    function syncSound() { sound.textContent = muted ? '♩' : '♪'; sound.setAttribute('aria-pressed', String(muted)); sound.setAttribute('aria-label', muted ? '開啟音效' : '關閉音效'); }
    syncSound(); sound.addEventListener('click', () => { unlock(); muted = !muted; persistence.setMuted(muted); audio.setMuted(muted); syncSound(); }, options);
    const select = app.querySelector<HTMLSelectElement>('#stage'), layout = app.querySelector<HTMLSelectElement>('#layout'), bike = app.querySelector<HTMLSelectElement>('#lead-bike'), traffic = app.querySelector<HTMLSelectElement>('#traffic'), inspection = app.querySelector<HTMLSelectElement>('#inspection');
    const reset = () => { pointer.cancel(); state = createPolice(select!.value as Stage, { ...state.round, layout: Number(layout!.value), traffic: traffic!.value as PoliceState['round']['traffic'] }, bike!.value as Bike, Number(inspection!.value)); bikeHint = createBikeHintClock(state.round.layout); save(); };
    select?.addEventListener('change', reset, options); layout?.addEventListener('change', reset, options); bike?.addEventListener('change', reset, options); traffic?.addEventListener('change', reset, options); inspection?.addEventListener('change', reset, options); app.querySelector('.reset-stage')?.addEventListener('click', reset, options);
    document.addEventListener('visibilitychange', () => { previous = performance.now(); if (document.hidden) save(); }, options); window.addEventListener('pagehide', save, options);
    app.querySelector('.loading')!.remove();
    const targetHost = app.querySelector<HTMLElement>('.police-targets')!;
    let targetKey = '', displayed: Stage | undefined;
    const label = (selector: string, text: string) => { const node = app.querySelector(selector)!; if (node.textContent !== text) node.textContent = text; };
    function animate(now: number) {
      const dt = document.hidden ? 0 : Math.min((now - previous) / 1000, 0.1); previous = now; time += dt; update(advance(state, dt));
      const held = pointer.context(); if (held && (held.phase !== state.phase || state.action !== 'dragging' || held.vehicle !== state.active)) pointer.cancel();
      const choosing = choosingBike(state), reduced = reducedMotion.matches;
      const size = `${scene.canvas.clientWidth}x${scene.canvas.clientHeight}`;
      if (size !== choiceSize) { bikeHint = createBikeHintClock(state.round.layout, bikeHint.bike); choiceSize = size; }
      const cycles = choosing ? { bike0: dragHintCycleLength(scene.hint(state, 'bike0')!), bike1: dragHintCycleLength(scene.hint(state, 'bike1')!) } : { bike0: 0, bike1: 0 };
      bikeHint = advanceBikeHint(bikeHint, state, dt, cycles, reduced);
      const suggested = choosing ? bikeHint.bike : preferred;
      scene.render(state, time, suggested, !(choosing && reduced));
      hint.update(choosing && reduced ? undefined : scene.hint(state, suggested), time);
      const marked = state.phase === 'guard' ? state.selected ? [state.selected] : choosing ? ['bike0', 'bike1'] as const : [] : [];
      choices.update(marked.map(id => scene.choiceMarker(state, id)), choosing && reduced);
      const eligible = available(state), chosen = state.active ?? (eligible.includes(suggested) ? suggested : eligible[0]);
      app.dataset.hintVehicle = choosing && reduced ? '' : chosen ?? '';
      const infos = (chosen ? [chosen] : []).map(v => scene.task(state, v));
      const key = infos.map(t => t.key === 'guard' ? 'guard' : `${t.vehicle}:${t.key}`).join(',');
      if (key !== targetKey) { targetHost.innerHTML = infos.map(t => `<div class="fire-target police-target" role="img" aria-label="目的地：${t.key === 'guard' ? '出口警戒位' : t.key === 'door' ? '打開側門' : t.vehicle === 'van' ? '偵防車' : t.vehicle === 'police' ? '警車' : '平板拖吊車'}" data-goal="${t.key === 'guard' ? 'guard' : t.vehicle}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" pathLength="1"/></svg><span>${t.key === 'guard' ? '出口警戒位' : t.key === 'door' ? '拉開' : t.key === 'escort' ? '出發' : '停這裡'}</span></div>`).join(''); targetKey = key; }
      for (const info of infos) {
        const node = targetHost.firstElementChild as HTMLElement; node.style.left = `${info.to.x}px`; node.style.top = `${info.to.y}px`; node.dataset.ready = String(info.value === 1);
        node.querySelector('circle')!.style.strokeDashoffset = String(1 - Math.min(1, state.elapsed / 0.4));
      }
      app.dataset.phase = state.phase; app.dataset.action = state.action; app.dataset.layout = String(state.round.layout); app.dataset.traffic = state.round.traffic; app.dataset.checked = String(state.checked); app.dataset.inspection = inspectionKind(state); app.dataset.color = String(state.round.color); app.dataset.selected = state.selected ?? ''; app.dataset.work = JSON.stringify(state.work); app.dataset.active = state.active ?? '';
      const value = progress(state); app.querySelector<HTMLElement>('.progress span')!.style.transform = `scaleX(${value})`; app.querySelector('.progress')!.setAttribute('aria-valuenow', String(Math.round(value * 100)));
      label('.house-instruction', instruction(state)); label('.house-detail', state.phase === 'guard' ? '另一台重機會留守入口' : state.phase === 'inspect' ? `臨檢車輛 · ${state.checked + 1} / 3` : '');
      const check = app.querySelector<HTMLElement>('.police-check')!;
      const wanted = state.checked === 2;
      check.hidden = !inspectionCheckVisible(state);
      if (!check.hidden) {
        const p = scene.screen({ x: direction(state.round) * CHECKPOINT.x, z: CHECKPOINT.z }, 3.4), caption = app.querySelector<HTMLElement>('.house-caption')!;
        check.querySelector<HTMLElement>('.check-portraits')!.hidden = !wanted; check.querySelector<HTMLElement>('.check-clearance')!.hidden = wanted;
        if (!wanted) {
          const kind = inspectionKind(state) as keyof typeof inspectionIcons, vehicle = check.querySelector<HTMLElement>('.check-vehicle')!;
          if (vehicle.dataset.kind !== kind) { vehicle.innerHTML = inspectionIcons[kind]; vehicle.dataset.kind = kind; }
          label('.clearance-symbol', state.elapsed >= 2.1 ? '✓' : '⋯');
        }
        const belowCaption = caption.getBoundingClientRect().bottom - scene.canvas.getBoundingClientRect().top + check.offsetHeight + 12;
        check.style.left = `${p.x}px`; check.style.top = `${Math.max(p.y, belowCaption)}px`;
        check.dataset.matched = String(wanted && state.elapsed >= 3.5); label('.check-symbol', state.elapsed >= 3.5 ? '✓' : '⋯');
        label('.check-label', wanted ? state.elapsed >= 3.5 ? '資料相符 · 通緝身分' : '查驗身分' : state.elapsed >= 2.1 ? '查驗完成 · 請通行' : '車輛查驗中');
      }
      app.querySelector<HTMLElement>('.finish-actions')!.hidden = state.phase !== 'complete'; app.querySelector<HTMLElement>('.police-arrival')!.hidden = state.phase !== 'complete';
      scene.canvas.style.cursor = state.action === 'dragging' ? 'grabbing' : eligible.length ? 'grab' : 'default';
      const status = crewStatus(state);
      app.querySelectorAll<HTMLElement>('[data-crew]').forEach((node, n) => { node.dataset.state = status[n]; });
      const vanCard = app.querySelector<HTMLElement>('[data-crew="van"]')!, open = ['door', 'boarding'].includes(state.phase);
      if (vanCard.dataset.open !== String(open)) { vanCard.innerHTML = open ? doorIcon : vanIcon; vanCard.dataset.open = String(open); }
      if (displayed !== state.phase) {
        label('#vehicle-name', names[state.phase]); app.querySelector('.badge-icon')!.innerHTML = ['tow-arrival', 'tow', 'tow-load', 'depart'].includes(state.phase) ? towIcon : ['bikes-arrival', 'guard', 'lead'].includes(state.phase) ? bikeIcon : state.phase === 'door' ? doorIcon : ['van-arrival', 'van', 'door', 'boarding', 'transport'].includes(state.phase) ? vanIcon : patrolIcon;
        if (select) select.value = state.phase; displayed = state.phase;
      }
      if (dev) { label('#phase', names[state.phase]); label('#action', state.action); layout!.value = String(state.round.layout); traffic!.value = state.round.traffic; inspection!.value = String(state.checked); if (state.selected) bike!.value = state.selected; }
    }
    return withAutosave('police-patrol', runFrameLoop('police-patrol', animate), save, 700);
  });
  return { connect, save };
}
