import { loadProgress, saveProgress, markCompleted, isMuted, setMuted } from '../../app/progress.ts';
import { Effect } from 'effect';
import type { createAudio } from '../../runtime/audio.ts';
import { bindPrimaryDrag } from '../../runtime/pointer.ts';
import { createDragHint } from '../../runtime/drag-hint.ts';
import type { roadSounds } from './sounds.ts';
import { restoreDevelopment, restoreRoadSnapshot, saveDevelopment } from './devtools.ts';
type ViteHotContext = NonNullable<ImportMeta['hot']>;
import type { createScene } from './scene.ts';
import { defaultTuning, input as truckInput, pose } from './domain/dump-truck.ts';
import type { Tuning } from './domain/dump-truck.ts';
import { HOME, CARRY_HEIGHT, grabBucket, hasBucketLoad, moveBucket, overTruck, releaseBucket, tapBucketTarget } from './domain/excavator.ts';
import type { Point } from './domain/excavator.ts';
import { advanceRoad, createRoad, stages, grabHauler, moveHauler, releaseHauler, grabRoller, moveRoller, releaseRoller, roadPose } from './domain/road.ts';
import type { EntryStage, RoadState, MissionPhase } from './domain/road.ts';
import { mountUI, icons } from './ui.ts';

export function createRoadSession(app: HTMLDivElement, dev: boolean, hot?: ViteHotContext, onHome: () => void = () => {}, fresh = false) {
  const bootStartedAt = performance.now();
  const params = new URLSearchParams(location.search);
  document.body.dataset.dev = String(dev);
  mountUI(app, dev);
  const queryStage = dev && !fresh ? params.get('stage') : null;
  // Preserve existing truck experiment bookmarks; a plain URL starts the whole road mission.
  const entry: EntryStage = stages.includes(queryStage as EntryStage) ? queryStage as EntryStage : queryStage === 'ready' || queryStage === 'dumping' ? 'dump-truck' : 'excavator';
  let state = createRoad(entry);
  if (queryStage === 'ready' || queryStage === 'dumping') {
    state.truck.phase = queryStage;
    state.access = 'working';
  }
  let tuning = { ...defaultTuning };
  let targetStage: EntryStage = entry;
  const snapshotKey = `town-crew:road:v2:${location.search}`;
  if (dev && !fresh) {
    const restored = restoreDevelopment(snapshotKey, hot);
    if (restored) ({ state, tuning, targetStage } = restored);
  }
  if (!dev && !fresh) {
    const restored = restoreRoadSnapshot(loadProgress('road-repair'), 'play');
    if (restored) ({ state, tuning, targetStage } = restored);
  }
  function save() {
    if (dev) saveDevelopment({ key: snapshotKey, state, tuning, targetStage }, hot);
    else saveProgress('road-repair', { key: 'play', state, tuning, targetStage });
  }
  function ready() {
    if (state.access !== 'working') return false;
    return state.phase === 'excavator' ? ['ready', 'carrying'].includes(state.excavator.action) : state.phase === 'haul-away' ? state.hauler.action === 'ready' : state.phase === 'dump-truck' ? state.truck.phase === 'ready' : state.phase === 'roller' && state.roller.action === 'ready';
  }
  function action() {
    if (state.phase !== 'traffic' && state.phase !== 'complete' && state.access !== 'working') return state.access;
    return state.phase === 'excavator' ? state.excavator.action : state.phase === 'haul-away' ? state.hauler.action : state.phase === 'dump-truck' ? state.truck.phase : state.phase === 'roller' ? state.roller.action : state.phase;
  }
  function connect(scene: ReturnType<typeof createScene>, audio: ReturnType<typeof createAudio<keyof typeof roadSounds>>) {
    const events = new AbortController();
    const options = { signal: events.signal };
    const canvas = scene.canvas;
    const dragHint = createDragHint(app.querySelector<HTMLElement>('.world')!);
    const gestureCaption = app.querySelector<HTMLElement>('.gesture-caption')!;
    const bucketGrip = app.querySelector<HTMLElement>('.excavator-grip')!;
    const dropTarget = app.querySelector<HTMLElement>('.excavator-drop')!;
    let bucketSelected = false, lastBucketInput = -Infinity;
    let muted = isMuted(), frame = 0, firstReady = false;
    audio.setMuted(muted);
    let previousTime = performance.now(), visualTime = 0, lastSave = 0;
    const progress = app.querySelector<HTMLElement>('.progress')!;
    const fillBar = app.querySelector<HTMLElement>('.progress span')!;
    const success = app.querySelector<HTMLElement>('.success')!;
    const phaseNames = { excavator: '挖土機 · 清除舊路面', 'haul-away': '清運車 · 載走舊路面', 'dump-truck': '運料車 · 補好道路', roller: '壓路機 · 壓平路面', traffic: '開放通車', complete: '道路修好了！' };
    const actions: Record<string, string> = { 'opening-entry': '移開入口路障', 'closing-entry': '封閉施工區', 'opening-exit': '開放工程車離場', leaving: '工程車離場', entering: '進場', ready: '等待操作', dragging: '跟手拖曳', scooping: '挖起舊路面', unloading: '裝入清運車', returning: '挖斗復位', resetting: '車斗復位', dumping: '填補路基', lowering: '鋪上路面材料', settling: '第一趟完成', flattening: '整平路面', complete: '完成', traffic: '移開路障／通車' };
    const stageSelect = app.querySelector<HTMLSelectElement>('#stage');
    if (stageSelect) stageSelect.value = targetStage;
    const threshold = app.querySelector<HTMLInputElement>('#threshold');
    const tilt = app.querySelector<HTMLInputElement>('#tilt');
    const duration = app.querySelector<HTMLInputElement>('#duration');
    function setState(next: RoadState) {
      if (next.excavator.action === 'scooping' && state.excavator.action !== 'scooping') audio.play('scoop');
      if (next.excavator.cleared > state.excavator.cleared) { audio.play('dump'); bucketSelected = false; }
      if (state.excavator.action === 'scooping' && next.excavator.action === 'carrying-drag') {
        // The automatic lift changes height. Re-anchor at the held finger so
        // the next movement continues smoothly instead of snapping backwards.
        const context = pointer.context();
        if (context?.phase === 'excavator') {
          context.height = CARRY_HEIGHT;
          const point = scene.onPlane(context.lastX, context.lastY, context.height);
          if (point) context.offset = { x: next.excavator.bucket.x - point.x, y: 0, z: next.excavator.bucket.z - point.z };
          if (scene.excavationTargetHit(context.lastX, context.lastY, next)) {
            next = { ...next, excavator: moveBucket(next.excavator, scene.excavationAim(context.lastX, context.lastY, next, next.excavator.bucket)) };
          }
        }
      }
      if (next.truck.phase === 'dumping' && state.truck.phase !== 'dumping') audio.play('dump');
      if (next.roller.passes > state.roller.passes) audio.play('compact');
      if (next.phase === 'traffic' && next.elapsed >= 2.05 && state.elapsed < 2.05) audio.play('horn');
      if (next.phase === 'complete' && state.phase !== 'complete') { audio.play('complete'); if (!dev) markCompleted('road-repair'); }
      state = next;
    }
    function unlock() {
      try {
        const promise = audio.unlock(); // Call synchronously inside the actual user gesture.
        void Effect.runPromise(Effect.tryPromise(() => promise).pipe(Effect.catch(() => Effect.void)));
      } catch { /* A missing audio device must not block the game. */ }
    }
    const pointer = bindPrimaryDrag<{ phase: MissionPhase; startX: number; startY: number; lastX: number; lastY: number; height: number; offset: Point; moved: boolean; destination: boolean }>(canvas, {
      start(event) {
        unlock();
        if (!ready()) return;
        const destination = state.phase === 'excavator' && bucketSelected && scene.excavationTargetHit(event.clientX, event.clientY, state);
        if (!destination && !scene.hit(event.clientX, event.clientY, state)) return;
        const height = state.phase === 'haul-away' ? 1.1 : state.phase === 'roller' ? 1.2 : hasBucketLoad(state.excavator) ? CARRY_HEIGHT : HOME.y;
        const point = scene.onPlane(event.clientX, event.clientY, height);
        if (!point) return;
        const context = {
          phase: state.phase, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, height, moved: false, destination,
          offset: state.phase === 'excavator'
            ? { x: state.excavator.bucket.x - point.x, y: 0, z: state.excavator.bucket.z - point.z }
            : { x: (state.phase === 'haul-away' ? state.hauler.x : state.roller.x) - point.x, y: 0, z: 0 },
        };
        if (state.phase === 'excavator') {
          lastBucketInput = visualTime;
          if (!destination) { bucketSelected = false; setState({ ...state, excavator: grabBucket(state.excavator) }); }
        }
        if (state.phase === 'haul-away') setState(grabHauler(state));
        if (state.phase === 'dump-truck') setState({ ...state, truck: truckInput(state.truck, { type: 'grab' }, tuning) });
        if (state.phase === 'roller') setState({ ...state, roller: grabRoller(state.roller) });
        audio.play('grab');
        return context;
      },
      move(event, context) {
        if (context.phase !== state.phase) return;
        context.lastX = event.clientX; context.lastY = event.clientY;
        context.moved ||= Math.hypot(event.clientX - context.startX, event.clientY - context.startY) > 8;
        if (state.phase === 'excavator') {
          lastBucketInput = visualTime;
          if (context.destination || !context.moved) return;
        }
        if (state.phase === 'dump-truck') {
          setState({ ...state, truck: truckInput(state.truck, { type: 'drag', upwardPx: context.startY - event.clientY }, tuning) });
        } else {
          const point = scene.onPlane(event.clientX, event.clientY, context.height);
          if (!point) return;
          if (state.phase === 'excavator') setState({ ...state, excavator: moveBucket(state.excavator, scene.excavationAim(event.clientX, event.clientY, state, { x: point.x + context.offset.x, y: context.height, z: point.z + context.offset.z })) });
          if (state.phase === 'haul-away') setState(moveHauler(state, point.x + context.offset.x));
          if (state.phase === 'roller') setState({ ...state, roller: moveRoller(state.roller, point.x + context.offset.x) });
        }
      },
      end(context, cancelled) {
        if (context.phase !== state.phase) return;
        if (state.phase === 'excavator') {
          lastBucketInput = visualTime;
          if (context.destination) {
            if (!cancelled && !context.moved) setState({ ...state, excavator: tapBucketTarget(state.excavator) });
            else bucketSelected = false;
            return;
          }
          bucketSelected = !cancelled && !context.moved;
          setState({ ...state, excavator: releaseBucket(state.excavator, cancelled || !context.moved) });
          return;
        }
        setState(releaseHauler({ ...state, truck: truckInput(state.truck, { type: cancelled ? 'cancel' : 'release' }, tuning), roller: releaseRoller(state.roller) }));
      },
    }, events.signal);
    const cancelPointer = pointer.cancel;
    canvas.addEventListener('keydown', event => {
      if (state.phase !== 'excavator') return;
      if (event.key === 'Escape') { cancelPointer(); bucketSelected = false; return; }
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      if (event.repeat || pointer.context() || !ready()) return;
      unlock(); lastBucketInput = visualTime;
      if (bucketSelected) setState({ ...state, excavator: tapBucketTarget(state.excavator) });
      else { bucketSelected = true; audio.play('grab'); }
    }, options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); previousTime = performance.now(); }, options);
    window.addEventListener('pagehide', save, options);
    app.querySelectorAll('.restart, .finish-restart').forEach(button => button.addEventListener('click', () => { unlock(); cancelPointer(); bucketSelected = false; lastBucketInput = -Infinity; state = createRoad(); save(); }, options));
    app.querySelectorAll('.home, .finish-home').forEach(button => button.addEventListener('click', () => { cancelPointer(); save(); onHome(); }, options));
    const soundButton = app.querySelector<HTMLButtonElement>('.sound')!;
    soundButton.textContent = muted ? '♩' : '♪';
    soundButton.setAttribute('aria-pressed', String(muted));
    soundButton.setAttribute('aria-label', muted ? '開啟音效' : '關閉音效');
    soundButton.addEventListener('click', () => {
      unlock(); muted = !muted; audio.setMuted(muted); setMuted(muted);
      soundButton.textContent = muted ? '♩' : '♪';
      soundButton.setAttribute('aria-pressed', String(muted));
      soundButton.setAttribute('aria-label', muted ? '開啟音效' : '關閉音效');
    }, options);
    function jump(stage: EntryStage) { cancelPointer(); bucketSelected = false; lastBucketInput = -Infinity; state = createRoad(stage); save(); }
    stageSelect?.addEventListener('change', () => { targetStage = stageSelect.value as EntryStage; jump(targetStage); }, options);
    app.querySelector('.reset-stage')?.addEventListener('click', () => jump(targetStage), options);
    function label(selector: string, text: string) { const element = app.querySelector(selector); if (element && element.textContent !== text) element.textContent = text; }
    function syncTuning() {
      if (!threshold || !tilt || !duration) return;
      threshold.value = String(tuning.dragThreshold); tilt.value = String(Math.round(tuning.dumpTilt * 180 / Math.PI)); duration.value = String(tuning.dumpDuration);
      label('#threshold-value', `${tuning.dragThreshold} px`); label('#tilt-value', `${Math.round(tuning.dumpTilt * 180 / Math.PI)}°`); label('#duration-value', `${tuning.dumpDuration.toFixed(2)} s`);
    }
    for (const slider of [threshold, tilt, duration]) slider?.addEventListener('input', () => {
      tuning = { ...tuning, dragThreshold: Number(threshold!.value), dumpTilt: Number(tilt!.value) * Math.PI / 180, dumpDuration: Number(duration!.value) };
      syncTuning(); save();
    }, options);
    app.querySelector('.reset-tuning')?.addEventListener('click', () => { tuning = { ...defaultTuning }; syncTuning(); save(); }, options);
    syncTuning();
    app.querySelector('.loading')?.remove();
    let displayedPhase: MissionPhase | undefined;
    function animate(now: number) {
      const delta = document.hidden ? 0 : Math.min((now - previousTime) / 1000, 0.1);
      previousTime = now; visualTime += delta;
      setState(advanceRoad(state, delta, tuning));
      if (pointer.context() && pointer.context()!.phase !== state.phase) cancelPointer();
      scene.render(state, tuning, visualTime);
      const excavating = state.phase === 'excavator' && state.access === 'working';
      const loaded = hasBucketLoad(state.excavator);
      const canDrop = state.excavator.action === 'carrying-drag' && overTruck(state.excavator.target);
      const hideHint = state.phase === 'excavator' && (!!pointer.context() || visualTime - lastBucketInput < 3);
      dragHint.update(hideHint ? undefined : scene.dragHint(state, tuning), visualTime);
      bucketGrip.hidden = !excavating || !ready();
      dropTarget.hidden = !excavating || !['carrying', 'carrying-drag'].includes(state.excavator.action);
      if (excavating) {
        const { from, to, gripSize, width, height } = scene.excavationControls(state);
        bucketGrip.style.left = `${from.x}px`; bucketGrip.style.top = `${from.y}px`;
        bucketGrip.style.width = bucketGrip.style.height = `${gripSize}px`;
        bucketGrip.dataset.selected = String(bucketSelected);
        dropTarget.style.left = `${to.x}px`; dropTarget.style.top = `${to.y}px`;
        dropTarget.style.width = `${width}px`; dropTarget.style.height = `${height}px`;
        dropTarget.dataset.ready = String(canDrop);
        dropTarget.firstElementChild!.textContent = canDrop ? '✓' : '↓';
      }
      canvas.tabIndex = state.phase === 'excavator' ? 0 : -1;
      app.querySelector<HTMLElement>('#excavator-keyboard-help')!.hidden = state.phase !== 'excavator';
      if (state.phase === 'excavator') canvas.setAttribute('aria-describedby', 'excavator-keyboard-help');
      else canvas.removeAttribute('aria-describedby');
      gestureCaption.hidden = state.access !== 'working' || !['ready', 'dragging', 'carrying', 'carrying-drag'].includes(action());
      const bucketInstruction = bucketSelected ? loaded ? '點一下車斗，倒進去' : '點一下破損路面，挖起來'
        : canDrop ? '放開，倒進車斗' : loaded ? '拖到車斗，放開' : '拖過去，挖起來';
      label('.gesture-instruction', state.phase === 'excavator' ? bucketInstruction : state.phase === 'haul-away' ? '按住清運車，往左拖，把舊路面載走' : state.phase === 'dump-truck' ? '按住車斗前端，往上拉' : state.roller.passes === 0 ? '按住車子，往右拖' : '按住車子，往左拖');
      app.dataset.phase = state.phase; app.dataset.action = action();
      app.dataset.cleared = String(state.excavator.cleared); app.dataset.passes = String(state.roller.passes);
      app.dataset.haulX = String(state.hauler.x); app.dataset.loaded = String(state.hauler.action === 'complete' ? 0 : state.excavator.cleared);
      app.dataset.bucketLoaded = String(loaded); app.dataset.bucketSelected = String(bucketSelected);
      const progressValue = roadPose(state, tuning).progress;
      fillBar.style.transform = `scaleX(${progressValue})`;
      progress.setAttribute('aria-valuenow', String(Math.round(progressValue * 100)));
      success.hidden = state.phase !== 'complete';
      app.querySelector<HTMLElement>('.finish-actions')!.hidden = state.phase !== 'complete';
      canvas.style.cursor = ['dragging', 'carrying-drag'].includes(action()) ? 'grabbing' : ready() ? 'grab' : 'default';
      if (stageSelect) {
        targetStage = state.phase === 'roller' && state.roller.passes > 0 ? 'roller-return' : state.phase;
        stageSelect.value = targetStage;
      }
      if (displayedPhase !== state.phase) {
        label('#vehicle-name', phaseNames[state.phase]);
        app.querySelector('.badge-icon')!.innerHTML = icons[state.phase as keyof typeof icons] ?? '<span aria-hidden="true">✓</span>';
        const current = ['excavator', 'haul-away', 'dump-truck', 'roller'].indexOf(state.phase);
        app.querySelectorAll<HTMLElement>('[data-step]').forEach((element, i) => { element.dataset.state = current < 0 || i < current ? 'done' : i === current ? 'active' : 'upcoming'; });
        displayedPhase = state.phase;
      }
      if (dev) {
        label('#phase', phaseNames[state.phase]); label('#action', actions[action()] ?? action());
        label('#rocks', `${state.excavator.cleared} / 3`); label('#passes', `${state.roller.passes} / 2`);
        label('#angle', state.phase === 'dump-truck' ? `${Math.round(pose(state.truck, tuning).tilt * 180 / Math.PI)}°` : '—');
        if (!firstReady && ready()) { label('#boot-time', `${Math.round(now - bootStartedAt)} ms`); firstReady = true; }
      }
      if (now - lastSave > 800) { save(); lastSave = now; }
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => { cancelPointer(); save(); cancelAnimationFrame(frame); events.abort(); dragHint.dispose(); };
  }
  return { connect, save };
}
