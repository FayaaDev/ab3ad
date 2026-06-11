# Cloudflare deployment runbook

This app uses a fast-hybrid launch topology:

- Cloudflare Workers runs the Next.js app/API through OpenNext.
- Cloudflare R2 stores uploaded source images, generated results, and sample `.glb` assets.
- PostgreSQL remains external for now. The production database is the ab3ad-owned Supabase project `ab3ad-production` (`db.mxignpctthsoouefkbci.supabase.co`, database `postgres`, user `postgres`, SSL required). Cloudflare Workers connect through the `HYPERDRIVE` binding; `DATABASE_URL` remains the fallback for local scripts and non-Workers runtimes.
- Job dispatch supports two modes. `JOB_QUEUE_MODE=inline` uses Cloudflare `waitUntil` to submit Hi3D work and relies on signed callbacks for completion; this is the current production/staging mode because the Worker cannot reach a private/local Redis endpoint. `JOB_QUEUE_MODE=redis` is reserved for an external BullMQ worker once a public Redis endpoint and worker runtime are configured to share the ab3ad production database (`DATABASE_SCHEMA=ab3ad_production` or the matching `HYPERDRIVE` binding), `REDIS_URL`, `R2_*`, `JOB_QUEUE_NAME`, and Hi3D callback settings.

## Cloudflare resources

Configured in `wrangler.jsonc`:

- Workers: `ab3ad-staging`, `ab3ad`
- R2 app bucket binding: `APP_STORAGE` -> `ab3ad-production`
- R2 OpenNext cache binding: `NEXT_INC_CACHE_R2_BUCKET` -> `ab3ad-open-next-cache`
- OpenNext self-reference binding: `WORKER_SELF_REFERENCE`
- Hyperdrive binding: `HYPERDRIVE` -> `ab3ad-production` (`48941da9b03f4167970cbff70e31b17b`) in production and `ab3ad-staging` (`b7fe6574cd6446399ee4942fdb0ce29a`) in staging.
- Isolated Postgres schemas/users on the ab3ad-owned Supabase project: `ab3ad_staging` and `ab3ad_production`.
- Staging queue mode: `JOB_QUEUE_MODE=inline`
- Production queue mode: `JOB_QUEUE_MODE=inline`
- Worker-side preview GLB generation disabled with `PREVIEW_GLB_GENERATION=disabled` to avoid CPU-heavy mesh/texture transforms inside Cloudflare Workers
- Observability enabled in staging and production

Production currently uses `JOB_QUEUE_MODE=inline` so the Worker submits Hi3D jobs without depending on the unavailable private Redis endpoint; signed Hi3D callbacks perform completion/result storage. Switch back to `JOB_QUEUE_MODE=redis` only after verifying the external BullMQ worker can reach the same PostgreSQL schema, R2 bucket, Redis queue, and Hi3D callback URL.

## Required configuration per environment

Use `wrangler secret bulk --env staging <file>` and `wrangler secret bulk --env production <file>` for secrets, and set non-secret vars in the environment config, with values for:

- `AUTH_SECRET`
- `ADMIN_EMAILS`
- `HEALTHCHECK_TOKEN`
- `DATABASE_URL` for scripts and the external worker; use the ab3ad Supabase direct PostgreSQL URL with SSL required, not any other project database
- `DATABASE_SCHEMA` (`ab3ad_production` for production worker/admin scripts, `ab3ad_staging` for staging scripts)
- `REDIS_URL` when `JOB_QUEUE_MODE=redis`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT` for non-Workers runtimes and compatibility fallback
- `HI3D_CLIENT_ID`, `HI3D_CLIENT_SECRET`
- `HI3D_CALLBACK_SECRET`
- `SAMPLE_ASSET_BASE_URL` pointing at the public R2/custom-domain prefix for `samples/` assets, for example `https://assets.example.com/samples`
- optional `HI3D_ALLOWED_RESULT_HOSTS`, `HI3D_SUBMIT_EXTRA_FIELDS`, `PREVIEW_GLB_GENERATION` for the external worker

Do not commit secret files or print secret values in logs.

## Production database record

- Provider/project: Supabase project `ab3ad-production` in org `zitdjdsefzfrtyrcwfuo`.
- Project ref/host: `mxignpctthsoouefkbci` / `db.mxignpctthsoouefkbci.supabase.co`.
- Database/users: PostgreSQL database `postgres`; production connects as user/schema `ab3ad_production`, staging connects as user/schema `ab3ad_staging`.
- SSL: required. Cloudflare Hyperdrive uses `sslmode=require`; Node scripts set `DATABASE_SSL=true`.
- Cloudflare Hyperdrive: production `ab3ad-production`, id `48941da9b03f4167970cbff70e31b17b`, binding `HYPERDRIVE`, caching disabled, origin connection limit `10`; staging `ab3ad-staging`, id `b7fe6574cd6446399ee4942fdb0ce29a`, origin connection limit `5`.
- Backup posture: Supabase-managed project backups are the source of record; no repository-managed dump job is configured. Before storing high-value production data, confirm the Supabase plan backup/PITR setting in the Supabase dashboard and add an app-level dump runbook if required.
- Ownership: owned by the ab3ad deployment in the FayaaDev Cloudflare account and the Supabase org above. Do not point production back to databases or Hyperdrive configs owned by other projects.

## Deployment commands

```bash
npm run lint
npm test
npm run build
npx opennextjs-cloudflare build
wrangler deploy --dry-run --env staging
npm run deploy:staging
npm run deploy
```

## Launch verification

Staging and production checks:

1. `GET /login` returns `200`.
2. `GET $SAMPLE_ASSET_BASE_URL/abady.glb` returns `200` with long-lived cache headers.
3. `GET /api/health` with `Authorization: Bearer $HEALTHCHECK_TOKEN` returns `ok: true`.
4. Register/sign in with an admin allowlisted email.
5. Upload one valid image through `/api/uploads`.
6. Create a generation through `/api/generations`.
7. Confirm staging inline mode writes job events, or in production confirm the external Redis/BullMQ worker writes job events.
8. Confirm `/api/hi3d/callback` rejects unsigned callbacks when `HI3D_MODE=real` and accepts the configured signature.
9. Confirm completed result downloads come from `/api/generations/:jobId/download`, backed by app-controlled R2 storage.
10. Confirm admin page shows jobs and failure diagnostics.

Rollback uses Wrangler versions:

```bash
wrangler versions list --name ab3ad
wrangler rollback --name ab3ad
```
