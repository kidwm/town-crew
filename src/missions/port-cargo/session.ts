import { bindPrimaryDrag } from '../../runtime/pointer.ts';
import { createDragHint } from '../../runtime/drag-hint.ts';
import { createAudio } from '../../runtime/audio.ts';
import { loadProgress, saveProgress, markCompleted, isMuted, setMuted } from '../../app/progress.ts';
import { createPort, chooseRound, validRound, resumePort, stages, available, grab, drive, moveLoad, release, advance, progress, smooth } from './domain/port.ts';
import type { Round, Stage, PortState, Cargo } from './domain/port.ts';
import type { createPortScene } from './scene.ts';
import { mountPortUI, icons, names, instruction } from './ui.ts';
export const createPortAudio = () => createAudio({ arrival: [262, 330, 392], parked: [440, 660], pickup: [392, 494], depart: [330, 440], complete: [523, 659, 784, 1047] });
const roundKey = 'town-crew:port:last-round:v1'; let previousRound: Round | undefined;
function newRound(previous?: Round) {
  try { const saved: unknown = JSON.parse(sessionStorage.getItem(roundKey) ?? 'null'); if (validRound(saved)) previousRound = saved; } catch { /* Storage is optional. */ }
  previousRound = chooseRound(previous ?? previousRound);
  try { sessionStorage.setItem(roundKey, JSON.stringify(previousRound)); } catch { /* Storage is optional. */ }
  return previousRound;
}
export function createPortSession(app: HTMLDivElement, dev: boolean, onHome: () => void, fresh = false) {
  const params = new URLSearchParams(location.search), requested = params.get('stage'), phase: Stage = dev && !fresh && stages.includes(requested as Stage) ? requested as Stage : 'boat';
  const devKey = `town-crew:port:dev:v1:${location.search}`;
  let restored: PortState | undefined;
  try { if (!fresh) restored = resumePort(dev ? JSON.parse(sessionStorage.getItem(devKey) ?? 'null') : loadProgress('port-cargo')); } catch { /* Storage is optional. */ }
  const palette = Number(params.get('palette') ?? 0), layout = params.get('layout') === '1' ? 1 : 0;
  let state = restored ?? createPort(phase, dev ? { layout, palette: Number.isInteger(palette) && palette >= 0 && palette < 4 ? palette : 0 } : newRound());
  function save() { if (dev) { try { sessionStorage.setItem(devKey, JSON.stringify(state)); } catch { /* Storage is optional. */ } } else saveProgress('port-cargo', state); }
  mountPortUI(app, dev);
  function connect(scene: ReturnType<typeof createPortScene>, audio: ReturnType<typeof createPortAudio>) {
    const events = new AbortController(), options = { signal: events.signal }, hint = createDragHint(app.querySelector<HTMLElement>('.world')!);
    let frame = 0, previous = performance.now(), time = 0, saved = 0, muted = isMuted(); audio.setMuted(muted);
    function unlock() { try { void audio.unlock().catch(() => {}); } catch { /* Audio is optional. */ } }
    function update(next: PortState) {
      if (next === state) return;
      const checkpoint = next.phase !== state.phase || next.action !== state.action || next.unloaded.length !== state.unloaded.length || next.loaded.length !== state.loaded.length;
      if (next.phase !== state.phase) audio.play(next.phase === 'complete' ? 'complete' : ['transport', 'departure'].includes(next.phase) ? 'depart' : 'parked');
      else if (next.action === 'picking' || next.action === 'lowering') audio.play('pickup');
      if (next.phase === 'complete' && state.phase !== 'complete' && !dev) markCompleted('port-cargo');
      state = next; if (checkpoint) save();
    }
    const pointer = bindPrimaryDrag<{ phase: Stage; cargo: boolean; origin: { x: number; y: number }; offset: { x: number; y: number } }>(scene.canvas, {
      start(event) {
        unlock(); const hit = scene.hit(event.clientX, event.clientY, state); if (hit === undefined) return;
        const info = scene.task(state, hit === 'vehicle' ? undefined : hit)!, r = scene.canvas.getBoundingClientRect();
        update(grab(state, hit === 'vehicle' ? undefined : hit));
        return { phase: state.phase, cargo: hit !== 'vehicle', origin: { x: event.clientX, y: event.clientY }, offset: { x: r.x + info.from.x - event.clientX, y: r.y + info.from.y - event.clientY } };
      },
      move(event, held) {
        const threshold = state.phase === 'forklift' && state.selected === null && available(state).length > 1 ? 25 : 10;
        if (state.phase !== held.phase || state.action !== 'dragging' || Math.hypot(event.clientX - held.origin.x, event.clientY - held.origin.y) < threshold) return;
        const pointer = { x: event.clientX, y: event.clientY }, adjusted = { x: pointer.x + held.offset.x, y: pointer.y + held.offset.y };
        if (held.cargo) update(moveLoad(state, scene.loadTarget(state, pointer, adjusted)));
        else { const target = scene.driveTarget(state, adjusted, { x: held.origin.x + held.offset.x, y: held.origin.y + held.offset.y }); update(drive(state, target.value, target.id)); }
      },
      end(held, cancelled) { if (state.phase === held.phase) update(release(state, cancelled)); save(); },
    }, events.signal);
    const restart = () => { unlock(); pointer.cancel(); state = createPort('boat', dev ? chooseRound(state.round) : newRound(state.round)); save(); };
    app.querySelectorAll('.restart, .finish-restart').forEach(b => b.addEventListener('click', restart, options));
    app.querySelectorAll('.home, .finish-home').forEach(b => b.addEventListener('click', () => { pointer.cancel(); save(); onHome(); }, options));
    const sound = app.querySelector<HTMLButtonElement>('.sound')!;
    function syncSound() { sound.textContent = muted ? '♩' : '♪'; sound.setAttribute('aria-pressed', String(muted)); sound.setAttribute('aria-label', muted ? '開啟音效' : '關閉音效'); }
    syncSound(); sound.addEventListener('click', () => { unlock(); muted = !muted; setMuted(muted); audio.setMuted(muted); syncSound(); }, options);
    const stage = app.querySelector<HTMLSelectElement>('#stage'), layout = app.querySelector<HTMLSelectElement>('#layout'), palette = app.querySelector<HTMLSelectElement>('#palette');
    const reset = () => { pointer.cancel(); state = createPort(stage!.value as Stage, { layout: Number(layout!.value) as 0 | 1, palette: Number(palette!.value) }); save(); };
    [stage, layout, palette].forEach(node => node?.addEventListener('change', reset, options)); app.querySelector('.reset-stage')?.addEventListener('click', reset, options);
    document.addEventListener('visibilitychange', () => { previous = performance.now(); if (document.hidden) save(); }, options); window.addEventListener('pagehide', save, options);
    app.querySelector('.loading')!.remove();
    const target = app.querySelector<HTMLElement>('.port-target')!, sources = app.querySelector<HTMLElement>('.port-sources')!;
    let sourceKey = '', displayed: Stage | undefined;
    const label = (selector: string, text: string) => { const node = app.querySelector(selector)!; if (node.textContent !== text) node.textContent = text; };
    function animate(now: number) {
      const dt = document.hidden ? 0 : Math.min((now - previous) / 1000, 0.1); previous = now; time += dt; update(advance(state, dt));
      const held = pointer.context(); if (held && (held.phase !== state.phase || state.action !== 'dragging')) pointer.cancel();
      scene.render(state, time); hint.update(scene.hint(state), time);
      const info = scene.task(state); target.hidden = !info;
      if (info) {
        target.style.left = `${info.to.x}px`; target.style.top = `${info.to.y}px`; target.dataset.ready = String(state.action === 'dragging' && state.elapsed > 0);
        target.querySelector('span')!.textContent = state.phase === 'unload' ? '卸在這裡' : state.phase === 'forklift' ? state.carrying ? '裝到車上' : '叉起貨箱' : state.phase === 'transport' ? '出發' : '停這裡';
        target.querySelector('circle')!.style.strokeDashoffset = String(1 - Math.min(1, state.elapsed / 0.4));
      }
      const availableSources = scene.sources(state), key = availableSources.map(p => p.id).join(',');
      if (key !== sourceKey) { sources.innerHTML = availableSources.map(p => `<div class="port-source" data-cargo="${p.id}" role="img" aria-label="可搬運的${p.id ? '玩具' : '食物'}貨箱"></div>`).join(''); sourceKey = key; }
      availableSources.forEach(p => { const node = sources.querySelector<HTMLElement>(`[data-cargo="${p.id}"]`)!; node.style.left = `${p.x}px`; node.style.top = `${p.y}px`; });
      app.dataset.phase = state.phase; app.dataset.action = state.action; app.dataset.layout = String(state.round.layout); app.dataset.palette = String(state.round.palette);
      app.dataset.unloaded = state.unloaded.join(','); app.dataset.loaded = state.loaded.join(','); app.dataset.selected = state.selected === null ? '' : String(state.selected); app.dataset.carrying = String(state.carrying);
      app.dataset.work = JSON.stringify({ boat: state.boat, truck: state.truck, haul: state.haul, fork: state.forkTravel }); app.dataset.load = JSON.stringify(state.load);
      const value = progress(state); app.querySelector<HTMLElement>('.progress span')!.style.transform = `scaleX(${value})`; app.querySelector('.progress')!.setAttribute('aria-valuenow', String(Math.round(value * 100)));
      label('.house-instruction', instruction(state)); label('.house-detail', state.phase === 'unload' || state.phase === 'crane-exit' ? `卸貨到岸 · ${state.unloaded.length} / 2` : state.phase === 'forklift' || state.phase === 'forklift-exit' ? `裝好物資 · ${state.loaded.length} / 2` : '貨船・吊車・堆高機・平板車，一起合作');
      app.querySelectorAll<HTMLElement>('[data-cargo-status]').forEach(node => { const id = Number(node.dataset.cargoStatus) as Cargo; node.dataset.done = String(state.loaded.includes(id)); node.querySelector('b')!.textContent = state.loaded.includes(id) ? '✓' : state.unloaded.includes(id) ? '↓' : ''; });
      app.querySelector<HTMLElement>('.finish-actions')!.hidden = state.phase !== 'complete';
      const arrival = app.querySelector<HTMLElement>('.port-arrival')!; arrival.hidden = !['arrival', 'complete'].includes(state.phase);
      const elapsed = state.phase === 'complete' ? 6 : state.elapsed;
      arrival.querySelector('.port-arrival-truck')!.setAttribute('transform', `translate(${35 - (1 - smooth(elapsed / 2)) * 145} 80)`);
      arrival.querySelector('.port-arrival-boxes')!.setAttribute('opacity', String(smooth((elapsed - 2) / 1.5)));
      arrival.querySelector('.freight-cargo')!.setAttribute('opacity', String(1 - smooth((elapsed - 2) / 1.5)));
      const active = state.phase === 'boat' ? 0 : ['unload', 'crane-exit'].includes(state.phase) ? 1 : ['forklift', 'forklift-exit'].includes(state.phase) ? 2 : 3;
      app.querySelectorAll<HTMLElement>('[data-step]').forEach((node, n) => { const done = n === 0 ? state.boat === 1 : n === 1 ? state.unloaded.length === 2 : n === 2 ? state.loaded.length === 2 : state.haul === 1; node.dataset.state = active === n && state.phase !== 'complete' ? 'active' : done ? 'done' : 'upcoming'; });
      scene.canvas.style.cursor = state.action === 'dragging' ? 'grabbing' : info ? 'grab' : 'default';
      if (displayed !== state.phase) { label('#vehicle-name', names[state.phase]); app.querySelector('.badge-icon')!.innerHTML = icons[active]; if (stage) stage.value = state.phase; displayed = state.phase; }
      if (dev) { label('#phase', names[state.phase]); label('#action', state.action); layout!.value = String(state.round.layout); palette!.value = String(state.round.palette); }
      if (now - saved > 700) { save(); saved = now; } frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => { pointer.cancel(); save(); cancelAnimationFrame(frame); events.abort(); hint.dispose(); };
  }
  return { connect, save };
}
