import { Effect, Exit } from 'effect';
import { createStartupDiagnostics } from './runtime/mission-startup.ts';
import { loadMissionModule, missionFailureMessage } from './runtime/mission-lifecycle.ts';
import { createAudio } from './runtime/audio.ts';
import { mountMenu } from './app/menu.ts';
import type { MissionId } from './app/progress.ts';
import { clearProgress } from './app/progress.ts';
import { registerPwa } from './app/pwa.ts';
import { createNavigation } from './app/navigation.ts';
import './style.css';

const stopPwa = registerPwa();
const app = document.querySelector<HTMLDivElement>('#app')!;
const params = new URLSearchParams(location.search);
const dev = import.meta.env.DEV && params.get('dev') === '1';
const navigation = createNavigation(import.meta.hot?.data.cleanup);
let fromMenu = false;
const events = new AbortController();
function route(): MissionId | undefined {
  if (location.hash === '#menu') return;
  if (location.hash === '#house-build') return 'house-build';
  if (location.hash === '#road-repair') return 'road-repair';
  if (location.hash === '#traffic-rescue') return 'traffic-rescue';
  if (location.hash === '#police-patrol') return 'police-patrol';
  if (location.hash === '#fire-rescue') return 'fire-rescue';
  if (location.hash === '#port-cargo') return 'port-cargo';
  if (location.hash === '#mountain-clearance') return 'mountain-clearance';
  if (location.hash === '#passenger-transfer') return 'passenger-transfer';
  if (dev && params.get('mission') === 'passenger-transfer') return 'passenger-transfer';
  if (dev && params.get('mission') === 'mountain-clearance') return 'mountain-clearance';
  if (dev && params.get('mission') === 'port-cargo') return 'port-cargo';
  if (dev && params.get('mission') === 'police-patrol') return 'police-patrol';
  if (dev && params.get('mission') === 'traffic-rescue') return 'traffic-rescue';
  if (dev) return params.get('mission') === 'fire-rescue' ? 'fire-rescue' : params.get('mission') === 'house-build' ? 'house-build' : 'road-repair';
}
function home() { location.hash = 'menu'; }
function show() {
  return navigation.show(isCurrent => Effect.gen(function* () {
    for (const key of Object.keys(app.dataset)) delete app.dataset[key];
    const mission = route();
    document.body.dataset.dev = String(dev && !!mission);
    if (!mission) {
      fromMenu = true;
      app.dataset.screen = 'menu';
      yield* Effect.acquireRelease(Effect.sync(() => mountMenu(app, id => { location.hash = id; })), dispose => Effect.sync(dispose));
      return yield* Effect.never;
    }
    const fresh = fromMenu; fromMenu = false;
    // The old scope has finished saving before a selection starts a new round.
    if (fresh) clearProgress(mission);
    app.dataset.screen = 'mission'; app.dataset.mission = mission;
    app.innerHTML = '<div class="loading" role="status">小小城市隊準備出發…</div>';
    const diagnostics = createStartupDiagnostics(mission, dev);
    const program = Effect.scoped(Effect.gen(function* () {
      if (mission === 'road-repair') {
        const trace = diagnostics;
        const run = yield* trace.startup(Effect.gen(function* () {
          const [{ createScene }, { prepareRoadMission, RoadPersistenceLive }, { roadSounds }] = yield* Effect.all([
            trace.stage('module.scene', loadMissionModule(mission, 'scene', () => import('./missions/road-repair/scene.ts'))),
            trace.stage('module.session', loadMissionModule(mission, 'session', () => import('./missions/road-repair/startup.ts'))),
            trace.stage('module.sounds', loadMissionModule(mission, 'sounds', () => import('./missions/road-repair/sounds.ts'))),
          ], { concurrency: 'unbounded' });
          return yield* prepareRoadMission({ app, dev, hot: import.meta.hot, home, fresh }, createScene, () => createAudio(roadSounds), trace).pipe(
            Effect.provide(RoadPersistenceLive),
          );
        }));
        yield* run;
      } else if (mission === 'house-build') {
        const trace = diagnostics;
        const run = yield* trace.startup(Effect.gen(function* () {
          const [{ createHouseScene }, { prepareHouseMission, HousePersistenceLive, houseSounds }] = yield* Effect.all([
            trace.stage('module.scene', loadMissionModule(mission, 'scene', () => import('./missions/house-build/scene.ts'))),
            trace.stage('module.session', loadMissionModule(mission, 'session', () => import('./missions/house-build/startup.ts'))),
          ], { concurrency: 'unbounded' });
          return yield* prepareHouseMission({ app, dev, home, fresh }, createHouseScene, () => createAudio(houseSounds), trace).pipe(
            Effect.provide(HousePersistenceLive),
          );
        }));
        yield* run;
      } else if (mission === 'traffic-rescue') {
        const trace = diagnostics;
        const run = yield* trace.startup(Effect.gen(function* () {
          const [{ createTrafficScene }, { prepareTrafficMission, TrafficPersistenceLive, createTrafficAudio }] = yield* Effect.all([
            trace.stage('module.scene', loadMissionModule(mission, 'scene', () => import('./missions/traffic-rescue/scene.ts'))),
            trace.stage('module.session', loadMissionModule(mission, 'session', () => import('./missions/traffic-rescue/startup.ts'))),
          ], { concurrency: 'unbounded' });
          return yield* prepareTrafficMission({ app, dev, home, fresh }, createTrafficScene, createTrafficAudio, trace).pipe(
            Effect.provide(TrafficPersistenceLive),
          );
        }));
        yield* run;
      } else if (mission === 'police-patrol') {
        const trace = diagnostics;
        const run = yield* trace.startup(Effect.gen(function* () {
          const [{ createPoliceScene }, { preparePoliceMission, PolicePersistenceLive, createPoliceAudio }] = yield* Effect.all([
            trace.stage('module.scene', loadMissionModule(mission, 'scene', () => import('./missions/police-patrol/scene.ts'))),
            trace.stage('module.session', loadMissionModule(mission, 'session', () => import('./missions/police-patrol/startup.ts'))),
          ], { concurrency: 'unbounded' });
          return yield* preparePoliceMission({ app, dev, home, fresh }, createPoliceScene, createPoliceAudio, trace).pipe(
            Effect.provide(PolicePersistenceLive),
          );
        }));
        yield* run;
      } else if (mission === 'port-cargo') {
        const trace = diagnostics;
        const run = yield* trace.startup(Effect.gen(function* () {
          const [{ createPortScene }, { preparePortMission, PortPersistenceLive, createPortAudio }] = yield* Effect.all([
            trace.stage('module.scene', loadMissionModule(mission, 'scene', () => import('./missions/port-cargo/scene.ts'))),
            trace.stage('module.session', loadMissionModule(mission, 'session', () => import('./missions/port-cargo/startup.ts'))),
          ], { concurrency: 'unbounded' });
          return yield* preparePortMission({ app, dev, home, fresh }, createPortScene, createPortAudio, trace).pipe(
            Effect.provide(PortPersistenceLive),
          );
        }));
        yield* run;
      } else if (mission === 'mountain-clearance') {
        const trace = diagnostics;
        const run = yield* trace.startup(Effect.gen(function* () {
          const [{ createMountainScene }, { prepareMountainMission, MountainPersistenceLive, createMountainAudio }] = yield* Effect.all([
            trace.stage('module.scene', loadMissionModule(mission, 'scene', () => import('./missions/mountain-clearance/scene.ts'))),
            trace.stage('module.session', loadMissionModule(mission, 'session', () => import('./missions/mountain-clearance/startup.ts'))),
          ], { concurrency: 'unbounded' });
          return yield* prepareMountainMission({ app, dev, home, fresh }, createMountainScene, createMountainAudio, trace).pipe(
            Effect.provide(MountainPersistenceLive),
          );
        }));
        yield* run;
      } else if (mission === 'passenger-transfer') {
        const trace = diagnostics;
        const run = yield* trace.startup(Effect.gen(function* () {
          const [{ createTransferScene }, { prepareTransferMission, TransferPersistenceLive, createTransferAudio }] = yield* Effect.all([
            trace.stage('module.scene', loadMissionModule(mission, 'scene', () => import('./missions/passenger-transfer/scene.ts'))),
            trace.stage('module.session', loadMissionModule(mission, 'session', () => import('./missions/passenger-transfer/startup.ts'))),
          ], { concurrency: 'unbounded' });
          return yield* prepareTransferMission({ app, dev, home, fresh }, createTransferScene, createTransferAudio, trace).pipe(
            Effect.provide(TransferPersistenceLive),
          );
        }));
        yield* run;
      } else {
        const trace = diagnostics;
        const run = yield* trace.startup(Effect.gen(function* () {
          const [{ createFireScene }, { prepareFireMission, FirePersistenceLive }, { createFireAudio }] = yield* Effect.all([
            trace.stage('module.scene', loadMissionModule(mission, 'scene', () => import('./missions/fire-rescue/scene.ts'))),
            trace.stage('module.session', loadMissionModule(mission, 'session', () => import('./missions/fire-rescue/startup.ts'))),
            trace.stage('module.sounds', loadMissionModule(mission, 'sounds', () => import('./missions/fire-rescue/sounds.ts'))),
          ], { concurrency: 'unbounded' });
          return yield* prepareFireMission({ app, dev, home, fresh }, createFireScene, createFireAudio, trace).pipe(
            Effect.provide(FirePersistenceLive),
          );
        }));
        yield* run;
      }
    }));
    yield* program.pipe(Effect.onExit(exit => Effect.gen(function* () {
      if (Exit.isSuccess(exit)) return;
      const message = missionFailureMessage(exit.cause);
      if (message === undefined) return;
      yield* diagnostics.failure(exit.cause);
      // Cleanup failures must be logged, but an obsolete mission must not replace the UI.
      if (!isCurrent()) return;
      app.innerHTML = `<div class="loading" role="alert">${message}<p><button class="error-home">回到選關</button></p></div>`;
      app.querySelector('.error-home')?.addEventListener('click', home, { signal: events.signal });
    })), Effect.catchCause(() => Effect.void));
  }));
}
window.addEventListener('hashchange', () => { void show(); }, { signal: events.signal });
void show();
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    events.abort();
    import.meta.hot!.data.cleanup = Promise.all([navigation.dispose(), stopPwa()]);
  });
}
