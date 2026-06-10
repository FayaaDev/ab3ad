# Cloudflare deployment runbook

This app uses a fast-hybrid launch topology:

- Cloudflare Workers runs the Next.js app/API through OpenNext.
- Cloudflare R2 stores uploaded source images, generated results, and sample `.glb` assets.
- PostgreSQL remains external for now. Prefer a Cloudflare Hyperdrive binding named `HYPERDRIVE`; `DATABASE_URL` remains the fallback for local scripts and non-Workers runtimes.
- Job dispatch supports two modes. `JOB_QUEUE_MODE=redis` keeps Redis/BullMQ external and requires the Worker plus external worker process to share `DATABASE_URL`/`HYPERDRIVE`, `REDIS_URL`, `R2_*`, `JOB_QUEUE_NAME`, and Hi3D callback settings. `JOB_QUEUE_MODE=inline` uses `waitUntil` for the Cloudflare smoke/launch path and avoids request-time filesystem or Redis assumptions.

## Cloudflare resources

Configured in `wrangler.jsonc`:

- Workers: `ab3ad-staging`, `ab3ad`
- R2 app bucket binding: `APP_STORAGE` -> `ab3ad-production`
- R2 OpenNext cache binding: `NEXT_INC_CACHE_R2_BUCKET` -> `ab3ad-open-next-cache`
- OpenNext self-reference binding: `WORKER_SELF_REFERENCE`
- Hyperdrive binding: `HYPERDRIVE`
- Isolated Postgres schemas: `ab3ad_staging`, `ab3ad_production`
- Launch queue mode: `JOB_QUEUE_MODE=inline`
- Observability enabled in staging and production

For a Redis/BullMQ worker cutover, switch `JOB_QUEUE_MODE` to `redis` and verify the external worker can reach the same PostgreSQL schema, R2 bucket, and Hi3D callback URL before changing traffic.

## Required configuration per environment

Use `wrangler secret bulk --env staging <file>` and `wrangler secret bulk --env production <file>` for secrets, and set non-secret vars in the environment config, with values for:

- `AUTH_SECRET`
- `ADMIN_EMAILS`
- `HEALTHCHECK_TOKEN`
- `DATABASE_URL` unless a `HYPERDRIVE` binding is configured
- `REDIS_URL` when `JOB_QUEUE_MODE=redis`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT` for non-Workers runtimes and compatibility fallback
- `HI3D_CLIENT_ID`, `HI3D_CLIENT_SECRET`
- `HI3D_CALLBACK_SECRET`
- `SAMPLE_ASSET_BASE_URL` pointing at the public R2/custom-domain prefix for `samples/` assets, for example `https://assets.example.com/samples`
- optional `HI3D_ALLOWED_RESULT_HOSTS`, `HI3D_SUBMIT_EXTRA_FIELDS`

Do not commit secret files or print secret values in logs.

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
2. `GET $SAMPLE_ASSET_BASE_URL/Alisa.glb` returns `200` with long-lived cache headers.
3. `GET /api/health` with `Authorization: Bearer $HEALTHCHECK_TOKEN` returns `ok: true`.
4. Register/sign in with an admin allowlisted email.
5. Upload one valid image through `/api/uploads`.
6. Create a generation through `/api/generations`.
7. Confirm `JOB_QUEUE_MODE=inline` or the external Redis/BullMQ worker writes job events, depending on the active queue mode.
8. Confirm `/api/hi3d/callback` rejects unsigned callbacks when `HI3D_MODE=real` and accepts the configured signature.
9. Confirm completed result downloads come from `/api/generations/:jobId/download`, backed by app-controlled R2 storage.
10. Confirm admin page shows jobs and failure diagnostics.

Rollback uses Wrangler versions:

```bash
wrangler versions list --name ab3ad
wrangler rollback --name ab3ad
```
