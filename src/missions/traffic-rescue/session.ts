import { bindPrimaryDrag } from '../../runtime/pointer.ts';
import { createDragHint } from '../../runtime/drag-hint.ts';
import { createAudio } from '../../runtime/audio.ts';
import { loadProgress, saveProgress, markCompleted, isMuted, setMuted } from '../../app/progress.ts';
import { createTraffic, resumeTraffic, chooseColors, stages, grab, drive, moveHandle, accept, release, advance, progress, isDriving, PALETTE, SETTLE_SECONDS, DEBRIS, towDirection, towType } from './domain/traffic.ts';
import type { Stage, Point, Goal, TrafficState } from './domain/traffic.ts';
import type { createTrafficScene } from './scene.ts';
import { mountTrafficUI, names, instruction, icons, liftIcon, goalNames } from './ui.ts';
export const trafficSounds = { connected: [440, 660], arrival: [440, 554, 440], sweep: [260, 330], depart: [392, 523], complete: [523, 659, 784, 1047], bump: [150, 110] } as const;
export const createTrafficAudio = () => createAudio(trafficSounds);
const colorKey = 'town-crew:traffic:last-colors:v1';
let lastColors: [number, number] | undefined;
function newColors() {
  try { const colors: unknown = JSON.parse(sessionStorage.getItem(colorKey) ?? 'null'); if (Array.isArray(colors) && colors.length === 2 && colors.every(c => Number.isInteger(c) && c >= 0 && c < PALETTE.length)) lastColors = colors as [number, number]; } catch { /* Optional storage. */ }
  lastColors = chooseColors(lastColors);
  try { sessionStorage.setItem(colorKey, JSON.stringify(lastColors)); } catch { /* Optional storage. */ }
  return lastColors;
}
export function createTrafficSession(app: HTMLDivElement, dev: boolean, onHome: () => void, fresh = false) {
  const query = new URLSearchParams(location.search).get('stage'), stage: Stage = dev && !fresh && stages.includes(query as Stage) ? query as Stage : 'collision';
  const devKey = `town-crew:traffic:dev:v1:${location.search}`;
  let restored: TrafficState | undefined;
  try { if (!fresh) restored = resumeTraffic(dev ? JSON.parse(sessionStorage.getItem(devKey) ?? 'null') : loadProgress('traffic-rescue')); } catch { /* Optional storage. */ }
  let state = restored ?? createTraffic(stage, dev ? [0, 2] : newColors());
  function save() { if (dev) { try { sessionStorage.setItem(devKey, JSON.stringify(state)); } catch { /* Optional storage. */ } } else saveProgress('traffic-rescue', state); }
  mountTrafficUI(app, dev);
  function connect(scene: ReturnType<typeof createTrafficScene>, audio: ReturnType<typeof createTrafficAudio>) {
    const events = new AbortController(), options = { signal: events.signal }, hint = createDragHint(app.querySelector<HTMLElement>('.world')!);
    let frame = 0, previous = performance.now(), time = 0, saved = 0, muted = isMuted(); audio.setMuted(muted);
    function unlock() { try { void audio.unlock().catch(() => {}); } catch { /* Optional audio. */ } }
    function update(next: TrafficState) {
      if (next === state) return;
      if (next.phase === 'collision' && state.elapsed < 1.45 && next.elapsed >= 1.45) audio.play('bump');
      if (next.phase === 'reopen' && state.elapsed < 2.6 && next.elapsed >= 2.6) audio.play('depart');
      if (next.phase !== state.phase) {
        audio.play(next.phase === 'complete' ? 'complete' : next.phase === 'tow-exit' ? 'connected' : 'arrival');
        if (next.phase === 'complete' && !dev) markCompleted('traffic-rescue');
      } else if (next.cleaned > state.cleaned) audio.play('sweep');
      else if (next.action === 'working' && state.action === 'dragging') audio.play('connected');
      state = next;
    }
    const pointer = bindPrimaryDrag<{ phase: Stage; plane: number; offset: Point; origin: { x: number; y: number }; screen: { x: number; y: number }; goal?: Goal; settle: number }>(scene.canvas, {
      start(event) {
        unlock();
        if (state.phase === 'tow-choice') {
          const goal = scene.carAt(event.clientX, event.clientY, state); if (!goal) return;
          const screen = { x: event.clientX, y: event.clientY }; update(grab(state));
          return { phase: state.phase, plane: 0.7, origin: screen, screen, settle: 0, offset: { x: 0, y: 0, z: 0 }, goal };
        }
        if (!scene.hit(event.clientX, event.clientY, state)) return;
        const plane = isDriving(state) ? 1 : 0.7, p = scene.onPlane(event.clientX, event.clientY, plane); if (!p) return;
        const anchor = scene.anchor(state), screen = { x: event.clientX, y: event.clientY }; update(grab(state));
        return { phase: state.phase, plane, origin: screen, screen, settle: 0, offset: { x: anchor.x - p.x, y: anchor.y - p.y, z: anchor.z - p.z } };
      },
      move(event, held) {
        if (state.phase !== held.phase || state.action !== 'dragging') return;
        held.screen = { x: event.clientX, y: event.clientY }; if (held.phase === 'tow-choice') return;
        const p = scene.onPlane(event.clientX, event.clientY, held.plane); if (!p) return;
        const position = { x: p.x + held.offset.x, y: p.y + held.offset.y, z: p.z + held.offset.z };
        update(isDriving(state) ? drive(state, position.x) : moveHandle(state, position));
        const goal = scene.targets(state, held.screen, held.origin).find(t => t.accepted)?.id;
        if (goal !== held.goal) { held.goal = goal; held.settle = 0; }
      },
      end(held, cancelled) {
        if (held.phase !== state.phase) return;
        if (held.phase === 'tow-choice') {
          const tapped = Math.hypot(held.screen.x - held.origin.x, held.screen.y - held.origin.y) < 18 && scene.carAt(held.screen.x, held.screen.y, state) === held.goal;
          update(release(state, cancelled || !tapped, held.goal)); save(); return;
        }
        const goal = scene.targets(state, held.screen, held.origin).find(t => t.accepted)?.id; update(release(state, cancelled, goal)); save(); },
    }, events.signal);
    const restart = () => { unlock(); pointer.cancel(); update(createTraffic('collision', dev ? chooseColors(state.colors) : newColors())); save(); };
    app.querySelectorAll('.restart, .finish-restart').forEach(b => b.addEventListener('click', restart, options));
    app.querySelectorAll('.home, .finish-home').forEach(b => b.addEventListener('click', () => { pointer.cancel(); save(); onHome(); }, options));
    const sound = app.querySelector<HTMLButtonElement>('.sound')!;
    function syncSound() { sound.textContent = muted ? '♩' : '♪'; sound.setAttribute('aria-pressed', String(muted)); sound.setAttribute('aria-label', muted ? '開啟音效' : '關閉音效'); }
    syncSound(); sound.addEventListener('click', () => { unlock(); muted = !muted; setMuted(muted); audio.setMuted(muted); syncSound(); }, options);
    const select = app.querySelector<HTMLSelectElement>('#stage');
    const resetStage = () => { pointer.cancel(); state = createTraffic(select!.value as Stage, state.colors, state.towTypes); save(); };
    select?.addEventListener('change', resetStage, options); app.querySelector('.reset-stage')?.addEventListener('click', resetStage, options);
    document.addEventListener('visibilitychange', () => { previous = performance.now(); if (document.hidden) save(); }, options); window.addEventListener('pagehide', save, options);
    app.querySelector('.loading')!.remove(); const targets = app.querySelector<HTMLElement>('.traffic-targets')!;
    let targetKey = '', displayed: Stage | undefined;
    function label(selector: string, text: string) { const node = app.querySelector(selector); if (node && node.textContent !== text) node.textContent = text; }
    function animate(now: number) {
      const dt = document.hidden ? 0 : Math.min((now - previous) / 1000, 0.1); previous = now; time += dt; update(advance(state, dt));
      let held = pointer.context();
      if (held && (held.phase !== state.phase || state.action !== 'dragging')) { pointer.cancel(); held = undefined; }
      if (held && !isDriving(state) && state.phase !== 'tow-choice') {
        const goal = scene.targets(state, held.screen, held.origin).find(t => t.accepted)?.id;
        if (goal !== held.goal) { held.goal = goal; held.settle = 0; }
        held.settle = goal ? held.settle + dt : 0;
        if (goal && held.settle >= SETTLE_SECONDS) { update(accept(state, goal)); pointer.cancel(); held = undefined; }
      }
      scene.render(state, time); hint.update(scene.dragHint(state), time);
      const items = scene.targets(state, held?.screen, held?.origin), key = items.map(t => t.id).join(',');
      if (key !== targetKey) { targets.innerHTML = items.map(t => `<div class="fire-target traffic-target" role="img" aria-label="目的地：${goalNames[t.id]}" data-goal="${t.id}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" pathLength="1"/></svg><span>${goalNames[t.id]}</span></div>`).join(''); targetKey = key; }
      items.forEach(t => { const node = targets.querySelector<HTMLElement>(`[data-goal="${t.id}"]`)!; node.style.left = `${t.x}px`; node.style.top = `${t.y}px`; node.dataset.ready = String(t.accepted); node.querySelector('circle')!.style.strokeDashoffset = String(1 - Math.min(1, (t.accepted ? held?.settle ?? 0 : 0) / SETTLE_SECONDS)); });
      app.dataset.phase = state.phase; app.dataset.action = state.action; app.dataset.towed = String(state.towed.filter(Boolean).length); app.dataset.cleaned = String(state.cleaned); app.dataset.colors = state.colors.join(','); app.dataset.selected = String(state.selected); app.dataset.towTypes = state.towTypes.join(','); app.dataset.towType = state.selected === null ? '' : towType(state); app.dataset.towSide = state.selected === null ? '' : towDirection(state) < 0 ? 'left' : 'right';
      const value = progress(state); app.querySelector<HTMLElement>('.progress span')!.style.transform = `scaleX(${value})`; app.querySelector('.progress')!.setAttribute('aria-valuenow', String(Math.round(value * 100)));
      label('.house-instruction', instruction(state, items.some(t => t.accepted)));
      label('.house-detail', ['tow-choice', 'tow-arrival', 'hook', 'tow-exit'].includes(state.phase) ? `送去修理 · ${state.towed.filter(Boolean).length} / 2` : state.phase === 'sweep' ? `道路清掃 · ${Math.round(state.cleaned / DEBRIS.length * 100)}%` : '');
      app.querySelectorAll<HTMLElement>('[data-car]').forEach((node, i) => { node.style.color = PALETTE[state.colors[i]]; node.dataset.done = String(state.towed[i]); node.querySelector('b')!.textContent = state.towed[i] ? '✓' : '○'; });
      app.querySelector<HTMLElement>('.traffic-tally')!.hidden = stages.indexOf(state.phase) < 3 || stages.indexOf(state.phase) > stages.indexOf('sweep');
      app.querySelector<HTMLElement>('.finish-actions')!.hidden = state.phase !== 'complete';
      scene.canvas.style.cursor = state.action === 'dragging' ? 'grabbing' : state.action === 'ready' && state.phase !== 'complete' ? 'grab' : 'default';
      if (displayed !== state.phase) {
        const index = stages.indexOf(state.phase), active = index < 3 ? 0 : index < stages.indexOf('sweeper') ? 1 : index < stages.indexOf('ambulance') ? 2 : 3;
        label('#vehicle-name', active === 1 && state.selected !== null ? (towType(state) === 'flatbed' ? '平板拖吊車' : '吊掛拖吊車') + (state.phase === 'hook' ? ' · 接好小客車' : state.phase === 'tow-exit' ? ' · 送去修理' : '來了') : names[state.phase]);
        app.querySelector('.badge-icon')!.innerHTML = active === 1 && state.selected !== null && towType(state) === 'wheel-lift' ? liftIcon : Object.values(icons)[active];
        app.querySelectorAll<HTMLElement>('[data-step]').forEach((node, i) => { node.dataset.state = state.phase === 'complete' || i < active ? 'done' : i === active ? 'active' : 'upcoming'; });
        if (select) select.value = state.phase; displayed = state.phase;
      }
      if (dev) { label('#phase', names[state.phase]); label('#action', state.action); }
      if (now - saved > 800) { save(); saved = now; } frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => { pointer.cancel(); save(); cancelAnimationFrame(frame); events.abort(); hint.dispose(); };
  }
  return { connect, save };
}
