# Town Crew · 小小城市隊

**Play:** [小小城市隊](https://town-crew.pages.dev)

Repair a road and build a two-storey home in two replayable town missions,
using Vite, TypeScript, Three.js and Effect **4.0.0-beta.107**. The game runs in the browser with mouse or single-touch
pointer input and uses procedural 3D models without downloaded game assets.

```sh
npm ci
npm run dev
```

- Choose a mission: <http://localhost:5173/>
- Build a two-storey home: <http://localhost:5173/#house-build>
- Repair the road: <http://localhost:5173/#road-repair>
- Development tools: <http://localhost:5173/?dev=1&stage=excavator>
- Phone/tablet on the same network: use the Network URL printed by Vite.
- `npm run build` checks TypeScript and creates `dist/`.
- Use Node 24 or newer; `.nvmrc` pins the CI/development major version.
- `npm test` runs the domain regression tests with Node's built-in test runner.
- `npm run check` runs domain tests and the production build.
- `npx playwright install chromium` installs the browser for end-to-end tests.
- `npm run test:e2e` tests the production build with mouse and emulated touch.
  Run `npm run build` first; the test runner starts its own preview on port 4173.
- To test a deployed build instead: `PLAYWRIGHT_BASE_URL=https://town-crew.pages.dev npm run test:e2e`.
- `npm run test:e2e:dev` starts Vite on port 5174 and checks stage entry, reload,
  tuning persistence, and HMR without rewriting source.
- To use an installed Chrome instead: `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`.
  No machine-specific runtime paths are required.

## Choose a mission

The entrance has two large illustrated cards. Both missions are available immediately.
Use the home button to return to selection; selecting a mission starts a new round.
Production progress is stored separately for each mission in sessionStorage, so
reloading within the current mission resumes it. Completion badges and the sound preference
use localStorage. No account is required; unavailable storage never blocks play.
Restart clears only the current mission's progress, while its earned badge remains.

## Build a two-storey home

1. Drag the gravel truck's bed upward to fill the prepared foundation.
2. Drag the concrete mixer's chute to each of three wide target rings. Keep it
   over the current target to pour; stopping or cancellation preserves partial filling.
3. Drag the flatbed truck right along the independent foreground lane into its parking bay.
4. The crane automatically picks up each part. Drag toward the actual assembly
   base or ghost outline; the site turns green and a short 0.4-second dwell
   automatically aligns and lowers the load without releasing. Releasing at a
   valid destination also works. Two L-shaped wall
   sections and an upper floor slab complete the first storey.
5. A second flatbed delivery brings the second storey's two wall sections and roof.
   After installing both walls, preview coral, green or blue on the roof waiting on
   the truck. Press the crane button to start the final lift in the chosen colour.
   There are six lifts across the two deliveries, with a celebration after the first floor.
6. The crane leaves the site. Ring the doorbell to welcome the residents. Windows light up,
   residents wave, and the mission can be replayed or left through the selection screen.

Crane loads travel above the completed structure before automatically lowering.
Misses and cancelled placements gently reset without installing a part. Taps and
brief passes through the site do not install a load; a held finger cannot pick up
the next part after automatic placement. Trucks use
clear access routes; the flatbed travels forward on the road in front of the house.

## Repair the road

1. Drag the excavator bucket to the highlighted rock. The fixed-length arm
   follows the finger, then automatically lifts and moves the rock to the side.
   Clear all three rocks. Misses and cancelled drags softly return the bucket.
2. The dump truck enters. Drag upward on the front-to-middle part of the orange
   bed. A tap or short drag returns the bed; crossing 60 CSS pixels starts
   dumping. The rear hinge is excluded from the interactive volume.
3. Drag the roller right across the repair area, then back left. Either pass
   can be paused and resumed. The first pass compresses the material; the second
   leaves a visibly repaired road surface.
4. The construction vehicles leave the road, barriers move aside, and a car
   passes with a horn cue. The crew celebrates together. Restart replays the
   entire mission from the excavator with all progress cleared.

The entry barrier opens fully before a construction vehicle moves. It closes
after the vehicle parks, before interaction begins. On departure it opens
again and stays clear during the handoff to the next vehicle. The far barrier
sits beyond the roller's complete body at its rightmost working position.

Only the primary pointer can control a vehicle. Pointer cancellation, lost
capture, and window blur recover without advancing an unfinished interaction.
Audio activates on a user gesture; the sound button mutes all cues. Vehicle
icons, moving hints, and environmental changes communicate the sequence without
requiring the child to read. The camera stays fixed.

The dump truck has four wheels, two per side. The far side is partly occluded
by the body and the fixed camera; both axles are modeled and the wheel track has
been widened slightly to make the structure easier to see. Truck/car wheels
and roller drums rotate according to vehicle displacement.

## Development loop

`?dev=1` enables the development panel in Vite development mode. Direct entries:

- `stage=excavator`: excavator entrance and three rocks.
- `stage=dump-truck`: rocks cleared, truck entrance.
- `stage=roller`: material filled, first roller pass.
- `stage=roller-return`: first pass complete, roller at the right edge.
- `stage=traffic`: repaired road and the opening traffic sequence.
- `stage=complete`: restored road and crew celebration.

House-building development entries use `?dev=1&mission=house-build&stage=…`:
`gravel`, `concrete`, `delivery-one`, `crane-one`, `delivery-two`, `crane-two`,
`roof-color`, `decorate`, and `complete`. The development panel can jump to or reset each stage,
with snapshots isolated from normal gameplay.

The old `stage=ready` and `stage=dumping` truck bookmarks still work with `dev=1`.
Production ignores development stage parameters. The normal entrance shows selection; an explicit mission hash opens that mission with its saved progress or a fresh start.
The panel can reset a stage and immediately adjust the truck's drag threshold,
maximum angle, and dump duration. The panel and persistence are absent from
production builds. A plain URL opens selection; select a card or use restart for a fresh mission.

In development, HMR and page reload preserve mission progress, animation state, and tuning in
versioned sessionStorage. Pointer capture cannot survive reload: an excavator
drag returns the bucket, a truck drag resets the bed, and a roller drag pauses
at its current location while preserving the completed pass. Browser storage
is optional. Background tabs pause the simulation.

The boot measurement runs from application-module evaluation to the first
rendered interactive frame. It excludes earlier dependency loading and is
**not** an end-to-end save-to-play benchmark.

## Code boundaries and future town missions

Planned missions include firefighting, outdoor rescue, and other town activities.
They should own their own interaction rules; they do not have to use this
road-repair sequence.

- `src/missions/road-repair/domain/`: pure TypeScript rules, animation timing,
  arm geometry, gate sequencing, and snapshot recovery; regression tests live here.
- `src/missions/road-repair/scene.ts`, `vehicles.ts`: the road environment,
  models, camera, picking, feedback, and rendering.
- `src/missions/road-repair/session.ts`: the mission controller and input mapping.
- `src/missions/road-repair/ui.ts`, `sounds.ts`: road-specific HUD and sound cues.
- `src/missions/road-repair/devtools.ts`: versioned development snapshots.
- `src/runtime/`: reusable pointer ownership, audio resources, and shape builders.
  These modules do not import road-repair rules.
- `src/missions/house-build/`: independent house rules, vehicle models, scene and session.
- `src/app/`: illustrated mission selection, separate optional progress storage and sound preference.
- `src/main.ts`: lazy mission loading, hash navigation, app bootstrap and Effect's scoped ownership of the scene, audio,
  listeners, animation loop, scene switching and HMR cleanup. The previous mission is released before the next one mounts.
- `tests/e2e/`: repeatable production and development browser checks.

See [architecture](docs/architecture.md) and [project plan](PROJECT_PLAN.md).

Effect owns side effects and resource lifetimes. Frame calculations and gameplay
rules are ordinary TypeScript functions without renderer objects or Effect
runtime values. Dependencies are pinned because Effect v4 is still beta.

Share services as real reuse appears. Both missions own their own state machines;
there is no generic mission DSL. Future firefighting or rescue interactions can
be implemented without adopting either existing vehicle sequence.

## Verification

The two missions have 30 domain tests, covering fixed arm lengths,
reach limits, gesture thresholds, missed/cancelled input, the two distinct roller
passes, complete missions, restart, and snapshot recovery. House tests also cover
ordered concrete pouring, partial delivery, cancelled placement, roof colour selection before
lifting, legacy roof snapshot migration, assembly target geometry, continuous
placement dwell and load clearance above each floor.
The access tests check vehicle clearance throughout entrance/departure,
continuous gate positions at handoff, the roller's complete working range,
and migration of development snapshots from before the gate sequence existed.

The checked-in Playwright browser suite covers both complete mouse and emulated-touch flows,
empty-space input, cancellation, partial roller movement, completion and
restart, fresh starts from selection, progress retained on reload, roof colour before lifting, completion badges,
phone selection and malformed storage.
The crane browser checks also cover automatic placement on the real base, visible
wall faces, continued holding, passing through the target, and cancellation.
Development reload/HMR is checked from
the first completed roller pass and the second floor of the house, including
preserved progress, mission switching and a single canvas. Normal and development layouts are
visually checked at tablet and desktop sizes.

Real iPad/Android touch, audible output, sustained device performance, and cold
loading still need hardware verification; touch emulation is not a substitute.
The production build reports Vite's default warning for the shared Three.js
chunk over 500 kB. The entrance loads independently; scene code is loaded when a mission is selected.

## Web migration and history

Web is the primary implementation. Rust/Bevy is preserved in the
[`bevy-prototype` tag](https://github.com/kidwm/town-crew/tree/bevy-prototype);
the complete Web experiment before the root migration is tagged
[`web-prototype`](https://github.com/kidwm/town-crew/tree/web-prototype).
The original product notes remain in `docs/history/` as historical references.
Use a separate checkout of a tag if you need to run an old implementation.
There is no requirement to port finished Web missions back to Bevy.

The original truck slice returned from one warm source edit to an interactive
frame in 451 ms. That measurement predates the full mission and is not a current
performance guarantee. Keep stage entry and HMR recovery working so small edits
can be tried without replaying the whole mission.

## Deployment

`npm run build` produces a static `dist/` directory. No game server, database,
runtime API keys, or server rendering are required. Hosting uses **Cloudflare
Pages**, configured in `wrangler.jsonc`.

- `npm run deploy:check`: run domain tests and build without uploading.
- `npm run deploy:preview`: build and deploy to the separate `preview` branch.
- `npm run deploy`: run rules/build checks and publish to the Pages `main` branch.

Deployment uses Wrangler login; credentials stay outside this repository.
GitHub CI builds and tests only. See [deployment setup](docs/deployment.md).
