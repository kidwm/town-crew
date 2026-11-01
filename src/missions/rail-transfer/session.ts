import { Effect } from 'effect';
import { railPersistence } from './services.ts';
import { createAudioUnlocker } from '../../runtime/audio-unlock.ts';
import { runFrameLoop } from '../../runtime/frame-loop.ts';
import { withAutosave } from '../../runtime/autosave.ts';
import { bindPrimaryDrag } from '../../runtime/pointer.ts';
import { createDragHint, dragHintCycleLength } from '../../runtime/drag-hint.ts';
import { createAudio } from '../../runtime/audio.ts';
import { available, advance, chooseRound, createRail, drive, grab, progress, release, stages, validRound, origins, destinations, type Direction, type Stage, type Train } from './domain/rail.ts';
import { createGesture, gestureValue, type RailGesture } from './domain/gesture.ts';
import type { RailScene } from './scene.ts';
import { mountRailUI, instruction, names } from './ui.ts';
import { railIcons, railNames } from '../../app/rail-art.ts';
export const createRailAudio = () => createAudio({ parked: [440, 660], door: [523, 659], depart: [392, 523], complete: [523, 659, 784, 1047] });
export function createRailSession(app: HTMLDivElement, dev: boolean, onHome: () => void, fresh = false, persistence = railPersistence) {
  const params = new URLSearchParams(location.search), query = params.get('stage'), phase: Stage = dev && !fresh && stages.includes(query as Stage) ? query as Stage : 'intro';
  const devKey = `town-crew:rail:dev:v1:${location.search}`, restored = fresh ? undefined : persistence.load(dev, devKey);
  const configured = { direction: params.get('direction') ?? 'city', layout: Number(params.get('layout') ?? 0), palette: Number(params.get('palette') ?? 0), cast: 0 };
  let state = restored ?? createRail(phase, dev && validRound(configured) ? configured : dev ? undefined : persistence.newRound(), dev ? Number(params.get('visit') ?? 0) : 0);
  if (!dev && restored) persistence.rememberRound(state.round);
  function save() { persistence.save(dev, devKey, state); }
  mountRailUI(app, dev);
  const connect = (scene: RailScene, audio: ReturnType<typeof createRailAudio>) => Effect.gen(function* () {
    const events = yield* Effect.acquireRelease(Effect.sync(() => new AbortController()), value => Effect.sync(() => value.abort())), options = { signal: events.signal };
    const hint = yield* Effect.acquireRelease(Effect.sync(() => createDragHint(app.querySelector<HTMLElement>('.world')!)), value => Effect.sync(() => value.dispose()));
    let previous = performance.now(), time = 0, choiceTime = 0, muted = persistence.isMuted();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)'); let wasReduced = reduced.matches;
    yield* Effect.addFinalizer(() => Effect.sync(save)); audio.setMuted(muted);
    const unlock = createAudioUnlocker('rail-transfer', audio, events.signal, dev);
    function update(next: typeof state) {
      if (next === state) return;
      if (next.phase !== state.phase) {
        audio.play(next.phase === 'complete' ? 'complete' : next.phase === 'exit' ? 'depart' : next.phase === 'door' ? 'parked' : 'door');
        if (next.phase === 'complete' && !dev) persistence.markCompleted();
        state = next; choiceTime = 0; save();
      } else state = next;
    }
    interface Held extends RailGesture { phase: Stage }
    const pointer = bindPrimaryDrag<Held>(scene.canvas, {
      start(event) {
        unlock(); const train = scene.hit(event.clientX, event.clientY, state); if (!train) return;
        const task = scene.task(state, train); update(grab(state, train)); choiceTime = 0;
        return { phase: state.phase, ...createGesture(task, { x: event.clientX, y: event.clientY }) };
      },
      move(event, held) {
        if (state.phase !== held.phase || state.action !== 'dragging') return;
        const value = gestureValue(held, { x: event.clientX, y: event.clientY }, state.moved);
        if (value !== undefined) update(drive(state, value));
      },
      end(held, cancelled) { if (held.phase === state.phase) update(release(state, cancelled)); save(); },
    }, events.signal);
    yield* Effect.addFinalizer(() => Effect.sync(pointer.cancel));
    const restart = () => { unlock(); pointer.cancel(); state = createRail('intro', dev ? chooseRound(state.round) : persistence.newRound(state.round)); choiceTime = 0; save(); };
    app.querySelectorAll('.restart, .finish-restart').forEach(b => b.addEventListener('click', restart, options));
    app.querySelectorAll('.home, .finish-home').forEach(b => b.addEventListener('click', () => { pointer.cancel(); save(); onHome(); }, options));
    const sound = app.querySelector<HTMLButtonElement>('.sound')!;
    function syncSound() { sound.textContent = muted ? '♩' : '♪'; sound.setAttribute('aria-pressed', String(muted)); sound.setAttribute('aria-label', muted ? '開啟音效' : '關閉音效'); }
    syncSound(); sound.addEventListener('click', () => { unlock(); muted = !muted; persistence.setMuted(muted); audio.setMuted(muted); syncSound(); }, options);
    const select = app.querySelector<HTMLSelectElement>('#stage'), layout = app.querySelector<HTMLSelectElement>('#layout'), palette = app.querySelector<HTMLSelectElement>('#palette'), direction = app.querySelector<HTMLSelectElement>('#direction'), visit = app.querySelector<HTMLSelectElement>('#visit');
    const reset = () => {
      pointer.cancel(); state = createRail(select!.value as Stage, { ...state.round, layout: Number(layout?.value ?? state.round.layout) as 0 | 1, palette: Number(palette?.value ?? state.round.palette), direction: (direction?.value ?? state.round.direction) as Direction }, Number(visit?.value ?? state.order.length)); choiceTime = 0; save();
    };
    [select, layout, palette, direction, visit].forEach(control => control?.addEventListener('change', reset, options)); app.querySelector('.reset-stage')?.addEventListener('click', reset, options);
    document.addEventListener('visibilitychange', () => { previous = performance.now(); if (document.hidden) save(); }, options); window.addEventListener('pagehide', save, options);
    app.querySelector('.loading')!.remove();
    const goal = app.querySelector<HTMLElement>('.rail-goal')!, source = app.querySelector<HTMLElement>('.rail-source')!;
    const label = (selector: string, text: string) => { const node = app.querySelector(selector); if (node && node.textContent !== text) node.textContent = text; };
    let displayed = '';
    function animate(now: number) {
      const dt = document.hidden ? 0 : Math.min((now - previous) / 1000, 0.1); previous = now; time += dt; update(advance(state, dt));
      const held = pointer.context(); if (held && (held.phase !== state.phase || state.action !== 'dragging')) pointer.cancel();
      scene.render(state, time);
      const eligible = available(state);
      if (wasReduced !== reduced.matches) { choiceTime = 0; wasReduced = reduced.matches; }
      choiceTime += state.phase === 'choose' && !reduced.matches ? dt : 0;
      const train = state.selected ?? eligible[reduced.matches ? 0 : Math.floor(choiceTime / dragHintCycleLength({})) % Math.max(1, eligible.length)];
      const task = train && eligible.includes(train) ? scene.task(state, train) : undefined;
      goal.hidden = !task; source.hidden = !task || state.phase === 'choose';
      if (task) {
        goal.style.left = `${task.to.x}px`; goal.style.top = `${task.to.y}px`; goal.dataset.kind = task.kind;
        goal.querySelector('span')!.textContent = task.kind === 'door' ? '拉開' : state.phase === 'exit' ? '出發' : '靠站';
        goal.setAttribute('aria-label', task.kind === 'door' ? '目的地：拉開列車車門' : state.phase === 'exit' ? '目的地：列車出發' : '目的地：列車停靠位');
        source.style.left = `${task.from.x}px`; source.style.top = `${task.from.y}px`; source.dataset.train = task.train;
      }
      hint.update(task && state.action !== 'dragging' ? { from: task.from, to: task.to, direction: task.to.x >= task.from.x ? 'right' : 'left', label: task.kind === 'door' ? '沿箭頭拉開列車車門' : `拖${railNames[task.train]}${state.phase === 'exit' ? '出發' : '靠站'}` } : undefined, time);
      app.querySelectorAll<HTMLElement>('[data-choice]').forEach(node => {
        const t = node.dataset.choice as Train, b = scene.bounds(state, t); node.hidden = state.phase !== 'choose' || !eligible.includes(t);
        node.style.left = `${b.centre.x}px`; node.style.top = `${b.centre.y - b.height * 0.35}px`; node.style.width = `${b.width}px`; node.style.height = `${b.height}px`;
        // Expose the real, visible body centre to CI without adding a second input surface.
        const target = scene.task(state, t).from; node.dataset.x = String(target.x); node.dataset.y = String(target.y);
      });
      app.dataset.phase = state.phase; app.dataset.action = state.action; app.dataset.direction = state.round.direction; app.dataset.layout = String(state.round.layout); app.dataset.palette = String(state.round.palette); app.dataset.vehicle = state.selected ?? ''; app.dataset.order = state.order.join(','); app.dataset.travel = String(state.travel); app.dataset.door = String(state.door);
      label('.house-instruction', instruction(state)); label('.house-detail', `${origins(state.round).map(t => railNames[t]).join('・')} → ${destinations(state.round).map(t => railNames[t]).join('・')}`);
      const value = Math.round(progress(state) * 100); app.querySelector<HTMLElement>('.progress > span')!.style.width = `${value}%`; app.querySelector('.progress')!.setAttribute('aria-valuenow', String(value));
      app.querySelectorAll<HTMLElement>('[data-step]').forEach(node => { const t = node.dataset.step as Train; node.dataset.state = state.order.includes(t) ? 'done' : state.selected === t || eligible.includes(t) ? 'active' : 'upcoming'; });
      app.querySelector<HTMLElement>('.finish-actions')!.hidden = state.phase !== 'complete'; app.querySelector<HTMLElement>('.rail-finish')!.hidden = state.phase !== 'complete';
      scene.canvas.style.cursor = state.action === 'dragging' ? 'grabbing' : eligible.length ? 'grab' : 'default';
      const title = state.selected ? `${railNames[state.selected]} · ${names[state.phase]}` : names[state.phase], key = `${state.phase}:${state.selected}:${state.round.direction}`;
      if (displayed !== key) { label('#vehicle-name', title); app.querySelector('.badge-icon')!.innerHTML = state.selected ? railIcons[state.selected] : eligible.length ? eligible.map(t => railIcons[t]).join('') : railIcons['high-speed']; displayed = key; }
      if (dev) { if (select) select.value = state.phase; if (layout) layout.value = String(state.round.layout); if (palette) palette.value = String(state.round.palette); if (direction) direction.value = state.round.direction; if (visit) visit.value = String(Math.min(3, state.order.length)); label('#phase', names[state.phase]); label('#action', state.action); }
    }
    return withAutosave('rail-transfer', runFrameLoop('rail-transfer', animate), save, 700);
  });
  return { connect, save };
}
