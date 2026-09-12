# Town Crew · 小小城市隊

A complete, replayable road-repair mission using Vite, TypeScript, Three.js,
and Effect **4.0.0-beta.107**. It runs in the browser with mouse or single-touch
pointer input and uses procedural 3D models without downloaded game assets.

```sh
npm ci
npm run dev
```

- Play the whole mission: <http://localhost:5173/>
- Development tools: <http://localhost:5173/?dev=1&stage=excavator>
- Phone/tablet on the same network: use the Network URL printed by Vite.
- `npm run build` checks TypeScript and creates `dist/`.
- Use Node 24 or newer; `.nvmrc` pins the CI/development major version.
- `npm test` runs the domain regression tests with Node's built-in test runner.
- `npm run check` runs domain tests and the production build.
- `npx playwright install chromium` installs the browser for end-to-end tests.
- `npm run test:e2e` tests the production build with mouse and emulated touch.
  Run `npm run build` first; the test runner starts its own preview on port 4173.
- `npm run test:e2e:dev` starts Vite on port 5174 and checks stage entry, reload,
  tuning persistence, and HMR without rewriting source.
- To use an installed Chrome instead: `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`.
  No machine-specific runtime paths are required.

## Play

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

The old `stage=ready` and `stage=dumping` truck bookmarks still work with `dev=1`.
Production ignores development stage parameters and always starts the full mission.
The panel can reset a stage and immediately adjust the truck's drag threshold,
maximum angle, and dump duration. The panel and persistence are absent from
production builds. A plain URL always starts a fresh whole mission.

HMR and page reload preserve mission progress, animation state, and tuning in
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
- `src/main.ts`: app bootstrap and Effect's scoped ownership of the scene, audio,
  listeners, animation loop, and HMR cleanup.
- `tests/e2e/`: repeatable production and development browser checks.

See [architecture](docs/architecture.md) and [project plan](PROJECT_PLAN.md).

Effect owns side effects and resource lifetimes. Frame calculations and gameplay
rules are ordinary TypeScript functions without renderer objects or Effect
runtime values. Dependencies are pinned because Effect v4 is still beta.

Share input adapters, asset/audio services, hints, and lifecycle management as
real reuse appears. Add the second distinct mission before designing a generic
mission format: firefighting may need continuous aiming while rescue may need
selection and transport.

## Verification

The complete Web mission has 16 domain tests, covering fixed arm lengths,
reach limits, gesture thresholds, missed/cancelled input, the two distinct roller
passes, the entire mission, restart, and snapshot recovery.
The access tests check vehicle clearance throughout entrance/departure,
continuous gate positions at handoff, the roller's complete working range,
and migration of development snapshots from before the gate sequence existed.

The checked-in Playwright browser suite covers the full mouse and emulated-touch flow,
empty-space input, cancellation, partial roller movement, completion and
restart. Development reload/HMR is checked from the first completed roller pass, including
preserved progress and a single canvas. Normal and development layouts are
visually checked at tablet and desktop sizes.

Real iPad/Android touch, audible output, sustained device performance, and cold
loading still need hardware verification; touch emulation is not a substitute.
The production build reports Vite's default warning for the single minified
JavaScript chunk over 500 kB (approximately 156 kB gzipped).

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
Workers Static Assets**, configured in `wrangler.jsonc`.

- `npm run deploy:check`: build and validate the deployment without uploading.
- `npm run deploy:preview`: build and upload an isolated preview version.
- `npm run deploy`: run rules/build checks and publish to the production Worker.

Deployment uses Wrangler login; credentials stay outside this repository.
GitHub CI builds and tests only. See [deployment setup](docs/deployment.md).
