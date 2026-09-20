# Cloudflare Pages deployment

Production URL: **[小小城市隊](https://town-crew.pages.dev)** on Cloudflare Pages.
The `town-crew` project was created on 2026-09-13 (Asia/Taipei) and received the
exact hostname `town-crew.pages.dev`, without a suffix.

## Build and publish

Vite emits the client-side game to `dist/`. Pages serves those files without
Functions, a database, server rendering, or runtime secrets. Run these commands
from the repository root with Node 24:

```sh
npm ci
npx wrangler login --scopes account:read user:read pages:write --use-keyring
npm run deploy:check
npm run deploy
```

The Pages project is created once with production branch `main`:

```sh
npx wrangler pages project create town-crew --production-branch main --force
```

`--force` is used only for initial creation with this Wrangler version: it opts
out of automatic Workers delegation so the project receives a `pages.dev`
hostname. It does not overwrite an existing project. Once the Pages project
exists, ordinary deployments target Pages without that flag.

`wrangler.jsonc` sets the project name, compatibility date and
`pages_build_output_dir`. The publish commands also specify the project and
branch explicitly, so a local feature branch cannot accidentally change which
Pages environment receives the upload.

- `deploy:check` runs the domain tests, TypeScript check and production build
  without uploading. The Pages deploy command has no `--dry-run` option.
- `deploy` runs those checks, then uploads `dist/` to production branch `main`.
- `deploy:preview` builds and uploads to branch `preview`, leaving production
  unchanged. Wrangler prints the deployment-specific and branch preview URLs.

Deployment credentials stay outside the repository in Wrangler's encrypted
credential store, with its key protected by the OS keychain. An existing login
may also retain Workers permissions for the earlier deployment; Pages publishing
requires `pages:write`.

## Automatic deployment and checks

The existing Pages project was connected to `kidwm/town-crew` on 2026-09-20 through
**Settings → Build → Git repository → Connect**, retaining `town-crew.pages.dev`
and its deployment history. The **Cloudflare Workers and Pages** GitHub App is
restricted to selected repositories, with `town-crew` included.

Pages build settings:

- Production branch: `main`, with automatic deployments enabled.
- Preview branches: all non-production branches.
- Build command: `npm run check` (domain tests, TypeScript check and Vite build).
- Output directory: `dist`; root directory: repository root; framework preset: None.
- Build system: Version 3; Node 24 is selected by the checked-in `.nvmrc`.

A push to `main` triggers Cloudflare's own build and publishes on success. Other
branches receive separate preview URLs. GitHub Actions does not upload the site,
so no Cloudflare API token or account secret is required in Actions.

The [GitHub Actions workflow](../.github/workflows/ci.yml) independently runs domain,
build, desktop, touch and development/HMR checks on `main`, `codex/**` pushes and
pull requests. New pushes cancel superseded checks on the same branch. Pages does
**not** wait for these browser checks: a direct push to `main` can publish before
they finish. Review the checks before merging a pull request.

Manual `npm run deploy` and the separate preview command remain available using
local Wrangler login; its credentials stay outside GitHub Actions.

## Release history and rollback

Inspect releases with:

```sh
npx wrangler pages deployment list --project-name town-crew
```

A previous successful production deployment can be restored with **Rollback to
this deployment** in the Pages dashboard. Preview deployments are separate from
production releases.

## Hosted verification

Run the existing mouse and touch suite against the assigned production URL:

```sh
PLAYWRIGHT_BASE_URL=https://town-crew.pages.dev npm run test:e2e
```

This skips the local preview server and exercises the hosted build. For system
Chrome, also set `PLAYWRIGHT_CHANNEL=chrome`. Real tablet audio, cold loading and
sustained frame rate still require hardware testing.

## Previous Workers release

The initial Workers release remains available at
<https://town-crew.wandererm.workers.dev>. It was published on 2026-09-13
(Asia/Taipei) from `e4d7b6d`, with version
`3f4e5375-58eb-421b-bc8b-df9d90c2e837`. The repository's deployment commands now
target Pages; the old Worker is not updated by them.

Sources:

- [Direct Upload and project naming](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Pages Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [Pages rollback](https://developers.cloudflare.com/pages/configuration/rollbacks/)
- [Pages GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)
- [Pages build image and Node version](https://developers.cloudflare.com/pages/configuration/build-image/)
