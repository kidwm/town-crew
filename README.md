# Town Crew · 小小城市隊

**Play:** [小小城市隊](https://town-crew.pages.dev)

Repair a road, build a two-storey home, help the fire brigade, and clear a traffic collision in four replayable town missions,
using Vite, TypeScript, Three.js and Effect **4.0.0-beta.107**. The game runs in the browser with mouse or single-touch
pointer input and uses procedural 3D models without downloaded game assets.

```sh
npm ci
npm run dev
```

- Choose a mission: <http://localhost:5173/>
- Build a two-storey home: <http://localhost:5173/#house-build>
- Repair the road: <http://localhost:5173/#road-repair>
- Help the fire brigade: <http://localhost:5173/#fire-rescue>
- Help the traffic crew: <http://localhost:5173/#traffic-rescue>
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

The entrance has four large illustrated cards in a two-column grid (one column on phones). All missions are available immediately.
Use the home button to return to selection; selecting a mission starts a new round.
Production progress is stored separately for each mission in sessionStorage, so
reloading within the current mission resumes it. Completion badges and the sound preference
use localStorage. No account is required; unavailable storage never blocks play.
Restart clears only the current mission's progress, while its earned badge remains.

## Help the traffic crew

1. Two differently coloured cars gently collide and stop with hazard lights. Their
   occupants move to the pavement. Each new round changes both colours, without
   repeating or simply swapping the previous pair; reload keeps the current pair.
2. Drag the police car into its bay and place two cones at the marked road edges.
   The police car then pulls into a side bay to keep the ambulance route clear.
3. Tap either accident car to choose the first rescue. Each round assigns one
   flatbed and one wheel-lift tow truck randomly to the left and right approaches.
   The selected car's truck reverses into the foreground apron. Drag its winch
   hook or wheel cradle to that car and hold for 0.4 seconds. The flatbed pulls
   the car aboard; the wheel-lift raises its front wheels while the rear wheels
   stay on the road. Drag the loaded truck back out on its arrival side.
   The other truck automatically arrives for the remaining car, with no second
   selection. The assignment, selected car and loading progress survive reload.
4. Drag the street sweeper to the start, then right across the debris. Rotating
   brushes clear the patches as they pass. Partial driving and cleaning survive
   release, cancellation and reload; driving back does not restore debris.
5. Drag the ambulance into the cleared pickup lane. Drag the stretcher to the
   resident, then back to the ambulance's rear doors. Assistance, loading, door
   closure and departure happen automatically.
6. The police collect the cones and leave before another car passes. The remaining
   resident and officer wave as the clean road reopens and confetti celebrates.

There is no injury detail, time limit or penalty. Loose cones, hooks and stretchers
reset on interrupted input; completed work and ongoing automatic animations persist.
A held pointer cannot start another task after automatic assistance. All four
service vehicles leave before completion. The ambulance, stretcher and character
models are shared with the fire mission; traffic rules remain independent.

## Help the fire brigade

1. Drag the fire engine into its parking bay, then drag the hose coupling to the
   real hydrant. A short hold near the target automatically connects it.
2. Press a ground fire to spray water. Move between three fires; partial work
   remains after stopping, cancelling or reloading. There is no spreading fire,
   time limit, score penalty or water shortage.
3. The aerial truck arrives in a separate lane. Drag its basket to the roof edge,
   then press the last fire. The empty basket returns to the ground afterward.
4. Drag the basket toward either the second-floor resident or the cat on the
   higher roof platform. Each trip automatically docks, picks up one passenger,
   lowers and unloads. Choose either order; the remaining passenger stays available.
5. The ladder stows and leaves; the engine retrieves its hose and reverses out
   along its own apron. Drag the arriving ambulance into the cleared parking bay.
6. Drag the stretcher to the resident; a crew member helps them lie down. Drag
   it back to the ambulance's rear doors. Loading, closing the doors and departure
   are automatic. A hospital arrival animation and waving crew finish the mission.

Equipment targets accept either the finger or the held object near the actual
destination, with a 0.4-second dwell and no required release. Releasing early at
a valid target also works. Interrupted loose equipment returns to its pickup
point, while extinguished fires, completed rescues and partial driving persist.
A still-held finger cannot control the next task after automatic assistance.
All emergency vehicles leave before the final celebration.

## Build a two-storey home

1. Drag the gravel truck's bed upward to fill the prepared foundation.
2. Drag the concrete mixer's chute toward the centre of each outlined foundation
   region. Its ring rests on the gravel/concrete surface; aiming there aligns
   the outlet and stream with that region's centre. Holding the raised outlet
   above the region also works. Stopping or cancellation preserves partial filling.
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

The town road has cracked, flat pieces of old asphalt, not natural mountain boulders.

1. Drag the excavator bucket toward each broken road surface. It automatically
   lifts the piece and drops it into the waiting green cleanup truck. All three
   pieces remain visible as cargo. Misses and cancelled drags return the bucket.
2. After the excavator leaves, drag the loaded cleanup truck left through the
   open gate. Taps cannot complete the trip; release or reload retains its position
   and load. The blue delivery truck waits until cleanup has fully departed.
3. Drag the delivery truck's bed at the front, farthest from its rear hinge,
   upward. Crossing the threshold triggers automatic tipping. The animation fills
   the base and spreads darker road material before the roller arrives.
4. Drag the roller right across the repair area, then back left. Either pass
   can be paused and resumed. The second pass leaves a smooth road patch.
5. The vehicles leave, cones and barriers are cleared, and a car passes with a
   horn cue. The finished surface sits below the restored centre marking.
   Restart clears all loading and hauling progress.

The original natural boulder model is preserved in `src/runtime/rocks.ts` as
`createBoulder`, with its original geometry, colour and size. The same module
provides the separate flat `createAsphaltChunk`. Both are in the model catalog.
Old saves retain completed work: former roadside piles become truck cargo;
uncompleted old scoops restart safely and later stages do not replay cleanup.

The entry barrier opens fully before a construction vehicle moves. It closes
after the vehicle parks, before interaction begins. On departure it opens
again and stays clear while the child drives cleanup out and during the handoff
to the next vehicle. The far barrier
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

- `stage=excavator`: excavator entrance, three asphalt chunks and an empty cleanup truck.
- `stage=haul-away`: all three chunks loaded, excavator gone, drag the cleanup truck left.
- `stage=dump-truck`: cleanup gone, delivery truck entrance.
- `stage=roller`: material filled, first roller pass.
- `stage=roller-return`: first pass complete, roller at the right edge.
- `stage=traffic`: repaired road and the opening traffic sequence.
- `stage=complete`: restored road with all vehicles and equipment cleared.

House-building development entries use `?dev=1&mission=house-build&stage=…`:
`gravel`, `concrete`, `delivery-one`, `crane-one`, `delivery-two`, `crane-two`,
`roof-color`, `decorate`, and `complete`. The development panel can jump to or reset each stage,
with snapshots isolated from normal gameplay.

Fire-brigade entries use `?dev=1&mission=fire-rescue&stage=…`:
`dispatch`, `hose`, `ground-fire`, `ladder-arrival`, `roof-reach`, `roof-fire`,
`rescue`, `stowing`, `ambulance`, `stretcher`, `boarding`, `departure`, and `complete`.
The same panel supports stage resets, reload and HMR, with isolated development saves.

Traffic-rescue entries use `?dev=1&mission=traffic-rescue&stage=…`:
`collision`, `police`, `cones`, `tow-choice`, `tow-arrival`, `hook`, `tow-exit`, `sweeper`, `sweep`,
`ambulance`, `stretcher`, `boarding`, `departure`, `reopen`, and `complete`.
Stage reset, reload and HMR retain isolated development saves and the current tow assignment.

The old `stage=ready` and `stage=dumping` truck bookmarks still work with `dev=1`.
Production ignores development stage parameters. The normal entrance shows selection; an explicit mission hash opens that mission with its saved progress or a fresh start.
The panel can reset a stage and immediately adjust the truck's drag threshold,
maximum angle, and dump duration. The panel and persistence are absent from
production builds. A plain URL opens selection; select a card or use restart for a fresh mission.

In development, HMR and page reload preserve mission progress, animation state, and tuning in
versioned sessionStorage. Pointer capture cannot survive reload: an excavator
drag returns the bucket, a truck drag resets the bed, and a roller drag pauses
at its current location while preserving the completed pass. Cleanup-truck drags
pause in place with all loaded chunks retained. Browser storage
is optional. Background tabs pause the simulation.

The boot measurement runs from application-module evaluation to the first
rendered interactive frame. It excludes earlier dependency loading and is
**not** an end-to-end save-to-play benchmark.

## Code boundaries and future town missions

Before designing or implementing new models, read the [model catalog](docs/model-catalog.md).
It lists existing vehicles, props and scenery, their source locations, and whether they
are shared or still built inside a mission scene. Search the source as well: a model
not yet extracted into `runtime/` still exists and should be considered for reuse.
Update the catalog whenever a model is added, moved or changed.

Future missions include outdoor rescue and other town activities.
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
- `src/missions/fire-rescue/`: independent fire, rescue and transport rules, emergency
  vehicles, characters, scene, HUD, controller and continuous water audio.
- `src/missions/traffic-rescue/`: independent collision, policing, two-car towing,
  continuous street cleaning and ambulance transport.
- `src/runtime/traffic-cone.ts`: the original hollow road-repair cone, shared by
  the road and traffic missions without changing its shape, colours or scale.
- `src/runtime/emergency-models.ts`: shared emergency chassis, ambulance, stretcher
  and residents; no mission rules.
- `src/app/`: illustrated mission selection, separate optional progress storage and sound preference.
- `src/main.ts`: lazy mission loading, hash navigation, app bootstrap and Effect's scoped ownership of the scene, audio,
  listeners, animation loop, scene switching and HMR cleanup. The previous mission is released before the next one mounts.
- `tests/e2e/`: repeatable production and development browser checks.

See [architecture](docs/architecture.md) and [project plan](PROJECT_PLAN.md).

Effect owns side effects and resource lifetimes. Frame calculations and gameplay
rules are ordinary TypeScript functions without renderer objects or Effect
runtime values. Dependencies are pinned because Effect v4 is still beta.

Share services as real reuse appears. Each mission owns its state machine;
there is no generic mission DSL. Further rescue interactions can be implemented
without adopting an existing vehicle sequence.

## Verification

The four missions have 57 domain tests, covering fixed arm lengths,
reach limits, gesture thresholds, missed/cancelled input, the two distinct roller
passes, complete missions, restart, and snapshot recovery. Road checks also cover
ordered loading and hauling, cancelled/partial haul movement, legacy cargo migration,
exit clearance and waiting for the loaded cleanup truck to fully leave. House tests also cover
ordered concrete pouring, partial delivery, cancelled placement, roof colour selection before
lifting, legacy roof snapshot migration, assembly target geometry, continuous
placement dwell and load clearance above each floor.
Fire tests cover both rescue orders, continuous extinguishing, interruption,
one passenger per trip, transport, and rejection of contradictory snapshots.
Traffic tests cover both towing orders and type assignments, automatic second dispatch,
wheel-lift ground contact, nonrepeating colours, one load per trip,
interrupted cleaning, equipment recovery, stage entry and contradictory snapshots.
The access tests check vehicle clearance throughout entrance/departure,
continuous gate positions at handoff, the roller's complete working range,
and migration of development snapshots from before the gate sequence existed.

The checked-in Playwright browser suite covers both complete mouse and emulated-touch flows,
empty-space input, cancellation, partial roller movement, completion and
restart, fresh starts from selection, progress retained on reload, roof colour before lifting, completion badges,
phone selection and malformed storage.
Concrete browser checks also drag directly to each ground-level region centre,
verify the saved outlet aligns exactly, and reject pouring into later regions early.
The crane browser checks also cover automatic placement on the real base, visible
wall faces, continued holding, passing through the target, and cancellation.
Brief passes and cancellation use Playwright's clock to keep 120 ms of contact
below the 400 ms dwell, even when native input commands are slow on CI. Successful
holds and complete missions run with the clock resumed.
Fire browser tests complete the mission using a desktop mouse and portrait-phone
touch, choose opposite rescue orders, cancel/reload during extinguishing, restore
the first completed rescue, verify held-pointer isolation, transport and replay.
Traffic browser checks complete opposite towing orders and type assignments on mouse and portrait-phone
touch, verify cancelled selection, automatic second dispatch, cone dwell cancellation, held-pointer isolation, partial towing and cleaning
reload, colour persistence, completion badges, fresh rounds and restart.
Development reload/HMR is checked from
a loaded cleanup truck partway through its drive, the first completed roller pass,
the second floor of the house, one completed fire rescue and partial street cleaning, including
preserved progress, mission switching and a single canvas. Normal and development layouts are
visually checked at tablet and desktop sizes.
Traffic development checks also resume a wheel-lift mid-animation and preserve
the tow assignment through reload, HMR and stage reset.

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
The Cloudflare GitHub App automatically builds and publishes pushes to `main`,
running `npm run check` before publishing. Other branches receive preview deployments.
GitHub Actions independently runs the full desktop, touch and development/HMR tests;
Pages does not wait for those jobs. No Cloudflare API token is needed in Actions.
See [deployment setup](docs/deployment.md).
