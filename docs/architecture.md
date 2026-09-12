# Web architecture

Town Crew uses Web as its primary product implementation. Moving the existing
Vite app to the repository root removes the second build workflow from everyday
development while keeping both historical implementations available through tags.

## Boundaries

```text
main.ts — application lifetime (Effect scope)
  ├─ runtime/ — primary pointer ownership, audio lifecycle, geometry primitives
  └─ missions/road-repair/
       ├─ domain/ — state transitions and numerical animation/IK functions
       ├─ session.ts — pointer-to-mission mapping and frame orchestration
       ├─ scene.ts + vehicles.ts — Three.js presentation and picking
       ├─ ui.ts + sounds.ts — mission presentation
       └─ devtools.ts — optional reload/HMR snapshots
```

Domain modules have no DOM, Three.js, storage, or Effect dependencies. Renderer
objects do not enter mission state. `runtime/` has no imports from missions:
the next mission can reuse browser resource handling without adopting road rules.
Road-specific models remain within the mission until another mission actually
needs them. The entry point intentionally starts the only implemented mission.

The Effect scope releases input/frame listeners, audio and scene resources on
HMR. The primary-pointer adapter owns capture and cancellation. The controller
maps screen movement to bucket/roller world coordinates or truck drag distance.
Gameplay advances through ordinary functions and is independent of audio success.

## Development and release

Development shortcuts require both Vite development mode and `dev=1`.
Production ignores `stage` parameters. Development snapshots are validated,
versioned, optional, and restored through `resumeRoad`, which cancels in-flight
pointer actions while preserving completed work.

Production browser tests exercise the built `dist/` files with real pointer
events. A separate development server tests HMR, reload, tuning and stage resets.
Both runners own their ports and use the lockfile-installed Playwright browser;
an optional `PLAYWRIGHT_CHANNEL=chrome` selects system Chrome.

## Next mission

Add a sibling such as `missions/fire-rescue/` with its own domain, controller,
scene and cues. Decide its interaction first: continuous aiming and extinguishing
need not follow the excavator/truck/roller state machine. Extract shared mission
selection or progress contracts only when both implementations establish their
requirements. A generic mission engine is not required for this migration.

## History

- `bevy-prototype`: preserves the latest Rust code and original project notes.
- `web-prototype`: preserves the complete browser experiment under `web/`.
- `main`: becomes the root Web project after the migration checks pass.

The local checkout directory may retain its old name so existing Codex tasks
and browser previews keep working. The GitHub repository name and npm package
name are independent of that directory.
