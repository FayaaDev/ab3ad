# Agent Instructions

## Project
- `ab3ad` is a Next.js 15 App Router app that turns uploaded images into 3D models through Ab3ad3d/Hi3D.
- The app runs on Cloudflare Workers via OpenNext; storage is Cloudflare R2; PostgreSQL stays external and Workers reach it through Hyperdrive.
- Auth is email/password with signed HTTP-only `ab3ad_session` cookies.
- Users have wallets/credits; starting a generation requires available credits and a completed generation debits `1` credit.

## Current App Shape
- Public/auth pages: `/`, `/login`, `/profile`, `/jobs/[jobId]`, `/admin`.
- Home page shows the sample model marquee and the authenticated upload studio.
- Profile page shows wallet balance/history plus recent user jobs and download links.
- Admin page shows job diagnostics and wallet grant controls.
- Sample showcase assets are served from `/api/assets/samples/[name]` with preview fallback support.

## Backend
- Auth/session routes: `app/api/auth/**`.
- Upload route: `app/api/uploads/route.ts` stores validated source files in app-controlled storage.
- Generation routes: `app/api/generations/**` create jobs, expose status, retries, and stored result downloads.
- Wallet routes: `app/api/wallet/**` expose balance/history and the current fake top-up flow.
- Profile jobs route: `app/api/profile/jobs/route.ts` refreshes active jobs and returns user-facing job summaries.
- Admin wallet grant route: `app/api/admin/wallet/grants/route.ts` adjusts user credits.
- Health route: `app/api/health/route.ts` is protected by admin auth or `HEALTHCHECK_TOKEN`.

## Runtime And Infra
- `wrangler.jsonc` defines staging and production Workers, `APP_STORAGE` R2, OpenNext cache R2, self-service binding, Hyperdrive, and observability.
- Current staging and production queue mode is `JOB_QUEUE_MODE=inline`.
- Inline mode uses Worker `waitUntil` for submit/poll work and signed Hi3D callbacks for completion.
- `JOB_QUEUE_MODE=redis` still exists for an external BullMQ worker, but it is not the current deployed default.
- Worker-side preview GLB generation is disabled in Cloudflare deploys with `PREVIEW_GLB_GENERATION=disabled`.
- Non-Worker runtimes can still use `DATABASE_URL`, `REDIS_URL`, and `R2_*` credentials directly.

## Core Files
- `app/page.tsx` - sample marquee plus upload entry.
- `app/profile/page.tsx` - authenticated wallet/jobs view.
- `app/admin/page.tsx` - admin jobs table and wallet controls.
- `lib/job-runner.ts` - Hi3D submit/query/callback handling, stored result download, wallet debit.
- `lib/queue.ts` - inline vs Redis queue dispatch.
- `lib/storage.ts` - local/R2 read-write helpers and trusted result fetches.
- `lib/store.ts` - PostgreSQL persistence for users, assets, jobs, events, wallet ledger.
- `lib/hi3d-security.ts` - callback verification and allowed result-host checks.
- `lib/cloudflare.ts` - OpenNext Cloudflare context, R2 binding, Hyperdrive binding.
- `scripts/load-env.ts` - local script env loading; ignores empty exported vars so `.env.local` can fill them.

## User Flow
1. User signs in or registers.
2. User uploads validated image files through `/api/uploads`.
3. UI calls `/api/generations`; ownership and wallet checks run before the job is created.
4. Inline Worker flow or external worker submits to Hi3D, tracks status, and handles signed callbacks.
5. The app downloads the final `.glb` into app-controlled storage, records assets/events, and debits the wallet on completion.
6. User downloads the stored result from `/api/generations/[jobId]/download`.

## Security Rules
- Keep Hi3D credentials and callback secrets server-side only.
- Preserve asset/job ownership checks on all asset and generation routes.
- Do not reintroduce client-controlled identity shortcuts such as `x-demo-user`.
- Keep `/api/health` protected by admin auth or `HEALTHCHECK_TOKEN`.
- Keep signed callback verification and trusted result-host checks intact.
- Do not serve transient Hi3D result URLs directly; always download into app-controlled storage first.

## Local Dev And Quality
- Typical local flow: `cp .env.example .env.local`, `npm install`, `docker compose up -d`, `npm run seed-admin`, `npm run worker`, `npm run dev`.
- Local/test defaults fill `AUTH_SECRET`, `DATABASE_URL`, and `REDIS_URL` when needed.
- `HI3D_MODE=mock` is the normal local mode.
- Tests live under `tests/**/*.test.ts`; current coverage includes auth utils, env/loading, Hi3D client/security, sample assets, storage, validation, and wallet behavior.
- Quality gates: `npm run lint`, `npm test`, `npm run build`.

## Beads
- Use `bd` for task tracking, not markdown TODOs.
- Start sessions with `bd prime`; inspect work with `bd ready` / `bd show <id>`.
- Claim with `bd update <id> --claim`, close with `bd close <id>`, persist notes with `bd remember`.
- If you change code, finish with quality gates, update beads, then `git pull --rebase`, `bd dolt push`, and `git push`.
