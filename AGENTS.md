# Agent Instructions

## Stack And Entrypoints
- Next.js 15 App Router app deployed to Cloudflare Workers through OpenNext; Wrangler entry is `.open-next/worker.js` from `wrangler.jsonc`.
- The main generation flow is wired through `app/api/generations/route.ts`, `lib/job-runner.ts`, `lib/queue.ts`, `lib/store.ts`, and `lib/storage.ts`.
- Auth is custom email/password with the signed HTTP-only `ab3ad_session` cookie in `lib/auth.ts`.

## Commands That Matter
- Local app flow: `cp .env.example .env.local && npm install && docker compose up -d && npm run seed-admin && npm run dev`.
- `npm run worker` starts the BullMQ worker for `JOB_QUEUE_MODE=redis` only.
- `npm run lint` is TypeScript only (`tsc --noEmit`); there is no separate ESLint command in `package.json`.
- Tests run with Node's test runner via `tsx --test tests/**/*.test.ts`. Run one file with `tsx --test tests/<name>.test.ts`.
- Cloudflare build/deploy commands all go through OpenNext: `npm run preview`, `npm run deploy:staging`, `npm run deploy`, `npm run cf:dry-run`.

## Runtime Quirks
- Deployed staging and production are both `JOB_QUEUE_MODE=inline` in `wrangler.jsonc`. In that mode `lib/queue.ts` uses Worker `waitUntil`; do not assume Redis worker processing is active in Cloudflare.
- `npm run worker` and `npm run healthcheck` call `scripts/load-env.ts` and then require non-empty `DATABASE_URL` and `REDIS_URL`. The app's dev/test fallbacks in `lib/env.ts` do not satisfy those scripts by themselves.
- PostgreSQL schema is auto-created and evolved inside `lib/db.ts` via `ensureDatabaseSchema()`. There is no migrations directory.
- `DATABASE_SCHEMA` changes the Postgres `search_path`; Wrangler sets different schemas for staging and production.
- Storage defaults to `r2`. `STORAGE_DRIVER=local` is the local-only escape hatch; local files live under `data/storage`.

## Constraints Worth Preserving
- Keep Hi3D callback verification and allowed result-host checks intact in `lib/hi3d-security.ts`.
- Do not serve provider result URLs directly. `lib/job-runner.ts` downloads final assets into app-controlled storage before users can fetch them.
- Generation creation must keep both ownership checks and wallet reservation before queueing the job.
- `/api/health` stays protected by admin auth or `HEALTHCHECK_TOKEN`.

## Sample Asset Gotchas
- Sample showcase files are allowlisted in `app/api/assets/samples/[name]/route.ts`; adding a new sample means updating that list.
- Preview GLBs are generated with `npm run previews:generate` into `data/storage/samples`.
- Preview requests intentionally stay on the app route so missing preview files can fall back to the original sample asset.

## Repo Workflow
- This repo uses `bd` for task tracking. Run `bd prime` for the local workflow before working from beads.
