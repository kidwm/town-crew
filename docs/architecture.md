# Web architecture

For the current Effect call sites, lifecycle boundaries, adoption priorities and
maintenance checklist, see [Effect usage and adoption plan](effect-usage.md).

Town Crew uses Web as its primary product implementation. Moving the existing
Vite app to the repository root removes the second build workflow from everyday
development while keeping both historical implementations available through tags.

## Boundaries

```text
main.ts — hash navigation and per-mission Effect scopes
  ├─ app/ — illustrated selection, optional progress and sound preferences
  ├─ runtime/ — primary pointer ownership, audio lifecycle, geometry primitives
  └─ missions/
       ├─ road-repair/ — existing road state machine, scene, UI and dev snapshots
       ├─ house-build/
       │    ├─ domain/house.ts — four vehicle stages, pouring, deliveries, six lifts
       │    ├─ scene.ts + vehicles.ts — house, site, crane, trucks and rendering
       │    └─ session.ts — input mapping, HUD, optional snapshots and developer entry
       ├─ fire-rescue/
       │    ├─ domain/fire.ts — water, docking, two rescue trips and ambulance transport
       │    ├─ scene.ts + vehicles.ts — shop, emergency vehicles, people, cat and water
       │    └─ session.ts + ui.ts + sounds.ts — input, hints, snapshots and water audio
       ├─ traffic-rescue/
       │    ├─ domain/traffic.ts — colours, tow assignment, first-car choice, automatic second trip, cleaning and transport
       │    ├─ domain/towing.ts — mirrored approach routes, flatbed loading and wheel-lift ground contact
       │    ├─ scene.ts + vehicles.ts — street, police, flatbed and rotating sweeper brushes
       │    └─ session.ts + ui.ts — input, hints, snapshots and audio cues
       ├─ port-cargo/
       │    ├─ domain/port.ts — two cargo directions, mirrored dock round, crane/fork trips and cargo recovery
       │    ├─ scene.ts + vehicles.ts — boat, quay, pallet boxes and forklift; shared crane/flatbed
       │    └─ session.ts + ui.ts — pointer intent, cues, independent snapshots and stage entry
       ├─ mountain-clearance/
       │    ├─ domain/mountain.ts — five-vehicle flow and versioned recovery
       │    ├─ domain/site.ts + loader.ts — shared points, rounded loader paths, scoop/pour poses
       │    ├─ scene.ts + vehicles.ts — mountain apron, bulldozer, skid loader and shared work vehicles
       │    └─ session.ts + ui.ts — pointer isolation, optional saves and stage/configuration selectors
       ├─ passenger-transfer/
       │    ├─ domain/transit.ts — passenger flow, dispatch order, doors, luggage and versioned recovery
       │    ├─ domain/terminal.ts — fixed-view berth, shared routes and passenger paths
       │    ├─ scene.ts + vehicles.ts — terminal, three passenger buses and shared-car taxi
       │    └─ session.ts + ui.ts — gestures, luggage dwell, snapshots and stage/configuration entry
       └─ police-patrol/
            ├─ domain/police.ts — four street routes, dispatch order, guard positions and escorted transport
            ├─ scene.ts + vehicles.ts — town blocks, motorcycles and sliding-door passenger vans
            └─ session.ts + ui.ts — pointer routes, configuration persistence, hints and developer entry
```

Domain modules have no DOM, Three.js, storage, or Effect dependencies. Renderer
objects do not enter mission state. `runtime/` has no imports from missions:
the next mission can reuse browser resource handling without adopting road rules.
Road-specific models remain within the mission until another mission actually
needs them. The entry point shows selection and dynamically imports the selected mission.
`app/navigation.ts` owns a Fiber and scope for each menu or mission request. The latest
request waits for all previous scopes to release input, audio, renderer and WebGL context
before mounting another scene, even when an intermediate waiting request is cancelled.
Hash navigation supports browser back; HMR carries navigation/PWA cleanup promises into
the replacement module. Menu disposal also belongs to its navigation scope.
Entering from selection clears the selected mission's snapshot after the previous
scope has finished saving. Reload and HMR inside a mission restore its current
snapshot; completion badges and mute preferences survive a fresh round.

All eight missions use the E01/E02 lifecycle pattern established by the road pilot.
Scene and connection factories return scoped Effects that register renderer,
observer, input, hint, frame and save finalizers as resources are acquired.
`runtime/scene-lifecycle.ts` shares renderer and scene graph ownership, including
Mesh, Line and Points resources. Independent finalizers continue cleanup after
another release fails. Fire separately stops its continuous water sound and
attempts AudioContext close even if an audio node fails to release. Its water graph tracks the
source, filter and gain separately; partial initialization rolls back those nodes so the next
gesture can rebuild them in the same owned context.
Typed module, scene, session and audio-close errors retain their original causes;
the entry point uses `onExit` outside the mission scope to distinguish normal interruption from
cleanup defects without replacing a newer screen. Node lifecycle tests inject
initialization and release failures in every mission. A throwing audio-close diagnostic sink
cannot turn normal interruption into a mission failure or prevent scene cleanup.

All eight missions also use E03/E04. Each scoped `connect` returns a waiting frame-loop
Effect that the entry point runs directly after initialization. `runtime/frame-loop.ts`
bridges rAF callback/scheduling errors into `FrameLoopError`, retaining the original
cause and stopping the loop before the mission scope releases input, audio and scene.
Ordinary frame calculations stay synchronous. `runtime/audio-unlock.ts` starts unlock
inside the user gesture, handles both synchronous throws and Promise rejection, and
uses the connection's AbortSignal to stop observing work after disposal. Pending gestures
are coalesced; later gestures may retry, with at most one development warning per connection.
Interruption cannot cancel the browser's AudioContext.resume itself.
All branches await this loop directly; the entry point no longer needs a trailing
`Effect.never`. Fire retains its independent water-stop finalizer after frame shutdown
and final save. DOM event and ResizeObserver callback exceptions remain outside the
frame-loop boundary. See the Effect usage document for per-mission fault tests and
the Vite-only manual fault page used with Codex's built-in browser.

All eight missions use `runtime/storage.ts` for fully synchronous storage/JSON operations.
Browser storage getters and get/set/remove calls run inside `Effect.try`, with typed failures
recovered before `runSync` returns. Development diagnostics are deduplicated; production stays quiet.
The boundary also isolates throwing injected reporters, preserving synchronous fallback.
The shared `app/progress.ts` facade uses this boundary for all formal saves, badges and mute
preferences while retaining copied memory snapshots and null tombstones after failed deletion.
Road development saves retain copied memory/HMR snapshots; the other seven use the per-key
`app/development.ts` memory facade. All seven last-round/colour records (fire has none) prefer
newer in-memory data over stale storage after a failed write. Keys and synchronous pagehide/
finalizer saves remain unchanged; E09 changes periodic scheduling for all eight missions as described below. Memory fallback cannot preserve
unwritten changes across a full page reload; snapshot cloning defects still propagate normally.

For E06, each mission owns a current-version Schema in `persistence.ts`. The seven new adapters
share `runtime/snapshot.ts`: validate the input, call the pure domain resume function with the original
keys, then validate/strip the recovered state. Road retains its snapshot envelope and tuning facade.
Domain invariants and input cancellation remain ordinary TypeScript; legacy migrations have been removed.
Formal and development saves only resume complete current formats: road 1, house 6, fire 1, traffic 3,
police 1, port 3, mountain 3 and transfer 4. Old versions, missing required fields and invalid states
start fresh with a typed development diagnostic. Badges and mute preferences keep their own keys.
Mission adapters remain lazy-loaded; measured bundle costs are recorded in the Effect adoption document. `tests/manual/effect-storage.html` isolates test keys and
provides fault controls for Codex built-in browser validation.

All eight missions resolve their `*Persistence` Context service once in `startup.ts` and pass its
synchronous facade to the session. `Layer.succeed` uses a module-lived live instance, sharing the app
progress singleton and existing development cache. Per-mission services own last-round/color memory;
road also retains hot.data snapshot priority. Factory functions allow isolated stores in tests.
`createMissionPersistence` shares the seven non-road missions' storage/decoder/preference boundary;
`createDevelopmentStore` owns copied per-key memory. Gameplay and random-round policy remain in each mission.
Pagehide still saves synchronously. Each `*Audio` uses `Layer.effect` with scoped acquireRelease;
`Layer.build` runs after scene acquisition and before connection. Connection cleanup (including fire's
continuous spray shutdown) precedes asynchronous audio close, which completes before scene release.

Every mission wraps parallel module loading and sequential prepare/scene/audio/connect in a
`mission.startup` root span. Road/fire have seven stages; the other six retain their existing combined
session/audio module and have six. Lazy `startup.ts` composes the session and services. Startup ends
before the caller awaits the frame loop. Development builds emit one bounded timing/outcome summary
per startup. After scope cleanup, Effect.logError records a genuine failure with mission, mode,
startupId and failed stage; normal interruption stays quiet. Runtime/cleanup failures remain separate
from successful startup. Summary/logger failures and an unavailable or non-finite timing clock
cannot replace the original exit; unavailable timing is reported as zero duration. Production emits
no successful-startup summary; no remote exporter or per-frame logging is installed.

E09 uses `runtime/autosave.ts` for all eight missions. After startup completes, `forkScoped` starts
a worker with `Schedule.spaced(intervalMs)`. Road/house/fire/traffic retain 800 ms intervals;
police/port/mountain/transfer retain 700 ms. The first periodic save waits one interval, and
subsequent saves wait one interval after the preceding attempt. `Fiber.join` raced with the frame loop propagates an
`AutosaveError` or frame failure, stops both workers, then permits connection finalizers.
Hidden pages skip periodic writes; timers may still wake. Visibilitychange/pagehide and final
saves remain synchronous. Storage failures retain E05's optional memory fallback, while unexpected
clone failures end the mission. Existing gesture, restart and phase/checkpoint saves also remain
synchronous. Fire still stops spraying after the final save and before audio/scene disposal.
No mission retains the periodic rAF save check or its timestamp.
Browser timer throttling does not cause catch-up writes or promise an exact save deadline.

`app/pwa.ts` runs an optional registration Fiber in secure production contexts. It starts
after load (or immediately if already complete), retrying TypeError/NetworkError at 1 then 2
seconds, with at most three total attempts. Other errors stop immediately; terminal failure
warns once without blocking gameplay. Pagehide/HMR cancels load waits, backoff and result
observation, but cannot undo an already-issued native registration. BFCache restoration does
not restart a cancelled job; a new document load does. Workbox cache/update policies are unchanged.
Effect TestClock validates schedule boundaries; built-in browser controls separately exercise
actual timers and cancellation. No Effect state or per-frame Effects enter the gameplay domain.

The Effect scope releases input/frame listeners, audio and scene resources on
HMR. The primary-pointer adapter owns capture and cancellation. The controller
maps screen movement to bucket/roller world coordinates or truck drag distance.
Gameplay advances through ordinary functions and is independent of audio success.
Each mission uses one fixed orthographic camera pose from introduction through
completion. Phase changes, work, handoffs and celebrations must not move, rotate,
zoom, switch or follow with the camera. Resolve occlusion through scene layout,
vehicle orientation and routes. Responsive frustum sizing may fit the viewport
without changing camera position or orientation; see the
[fixed-view design rule](mission-design.md#整關維持同一視角).
Crane picking accepts the projected final part and its assembly base, with a
small CSS-pixel margin; the former elevated target remains an alternative.
A continuous 0.4-second dwell commits placement before releasing pointer
ownership, so a still-held finger cannot control the next load. This dwell is
transient drag context; cancellation and reload discard it.

The police mission owns a separate pure domain state machine and four validated
route configurations. Round identity, eight continuous work fractions, motorcycle
completion order and automatic animation time are versioned in its snapshot.
Pointer targets select distance along rounded road paths; the domain advances cars
at a bounded speed, stops on release, and requires endpoint dwell or valid release.
The transient desired distance and pointer ownership never survive reload.
The original traffic car and scenery builders are shared renderer-only functions;
police motorcycle and passenger-van geometry remains in the police mission.

## Development and release

Development shortcuts require both Vite development mode and `dev=1`.
Production ignores `stage` parameters. Normal play uses separate optional
sessionStorage snapshots per mission; completion badges and mute preferences use
localStorage. Domain-specific restoration validates stored data and releases stale
pointer gestures through `resumeRoad`, `resumeHouse` and `resumeFire`. Development snapshots
use separate versioned keys and do not award completion badges.
House snapshots use schema version 6 and include roof style, mirrored layout,
palette, family and pet. Work coordinates remain in the original site's local frame;
the scene mirrors its entire site group and converts input/projection at that boundary.
The same transform drives vehicles, buildings, crane targets and hints. Each concrete
region accepts partial pouring in any order. New rounds avoid repeating roof style,
layout and palette; a separate last-round summary survives restarting work. Development
selectors retain the round on stage resets, and explicitly select variants for testing.
Only complete version-6 homes resume. New play moves from the fifth installation to
empty-hook roof pickup; the roof-color development entry remains available. Empty and attached hooks
share the 96 px grab area and attach/detach/dwell timings in `runtime/crane-control.ts`;
geometry stays in the existing shared crane builder. The crane leaves before the
automatic welcome, and phase/placement/attachment checkpoints are saved immediately. `decorate`
now holds a ten-second arrival clock: car route, door opening, passengers and pets
are derived from its persisted `elapsed`. Reload/HMR resumes the same instant; a
completed snapshot renders the parked car and family at home without replaying.
A persisted 0.7-second `finishing` action separates each work vehicle's departure
from the next arrival. Garage gravel, floor/path, walls and roof grow only in these
four gaps, after the dump truck, mixer, first flatbed and final crane leave respectively.
The crane remains parked during the first flatbed handoff. Departed vehicles and
interaction prompts stay hidden during finishing; phase, placement and finishing
boundaries are saved immediately. Garage progress derives from phase/action/elapsed,
without an extra work counter, and reload/HMR resumes a partial addition.
A rear crane lane clears the garage;
the shared car's optional opening cabin leaves existing traffic/police cars unchanged.
Fire snapshots keep each fire's remaining heat, the two independent rescue flags,
the current passenger and animation progress. Restoration rejects impossible
stage/action/heat/rescue combinations and releases stale pointer input. Water
and parking progress remain; loose equipment returns to a visible pickup point.
The basket moves on a plane in front of the facade. Projected character positions
and the held basket determine the nearest eligible rescue; continuous dwell is
transient pointer state. Pickup, descent and unloading each finish before the
other passenger can be selected. Separate aprons keep the parked engine clear
of the aerial truck and subsequent ambulance.

Traffic snapshots use schema version 3 and preserve both colours, the left/right
tow-type assignment, placed cones, individually removed cars, the selected car,
continuous sweeping and animation elapsed time. Interrupted equipment
returns to its pickup point; vehicle positions and cleaned patches remain. Last-round
colours are kept separately from gameplay progress so a new selection avoids repeating
the preceding pair. `runtime/emergency-models.ts` shares renderer-only ambulance,
stretcher, chassis and character builders across the fire and traffic missions.
New rounds reroll the tow assignment; development stage resets keep it. The current
format requires towTypes and firstTow; versions 1/2 start fresh. Only the first car needs a choice; the remaining truck is dispatched
automatically after the first loaded vehicle leaves.

Production browser tests exercise the built `dist/` files with real pointer
events. A separate development server tests HMR, reload, tuning and stage resets.
Both runners own their ports and use the lockfile-installed Playwright browser;
an optional `PLAYWRIGHT_CHANNEL=chrome` selects system Chrome.
CI runs desktop and touch in separate runners, with one graphical browser per
runner; the desktop job also runs the development checks. Local suites remain
sequential so graphical runs do not compete for the same GPU.

The port mission owns a version-3 snapshot and separate production/development keys.
Older versions start fresh. Current suspended cargo and partial lifting resume automatically. Empty hook movement,
attachment state, cargo position and automatic clocks persist independently of input.
The validated round includes cargo direction, layout and palette. Replay alternates
direction and independently draws either layout; restore retains the current round.
Each direction has its own stage sequence: incoming hands crane work to the forklift
and sends a loaded truck into town; outgoing unloads a truck with the forklift,
clears the work area, deploys the crane to load the ship, then sends it to the opposite
town. Outgoing truck pickup raises before insertion, lifts clear, withdraws before
lowering and turns toward the quay. Cargo sources, destinations, ownership and routes
derive from direction and the independent unloading/loading ID arrays.
Its two mirrored layouts use local work coordinates, transformed at the scene boundary
for rendering, picking, projected hints and destinations. Unloading and loading orders
are independent cargo-ID arrays; the current suspended box, fork choice/load, drive
fractions and automatic elapsed time survive reload. Desired input and endpoint dwell
are cleared. Empty hooks choose either remaining box by dragging toward it, then automatically
attach and raise after dwell or valid release. A new drag on the hook or hanging
cargo places it; valid early release runs the safe traverse/lower sequence.
Misses and cancellation preserve the current position; placement releases the
box and raises the empty hook for the next pickup.
The first incoming fork pickup approaches from the pallet's outer side, with a curved turn
clear of the quay edge and a horizontal final insertion visible in both mirrored
views. After the first delivery, the forklift parks between the quay bays; its
second approach changes side to enter through the vacant first bay. This shorter
route and the parking position derive from loaded cargo IDs, so reload retains them.
Both loaded trips turn forward toward land immediately after pickup; the carried
box swings clear of the other pallet without reversing the approach. Quay pallet
orientation matches the approach, and routes remain clear of people. The side loading
position remains outside the truck: automatic loading raises first, inserts second,
then withdraws before lowering. Incoming crane departure completes before fork work;
outgoing forklift and empty-truck departure completes before crane loading.
The last work vehicle clears the dock before manual hauling. Reaching the exit lane hands off the
remaining truck or boat departure automatically; scene exit distances account for viewport
width and whole-vehicle lengths in either layout. Town arrival derives SVG animation from
the saved clock. `runtime/construction-models.ts` preserves the original house chassis,
crane and flatbed; the flatbed's optional panels default to the original house cargo.

The mountain mission owns a version-3 snapshot and two rock distributions with two
mirrored layouts. New rounds alternate distribution and independently choose layout;
soil and rock loading orders are independent child choices. Both soil strips and their bulldozer routes are
horizontal within the fixed camera view, exposing the blade and moving soil from the side. A first
push retreats behind both strips before changing lanes and accepting another
gesture. The widened foreground road and guardrail leave whole-vehicle clearance.
The excavator loads the three original boulders before the skid loader takes the two soil piles. Its
direct cleared-ground routes, pickup/back-out, rear-bed park/manual lift/advance/pour and clear-before-
lowering poses live in pure `domain/loader.ts`; `domain/site.ts` owns the shared
push/soil/bed coordinates. The renderer and real-model clearance tests use these
same helpers. Ground soil, full bucket and bed soil derive from the saved transfer
clock, so interruptions cannot duplicate material. Loader approach, selected pile,
full bucket, parked state, partial lift, ordered soil IDs and automatic clocks persist.
`loaderDocked` separates driving from raising; `loaderTravel` measures the active leg
or lift fraction. Parking consumes the pointer and accepts only a fresh upward drag.
Only complete version-3 saves resume, including their explicit work order; versions 1/2
start fresh. New rounds use rock-first order. `stageOrder` supplies the renderer and snapshot validator
with the appropriate sequence, including vehicle handoffs and progress icons.
After the first pour the loader waits beside the remaining pile; after the last pour
it exits from the dock. Fine residue is traversable, and removed piles no longer
affect clearance. The shared truck remains unchanged: two original boulders support a third in the
original-length bed, then soil fills their gaps without raising the stones.
Pickup raises the rock and parks the high
bucket clear of rock/bed targets so phone projections retain a usable drag distance.
Automatic pickup/unloading releases pointer
ownership. Bucket/load positions, ordered rock IDs, soil fractions, hauling, cleaning
and animation clocks persist; uncommitted dwell and pointer targets are cleared.
In new rounds the truck arrives before the excavator, the excavator leaves before
the loader arrives, and the loader leaves before manual hauling. The truck departs
before the sweeper. The six-second reopening clock moves
barriers before passing traffic and resumes across reload. Development saves are
separate and configuration selectors retain the current stage.
`runtime/excavator-model.ts` preserves the original road renderer while pure fixed-arm
math lives in `runtime/excavator-arm.ts`; `runtime/sweeper.ts` preserves the original
traffic sweeper; `runtime/road-barrier.ts` preserves the original road barrier.
Original mission exports and behavior remain. Shared SVG vehicle
icons live in `app/road-vehicle-art.ts` and `app/traffic-vehicle-art.ts`.

The transfer mission has a version-4 snapshot and two terminal configurations. A public
bus delivers six passengers, then the taxi and a randomly selected school bus or coach
arrive together. The child dispatches either one first; the remaining large vehicle
arrives after both leave. The coach always stows one suitcase before boarding travellers. A single
large-vehicle berth and separate taxi loading bay use whole-vehicle departure handoffs.
The 5-metre road is one-way from left to right, with direction arrows and no centre
divider. Both loading bays sit outside the through lane on the near side, next to
one continuous platform; separate school/coach holding spaces lie on the far side.
`domain/terminal.ts` shares platform and asphalt outlines, the small planted divider,
all four vehicle routes, door positions and waiting points with rendering and tests.
Forward-only lane changes carry explicit eased headings and preserve the swept
body's curb clearance. The school bus merges onto the road before approaching the
large-vehicle bay; the coach pulls forward diagonally from its own holding space.
All four depart into `ROAD.outbound`, eliminating the previous turning loop.
Clearance checks cover the full model, mirrors, the other waiting vehicle, paved
surfaces, platform and divider; simultaneous entrance clocks also avoid overlap.
`passenger-transfer/view.ts` supplies the same camera and resize rules to rendering
and whole-route visibility tests.
Approach geometry,
door locations, actual passenger routes, luggage targets and hints derive from the
same round. The last 30 cm of driving align automatically after a deliberate drag.
Door work and driving fractions persist independently of input; restore discards
stale pointer ownership and uncommitted suitcase dwell. Automatic unloading,
boarding, luggage insertion, vehicle entrance and departure retain their clocks.
Both transfer vehicles drive in from offscreen before choice becomes available;
the remaining large vehicle drives in automatically after the pair fully leaves,
then hands control to the child at its approach point. All entrance clocks survive reload.
Versions 1/2/3 and saves without an explicit companion start fresh.
Final-visit stage IDs retain their original `coach-` prefix for saved progress and development
links; vehicle identity, labels, passengers and doors derive from the saved companion.
An early coach visit retains its selected vehicle through luggage loading and then returns
to the pair's boarding/departure flow. The suitcase uses a coach-local pose transformed by
the full vehicle position and heading; clearance tests keep its geometry inside the compartment.
Neutral choice shows both vehicle rings and nearby picture labels, without defaulting
the route hint to one vehicle. Opening a door or
finishing a drive consumes the gesture before the next task becomes available.
The taxi extends the original opening-door car with optional side/rear-only door
selection; existing callers keep all-door behaviour. `runtime/resident.ts` extracts
the original house person without changing its default geometry or colours.
Three new passenger buses have open interiors and real boarding gaps; the coach's
lower luggage compartment receives the suitcase lying flat. No renderer state
enters the domain or snapshot.

## Further missions

Read the [mission design principles and proposal checklist](mission-design.md) at the start of design.
Each proposal defines its fixed task dependencies, round variations, child-controlled choices,
nonrepetition policy and restore behaviour. Keep validated round configuration in domain state;
rendering, interaction targets, hints and routes derive from that same configuration. Select it
once for a fresh round and persist it with progress, rather than rerolling on reload or render.
Keep the previous-round summary separately so restarting work can still avoid repeating it.
Provide explicit configurations for development and deterministic tests; validate all main layouts
and allowed task orders before adding more combinations. No generic randomisation framework is required.

Use the [model catalog](model-catalog.md) before creating vehicles, characters, props
or scenery. It includes models embedded in scene setup, not just exported builders.
Search all mission sources and inspect the original appearance before implementing a
similar object. When reuse appears, extract the existing renderer code and preserve its
geometry, materials and scale; mission rules remain independent. Keep the catalog in
sync with additions, moves, changes and deliberate variants.

Add a sibling mission with its own domain, controller, scene and cues. Decide its
interaction first: firefighting's continuous aiming and two passenger trips do
not follow the excavator/truck/roller state machine. Selection and optional
progress storage are shared by the eight missions. Further abstractions
should follow actual reuse. A generic mission engine is not required.

## History

- `bevy-prototype`: preserves the latest Rust code and original project notes.
- `web-prototype`: preserves the complete browser experiment under `web/`.
- `main`: the root Web project, verified and promoted after migration checks.

The local checkout directory may retain its old name so existing Codex tasks
and browser previews keep working. The GitHub repository name and npm package
name are independent of that directory.
