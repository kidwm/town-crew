# Web architecture

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
The app waits for the previous Effect scope to release input, audio, renderer and
WebGL context before mounting another scene. Hash navigation supports browser back;
HMR carries the cleanup promise into the replacement module.
Entering from selection clears the selected mission's snapshot after the previous
scope has finished saving. Reload and HMR inside a mission restore its current
snapshot; completion badges and mute preferences survive a fresh round.

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
Version 1/2 homes migrate to the original appearance and layout, retaining work and
roof colour. The old `roof-color` pause automatically starts pickup; new play moves
from the fifth installation to empty-hook roof pickup. Version 1–5 hanging
materials migrate as attached, retaining their position. Empty and attached hooks
share the 96 px grab area and attach/detach/dwell timings in `runtime/crane-control.ts`;
geometry stays in the existing shared crane builder. The crane leaves before the
automatic welcome, and phase/placement/attachment checkpoints are saved immediately. `decorate`
now holds a ten-second arrival clock: car route, door opening, passengers and pets
are derived from its persisted `elapsed`. Reload/HMR resumes the same instant; a
completed snapshot renders the parked car and family at home without replaying.
Version 1–3 unfinished welcome saves start this clock at zero; version 3 retains
its round configuration; version 4 arrival clocks retain their exact progress.
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

Traffic snapshots use schema version 2 and preserve both colours, the left/right
tow-type assignment, placed cones, individually removed cars, the selected car,
continuous sweeping and animation elapsed time. Interrupted equipment
returns to its pickup point; vehicle positions and cleaned patches remain. Last-round
colours are kept separately from gameplay progress so a new selection avoids repeating
the preceding pair. `runtime/emergency-models.ts` shares renderer-only ambulance,
stretcher, chassis and character builders across the fire and traffic missions.
New rounds reroll the tow assignment; development stage resets keep it. Version 1
snapshots retain colours and completed work, restarting unfinished old towing on
the new route. Only the first car needs a choice; the remaining truck is dispatched
automatically after the first loaded vehicle leaves.

Production browser tests exercise the built `dist/` files with real pointer
events. A separate development server tests HMR, reload, tuning and stage resets.
Both runners own their ports and use the lockfile-installed Playwright browser;
an optional `PLAYWRIGHT_CHANNEL=chrome` selects system Chrome.
CI runs desktop and touch in separate runners, with one graphical browser per
runner; the desktop job also runs the development checks. Local suites remain
sequential so graphical runs do not compete for the same GPU.

The port mission owns a version-3 snapshot and separate production/development keys.
Version-1 snapshots migrate as incoming rounds; version-1/2 hanging cargo
remains attached, and partial lifting resumes automatically. Empty hook movement,
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
Version-1/2 saves keep their original soil-first order, material and completion; new
rounds use rock-first order. `stageOrder` supplies the renderer and snapshot validator
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
Version-1/2/3 saves retain the taxi/school pair and preserve work without replaying entrances.
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
