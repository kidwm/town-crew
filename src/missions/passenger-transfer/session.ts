import { Effect } from 'effect';
import { transferPersistence } from './services.ts';
import { createAudioUnlocker } from '../../runtime/audio-unlock.ts';
import { runFrameLoop } from '../../runtime/frame-loop.ts';
import { withAutosave } from '../../runtime/autosave.ts';
import { bindPrimaryDrag } from '../../runtime/pointer.ts';
import { createDragHint } from '../../runtime/drag-hint.ts';
import { createAudio } from '../../runtime/audio.ts';
import { createTransit, chooseRound, validRound, stages, available, currentVehicle, isDoor, isDriving, grab, drive, moveLuggage, release, advance, progress } from './domain/transit.ts';
import type { Stage, TransitState, Vehicle } from './domain/transit.ts';
import { companion, finalVehicle } from './domain/terminal.ts';
import type { TransferScene } from './scene.ts';
import { mountTransferUI, stageName, instruction, vehicleNames } from './ui.ts';
import { transferIcons } from '../../app/transfer-art.ts';
export const createTransferAudio = () => createAudio({ parked: [440, 660], door: [523, 659], luggage: [392, 523, 659], depart: [392, 523], complete: [523, 659, 784, 1047] });
export function createTransferSession(app: HTMLDivElement, dev: boolean, onHome: () => void, fresh = false, persistence = transferPersistence) {
  const params = new URLSearchParams(location.search), query = params.get('stage'), phase: Stage = dev && !fresh && stages.includes(query as Stage) ? query as Stage : 'intro';
  const devKey = `town-crew:transfer:dev:v1:${location.search}`;
  const restored = fresh ? undefined : persistence.load(dev, devKey);
  const configured = { layout: Number(params.get('layout') ?? 0), palette: Number(params.get('palette') ?? 0), cast: 0, companion: params.get('companion') ?? 'school' };
  let state = restored ?? createTransit(phase, dev ? validRound(configured) ? configured : { layout: 0, palette: 0, cast: 0 } : persistence.newRound());
  if (!dev && restored) persistence.rememberRound(state.round);
  function save() { persistence.save(dev, devKey, state); }
  mountTransferUI(app, dev);
  const connect = (scene: TransferScene, audio: ReturnType<typeof createTransferAudio>) => Effect.gen(function* () {
    const events = yield* Effect.acquireRelease(Effect.sync(() => new AbortController()), value => Effect.sync(() => value.abort()));
    const options = { signal: events.signal };
    const hint = yield* Effect.acquireRelease(Effect.sync(() => createDragHint(app.querySelector<HTMLElement>('.world')!)), value => Effect.sync(() => value.dispose()));
    let previous = performance.now(), time = 0, muted = persistence.isMuted(), preferred: Vehicle | undefined;
    yield* Effect.addFinalizer(() => Effect.sync(save));
    audio.setMuted(muted);
    const unlock = createAudioUnlocker('passenger-transfer', audio, events.signal, dev);
    function update(next: TransitState) {
      if (next === state) return;
      if (next.phase !== state.phase) {
        if (next.phase === 'choose') preferred = undefined;
        audio.play(next.phase === 'complete' ? 'complete' : next.phase === 'loading' ? 'luggage' : next.phase.endsWith('-exit') ? 'depart' : next.phase.endsWith('-door') ? 'parked' : 'door');
        if (next.phase === 'complete' && !dev) persistence.markCompleted();
        state = next; save();
      } else state = next;
    }
    interface Held { phase: Stage; vehicle: Vehicle; value: number; origin: { x: number; y: number }; offset: { x: number; y: number }; vector: { x: number; y: number }; bagOffset: { x: number; z: number } }
    const pointer = bindPrimaryDrag<Held>(scene.canvas, {
      start(event) {
        unlock(); const vehicle = scene.hit(event.clientX, event.clientY, state); if (!vehicle) return;
        const t = scene.task(state, vehicle), r = scene.canvas.getBoundingClientRect(), p = scene.world({ x: event.clientX, y: event.clientY });
        update(grab(state, vehicle)); preferred = vehicle;
        return { phase: state.phase, vehicle, value: t.value, origin: { x: event.clientX, y: event.clientY }, offset: { x: r.x + t.from.x - event.clientX, y: r.y + t.from.y - event.clientY }, vector: { x: (t.to.x - t.from.x) / Math.max(0.01, 1 - t.value), y: (t.to.y - t.from.y) / Math.max(0.01, 1 - t.value) }, bagOffset: { x: state.luggage.x - p.x, z: state.luggage.z - p.z } };
      },
      move(event, held) {
        if (state.phase !== held.phase || state.action !== 'dragging') return;
        const dx = event.clientX - held.origin.x, dy = event.clientY - held.origin.y;
        const unfinished = isDriving(state) ? state.travel > 0 : isDoor(state) ? state.doors[held.vehicle] > 0 : false;
        if (Math.hypot(dx, dy) < 10 && !unfinished) return;
        if (state.phase === 'luggage') {
          const p = scene.world({ x: event.clientX, y: event.clientY }); p.x += held.bagOffset.x; p.z += held.bagOffset.z;
          update(moveLuggage(state, p, scene.nearCargo(state, { x: event.clientX, y: event.clientY }, p)));
        } else if (isDoor(state)) {
          const v = held.vector, value = held.value + (dx * v.x + dy * v.y) / (v.x * v.x + v.y * v.y);
          update(drive(state, value));
        } else update(drive(state, scene.target(state, held.vehicle, { x: event.clientX + held.offset.x, y: event.clientY + held.offset.y })));
      },
      end(held, cancelled) { if (held.phase === state.phase) update(release(state, cancelled)); save(); },
    }, events.signal);
    yield* Effect.addFinalizer(() => Effect.sync(pointer.cancel));
    const restart = () => { unlock(); pointer.cancel(); state = createTransit('intro', dev ? chooseRound(state.round) : persistence.newRound(state.round)); preferred = undefined; save(); };
    app.querySelectorAll('.restart, .finish-restart').forEach(b => b.addEventListener('click', restart, options));
    app.querySelectorAll('.home, .finish-home').forEach(b => b.addEventListener('click', () => { pointer.cancel(); save(); onHome(); }, options));
    app.querySelectorAll<HTMLButtonElement>('[data-vehicle]').forEach(b => b.addEventListener('click', () => { preferred = b.dataset.vehicle as Vehicle; unlock(); }, options));
    const sound = app.querySelector<HTMLButtonElement>('.sound')!;
    function syncSound() { sound.textContent = muted ? '♩' : '♪'; sound.setAttribute('aria-pressed', String(muted)); sound.setAttribute('aria-label', muted ? '開啟音效' : '關閉音效'); }
    syncSound(); sound.addEventListener('click', () => { unlock(); muted = !muted; persistence.setMuted(muted); audio.setMuted(muted); syncSound(); }, options);
    const select = app.querySelector<HTMLSelectElement>('#stage'), layout = app.querySelector<HTMLSelectElement>('#layout'), palette = app.querySelector<HTMLSelectElement>('#palette'), paired = app.querySelector<HTMLSelectElement>('#companion');
    if (paired) paired.value = companion(state.round);
    const reset = () => { pointer.cancel(); state = createTransit(select!.value as Stage, { ...state.round, layout: Number(layout!.value) as 0 | 1, palette: Number(palette!.value), companion: paired!.value as 'school' | 'coach' }); preferred = undefined; save(); };
    select?.addEventListener('change', reset, options); layout?.addEventListener('change', reset, options); palette?.addEventListener('change', reset, options); paired?.addEventListener('change', reset, options); app.querySelector('.reset-stage')?.addEventListener('click', reset, options);
    document.addEventListener('visibilitychange', () => { previous = performance.now(); if (document.hidden) save(); }, options); window.addEventListener('pagehide', save, options);
    app.querySelector('.loading')!.remove();
    const goal = app.querySelector<HTMLElement>('.transfer-goal')!, grip = app.querySelector<HTMLElement>('.transfer-grip')!;
    const label = (selector: string, text: string) => { const node = app.querySelector(selector)!; if (node.textContent !== text) node.textContent = text; };
    let displayed = '';
    function animate(now: number) {
      const dt = document.hidden ? 0 : Math.min((now - previous) / 1000, 0.1); previous = now; time += dt; update(advance(state, dt));
      const held = pointer.context(); if (held && (held.phase !== state.phase || state.action !== 'dragging')) pointer.cancel();
      scene.render(state, time, preferred); hint.update(scene.hint(state, preferred), time);
      const eligible = available(state), choosing = state.phase === 'choose' && eligible.length === 2, vehicle = preferred && eligible.includes(preferred) ? preferred : choosing ? undefined : eligible[0];
      const t = vehicle ? scene.task(state, vehicle) : undefined;
      goal.hidden = !t; grip.hidden = !t || t.kind === 'drive';
      if (t) {
        goal.style.left = `${t.to.x}px`; goal.style.top = `${t.to.y}px`; goal.dataset.kind = t.kind; goal.dataset.ready = String(state.phase === 'luggage' && state.aim === 1);
        goal.querySelector('span')!.textContent = t.kind === 'door' ? '拉開' : t.kind === 'luggage' ? '行李艙' : state.phase.endsWith('-exit') ? '出發' : t.vehicle === 'taxi' ? '計程車載客區' : '大型車停靠區';
        goal.setAttribute('aria-label', t.kind === 'luggage' ? '目的地：遊覽車行李艙' : t.kind === 'door' ? '目的地：拉開車門' : state.phase.endsWith('-exit') ? '目的地：出發' : t.vehicle === 'taxi' ? '目的地：計程車專屬載客區' : '目的地：大型車停靠區');
        grip.style.left = `${t.from.x}px`; grip.style.top = `${t.from.y}px`;
      }
      app.dataset.phase = state.phase; app.dataset.action = state.action; app.dataset.layout = String(state.round.layout); app.dataset.palette = String(state.round.palette); app.dataset.companion = companion(state.round); app.dataset.order = state.order.join(','); app.dataset.vehicle = currentVehicle(state); app.dataset.travel = String(state.travel); app.dataset.doors = JSON.stringify(state.doors); app.dataset.luggage = JSON.stringify(state.luggage); app.dataset.elapsed = String(state.elapsed);
      const value = progress(state); app.querySelector<HTMLElement>('.progress span')!.style.transform = `scaleX(${value})`; app.querySelector('.progress')!.setAttribute('aria-valuenow', String(Math.round(value * 100)));
      label('.house-instruction', instruction(state)); label('.house-detail', choosing ? `計程車到專屬載客區・${vehicleNames[companion(state.round)]}到大型車月台` : state.phase === 'luggage' ? '對準敞開的行李艙，就會自動放好' : '');
      const picker = app.querySelector<HTMLElement>('.transfer-picker')!; picker.hidden = state.phase !== 'choose' || state.action !== 'ready' || eligible.length < 2;
      picker.querySelectorAll<HTMLButtonElement>('button').forEach(b => {
        const v = b.dataset.vehicle as 'taxi' | 'school' | 'coach', p = scene.choice(state, v), ring = app.querySelector<HTMLElement>(`[data-choice="${v}"]`)!;
        b.hidden = !eligible.includes(v); ring.hidden = !choosing || !eligible.includes(v); ring.style.left = `${p.from.x}px`; ring.style.top = `${p.from.y}px`; ring.style.width = `${p.width}px`; ring.style.height = `${p.height}px`;
        b.style.left = `${Math.max(64, Math.min(scene.canvas.clientWidth - 64, p.from.x + (v === 'taxi' ? p.width / 2 + 64 : 0)))}px`;
        b.style.top = `${v !== 'taxi' ? p.from.y - p.height / 2 - 32 : p.from.y + 10}px`;
        b.disabled = !eligible.includes(v); b.setAttribute('aria-pressed', String(preferred === v));
      });
      app.querySelector<HTMLElement>('.finish-actions')!.hidden = state.phase !== 'complete'; app.querySelector<HTMLElement>('.transfer-finish')!.hidden = state.phase !== 'complete';
      scene.canvas.style.cursor = state.action === 'dragging' ? 'grabbing' : eligible.length ? 'grab' : 'default';
      app.querySelectorAll<HTMLElement>('[data-step]').forEach(node => { const v = node.dataset.step as Vehicle, done = v === 'bus' ? stages.indexOf(state.phase) >= stages.indexOf('transfer-entrance') : state.order.includes(v) || v === finalVehicle(state.round) && ['celebrate', 'complete'].includes(state.phase); node.dataset.state = done ? 'done' : choosing && eligible.includes(v) || currentVehicle(state) === v ? 'active' : 'upcoming'; });
      const shown = state.phase === 'choose' ? vehicle ?? currentVehicle(state) : currentVehicle(state), key = `${state.phase}:${shown}:${companion(state.round)}`;
      if (displayed !== key) { label('#vehicle-name', state.phase.startsWith('transfer-') && state.phase !== 'transfer-entrance' ? `${vehicleNames[shown]} · ${state.phase.endsWith('-door') ? '打開車門' : state.phase.endsWith('-exit') ? '出發' : state.phase.endsWith('-departure') ? '離站中' : '接送乘客'}` : stageName(state.phase, state.round)); const badge = app.querySelector<HTMLElement>('.badge-icon')!; badge.innerHTML = choosing ? transferIcons.taxi + transferIcons[companion(state.round)] : transferIcons[shown]; badge.dataset.choice = String(choosing); if (select) { select.value = state.phase; for (const option of select.options) option.textContent = stageName(option.value as Stage, state.round); } displayed = key; }
      if (dev) { label('#phase', stageName(state.phase, state.round)); label('#action', state.action); layout!.value = String(state.round.layout); palette!.value = String(state.round.palette); paired!.value = companion(state.round); }
    }
    return withAutosave('passenger-transfer', runFrameLoop('passenger-transfer', animate), save, 700);
  });
  return { connect, save };
}
