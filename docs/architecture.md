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
       └─ house-build/
            ├─ domain/house.ts — four vehicle stages, pouring, deliveries, six lifts
            ├─ scene.ts + vehicles.ts — house, site, crane, trucks and rendering
            └─ session.ts — input mapping, HUD, optional snapshots and developer entry
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

## Development and release

Development shortcuts require both Vite development mode and `dev=1`.
Production ignores `stage` parameters. Normal play uses separate optional
sessionStorage snapshots per mission; completion badges and mute preferences use
localStorage. Domain-specific restoration validates stored data and releases stale
pointer gestures through `resumeRoad` and `resumeHouse`. Development snapshots
use separate versioned keys and do not award completion badges.
House snapshots use schema version 2: after five installed parts, `roof-color`
pauses with the roof on the truck until the player confirms a colour and starts
its pickup. Version 1 unfinished roofs migrate to this choice; already completed
homes retain their colour and completion state.

Production browser tests exercise the built `dist/` files with real pointer
events. A separate development server tests HMR, reload, tuning and stage resets.
Both runners own their ports and use the lockfile-installed Playwright browser;
an optional `PLAYWRIGHT_CHANNEL=chrome` selects system Chrome.

## Further missions

Add a sibling such as `missions/fire-rescue/` with its own domain, controller,
scene and cues. Decide its interaction first: continuous aiming and extinguishing
need not follow the excavator/truck/roller state machine. Selection and optional
progress storage are now shared by the two real missions. Further abstractions
should follow actual reuse. A generic mission engine is not required.

## History

- `bevy-prototype`: preserves the latest Rust code and original project notes.
- `web-prototype`: preserves the complete browser experiment under `web/`.
- `main`: the root Web project, verified and promoted after migration checks.

The local checkout directory may retain its old name so existing Codex tasks
and browser previews keep working. The GitHub repository name and npm package
name are independent of that directory.
