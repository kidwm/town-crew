# Town Crew · 小小城市隊

**Play:** [小小城市隊](https://town-crew.pages.dev)

Repair a road, build a two-storey home, help the fire brigade, clear a traffic collision, help the police team, move cargo at the dock, clear a mountain road, help passengers transfer, and help the sanitation crew in nine replayable town missions,
using Vite, TypeScript, Three.js and Effect **4.0.5**. The game runs in the browser with mouse or single-touch
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
- Help the police team: <http://localhost:5173/#police-patrol>
- Move cargo at the dock: <http://localhost:5173/#port-cargo>
- Clear a mountain road: <http://localhost:5173/#mountain-clearance>
- Help passengers transfer: <http://localhost:5173/#passenger-transfer>
- Help the sanitation crew: <http://localhost:5173/#sanitation>
- Development tools: <http://localhost:5173/?dev=1&stage=excavator>
- Phone/tablet on the same network: use the Network URL printed by Vite.
- `npm run build` checks TypeScript and creates `dist/`.
- Use Node 24 or newer; `.nvmrc` pins the CI/development major version.
- `npm test` runs domain and lifecycle regression tests with Node's built-in test runner.
- `npm run check` runs those tests, TypeScript checks and the production build.
- `npx playwright install chromium webkit` installs the browsers for end-to-end tests.
- `npm run test:e2e` tests the production build with mouse, emulated touch and WebKit PWA checks.
  Run `npm run build` first; the test runner starts its own preview on port 4173.
- To test a deployed build instead: `PLAYWRIGHT_BASE_URL=https://town-crew.pages.dev npm run test:e2e`.
- `npm run test:e2e:dev` starts Vite on port 5174 and checks stage entry, reload,
  tuning persistence, and HMR without rewriting source.
- To use an installed Chrome instead: `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`.
  No machine-specific runtime paths are required.

## Install and play offline

The production build is a PWA. Use the browser's install action, or on iPhone/iPad
choose Share → Add to Home Screen. It opens in its own window with the town-and-truck
icon. Installation requires HTTPS or localhost ([PWA installation requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)).

On the first online visit, the service worker caches the menu and **all nine missions**,
including their lazy-loaded JavaScript. After that initial cache completes, reloads
and switching to previously unopened missions work offline. New builds wait until
all existing game tabs/windows close before activating, keeping a running mission
on one consistent version. Saved progress and sound preferences keep their existing
storage behavior. Service workers are disabled in Vite development mode.

`vite-plugin-pwa` generates `dist/sw.js` with Workbox revisioned precaching.
Workbox copies redirected HTML responses before caching them: Cloudflare Pages
redirects `/index.html` to `/`, and returning that raw redirected response from a
worker prevents navigation in Safari. The PWA tests reproduce this 308 redirect,
offline reloads and reopening in Chromium and WebKit. WebKit uses a stopped origin
because [Playwright 1.63 offline emulation blocks service-worker responses](https://github.com/microsoft/playwright/issues/42775).
Activation also removes the
retired custom worker's caches. Cloudflare Pages headers allow the browser to check
for worker and manifest updates. The editable icon source
is `public/icons/town-crew.svg`, with PNG exports for 192/512px installation icons,
a 512px maskable icon, a 180px Apple touch icon, and a 32px favicon.
Regenerate the PNGs with `npm run icons` (or `PLAYWRIGHT_CHANNEL=chrome npm run icons`
to use an installed Chrome).
Game labels and controls prevent selection and iOS touch callouts; editable fields
still allow normal text selection, and the menu retains touch scrolling.

## Choose a mission

The entrance has nine large illustrated cards in a two-column grid (one column on phones). All missions are available immediately.
Use the home button to return to selection; selecting a mission starts a new round.
Production progress is stored separately for each mission in sessionStorage, so
reloading within the current mission resumes it. Completion badges and the sound preference
use localStorage. No account is required; unavailable storage never blocks play.
Restart clears only the current mission's progress, while its earned badge remains.

## Help the sanitation crew

1. Drag the yellow garbage truck from the through lane into the recessed collection
   bay. Choose either tied rubbish bag and drag it into the actual rear hopper.
   A 0.4-second hold or valid release stows each; the plate then compresses them.
2. Drag the wheeled bin to the rear lift, then start a **new upward drag**.
   Its height follows the finger and stays on release, cancellation or reload.
   At full height it automatically tips, empties, lowers and returns to the pavement.
   Drag the garbage truck out along the merge back into the through lane.
3. The recycling and food-waste trucks visit in a randomly selected order.
   When the recycling truck parks in the bay, load either of the two selected
   packages first. Each round draws two different types from cardboard, bottles,
   cans and newspapers; all six pairs are possible. Both packages rest on the real
   flatbed deck and stay fixed inside it while the truck turns and departs.
4. Whenever the food-waste truck visits, drag the food-marked bin to its side lift,
   then start another upward drag. The roof hatch opens and the bin tips into the
   actual opening. The empty bin returns and the side lift folds before departure.
5. The original sweeper clears the collection apron after both trucks fully leave.
   Cleaned patches survive reversing, cancellation and reload. Brushes fold before the sweeper merges back into the through lane. The whole sweeper
   leaves before residents wave, confetti and replay/selection.

The main road has a divider centred between its two edges. The lighter collection
bay sits entirely outside the through lane, with diagonal approaches and merges.
The same fixed rear three-quarter camera exposes tools and cargo in both layouts.
A tighter, slightly right-centred frame trims unused road on the left and makes
vehicles about 24% larger. Shorter visible approach/exit stretches and a matching
sweep strip retain whole-vehicle and target visibility without changing the camera mid-round.
Each round keeps two rubbish bags, two bin lifts, two recycling packages and one sweep.
New rounds switch layout/palette and avoid the previous unordered recycling pair;
the middle-truck order is an independent random choice and may repeat. Children
choose bag and recycling loading orders independently, without a sorting quiz.

Complete version-2 snapshots retain bay configuration, content pair, truck order,
prop positions, loaded cargo, partial driving/lifting/sweeping and automatic clocks.
Reload/HMR releases stale pointers and uncommitted dwell without rerolling.
Older or incomplete saves start fresh; earned badges remain. Completed rounds do
not replay departure. Production/development progress are separate.

The sweeper, original flatbed, residents, workers, houses, trees, bench and runtime
services are reused. New can crates reuse the bottle crate structure; newspaper
bundles extend the existing collected-prop style. Multi-stop routes and disposal
sites remain deferred.

## Help passengers transfer

1. Drag the public bus into the outlined berth, then pull its passenger door open.
   Six passengers automatically alight and walk along the platform to their waiting areas.
   The door closes before the child drags the empty bus away.
2. Watch the taxi and a randomly chosen school bus or coach drive into their waiting areas, then choose either
   by dragging the actual vehicle. Both have equal choice rings and nearby picture
   labels; optional vehicle buttons only change the hint. The taxi uses its own
   yellow-marked loading bay and pedestrian walkway; either large vehicle uses the shared
   berth. Pull the door open, watch two residents, pupils or travellers
   board, then drag the vehicle out. The first vehicle fully leaves before the next
   one can approach; the child chooses their order.
3. Once both transfer vehicles have left, the remaining large vehicle drives in from
   offscreen. Drag it to the shared berth, open its door and let its two passengers board.
   Whenever the coach is dispatched, its luggage hatch opens with the front door:
   drag one suitcase into the real bay before the travellers board. A 0.4-second hold
   or valid release stows it. Luggage stays fixed inside the compartment through turns
   and departure. There is exactly one suitcase in either arrival arrangement.
4. The last vehicle fully leaves, the station worker waves, and confetti leads into
   replay and selection buttons without another confirmation.

One fixed orthographic view exposes the passenger side of all four vehicles.
The station road is a single 5-metre-wide, left-to-right lane with direction arrows
and no centre divider. Separate recessed taxi and large-vehicle loading bays lie
along its near edge, next to one continuous raised passenger platform. A small
planted divider separates the bays; neither parked vehicle occupies the through lane
or the waiting platform. The school bus and coach use independent roadside holding
spaces on the far side. All four vehicles enter from the left and leave to the right;
diagonal approaches and merges replace the school bus's former U-turn.
Vehicle headings and routes leave clearance for the whole body, mirrors, curbs and
the other waiting vehicle. The shelter covers only the platform's right-end bench.
Two complete configurations move the berth and platform left or right while keeping
the boarding side visible. New rounds change configuration and vehicle palette;
passenger shirts also vary. The child chooses which of the two waiting vehicles goes first.
Driving and partial door opening pause on release. Version-4 snapshots preserve the
random companion, round, order, selected vehicle, driving, doors, carried luggage and automatic clocks;
reload/HMR releases stale pointers and uncommitted luggage dwell. Completed saves do
not replay the farewell. Only complete version-4 snapshots are accepted; older versions start a fresh round.
Production and development saves remain independent.

The taxi reuses the original opening-door car, with a roof light and checker stripe;
the three large passenger vehicles are new procedural bodies with real entry gaps,
seats and folding doors. The coach has a working lower luggage hatch. Passengers
reuse the original house residents, now extracted into `runtime/resident.ts`; the
house retains its original geometry and colours. Scenery, the station worker, hints,
audio lifecycle and completion storage reuse existing builders and services.
There is no timer, penalty, fare collection or passenger sorting quiz.

## Clear a mountain road

1. Drag the tracked bulldozer along two horizontal lanes. The fixed camera exposes
   its blade and moving soil from the side. It retreats before changing lanes;
   another drag completes the second push. Partial work survives cancellation and reload.
2. The bulldozer leaves, the original green cleanup truck parks, and the excavator
   loads three original-size boulders in the child's chosen order. Drag its bucket
   to a rock, then start a new drag toward the real bed. Two rocks sit below a third
   nestled between them. The bed keeps its original length, with no soil layer
   raising the stones. The excavator leaves before the loader arrives.
3. A compact skid loader takes either soil pile. Each trip has three distinct actions:
   drag to a pile to scoop, drag the loaded vehicle to the parking ring behind the
   truck, then start a separate upward drag to raise the bucket. Parking consumes
   the driving gesture and waits with the bucket low. Partial lift survives release,
   cancellation and reload; reaching the upper target automatically advances and tips
   the bucket, visibly pouring soil into gaps around the rocks. It backs clear before
   lowering. After the first pour it waits beside the remaining pile; after the second
   it exits from the dock. Fine residue and removed piles do not block its routes.
4. Drag the loaded truck out. Partial hauling and all cargo survive release and reload.
   Reaching the exit hands off the rest of the departure automatically.
5. Drag the sweeper across the foreground road once. Its brushes progressively remove
   the fine residue, retaining cleaned sections through interruption. It leaves before
   the barriers move aside.
6. The waiting car crosses in a six-second reopening animation. Workers wave; confetti,
   replay and selection buttons appear without another tap.

The camera stays fixed throughout both mirrored layouts. Every new round has two pushes,
three rock loads, two soil loads, one haul and one sweep. Two rock distributions alternate;
layout and the child's soil/rock orders remain independent. Version-3 snapshots also save
parking and partial lift. Only complete version-3 snapshots resume; older versions start fresh.
Current version-3 soil-first saves remain valid; new rounds use the rock-first flow.

## Move cargo at the dock

1. Drag the small cargo boat into the dashed hull-shaped berth. It follows the
   waterway, pauses on release, then automatically moors at the actual berth;
   the outline fades as docking finishes.
2. Drag the empty green material flatbed into the foreground loading bay.
3. Drag the empty hook to either pallet box on the open deck. Holding there for
   0.4 seconds, or releasing at the box, automatically attaches and raises it.
   Start a new drag on the hook or suspended box toward the translucent pallet-box
   preview on the quay. Only the next landing position is shown; the preview fades
   as the real box lands. A 0.4-second hold or valid early release aligns and lowers
   it automatically. Misses and cancellation preserve the hook or suspended box
   at its current position. Choose either unloading order; the empty hook rises
   after placement, ready for the next box. Both boxes must be ashore before the
   crane stows and leaves.
4. Drag the forklift toward either pallet. The first pickup uses the outer
   side, then inserts horizontally and lifts with its side visible in either
   mirrored view. Pallets turn into position while unloading; symbols on all
   four faces retain their identity. Start a new drag
   toward the truck-side loading position. It carries low and immediately turns
   forward toward land, swinging the box clear of the other pallet. It stops
   outside the truck, raises the box, moves
   forward to place it, then reverses and lowers its forks. Choose either loading
   order independently of the crane order. After the first delivery it parks
   between the quay bays. The second pickup uses the vacated first bay and a
   shorter approach, followed by the same direct forward turn toward the truck.
   Two trips load both boxes.
5. The forklift leaves before the child drags the loaded flatbed out. The empty
   boat unmoors and departs along the waterway. A six-second town delivery animation
   and waving workers lead directly into confetti and replay/selection buttons.

Two complete mirrored layouts coordinate the boat, crane supports, two quay
spaces, forklift routes, truck bay and hints. Fresh rounds alternate cargo direction,
independently select either layout and change the boat palette. The other direction
starts with an empty boat and a loaded flatbed: two forklift trips unload to the quay,
the forklift and empty truck leave, the crane deploys and loads both boxes onto the
boat, then the child drags the loaded boat toward the opposite town. Truck unloading
and ship loading orders remain independent. Automatic truck pickup raises before
inserting, lifts the box clear, withdraws before lowering and turns toward the quay.

Version-3 saves track empty/hanging hooks, suspended cargo and partial automatic lifting.
Version-1/2 snapshots are rejected and start a fresh round.
Reload/HMR retains the current direction, layout, unloading/loading
orders, partial vehicle movement, suspended cargo, fork load and automatic clocks.
Pointer ownership and uncommitted dwell are discarded on restore. A still-held
finger cannot start the next box or drive the forklift after automatic pickup.
Cargo identity uses an apple or stacked-block symbol as well as colour.
There is no timer, penalty, sorting quiz or extra confirmation screen.

The crane and flatbed are the original house-building models extracted into
`src/runtime/construction-models.ts`; default house cargo and appearance remain.
The forklift, coastal cargo boat, pallet boxes and quay are new procedural models.
Workers, trees and houses reuse existing builders. There are two crane lifts and
two forklift trips in every round, with no container stacking or extra destination.
Low houses and trees sit at the two shore-side ends, clearing the foreground
truck approach. Water strokes drift and fade continuously, with a short wake
while the boat moves; these decorative animations do not change saved progress.

## Help the police team

Six short vehicle tasks turn a checkpoint inspection into a coordinated pickup and recovery:

1. Drag the patrol car into the checkpoint bay. Both motorcycles then ride in from
   beyond the frame and park before their controls unlock.
2. Drag either police motorcycle to the exit guard position. The other guards the
   entrance. A taxi and loaded freight flatbed are inspected and released in sequence;
   the third vehicle is a small passenger car whose driver matches the wanted record.
   An officer accompanies the passenger to the waiting area.
3. The detective van drives in from beyond the frame and stops at its waiting position.
   Drag it into the foreground pickup bay once the hint appears.
4. Pull its camera-facing sliding door sideways. The 96 px grab area and minimum
   72 px gesture remain; a tap does not open the door. Boarding and closure are automatic.
5. After the chosen motorcycle automatically takes the lead, drag the van toward the exit.
6. Reverse the flatbed tow truck toward the stopped car. Once aligned, the bed lowers,
   the winch loads the car, the bed rises and secures it, then the loaded truck leaves.
   The remaining crews clear the checkpoint and traffic resumes.

The fixed camera and two mirrored layouts remain. New rounds alternate direction and
normal-vehicle order, and change the wanted car's colour. Children choose the lead
motorcycle directly. The bottom row groups work into four vehicle cards: patrol car,
paired motorcycles, detective van and tow truck; the van's three tasks share one card.
The wanted car always uses the smaller passenger-car model, distinct from the detective van.
Each task allows release and continuation. Complete version-3 snapshots retain round,
inspection index, chosen motorcycle, six work fractions and automatic animation time,
including loading. Versions 1/2 start fresh; badges and sound preferences remain.
There is no timer or penalty, and a held pointer cannot control the next task.
Existing tow-truck, taxi and pallet-cargo factories are now shared renderer-only modules;
their original missions retain re-exported APIs and unchanged models.
See the [checkpoint design and framing record](docs/police-checkpoint-proposal.md).

## Help the traffic crew

1. Two differently coloured cars gently collide and stop with hazard lights. Their
   occupants move to the pavement. Each new round changes both colours, without
   repeating or simply swapping the previous pair; reload keeps the current pair.
2. Drag the police car into its bay and place two cones inside the accident area,
   leaving a clear lane for the ambulance and its rear doors.
   The police car then pulls into a side bay to keep the ambulance route clear.
3. A tow truck automatically reverses into the foreground apron. Each round assigns
   one flatbed and one wheel-lift truck randomly to the left and right approaches,
   independently choosing which side arrives first. Drag its winch hook or wheel
   cradle to either accident car and hold for 0.4 seconds to choose and attach it.
   No preliminary tap is needed; either rig can recover either car. The flatbed pulls
   the car aboard; the wheel-lift raises its front wheels while the rear wheels
   stay on the road. Drag the loaded truck back out on its arrival side.
   The other truck automatically arrives from the opposite side; drag its tool
   to the only remaining car. Rig assignment, arrival order and loading progress
   survive reload in complete version-3 saves. Older versions start a fresh round.
4. Drag the street sweeper to the start, then right across the debris. Rotating
   brushes clear the patches as they pass. Partial driving and cleaning survive
   release, cancellation and reload; driving back does not restore debris.
5. Drag the ambulance into the cleared pickup lane. Drag the stretcher to the
   resident, then back to the ambulance's rear doors. Assistance, loading, door
   closure and departure happen automatically.
6. The police collect the cones and leave before another car passes at the same
   speed and easing as the road-repair mission. The remaining
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
   region, in any order. All unfinished regions show rings on the gravel/concrete surface; aiming there aligns
   the outlet and stream with that region's centre. Holding the raised outlet
   above the region also works. Stopping or cancellation preserves partial filling.
3. Drag the flatbed along the independent foreground lane into its parking bay. The direction follows this round's left/right site layout.
4. Drag the empty hook to the next material on the flatbed. A 0.4-second hold or
   valid release attaches and raises it automatically. Start a new drag on the
   hook or hanging material toward the actual assembly
   base or ghost outline; the site turns green and a short 0.4-second dwell
   automatically aligns and lowers the load without releasing. Releasing at a
   valid destination also works. Two L-shaped wall
   sections and an upper floor slab complete the first storey.
5. A second flatbed delivery brings the second storey's two wall sections and roof.
   After installing both walls, drag the hook to pick up the coordinated-colour roof.
   Drag the hook or roof into place without a colour-selection screen or another confirmation.
   There are six lifts across the two deliveries, with a celebration after the first floor.
6. After the crane leaves, a ten-second welcome plays automatically: the family car
   turns into the garage, parks, switches off its lights and opens its doors. The
   residents and optional pet get out and walk along the path to the front door.
   Windows then light up, residents wave, and replay/selection buttons appear.

The open single-car garage takes shape during short, automatic vehicle handoffs:
gravel after the dump truck exits, floor/driveway/path after the mixer exits, walls
after the first flatbed exits, and roof after the final crane exits. Each addition
finishes in 0.7 seconds before the next vehicle or family car enters; it stays still
during the child's work. No extra gestures or lifts are needed. Its palette matches
the house; the entire garage, approach and walking route mirror with the site.
A rear service lane keeps the crane and its supports clear. Handoff and welcome
clocks survive reload/HMR; completed homes stay completed with the car parked and
the family at the door.

Each fresh round changes the roof style (gable, shed or flat), mirrors the site to the
opposite side and changes the wall/door palette. Three family arrangements and an
optional cat or dog greet the finished house. The illustrated plan previews the
actual roof and palette without requiring a tap. All variants remain two-storey homes
with four vehicle types, two deliveries and six lifts. Reload retains the same home,
family, pet, colour and partial work in complete version-6 snapshots. Older versions start a fresh round.

Crane loads travel above the completed structure before automatically lowering.
Misses and cancelled placements retain the current hook or suspended material position. Taps and
brief passes through the site do not install a load; a held finger cannot pick up
the next part after automatic placement. Trucks use
clear access routes; the flatbed travels forward on the road in front of the house.

## Repair the road

The town road has cracked, flat pieces of old asphalt, not natural mountain boulders.
Each new round selects one of three damage patterns (staggered, split, clustered)
and mirrors the whole worksite. The next round changes both pattern and side;
reload and HMR retain the current configuration. Hole, fill and finished patch
share the same outline. The workload stays at three loads, one cleanup trip,
one filling operation and two roller passes.

1. Drag the outlined excavator bucket toward any of the three broken surfaces,
   in the child's chosen order. Pause briefly over a piece to lift it and keep
   control with the same finger. Releasing over a piece also lifts it and waits
   for the next drag. Crossing another piece on the way does not choose it. Drag the loaded bucket
   to the highlighted bed of the green cleanup truck and release when the target
   turns green to align and tip it in. The bucket travels above the cab. Releasing
   elsewhere or cancelling pauses in place with the load; grab again to continue.
   Reload also retains that load and position. All three delivered pieces remain
   visible in the truck before cleanup starts.
   A hand demonstrates the initial drag and changes destination after pickup;
   it hides during interaction and reappears after three idle seconds. Tapping
   the bucket selects it, then tapping any remaining piece or the truck performs that
   pickup or delivery. With the canvas focused, Enter/Space selects the bucket
   and activates its destination; Escape cancels selection.
2. After the excavator leaves, drag the loaded cleanup truck through the
   open gate. Taps cannot complete the trip; release or reload retains its position
   and load. The blue delivery truck waits until cleanup has fully departed.
3. Drag the delivery truck's bed at the front, farthest from its rear hinge,
   upward. Crossing the threshold triggers automatic tipping. The animation fills
   the base and spreads darker road material before the roller arrives.
4. Drag the roller across the repair area, then back. Hints follow the site's orientation. Either pass
   can be paused and resumed. The second pass leaves a smooth road patch.
5. The vehicles leave, cones and barriers are cleared, and a car passes with a
   horn cue. The finished surface sits below the restored centre marking.
   Restart clears all loading and hauling progress and changes the worksite.

The original natural boulder model is preserved in `src/runtime/rocks.ts` as
`createBoulder`, with its original geometry, colour and size. The same module
provides the separate flat `createAsphaltChunk`. Both are in the model catalog.
Only complete version-1 saves resume; missing version, round, gate, hauler or cargo fields
start a fresh round. Current saves preserve paused, loaded buckets; an
already committed tipping animation finishes only once after reload. Delivered
piece identities and their loading order are preserved, including each piece's appearance.

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
- `stage=haul-away`: all three chunks loaded, excavator gone, drag the cleanup truck out.
- `stage=dump-truck`: cleanup gone, delivery truck entrance.
- `stage=roller`: material filled, first roller pass.
- `stage=roller-return`: first pass complete, roller at the far edge.
- `stage=traffic`: repaired road and the opening traffic sequence.
- `stage=complete`: restored road with all vehicles and equipment cleared.

Add `pattern=staggered|split|clustered` and `layout=0|1` to select a road worksite.
The panel exposes the same choices. Changing or resetting stages preserves them;
restarting the mission draws a new round. Normal gameplay ignores these shortcuts.

House-building development entries use `?dev=1&mission=house-build&stage=…`:
`gravel`, `concrete`, `delivery-one`, `crane-one`, `delivery-two`, `crane-two`,
`decorate`, and `complete`. The `roof-color` development entry automatically starts the final pickup.
Add `roof=gable|shed|flat`, `layout=0|1`, `palette=0..3`, `family=0..2`, and
`pet=none|cat|dog` to select a development round. The panel exposes the same selectors;
changing or resetting stages retains the configuration. The development panel can jump to or reset each stage,
with snapshots isolated from normal gameplay.

Fire-brigade entries use `?dev=1&mission=fire-rescue&stage=…`:
`dispatch`, `hose`, `ground-fire`, `ladder-arrival`, `roof-reach`, `roof-fire`,
`rescue`, `stowing`, `ambulance`, `stretcher`, `boarding`, `departure`, and `complete`.
The same panel supports stage resets, reload and HMR, with isolated development saves.

Traffic-rescue entries use `?dev=1&mission=traffic-rescue&stage=…`:
`collision`, `police`, `cones`, `tow-arrival`, `hook`, `tow-exit`, `sweeper`, `sweep`,
`ambulance`, `stretcher`, `boarding`, `departure`, `reopen`, and `complete`.
Stage reset, reload and HMR retain isolated development saves and the current tow assignment.

Police entries use `?dev=1&mission=police-patrol&stage=…`:
`intro`, `setup`, `bikes-arrival`, `guard`, `inspect`, `van-arrival`, `van`, `door`, `boarding`,
`lead`, `transport`, `tow-arrival`, `tow`, `tow-load`, `depart`, and `complete`.
Add `layout=0|1`, `traffic=taxi-first|freight-first`, `inspection=0|1|2`, and
`bike=bike0|bike1` (for stages after selection). The panel switches direction,
normal-vehicle order, current inspection and lead motorcycle, and resets stages;
reload and HMR retain independent development progress.

Port entries use `?dev=1&mission=port-cargo&stage=…`:
`boat`, `truck`, `unload`, `crane-exit`, `forklift`, `forklift-exit`, `transport`,
`departure`, `arrival`, and `complete`. Add `direction=load` for the outgoing flow,
with `boat`, `truck`, `forklift`, `forklift-exit`, `crane-ready`, `load-ship`,
`crane-exit`, `ship-transport`, `departure`, `arrival`, and `complete`.
Add `layout=0|1` and `palette=0..3`. The panel switches direction and lists its valid
stages; an incompatible stage resets to boat entry. Stage resets retain direction,
layout and palette, with independent development saves.

Mountain entries use `?dev=1&mission=mountain-clearance&stage=…`:
`intro`, `push`, `dozer-exit`, `truck-arrival`, `excavator-arrival`, `excavate`,
`excavator-exit`, `loader-arrival`, `load-soil`,
`loader-exit`, `haul`, `truck-exit`, `sweeper-arrival`, `sweep`, `sweeper-exit`,
`reopen`, and `complete`. Add `pattern=spread|cluster` and `layout=0|1`.
The panel selects either distribution/layout and resets stages without rerolling;
reload and HMR preserve independent development progress.
New or reset `load-soil` entries start with all three rocks already loaded.

Transfer entries use `?dev=1&mission=passenger-transfer&stage=…`:
`intro`, `bus-arrival`, `bus-door`, `unloading`, `bus-exit`, `bus-departure`,
`transfer-entrance`, `choose`, `transfer-arrival`, `transfer-door`, `boarding`, `transfer-exit`,
`transfer-departure`, `coach-entrance`, `coach-arrival`, `coach-door`, `luggage`, `loading`,
`coach-boarding`, `coach-exit`, `coach-departure`, `celebrate`, and `complete`.
Add `layout=0|1` and `palette=0..3`. Stage/configuration selectors preserve the other
settings; reset entries create consistent passengers and cargo for that stage.

Sanitation entries use `?dev=1&mission=sanitation&stage=bin-lift&layout=0&palette=0&service=food-first&cargo=5`.
The stage selector includes collection, locking, independent lifting, tipping,
vehicle handoffs, food collection and sweeping. Layout, palette, middle-truck order and content-pair selectors retain
the selected stage; reload/HMR preserves the current round and partial lift.

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

For existing mission maintenance and new mission design, follow the [repository guide](AGENTS.md),
[mission design principles](docs/mission-design.md), and [Effect maintenance checklist](docs/effect-usage.md#維護與新增關卡清單).
Choose checks from the [Effect verification guide](docs/effect-verification.md#按變更選擇驗證) before implementing the change.
Start each new mission proposal with the design checklist, including resource ownership, cancellation and save recovery.
Plan replay variation and child choices alongside the core interaction: define valid configurations,
which main variation avoids repeating the previous round, and how reload preserves the current round.
Keep gestures familiar and coordinate routes, targets and hints for every configuration.
The same document records implemented house variants and the playtest-driven removal of the blocking colour picker.

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
- `src/missions/house-build/`: independent house rules, persisted round configuration, house/roof
  variants, residents, vehicle models, scene and session.
- `src/runtime/pets.ts`: the original fire-rescue cat, now shared with house-building, and a new dog.
- `src/missions/fire-rescue/`: independent fire, rescue and transport rules, emergency
  vehicles, characters, scene, HUD, controller and continuous water audio.
- `src/missions/traffic-rescue/`: independent collision, policing, two-car towing,
  continuous street cleaning and ambulance transport.
- `src/missions/police-patrol/`: six checkpoint tasks, three inspected vehicles, two mirrored layouts,
  direct motorcycle choice, automatic inspection, sliding-door boarding and escorted transport.
- `src/missions/port-cargo/`: independent two-way cargo flows, forklift truck pickup/loading, mirrored dock routes, cargo persistence and town delivery.
- `src/missions/mountain-clearance/`: independent pushing, three-rock loading, two soil loads with separate parking/raising gestures, hauling, sweeping, mirrored routes and versioned recovery. Pure site/loader geometry defines the same paths used by the renderer and clearance tests.
- `src/missions/sanitation/`: four-vehicle collection, rear/side bin lifts, independent cargo orders, fixed-view pullout/merge routes, random content/dispatch and version-2 recovery.
- `src/missions/passenger-transfer/`: independent passenger transfers, child-selected taxi/school dispatch, actual door gestures, suitcase stowage, fixed-view terminal routes and versioned recovery.
- `src/runtime/resident.ts`: the original house resident, with its seated/walking legs and waving arm, shared with the transfer station.
- `src/runtime/excavator-model.ts`, `excavator-arm.ts`, `road-barrier.ts`, `sweeper.ts`: the original road excavator, pure arm geometry, road barrier and original traffic sweeper shared with mountain clearance.
- `src/runtime/construction-models.ts`: original house flatbed, crane, chassis and link helper; the flatbed can omit the house material panels.
- `src/runtime/car.ts`, `town-scenery.ts`: original traffic cars, trees, houses and
  bench shared with the police mission; officer colours live in `emergency-models.ts`.
- `src/runtime/traffic-cone.ts`: the original hollow road-repair cone, shared by
  the road and traffic missions without changing its shape, colours or scale.
- `src/runtime/emergency-models.ts`: shared emergency chassis, ambulance, stretcher
  and residents; no mission rules.
- `src/app/`: illustrated mission selection, separate optional progress storage and sound preference.
- `src/main.ts`: lazy mission loading, hash navigation, app bootstrap and Effect's scoped ownership of the scene, audio,
  listeners, animation loop, scene switching and HMR cleanup. The previous mission is released before the next one mounts.
- `src/runtime/`: shared scoped scene/audio ownership, typed failures, frame supervision, synchronous storage,
  snapshot validation, startup diagnostics and scheduled autosave. The [Effect guide](docs/effect-usage.md)
  defines their contracts and source entry points.
- Each mission’s `persistence.ts`, `services.ts` and `startup.ts`: current-version recovery, injectable persistence,
  scoped audio and startup composition. Mission-specific differences belong in the [mission table](docs/effect-usage.md#各任務差異).
- `src/app/navigation.ts` and `pwa.ts`: navigation cleanup barriers and optional cancellable PWA registration.
- `tests/manual/effect-*.html`: Vite-only fault controls for Codex built-in browser verification;
  see the [coverage and procedures](docs/effect-verification.md). All four mission selectors include sanitation and cover the nine missions; dated execution results remain in the history.
- `tests/e2e/`: repeatable production and development browser checks.

See [architecture](docs/architecture.md) and the [project plan](PROJECT_PLAN.md).
Effect documentation is split into the [current guide](docs/effect-usage.md),
[verification guide](docs/effect-verification.md), and [complete adoption history](docs/history/effect-adoption.md).

Effect owns side effects and resource lifetimes. Frame calculations and gameplay
rules are ordinary TypeScript functions without renderer objects or Effect
runtime values. Dependencies are pinned for reproducible installs.

Share services as real reuse appears. Each mission owns its state machine;
there is no generic mission DSL. Further rescue interactions can be implemented
without adopting an existing vehicle sequence.

## Verification

Node tests cover all nine missions' domain rules and Effect integration: partial initialization,
independent cleanup, typed failures, optional audio, current-version recovery, injected services,
startup diagnostics and supervised autosave. Shared app/runtime tests cover storage fallback,
navigation and PWA registration. Use `npm test` for Node checks and `npm run check` for tests,
type checking and the production build.

Follow the [Effect verification guide](docs/effect-verification.md) for change-specific checks,
fault controls and current coverage gaps. Interactive checks use Codex's built-in browser;
checked-in Playwright suites remain available for repeatable automation and CI.
The [dated history](docs/history/effect-adoption.md) preserves Effect integration results, counts and limits,
including the original eight-mission audit and the later sanitation work; these are not claims
that every browser suite was rerun on the current checkout.

The domain tests cover fixed arm lengths,
reach limits, gesture thresholds, missed/cancelled input, the two distinct roller
passes, complete missions, restart, and snapshot recovery. Road checks also cover
ordered loading and hauling, cancelled/partial haul movement, rejection of obsolete cargo formats,
exit clearance and waiting for the loaded cleanup truck to fully leave. House tests also cover
all concrete pouring orders, partial delivery, cancelled placement, hook pickup and roof installation,
current snapshot recovery and rejection of old formats, assembly target geometry, continuous placement dwell,
load clearance, garage construction between vehicle departures/arrivals, whole-car turning clearance and the family walking
route. Arrival checks cover automatic completion, mid-animation reload and completed saves.
Fire tests cover both rescue orders, continuous extinguishing, interruption,
one passenger per trip, transport, and rejection of contradictory snapshots.
Traffic tests cover both car orders, rig assignments and arrival sides, automatic dispatch,
uncommitted hook choice, version-1/2 rejection, actual-model cone/vehicle clearance and shared passing speed,
wheel-lift ground contact, nonrepeating colours, one load per trip,
interrupted cleaning, equipment recovery, stage entry and contradictory snapshots.
Police rules cover both directions, motorcycle choices and normal-vehicle orders,
all six tasks, inspection-index recovery, partial work and cancelled dwell, held-pointer
isolation, alternating rounds, version-3 recovery and version-1/2 rejection. Actual-model
checks cover vehicle/cone clearance, six viewport sizes, lowered ramps, tyre contact,
loaded-car attachment and departures; four vehicle cards group the six tasks.
Port rules cover both directions, both layouts and both independent cargo orders, early release, cancelled dwell, suspended cargo and partial driving, automatic reload, snapshot rejection, version-1/2 rejection, empty hook pickup, alternating directions, independent layouts, raised truck pickup, side-view quay pickup, shorter second pickup through the vacant bay, whole-forklift/cargo clearance and whole-vehicle departures across viewport widths.
Mountain rules cover all four configurations and all six rock orders, fixed arm reach, actual vehicle footprints, partial driving/cleaning, cancelled dwell, automatic clocks, malformed saves and nonrepeating distributions. Browser checks follow all four configurations on mouse and portrait-phone touch, retain carried and truck-loaded rocks across reload, isolate held pointers, reopen the road, award badges and restart. Development checks cover carried rocks across reload/HMR and stage/configuration resets.
The port browser suite follows both directions and layouts using visible hints on mouse and portrait-phone touch, preserves partial boat/fork work, suspended cargo and loaded boxes across reload, checks held-pointer isolation, completion and replay. Development checks include carried and suspended cargo across HMR/reload, direction switching and stage reset.
The police browser suite is maintained for CI: both checkpoint directions on mouse
and phone touch, direct motorcycle choice, three inspections, the wide door grab area,
manual recovery, loading reload, badges, replay and development HMR.
Police gameplay and hint checks are recorded in the [checkpoint design](docs/police-checkpoint-proposal.md);
Effect integration checks remain in the [verification history](docs/history/effect-adoption.md).
The access tests check vehicle clearance throughout entrance/departure,
continuous gate positions at handoff, the roller's complete working range,
and rejection of development snapshots missing the current gate fields.

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
touch, verify hook choice after arrival, cancelled attachment, automatic second dispatch, cone dwell cancellation, held-pointer isolation, partial towing and cleaning
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
