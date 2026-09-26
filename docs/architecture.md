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
House snapshots use schema version 3 and include roof style, mirrored layout,
palette, family and pet. Work coordinates remain in the original site's local frame;
the scene mirrors its entire site group and converts input/projection at that boundary.
The same transform drives vehicles, buildings, crane targets and hints. Each concrete
region accepts partial pouring in any order. New rounds avoid repeating roof style,
layout and palette; a separate last-round summary survives restarting work. Development
selectors retain the round on stage resets, and explicitly select variants for testing.
Version 1/2 homes migrate to the original appearance and layout, retaining work and
roof colour. The old `roof-color` pause automatically starts pickup; new play moves
directly from the fifth installation to roof pickup. The crane leaves before the
automatic welcome, and phase/placement checkpoints are saved immediately.
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
progress storage are shared by the five missions. Further abstractions
should follow actual reuse. A generic mission engine is not required.

## History

- `bevy-prototype`: preserves the latest Rust code and original project notes.
- `web-prototype`: preserves the complete browser experiment under `web/`.
- `main`: the root Web project, verified and promoted after migration checks.

The local checkout directory may retain its old name so existing Codex tasks
and browser previews keep working. The GitHub repository name and npm package
name are independent of that directory.
