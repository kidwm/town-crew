import { bindPrimaryDrag } from '../../runtime/pointer.ts';
import { createDragHint } from '../../runtime/drag-hint.ts';
import { loadProgress, saveProgress, markCompleted, isMuted, setMuted } from '../../app/progress.ts';
import { createFire, resumeFire, stages, grab, drive, moveHandle, spray, accept, release, advance, progress, isDriving, isSpraying, isBasket, FIRES, SETTLE_SECONDS } from './domain/fire.ts';
import type { FireState, Stage, Point, Goal } from './domain/fire.ts';
import type { createFireScene } from './scene.ts';
import type { createFireAudio } from './sounds.ts';
import { mountFireUI, names, instructions, icons, goalNames } from './ui.ts';

export function createFireSession(app: HTMLDivElement, dev: boolean, onHome: () => void, fresh = false) {
  const query = new URLSearchParams(location.search).get('stage');
  const stage: Stage = dev && !fresh && stages.includes(query as Stage) ? query as Stage : 'dispatch';
  const devKey = `town-crew:fire:dev:v1:${location.search}`;
  let state = createFire(stage);
  try { if (!fresh) state = resumeFire(dev ? JSON.parse(sessionStorage.getItem(devKey) ?? 'null') : loadProgress('fire-rescue')) ?? state; } catch { /* Optional storage. */ }
  function save() {
    if (dev) { try { sessionStorage.setItem(devKey, JSON.stringify(state)); } catch { /* Optional storage. */ } }
    else saveProgress('fire-rescue', state);
  }
  mountFireUI(app, dev);
  function connect(scene: ReturnType<typeof createFireScene>, audio: ReturnType<typeof createFireAudio>) {
    const events = new AbortController(), options = { signal: events.signal }, hint = createDragHint(app.querySelector<HTMLElement>('.world')!);
    let frame = 0, previous = performance.now(), time = 0, saved = 0, muted = isMuted(); audio.setMuted(muted);
    function unlock() { try { void audio.unlock().catch(() => {}); } catch { /* Audio is optional. */ } }
    function update(next: FireState) {
      if (next === state) return;
      if (next.fires.some((heat, i) => heat === 0 && state.fires[i] > 0)) audio.play('out');
      if (next.passenger && next.passenger !== state.passenger) audio.play(next.passenger);
      if (next.phase !== state.phase) {
        if (next.phase === 'ground-fire') audio.play('connected');
        if (['ladder-arrival', 'ambulance', 'departure'].includes(next.phase)) audio.play('depart');
        if (next.phase === 'rescue') audio.play('cat');
        if (next.phase === 'complete') { audio.play('complete'); if (!dev) markCompleted('fire-rescue'); }
      }
      if (next.rescued.some((done, i) => done && !state.rescued[i])) audio.play('arrived');
      state = next;
    }
    function aim(x: number, y: number) {
      const wet = scene.waterTarget(x, y, state), point = scene.onPlane(x, y, true, 1.35);
      if (wet !== null) update(spray(state, { ...FIRES[wet], y: FIRES[wet].y + 0.35 }, wet));
      else if (point) update(spray(state, { x: Math.max(-5, Math.min(8, point.x)), y: Math.max(0.2, Math.min(7, point.y)), z: point.z }, null));
    }
    const pointer = bindPrimaryDrag<{ phase: Stage; vertical: boolean; plane: number; offset: Point; origin: { x: number; y: number }; screen: { x: number; y: number }; goal?: Goal; settle: number }>(scene.canvas, {
      start(event) {
        unlock();
        if (state.action !== 'ready' || !scene.hit(event.clientX, event.clientY, state)) return;
        const vertical = isBasket(state) || isSpraying(state), plane = isBasket(state) ? 2.4 : isSpraying(state) ? 1.35 : isDriving(state) ? 1.5 : state.phase === 'hose' ? 0.95 : 0.7;
        const p = scene.onPlane(event.clientX, event.clientY, vertical, plane); if (!p) return;
        const anchor = isDriving(state) ? { ...p, x: state.truckX } : state.phase === 'hose' ? state.hose : isBasket(state) ? state.basket : state.stretcher;
        update(grab(state));
        if (isSpraying(state)) aim(event.clientX, event.clientY);
        const screen = { x: event.clientX, y: event.clientY };
        return { phase: state.phase, vertical, plane, origin: screen, screen, settle: 0, offset: { x: anchor.x - p.x, y: anchor.y - p.y, z: anchor.z - p.z } };
      },
      move(event, held) {
        if (state.phase !== held.phase || state.action !== 'dragging') return;
        held.screen = { x: event.clientX, y: event.clientY };
        if (isSpraying(state)) { aim(event.clientX, event.clientY); return; }
        const p = scene.onPlane(event.clientX, event.clientY, held.vertical, held.plane); if (!p) return;
        const next = { x: p.x + held.offset.x, y: p.y + held.offset.y, z: p.z + held.offset.z };
        update(isDriving(state) ? drive(state, next.x) : moveHandle(state, next));
        const target = scene.targets(state, held.screen, held.origin).find(t => t.accepted)?.id;
        if (target !== held.goal) { held.goal = target; held.settle = 0; }
      },
      end(held, cancelled) {
        const goal = scene.targets(state, held.screen, held.origin).find(t => t.accepted)?.id;
        update(release(state, cancelled, goal)); audio.setSpraying(false); save();
      },
    }, events.signal);
    const restart = () => { unlock(); pointer.cancel(); update(createFire()); save(); };
    app.querySelectorAll('.restart, .finish-restart').forEach(button => button.addEventListener('click', restart, options));
    app.querySelectorAll('.home, .finish-home').forEach(button => button.addEventListener('click', () => { pointer.cancel(); save(); onHome(); }, options));
    const sound = app.querySelector<HTMLButtonElement>('.sound')!;
    const syncSound = () => { sound.textContent = muted ? '♩' : '♪'; sound.setAttribute('aria-pressed', String(muted)); sound.setAttribute('aria-label', muted ? '開啟音效' : '關閉音效'); };
    syncSound(); sound.addEventListener('click', () => { unlock(); muted = !muted; setMuted(muted); audio.setMuted(muted); syncSound(); }, options);
    const select = app.querySelector<HTMLSelectElement>('#stage');
    select?.addEventListener('change', () => { pointer.cancel(); state = createFire(select.value as Stage); save(); }, options);
    app.querySelector('.reset-stage')?.addEventListener('click', () => { pointer.cancel(); state = createFire(select!.value as Stage); save(); }, options);
    document.addEventListener('visibilitychange', () => { previous = performance.now(); if (document.hidden) save(); }, options);
    window.addEventListener('pagehide', save, options);
    app.querySelector('.loading')!.remove();
    const targets = app.querySelector<HTMLElement>('.fire-targets')!;
    let targetKey = '', displayed: Stage | undefined;
    function label(selector: string, text: string) { const node = app.querySelector(selector); if (node && node.textContent !== text) node.textContent = text; }
    function animate(now: number) {
      const dt = document.hidden ? 0 : Math.min((now - previous) / 1000, 0.1); previous = now; time += dt;
      update(advance(state, dt));
      let held = pointer.context();
      if (held && (held.phase !== state.phase || state.action !== 'dragging')) { pointer.cancel(); held = undefined; }
      if (held && !isSpraying(state) && !isDriving(state)) {
        const goal = scene.targets(state, held.screen, held.origin).find(t => t.accepted)?.id;
        if (goal !== held.goal) { held.goal = goal; held.settle = 0; }
        held.settle = goal ? Math.min(SETTLE_SECONDS, held.settle + dt) : 0;
        if (goal && held.settle >= SETTLE_SECONDS) { update(accept(state, goal)); pointer.cancel(); held = undefined; }
      }
      audio.setSpraying(isSpraying(state) && state.action === 'dragging');
      scene.render(state, time); hint.update(scene.dragHint(state), time);
      const items = scene.targets(state, held?.screen, held?.origin), key = items.map(t => t.id).join(',');
      if (key !== targetKey) {
        targets.innerHTML = items.map(t => `<div class="fire-target" role="img" aria-label="目的地：${goalNames[t.id]}" data-goal="${t.id}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" pathLength="1"/></svg><span>${goalNames[t.id]}</span></div>`).join(''); targetKey = key;
      }
      items.forEach(t => {
        const node = targets.querySelector<HTMLElement>(`[data-goal="${t.id}"]`)!;
        node.style.left = `${t.x}px`; node.style.top = `${t.y}px`; node.dataset.ready = String(t.accepted);
        node.querySelector('circle')!.style.strokeDashoffset = String(1 - (t.accepted ? held?.settle ?? 0 : 0) / SETTLE_SECONDS);
      });
      const extinguished = state.fires.filter(n => n === 0).length, rescued = state.rescued.filter(Boolean).length;
      app.dataset.phase = state.phase; app.dataset.action = state.action; app.dataset.extinguished = String(extinguished); app.dataset.rescued = String(rescued);
      app.dataset.resident = String(state.rescued[0]); app.dataset.cat = String(state.rescued[1]); app.dataset.passenger = state.passenger ?? '';
      const value = progress(state); app.querySelector<HTMLElement>('.progress span')!.style.transform = `scaleX(${value})`;
      app.querySelector('.progress')!.setAttribute('aria-valuenow', String(Math.round(value * 100)));
      let instruction = instructions[state.phase];
      if (items.some(t => t.accepted)) instruction = '對準了，幫你接好！';
      if (state.phase === 'rescue' && state.action === 'returning') instruction = state.passenger ? '接到了，慢慢回到地面' : '火熄滅了，準備接大家下來';
      if (state.phase === 'rescue' && state.action === 'working') instruction = state.passenger === 'cat' ? '小貓跳進工作籃了' : '消防員陪居民一起下來';
      if (state.phase === 'rescue' && state.action === 'unloading') instruction = '回到地面，平安了！';
      label('.house-instruction', instruction);
      label('.house-detail', isSpraying(state) ? state.phase === 'ground-fire' ? `地面火點 · ${extinguished} / 3` : '屋簷最後一處火點' : state.phase === 'rescue' ? `平安回到地面 · ${rescued} / 2` : '');
      app.querySelector<HTMLElement>('.rescue-tally')!.hidden = stages.indexOf(state.phase) < 6;
      app.querySelectorAll<HTMLElement>('[data-rescue]').forEach((node, i) => { node.dataset.done = String(state.rescued[i]); node.querySelector('b')!.textContent = state.rescued[i] ? '✓' : '○'; });
      app.querySelector<HTMLElement>('.finish-actions')!.hidden = state.phase !== 'complete';
      app.querySelector<HTMLElement>('.hospital-arrival')!.hidden = state.phase !== 'complete';
      scene.canvas.style.cursor = state.action === 'dragging' ? isSpraying(state) ? 'crosshair' : 'grabbing' : state.action === 'ready' && state.phase !== 'complete' ? 'grab' : 'default';
      if (displayed !== state.phase) {
        const index = stages.indexOf(state.phase), active = index < 3 ? 0 : index < 8 ? 1 : 2;
        label('#vehicle-name', names[state.phase]); app.querySelector('.badge-icon')!.innerHTML = Object.values(icons)[active];
        app.querySelectorAll<HTMLElement>('[data-step]').forEach((node, i) => { node.dataset.state = state.phase === 'complete' || i < active ? 'done' : i === active ? 'active' : 'upcoming'; });
        if (select) select.value = state.phase; displayed = state.phase;
      }
      if (dev) { label('#phase', names[state.phase]); label('#action', state.action); label('#extinguished', `${extinguished} / 4`); label('#rescued', `${rescued} / 2`); }
      if (now - saved > 800) { save(); saved = now; }
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => { pointer.cancel(); save(); cancelAnimationFrame(frame); audio.setSpraying(false); events.abort(); hint.dispose(); };
  }
  return { connect, save };
}
