import { Effect } from 'effect';
import { mountainPersistence } from './services.ts';
import { createAudioUnlocker } from '../../runtime/audio-unlock.ts';
import { runFrameLoop } from '../../runtime/frame-loop.ts';
import { withAutosave } from '../../runtime/autosave.ts';
import { bindPrimaryDrag } from '../../runtime/pointer.ts';
import { createDragHint } from '../../runtime/drag-hint.ts';
import { createAudio } from '../../runtime/audio.ts';
import { createMountain, chooseRound, stages, grab, drive, moveLoader, moveBucket, release, advance, progress, canGrab } from './domain/mountain.ts';
import type { Stage, Pattern, MountainState } from './domain/mountain.ts';
import type { MountainScene } from './scene.ts';
import { mountMountainUI, names, instruction, step, vehicleSteps } from './ui.ts';
import { mountainIcons } from '../../app/mountain-art.ts';
export const createMountainAudio = () => createAudio({ work: [294, 392], depart: [392, 523], horn: [392, 494], complete: [523, 659, 784, 1047] });
export function createMountainSession(app: HTMLDivElement, dev: boolean, onHome: () => void, fresh = false, persistence = mountainPersistence) {
  const params = new URLSearchParams(location.search), query = params.get('stage');
  const phase: Stage = dev && !fresh && stages.includes(query as Stage) ? query as Stage : 'intro';
  const devKey = `town-crew:mountain:dev:v1:${location.search}`;
  const restored = fresh ? undefined : persistence.load(dev, devKey);
  let state = restored ?? createMountain(phase, dev ? { pattern: params.get('pattern') === 'cluster' ? 'cluster' : 'spread', layout: params.get('layout') === '1' ? 1 : 0 } : persistence.newRound());
  if (!dev && restored) persistence.rememberRound(state.round);
  function save() { persistence.save(dev, devKey, state); }
  mountMountainUI(app, dev);
  const connect = (scene: MountainScene, audio: ReturnType<typeof createMountainAudio>) => Effect.gen(function* () {
    const events = yield* Effect.acquireRelease(Effect.sync(() => new AbortController()), value => Effect.sync(() => value.abort()));
    const options = { signal: events.signal };
    const hint = yield* Effect.acquireRelease(Effect.sync(() => createDragHint(app.querySelector<HTMLElement>('.world')!)), value => Effect.sync(() => value.dispose()));
    let previous = performance.now(), time = 0, muted = persistence.isMuted();
    yield* Effect.addFinalizer(() => Effect.sync(save));
    audio.setMuted(muted);
    const unlock = createAudioUnlocker('mountain-clearance', audio, events.signal, dev);
    function update(next: MountainState) {
      if (next === state) return;
      const checkpoint = next.phase !== state.phase || next.motion !== state.motion || next.delivered.length !== state.delivered.length || next.carried !== state.carried || next.loaderCarrying !== state.loaderCarrying || next.soilLoaded.length !== state.soilLoaded.length;
      if (checkpoint) audio.play(next.phase === 'complete' ? 'complete' : next.phase === 'reopen' ? 'horn' : next.phase.endsWith('exit') ? 'depart' : 'work');
      if (next.phase === 'complete' && state.phase !== 'complete' && !dev) persistence.markCompleted();
      state = next; if (checkpoint) save();
    }
    const pointer = bindPrimaryDrag<{ phase: Stage; origin: { x: number; y: number }; offset: { x: number; y: number } }>(scene.canvas, {
      start(event) {
        unlock(); if (!scene.hit(event.clientX, event.clientY, state)) return;
        const r = scene.canvas.getBoundingClientRect(), from = scene.task(state).from; update(grab(state));
        return { phase: state.phase, origin: { x: event.clientX, y: event.clientY }, offset: { x: r.x + from.x - event.clientX, y: r.y + from.y - event.clientY } };
      },
      move(event, held) {
        if (state.phase !== held.phase || state.action !== 'dragging' || Math.hypot(event.clientX - held.origin.x, event.clientY - held.origin.y) < 10) return;
        const p = { x: event.clientX + held.offset.x, y: event.clientY + held.offset.y };
        if (state.phase === 'load-soil') { const target = scene.loaderTarget(state, p, { x: event.clientX, y: event.clientY }); update(moveLoader(state, target.id, target.desired)); return; }
        update(state.phase === 'excavate' ? moveBucket(state, scene.bucketTarget(state, p)) : drive(state, scene.driveTarget(state, p)));
      },
      end(held, cancelled) { if (state.phase === held.phase) update(release(state, cancelled)); save(); },
    }, events.signal);
    yield* Effect.addFinalizer(() => Effect.sync(pointer.cancel));
    const restart = () => { unlock(); pointer.cancel(); state = createMountain('intro', dev ? chooseRound(state.round) : persistence.newRound(state.round)); save(); };
    app.querySelectorAll('.restart, .finish-restart').forEach(b => b.addEventListener('click', restart, options));
    app.querySelectorAll('.home, .finish-home').forEach(b => b.addEventListener('click', () => { pointer.cancel(); save(); onHome(); }, options));
    const sound = app.querySelector<HTMLButtonElement>('.sound')!;
    function syncSound() { sound.textContent = muted ? '♩' : '♪'; sound.setAttribute('aria-pressed', String(muted)); sound.setAttribute('aria-label', muted ? '開啟音效' : '關閉音效'); }
    syncSound(); sound.addEventListener('click', () => { unlock(); muted = !muted; persistence.setMuted(muted); audio.setMuted(muted); syncSound(); }, options);
    const select = app.querySelector<HTMLSelectElement>('#stage'), layout = app.querySelector<HTMLSelectElement>('#layout'), pattern = app.querySelector<HTMLSelectElement>('#pattern');
    const reset = () => { pointer.cancel(); state = createMountain(select!.value as Stage, { layout: Number(layout!.value) as 0 | 1, pattern: pattern!.value as Pattern }); save(); };
    select?.addEventListener('change', reset, options); layout?.addEventListener('change', reset, options); pattern?.addEventListener('change', reset, options); app.querySelector('.reset-stage')?.addEventListener('click', reset, options);
    document.addEventListener('visibilitychange', () => { previous = performance.now(); if (document.hidden) save(); }, options); window.addEventListener('pagehide', save, options);
    app.querySelector('.loading')!.remove();
    const targets = app.querySelector<HTMLElement>('.mountain-targets')!, grip = app.querySelector<HTMLElement>('.mountain-grip')!;
    let targetKey = '', displayed: Stage | undefined, displayedOrder: MountainState['workOrder'] | undefined;
    const label = (selector: string, text: string) => { const n = app.querySelector(selector)!; if (n.textContent !== text) n.textContent = text; };
    function animate(now: number) {
      const dt = document.hidden ? 0 : Math.min((now - previous) / 1000, 0.1); previous = now; time += dt; update(advance(state, dt));
      const held = pointer.context(); if (held && (held.phase !== state.phase || state.action !== 'dragging')) pointer.cancel();
      scene.render(state, time); hint.update(scene.hint(state), time);
      const goals = scene.goals(state), key = goals.map(g => g.id).join(',');
      if (key !== targetKey) { targets.innerHTML = goals.map(g => `<div class="mountain-goal ${g.id === 'bed' ? 'mountain-bed' : g.id === 'dock' ? 'mountain-dock' : g.id === 'raise' ? 'mountain-raise' : ''}" role="img" aria-label="${g.id === 'bed' ? '砂石車車斗' : g.id === 'dock' ? '車斗後方停車位置' : g.id === 'raise' ? '向上抬升鏟斗' : g.id.startsWith('soil-') ? '待鏟土堆' : '大石頭'}" data-goal="${g.id}">${g.id === 'bed' ? '<span>↓</span>' : g.id === 'raise' ? '<span>↑</span>' : ''}</div>`).join(''); targetKey = key; }
      goals.forEach(g => { const node = targets.querySelector<HTMLElement>(`[data-goal="${g.id}"]`)!; node.style.left = `${g.point.x}px`; node.style.top = `${g.point.y}px`; node.dataset.ready = String(state.dwell > 0 && (g.id === 'bed' || g.id === 'dock' || g.id === 'raise' || String(state.aimed) === g.id || `soil-${state.loaderSelected}` === g.id)); });
      grip.hidden = state.phase !== 'excavate' || state.action === 'auto'; if (!grip.hidden) { const p = scene.task(state).from; grip.style.left = `${p.x}px`; grip.style.top = `${p.y}px`; }
      app.dataset.phase = state.phase; app.dataset.action = state.action; app.dataset.motion = state.motion; app.dataset.layout = String(state.round.layout); app.dataset.pattern = state.round.pattern; app.dataset.delivered = state.delivered.join(','); app.dataset.carried = state.carried === null ? '' : String(state.carried); app.dataset.work = JSON.stringify({ pushes: state.pushes, haul: state.haul, swept: state.swept });
      app.dataset.soilLoaded = state.soilLoaded.join(','); app.dataset.loaderCarrying = String(state.loaderCarrying); app.dataset.loaderSelected = state.loaderSelected === null ? '' : String(state.loaderSelected); app.dataset.loaderTravel = String(state.loaderTravel); app.dataset.loaderDocked = String(state.loaderDocked); app.dataset.workOrder = state.workOrder;
      const value = progress(state); app.querySelector<HTMLElement>('.progress span')!.style.transform = `scaleX(${value})`; app.querySelector('.progress')!.setAttribute('aria-valuenow', String(Math.round(value * 100)));
      label('.house-instruction', instruction(state)); label('.house-detail', state.phase === 'push' ? `集中土石 · ${state.pushIndex + 1} / 2` : state.phase === 'load-soil' ? `散土裝車 · ${state.soilLoaded.length} / 2` : state.phase === 'excavate' ? `大石頭裝車 · ${state.delivered.length} / 3` : '');
      app.querySelector<HTMLElement>('.finish-actions')!.hidden = state.phase !== 'complete'; app.querySelector<HTMLElement>('.success')!.hidden = state.phase !== 'complete';
      scene.canvas.style.cursor = state.action === 'dragging' ? 'grabbing' : canGrab(state) ? 'grab' : 'default';
      const vehicles = vehicleSteps(state.workOrder), active = vehicles.indexOf(step(state));
      if (displayedOrder !== state.workOrder) {
        const steps = app.querySelector<HTMLElement>('.mission-steps')!;
        vehicles.forEach(id => steps.append(app.querySelector(`[data-step="${id}"]`)!));
        steps.setAttribute('aria-label', vehicles.map(id => ['推土機', '鏟裝機', '挖土機', '砂石車', '清掃車'][id]).join('、'));
        displayedOrder = state.workOrder; displayed = undefined;
      }
      app.querySelectorAll<HTMLElement>('[data-step]').forEach(n => { const rank = vehicles.indexOf(Number(n.dataset.step)); n.dataset.state = state.phase === 'complete' || rank < active ? 'done' : rank === active ? 'active' : 'upcoming'; });
      if (displayed !== state.phase) { label('#vehicle-name', names[state.phase]); app.querySelector('.badge-icon')!.innerHTML = mountainIcons[step(state)]; if (select) select.value = state.phase; displayed = state.phase; }
      if (dev) { label('#phase', names[state.phase]); label('#action', `${state.action} · ${state.motion}`); layout!.value = String(state.round.layout); pattern!.value = state.round.pattern; }
    }
    return withAutosave('mountain-clearance', runFrameLoop('mountain-clearance', animate), save, 700);
  });
  return { connect, save };
}
