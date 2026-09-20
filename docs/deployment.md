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

## Release policy and rollback

This is a Direct Upload project. The [GitHub Actions workflow](../.github/workflows/ci.yml)
builds and tests pushes and pull requests. A push to `main` automatically publishes
after both desktop and touch jobs pass, including the desktop development/HMR checks.
The deploy job downloads the exact `dist/` artifact exercised by the desktop tests
and uploads it with the lockfile-pinned Wrangler version. It does not rebuild it.
Pull requests and `codex/**` branch pushes run checks without publishing.
New pushes cancel superseded runs on the same branch.

Configure these repository **Actions secrets** once:

- `CLOUDFLARE_ACCOUNT_ID`: the account containing the `town-crew` Pages project.
- `CLOUDFLARE_API_TOKEN`: a dedicated token with **Account → Cloudflare Pages → Edit**,
  limited to that account. Local Wrangler OAuth credentials are not copied to CI.

The production deployment job uses the `production` GitHub environment and records
the source commit hash in Pages. Missing credentials fail with a clear error;
failed tests prevent the deploy job from running. Manual `npm run deploy` and the
separate preview command remain available.

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
- [Direct Upload from CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
