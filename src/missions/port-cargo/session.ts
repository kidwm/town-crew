import { bindPrimaryDrag } from '../../runtime/pointer.ts';
import { createDragHint } from '../../runtime/drag-hint.ts';
import { createAudio } from '../../runtime/audio.ts';
import { loadProgress, saveProgress, markCompleted, isMuted, setMuted } from '../../app/progress.ts';
import { createPort, chooseRound, readRound, resumePort, missionStages, isCraneStage, forkCount, available, grab, drive, moveLoad, release, advance, progress, smooth } from './domain/port.ts';
import type { Round, Stage, PortState, Cargo } from './domain/port.ts';
import type { createPortScene } from './scene.ts';
import { mountPortUI, iconsFor, stepIndex, vehicleIcon, phaseName, stageOptions, instruction } from './ui.ts';
export const createPortAudio = () => createAudio({ arrival: [262, 330, 392], parked: [440, 660], pickup: [392, 494], depart: [330, 440], complete: [523, 659, 784, 1047] });
const roundKey = 'town-crew:port:last-round:v1'; let previousRound: Round | undefined;
function newRound(previous?: Round) {
  try { const saved = readRound(JSON.parse(sessionStorage.getItem(roundKey) ?? 'null')); if (saved) previousRound = saved; } catch { /* Storage is optional. */ }
  previousRound = chooseRound(previous ?? previousRound);
  try { sessionStorage.setItem(roundKey, JSON.stringify(previousRound)); } catch { /* Storage is optional. */ }
  return previousRound;
}
export function createPortSession(app: HTMLDivElement, dev: boolean, onHome: () => void, fresh = false) {
  const params = new URLSearchParams(location.search), requested = params.get('stage'), direction = params.get('direction') === 'load' ? 'load' : 'unload';
  const phase: Stage = dev && !fresh && missionStages(direction).includes(requested as Stage) ? requested as Stage : 'boat';
  const devKey = `town-crew:port:dev:v1:${location.search}`;
  let restored: PortState | undefined;
  try { if (!fresh) restored = resumePort(dev ? JSON.parse(sessionStorage.getItem(devKey) ?? 'null') : loadProgress('port-cargo')); } catch { /* Storage is optional. */ }
  const palette = Number(params.get('palette') ?? 0), layout = params.get('layout') === '1' ? 1 : 0;
  let state = restored ?? createPort(phase, dev ? { layout, direction, palette: Number.isInteger(palette) && palette >= 0 && palette < 4 ? palette : 0 } : newRound());
  function save() { if (dev) { try { sessionStorage.setItem(devKey, JSON.stringify(state)); } catch { /* Storage is optional. */ } } else saveProgress('port-cargo', state); }
  mountPortUI(app, dev, state.round.direction);
  function connect(scene: ReturnType<typeof createPortScene>, audio: ReturnType<typeof createPortAudio>) {
    const events = new AbortController(), options = { signal: events.signal }, hint = createDragHint(app.querySelector<HTMLElement>('.world')!);
    let frame = 0, previous = performance.now(), time = 0, saved = 0, muted = isMuted(); audio.setMuted(muted);
    function unlock() { try { void audio.unlock().catch(() => {}); } catch { /* Audio is optional. */ } }
    function update(next: PortState) {
      if (next === state) return;
      const checkpoint = next.phase !== state.phase || next.action !== state.action || next.unloaded.length !== state.unloaded.length || next.loaded.length !== state.loaded.length;
      if (next.phase !== state.phase) audio.play(next.phase === 'complete' ? 'complete' : ['transport', 'ship-transport', 'departure'].includes(next.phase) ? 'depart' : 'parked');
      else if (next.action !== state.action && ['picking', 'hoisting', 'lowering'].includes(next.action)) audio.play('pickup');
      if (next.phase === 'complete' && state.phase !== 'complete' && !dev) markCompleted('port-cargo');
      state = next; if (checkpoint) save();
    }
    const pointer = bindPrimaryDrag<{ phase: Stage; cargo: boolean; origin: { x: number; y: number }; offset: { x: number; y: number } }>(scene.canvas, {
      start(event) {
        unlock(); const hit = scene.hit(event.clientX, event.clientY, state); if (hit === undefined) return;
        const id = typeof hit === 'number' ? hit : undefined, info = scene.task(state, id)!, r = scene.canvas.getBoundingClientRect();
        update(grab(state, id));
        return { phase: state.phase, cargo: isCraneStage(state), origin: { x: event.clientX, y: event.clientY }, offset: { x: r.x + info.from.x - event.clientX, y: r.y + info.from.y - event.clientY } };
      },
      move(event, held) {
        const threshold = state.phase === 'forklift' && state.selected === null && available(state).length > 1 ? 25 : 10;
        if (state.phase !== held.phase || state.action !== 'dragging' || Math.hypot(event.clientX - held.origin.x, event.clientY - held.origin.y) < threshold) return;
        const pointer = { x: event.clientX, y: event.clientY }, adjusted = { x: pointer.x + held.offset.x, y: pointer.y + held.offset.y };
        if (held.cargo) { const target = scene.loadTarget(state, pointer, adjusted); update(moveLoad(state, target, target.id)); }
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
    const stage = app.querySelector<HTMLSelectElement>('#stage'), layout = app.querySelector<HTMLSelectElement>('#layout'), palette = app.querySelector<HTMLSelectElement>('#palette'), directionControl = app.querySelector<HTMLSelectElement>('#direction');
    if (directionControl) directionControl.value = state.round.direction;
    const reset = () => { pointer.cancel(); state = createPort(stage!.value as Stage, { layout: Number(layout!.value) as 0 | 1, palette: Number(palette!.value), direction: directionControl!.value === 'load' ? 'load' : 'unload' }); save(); };
    [stage, layout, palette, directionControl].forEach(node => node?.addEventListener('change', reset, options)); app.querySelector('.reset-stage')?.addEventListener('click', reset, options);
    document.addEventListener('visibilitychange', () => { previous = performance.now(); if (document.hidden) save(); }, options); window.addEventListener('pagehide', save, options);
    app.querySelector('.loading')!.remove();
    const target = app.querySelector<HTMLElement>('.port-target')!, sources = app.querySelector<HTMLElement>('.port-sources')!;
    let sourceKey = '', displayed = '';
    const label = (selector: string, text: string) => { const node = app.querySelector(selector)!; if (node.textContent !== text) node.textContent = text; };
    function animate(now: number) {
      const dt = document.hidden ? 0 : Math.min((now - previous) / 1000, 0.1); previous = now; time += dt; update(advance(state, dt));
      const held = pointer.context(); if (held && (held.phase !== state.phase || state.action !== 'dragging')) pointer.cancel();
      scene.render(state, time); hint.update(scene.hint(state), time);
      const info = scene.task(state); target.hidden = !info;
      if (info) {
        target.style.left = `${info.to.x}px`; target.style.top = `${info.to.y}px`; target.dataset.ready = String(state.action === 'dragging' && state.elapsed > 0);
        target.querySelector('span')!.textContent = isCraneStage(state) ? !state.craneAttached ? '吊起貨箱' : state.round.direction === 'load' ? '裝到船上' : '卸在這裡' : state.phase === 'forklift' ? state.carrying ? state.round.direction === 'load' ? '卸在這裡' : '裝到車上' : '叉起貨箱' : state.phase === 'transport' || state.phase === 'ship-transport' ? '出發' : '停這裡';
        target.querySelector('circle')!.style.strokeDashoffset = String(1 - Math.min(1, state.elapsed / 0.4));
      }
      const availableSources = scene.sources(state), key = availableSources.map(p => p.id).join(',');
      if (key !== sourceKey) { sources.innerHTML = availableSources.map(p => `<div class="port-source" data-cargo="${p.id}" role="img" aria-label="可搬運的${p.id ? '玩具' : '食物'}貨箱"></div>`).join(''); sourceKey = key; }
      availableSources.forEach(p => { const node = sources.querySelector<HTMLElement>(`[data-cargo="${p.id}"]`)!; node.style.left = `${p.x}px`; node.style.top = `${p.y}px`; });
      app.dataset.phase = state.phase; app.dataset.action = state.action; app.dataset.layout = String(state.round.layout); app.dataset.palette = String(state.round.palette);
      app.dataset.direction = state.round.direction;
      app.dataset.attached = String(state.craneAttached);
      app.dataset.unloaded = state.unloaded.join(','); app.dataset.loaded = state.loaded.join(','); app.dataset.selected = state.selected === null ? '' : String(state.selected); app.dataset.carrying = String(state.carrying);
      app.dataset.work = JSON.stringify({ boat: state.boat, truck: state.truck, haul: state.haul, fork: state.forkTravel }); app.dataset.load = JSON.stringify(state.load);
      const value = progress(state); app.querySelector<HTMLElement>('.progress span')!.style.transform = `scaleX(${value})`; app.querySelector('.progress')!.setAttribute('aria-valuenow', String(Math.round(value * 100)));
      const outgoing = state.round.direction === 'load';
      label('.house-instruction', instruction(state)); label('.house-detail', isCraneStage(state) || state.phase === 'crane-exit' ? outgoing ? `裝上貨船 · ${state.loaded.length} / 2` : `卸貨到岸 · ${state.unloaded.length} / 2` : state.phase === 'forklift' || state.phase === 'forklift-exit' ? `${outgoing ? '卸車到岸' : '裝好物資'} · ${forkCount(state)} / 2` : outgoing ? '裝船送出去 · 平板車 → 碼頭 → 貨船' : '卸船送進城 · 貨船 → 碼頭 → 平板車');
      app.querySelectorAll<HTMLElement>('[data-cargo-status]').forEach(node => { const id = Number(node.dataset.cargoStatus) as Cargo; node.dataset.done = String(state.loaded.includes(id)); node.querySelector('b')!.textContent = state.loaded.includes(id) ? '✓' : state.unloaded.includes(id) ? '↓' : ''; });
      app.querySelector<HTMLElement>('.finish-actions')!.hidden = state.phase !== 'complete';
      const arrival = app.querySelector<HTMLElement>(outgoing ? '.port-boat-arrival' : '.port-truck-arrival')!;
      app.querySelectorAll<HTMLElement>('.port-arrival').forEach(node => { node.hidden = node !== arrival || !['arrival', 'complete'].includes(state.phase); });
      const elapsed = state.phase === 'complete' ? 6 : state.elapsed;
      arrival.querySelector(outgoing ? '.port-arrival-boat' : '.port-arrival-truck')!.setAttribute('transform', `translate(${35 - (1 - smooth(elapsed / 2)) * 145} ${outgoing ? 82 : 80})`);
      arrival.querySelector('.port-arrival-boxes')!.setAttribute('opacity', String(smooth((elapsed - 2) / 1.5)));
      arrival.querySelector(outgoing ? '.boat-cargo' : '.freight-cargo')!.setAttribute('opacity', String(1 - smooth((elapsed - 2) / 1.5)));
      const active = stepIndex(state), displayKey = `${state.round.direction}:${state.phase}`;
      if (displayed !== displayKey) {
        const steps = app.querySelector('.mission-steps')!;
        steps.innerHTML = iconsFor(state.round.direction).map((icon, n) => `<span data-step="${n}">${icon}</span>`).join('');
        steps.setAttribute('aria-label', outgoing ? '平板車、堆高機、吊車、貨船' : '貨船、吊車、堆高機、平板車');
        label('#vehicle-name', phaseName(state.phase, state.round.direction)); app.querySelector('.badge-icon')!.innerHTML = vehicleIcon(state);
        label('.mission-badge .eyebrow', outgoing ? '一起，把物資送往對岸' : '一起，把物資送進城');
        if (stage) { stage.innerHTML = stageOptions(state.round.direction); stage.value = state.phase; label('.dev-intro', outgoing ? '平板車 → 兩趟卸車 → 兩次吊裝 → 貨船' : '貨船 → 兩次吊卸 → 兩趟叉運 → 平板車'); }
        displayed = displayKey;
      }
      app.querySelectorAll<HTMLElement>('[data-step]').forEach((node, n) => { const done = n === 0 ? state.boat === 1 && state.truck === 1 : n === 1 ? state.unloaded.length === 2 : n === 2 ? state.loaded.length === 2 : state.haul === 1; node.dataset.state = active === n && state.phase !== 'complete' ? 'active' : done ? 'done' : 'upcoming'; });
      scene.canvas.style.cursor = state.action === 'dragging' ? 'grabbing' : info ? 'grab' : 'default';
      if (dev) { label('#phase', phaseName(state.phase, state.round.direction)); label('#action', state.action); layout!.value = String(state.round.layout); palette!.value = String(state.round.palette); directionControl!.value = state.round.direction; }
      if (now - saved > 700) { save(); saved = now; } frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => { pointer.cancel(); save(); cancelAnimationFrame(frame); events.abort(); hint.dispose(); };
  }
  return { connect, save };
}
