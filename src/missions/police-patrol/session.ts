import { bindPrimaryDrag } from '../../runtime/pointer.ts';
import { createDragHint } from '../../runtime/drag-hint.ts';
import { createAudio } from '../../runtime/audio.ts';
import { loadProgress, saveProgress, markCompleted, isMuted, setMuted } from '../../app/progress.ts';
import { createPolice, chooseRound, validRound, resumePolice, stages, available, grab, drive, release, advance, progress } from './domain/police.ts';
import type { Round, Stage, Vehicle, PoliceState } from './domain/police.ts';
import type { createPoliceScene } from './scene.ts';
import { mountPoliceUI, names, instruction } from './ui.ts';
import { patrolIcon, bikeIcon, vanIcon } from '../../app/police-art.ts';
export const createPoliceAudio = () => createAudio({ arrival: [440, 554, 440], parked: [440, 660], depart: [392, 523], complete: [523, 659, 784, 1047] });
const roundKey = 'town-crew:police:last-round:v1'; let previousRound: Round | undefined;
function newRound(previous?: Round) {
  try { const saved: unknown = JSON.parse(sessionStorage.getItem(roundKey) ?? 'null'); if (validRound(saved)) previousRound = saved; } catch { /* Optional storage. */ }
  previousRound = chooseRound(previous ?? previousRound);
  try { sessionStorage.setItem(roundKey, JSON.stringify(previousRound)); } catch { /* Optional storage. */ }
  return previousRound;
}
export function createPoliceSession(app: HTMLDivElement, dev: boolean, onHome: () => void, fresh = false) {
  const params = new URLSearchParams(location.search), query = params.get('stage'), phase: Stage = dev && !fresh && stages.includes(query as Stage) ? query as Stage : 'intro';
  const devKey = `town-crew:police:dev:v1:${location.search}`;
  let restored: PoliceState | undefined;
  try { if (!fresh) restored = resumePolice(dev ? JSON.parse(sessionStorage.getItem(devKey) ?? 'null') : loadProgress('police-patrol')); } catch { /* Optional storage. */ }
  const configured = Number(params.get('layout') ?? 0);
  let state = restored ?? createPolice(phase, dev ? { layout: Number.isInteger(configured) && configured >= 0 && configured < 4 ? configured : 0, color: 0, body: 'car', bag: 0 } : newRound());
  function save() { if (dev) { try { sessionStorage.setItem(devKey, JSON.stringify(state)); } catch { /* Optional storage. */ } } else saveProgress('police-patrol', state); }
  mountPoliceUI(app, dev);
  function connect(scene: ReturnType<typeof createPoliceScene>, audio: ReturnType<typeof createPoliceAudio>) {
    const events = new AbortController(), options = { signal: events.signal }, hint = createDragHint(app.querySelector<HTMLElement>('.world')!);
    let frame = 0, previous = performance.now(), time = 0, saved = 0, muted = isMuted(), preferred: Vehicle = 'bike0'; audio.setMuted(muted);
    function unlock() { try { void audio.unlock().catch(() => {}); } catch { /* Audio is optional. */ } }
    function update(next: PoliceState) {
      if (next === state) return;
      if (next.phase !== state.phase || next.order.length > state.order.length) audio.play(next.phase === 'complete' ? 'complete' : next.phase === 'transport' ? 'depart' : 'parked');
      if (next.phase === 'complete' && state.phase !== 'complete' && !dev) markCompleted('police-patrol');
      state = next;
    }
    const pointer = bindPrimaryDrag<{ phase: Stage; vehicle: Vehicle; value: number; origin: { x: number; y: number }; offset: { x: number; y: number } }>(scene.canvas, {
      start(event) {
        unlock(); const vehicle = scene.hit(event.clientX, event.clientY, state); if (!vehicle) return;
        const { from, value } = scene.task(state, vehicle), r = scene.canvas.getBoundingClientRect();
        update(grab(state, vehicle)); preferred = vehicle;
        return { phase: state.phase, vehicle, value, origin: { x: event.clientX, y: event.clientY }, offset: { x: r.x + from.x - event.clientX, y: r.y + from.y - event.clientY } };
      },
      move(event, held) {
        if (state.phase !== held.phase || state.active !== held.vehicle || state.action !== 'dragging') return;
        if (Math.hypot(event.clientX - held.origin.x, event.clientY - held.origin.y) < 10) return;
        update(drive(state, scene.target(state, held.vehicle, { x: event.clientX + held.offset.x, y: event.clientY + held.offset.y }, held.value)));
      },
      end(held, cancelled) { if (state.phase === held.phase && state.active === held.vehicle) update(release(state, cancelled)); save(); },
    }, events.signal);
    const restart = () => { unlock(); pointer.cancel(); state = createPolice('intro', dev ? chooseRound(state.round) : newRound(state.round)); preferred = 'bike0'; save(); };
    app.querySelectorAll('.restart, .finish-restart').forEach(b => b.addEventListener('click', restart, options));
    app.querySelectorAll('.home, .finish-home').forEach(b => b.addEventListener('click', () => { pointer.cancel(); save(); onHome(); }, options));
    app.querySelectorAll<HTMLButtonElement>('[data-bike]').forEach(b => b.addEventListener('click', () => { preferred = b.dataset.bike as Vehicle; unlock(); }, options));
    const sound = app.querySelector<HTMLButtonElement>('.sound')!;
    function syncSound() { sound.textContent = muted ? '♩' : '♪'; sound.setAttribute('aria-pressed', String(muted)); sound.setAttribute('aria-label', muted ? '開啟音效' : '關閉音效'); }
    syncSound(); sound.addEventListener('click', () => { unlock(); muted = !muted; setMuted(muted); audio.setMuted(muted); syncSound(); }, options);
    const select = app.querySelector<HTMLSelectElement>('#stage'), layout = app.querySelector<HTMLSelectElement>('#layout');
    const reset = () => { pointer.cancel(); state = createPolice(select!.value as Stage, { ...state.round, layout: Number(layout!.value) }); save(); };
    select?.addEventListener('change', reset, options); layout?.addEventListener('change', reset, options); app.querySelector('.reset-stage')?.addEventListener('click', reset, options);
    document.addEventListener('visibilitychange', () => { previous = performance.now(); if (document.hidden) save(); }, options); window.addEventListener('pagehide', save, options);
    app.querySelector('.loading')!.remove();
    const targetHost = app.querySelector<HTMLElement>('.police-targets')!;
    let targetKey = '', displayed: Stage | undefined;
    const label = (selector: string, text: string) => { const node = app.querySelector(selector)!; if (node.textContent !== text) node.textContent = text; };
    function animate(now: number) {
      const dt = document.hidden ? 0 : Math.min((now - previous) / 1000, 0.1); previous = now; time += dt; update(advance(state, dt));
      const held = pointer.context(); if (held && (held.phase !== state.phase || state.action !== 'dragging' || held.vehicle !== state.active)) pointer.cancel();
      scene.render(state, time, preferred); hint.update(scene.hint(state, preferred), time);
      const eligible = available(state), chosen = state.active ?? (eligible.includes(preferred) ? preferred : eligible[0]);
      const infos = (chosen ? [chosen] : []).map(v => scene.task(state, v));
      const key = infos.map(t => `${t.vehicle}:${t.key}`).join(',');
      if (key !== targetKey) { targetHost.innerHTML = infos.map(t => `<div class="fire-target police-target" role="img" aria-label="目的地：${t.key === 'door' ? '打開側門' : t.vehicle === 'van' ? '偵防車' : t.vehicle === 'police' ? '警車' : t.vehicle === 'bike0' ? '一號重機' : '二號重機'}" data-goal="${t.vehicle}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" pathLength="1"/></svg><span>${t.key === 'door' ? '拉開' : t.key === 'lead' || t.key === 'escort' ? '出發' : '停這裡'}</span></div>`).join(''); targetKey = key; }
      for (const info of infos) {
        const node = targetHost.firstElementChild as HTMLElement; node.style.left = `${info.to.x}px`; node.style.top = `${info.to.y}px`; node.dataset.ready = String(info.value === 1);
        node.querySelector('circle')!.style.strokeDashoffset = String(1 - Math.min(1, state.elapsed / 0.4));
      }
      app.dataset.phase = state.phase; app.dataset.action = state.action; app.dataset.layout = String(state.round.layout); app.dataset.body = state.round.body; app.dataset.color = String(state.round.color); app.dataset.order = state.order.join(','); app.dataset.work = JSON.stringify(state.work); app.dataset.active = state.active ?? '';
      const value = progress(state); app.querySelector<HTMLElement>('.progress span')!.style.transform = `scaleX(${value})`; app.querySelector('.progress')!.setAttribute('aria-valuenow', String(Math.round(value * 100)));
      label('.house-instruction', instruction(state)); label('.house-detail', state.phase === 'bikes' ? `包抄到位 · ${state.order.length} / 2` : state.phase === 'intro' ? '警車・重機・偵防車，一起合作' : '');
      const picker = app.querySelector<HTMLElement>('.bike-picker')!; picker.hidden = state.phase !== 'bikes' || state.action !== 'ready';
      picker.querySelectorAll<HTMLButtonElement>('button').forEach(b => { const v = b.dataset.bike as Vehicle; b.disabled = !eligible.includes(v); b.setAttribute('aria-pressed', String(chosen === v)); b.querySelector('span')!.textContent = eligible.includes(v) ? v === 'bike0' ? '1' : '2' : '✓'; });
      app.querySelector<HTMLElement>('.finish-actions')!.hidden = state.phase !== 'complete'; app.querySelector<HTMLElement>('.police-arrival')!.hidden = state.phase !== 'complete';
      scene.canvas.style.cursor = state.action === 'dragging' ? 'grabbing' : eligible.length ? 'grab' : 'default';
      app.querySelectorAll<HTMLElement>('[data-step]').forEach((node, n) => {
        const done = n === 0 ? state.work.follow === 1 : n === 1 ? state.order.includes('bike0') : n === 2 ? state.order.includes('bike1') : state.work.escort === 1;
        node.dataset.state = chosen === (['police', 'bike0', 'bike1', 'van'] as const)[n] ? 'active' : done ? 'done' : 'upcoming';
      });
      if (displayed !== state.phase) {
        label('#vehicle-name', names[state.phase]); app.querySelector('.badge-icon')!.innerHTML = ['bikes', 'lead'].includes(state.phase) ? bikeIcon : ['van', 'door', 'boarding', 'transport'].includes(state.phase) ? vanIcon : patrolIcon;
        if (select) select.value = state.phase; displayed = state.phase;
      }
      if (dev) { label('#phase', names[state.phase]); label('#action', state.action); layout!.value = String(state.round.layout); }
      if (now - saved > 700) { save(); saved = now; } frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => { pointer.cancel(); save(); cancelAnimationFrame(frame); events.abort(); hint.dispose(); };
  }
  return { connect, save };
}
