# Agent Instructions

## Project
- `ab3ad` is a Next.js app that turns uploaded images into 3D models via Ab3ad3d.
- Production-shaped flow: authenticated users upload images, the app stores assets/jobs in PostgreSQL, a Redis/BullMQ worker submits and polls Ab3ad3d, and completed `.glb` files are stored by the app before download.
- Frontend pages: upload, login, job status, admin.
- Backend: App Router routes under `app/api/**`.
- Persistence/services: PostgreSQL, Redis + BullMQ, Cloudflare R2.
- Auth is email/password with signed HTTP-only session cookies.
- Admin access is restricted to authenticated admins / allowlists.

## Core Files
- `app/page.tsx` - authenticated upload entry
- `app/login/page.tsx` - login/register UI
- `app/jobs/[jobId]/page.tsx` - job progress UI
- `app/admin/page.tsx` - admin jobs and wallet visibility
- `app/api/auth/**` - auth/session endpoints
- `app/api/uploads/route.ts` - upload validation and persistence
- `app/api/generations/**` - create/status/download/retry APIs
- `app/api/hi3d/callback/route.ts` - signed Ab3ad3d callback handler
- `app/api/health/route.ts` - protected readiness endpoint
- `lib/hi3d-client.ts` - Ab3ad3d client
- `lib/job-runner.ts` - queue job orchestration and durable result downloads
- `lib/storage.ts` - local/R2 storage helpers
- `lib/store.ts` - PostgreSQL persistence helpers, billing/wallet data
- `lib/auth.ts` / `lib/auth-utils.ts` - auth/session helpers
- `lib/hi3d-security.ts` - callback verification and trusted result-host checks
- `lib/queue.ts` / `lib/worker.ts` - BullMQ enqueue + worker process
- `scripts/load-env.ts` - env loading for worker/scripts

## User Flow
1. User signs in.
2. User uploads an image through `/api/uploads`.
3. UI calls `/api/generations` to queue a generation job.
4. Worker submits to Ab3ad3d, polls or handles callbacks, downloads the result into app-controlled storage, and marks the job complete.
5. User downloads the stored `.glb` from the app.

## Security Rules
- Keep secrets server-side only; never expose Ab3ad3d credentials to the browser.
- Preserve asset/job ownership checks on all file and generation endpoints.
- Do not reintroduce `x-demo-user` or any client-controlled identity shortcut.
- Keep `/api/health` protected by admin auth or `HEALTHCHECK_TOKEN`.
- Keep Ab3ad3d callback verification and trusted result-host checks intact.
- Do not rely on transient Ab3ad3d result URLs; results must be downloaded into local/object storage.

## Current Status
- Local authenticated upload -> queued job -> worker processing -> stored `.glb` download is working.
- `scripts/load-env.ts` handles empty exported env vars correctly so `.env` / `.env.local` can still supply `DATABASE_URL` and `REDIS_URL`.
- Recent deployment epic `ab3ad-495` is closed: Cloudflare fast-hybrid rollout was completed, including OpenNext/Wrangler scaffolding, staging validation, and production cutover checks.
- Recent payment epic `ab3ad-1zs` is closed: wallet ledger, credit enforcement, wallet UI/history, fake top-up flow, admin credit tools, and regression coverage are in place.
- Current production shape is Cloudflare-hosted app/API with PostgreSQL and the existing Redis/BullMQ worker still external.

## Local Dev Notes
- Typical startup: `cp .env.example .env.local`, `npm install`, `docker compose up -d`, `npm run seed-admin`, `npm run worker`, `npm run dev`.
- The web app and worker are separate processes. If uploads work but jobs stay `queued`, check the worker first.
- If `/api/uploads` and `/api/generations` return `200` but `pollAttempts` stays `0`, inspect worker env/process health before touching frontend code.
- If the worker reaches `submit_started` or `submitted_to_hi3d`, then investigate Ab3ad3d config/mode.
- Local/dev default is `HI3D_MODE=mock`; production should use real Ab3ad3d credentials plus callback signing.

## Beads
- Use `bd` for task tracking; do not use markdown TODOs.
- Start with `bd prime`.
- Common commands: `bd ready`, `bd show <id>`, `bd update <id> --claim`, `bd close <id>`.
- Use `bd remember "note"` for persistent knowledge.

## Quality Gates
- `npm run lint`
- `npm test`
- `npm run build`

## Follow-ups
- Add signed upload URLs if direct-to-bucket uploads are needed later.
- Add broader production smoke tests for the full app + worker + infra path.
- Adjust callback fields or submit extras via env if the real Ab3ad3d contract differs.
- Consider a worker startup self-check that confirms required env keys are present without printing secrets.

## Session Close
- If code changed: run lint, tests, and build.
- Close completed beads.
- If a git remote exists, `git pull --rebase && git push` before ending.
