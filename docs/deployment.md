# Cloudflare deployment

Selected platform: **Cloudflare Workers Static Assets**. Initial publication is
pending completion of Wrangler authorization. The configuration and local dry
run are ready; no custom domain or automatic production release is configured.

## Build and publish

The game is entirely client-side. Vite emits `dist/`; Cloudflare serves those
files without a Worker script, database, server rendering, or runtime secrets.
Run commands from the repository root with Node 24.

```sh
npm ci
npx wrangler login --scopes account:read user:read workers_scripts:write --use-keyring
npm run check
npx playwright install chromium
npm run test:e2e
npm run test:e2e:dev
npm run deploy:check
npm run deploy
```

`deploy:check` builds and runs `wrangler deploy --dry-run` without publishing.
`deploy` repeats rules/build checks and publishes Worker `town-crew` to its
 default HTTPS `workers.dev` hostname. Wrangler prints the exact URL and version
ID; use that URL for device testing. Credentials stay in the OS keychain.

The `workers_dev` and `preview_urls` settings are explicit in `wrangler.jsonc`.
There is no `main` script or dynamic resource binding. Only `dist/` is uploaded.

## Preview and release policy

- GitHub pushes and PRs run domain, production browser and development checks.
- Publishing is explicit: a Git push alone does not deploy the game.
- `npm run deploy:preview` uploads a version and prints a preview URL without
  replacing production. Use previews for feedback before a release.
- `npm run deploy` publishes the current build. Record its version ID for rollback.
- To restore a previous release, inspect `npx wrangler deployments list`, then
  use `npx wrangler rollback <version-id>` for a known, previously tested version.

If automated releases become useful, connect Git builds with distinct preview
and production commands, or add a release workflow with a scoped Cloudflare
credential. That is separate from the current build/test CI.

## Verification and device follow-up

Verify the deployed URL, JS/CSS responses, full mission, cancellation and restart
using the same production browser suite. Real iPad/Android touch, audible cues,
cold loading and sustained frame rate still require hardware testing.

## Why this platform

Cloudflare's static-asset requests are free and unlimited, and new static
projects are directed to Workers Static Assets. Optional dynamic Workers,
storage products and build quotas have their own limits.

Alternatives considered were Vercel (convenient previews, but Hobby is for
personal non-commercial use) and GitHub Pages (sufficient for a public static
demo, with additional setup for branch previews and project-path hosting).

Sources checked 2026-09-12:

- [Static-asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [New-project guidance](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/#use-workers-static-assets-for-new-projects)
- [Cloudflare Git builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
