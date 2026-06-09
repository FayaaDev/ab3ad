# ab3ad

Next.js app for turning uploaded images into Hi3D generation jobs with PostgreSQL, Redis/BullMQ, and Cloudflare R2 storage.

## What is included

- Upload page, job status page, and admin archive
- `POST /api/uploads`
- `POST /api/generations`
- `GET /api/generations/:jobId`
- `GET /api/generations/:jobId/download`
- `POST /api/generations/:jobId/retry`
- `POST /api/hi3d/callback`
- `GET /api/health`
- Email/password auth with signed HTTP-only sessions
- Admin access allowlisting via `ADMIN_EMAILS` / `ADMIN_USER_IDS`
- Dedicated `lib/hi3d-client.ts`
- PostgreSQL persistence for users, assets, jobs, events, and billing entries
- Redis + BullMQ queueing for generation work
- Cloudflare R2 storage for uploads and generated results
- Mock Hi3D mode for local development

## Run locally

```bash
cp .env.example .env.local
npm install
docker compose up -d
npm run seed-admin
npm run worker
npm run dev
```

For local development, the app also falls back to the Docker Compose defaults for `DATABASE_URL`, `REDIS_URL`, and `AUTH_SECRET` when they are omitted. R2 is the default storage backend; if you do not want to use R2 locally, set `STORAGE_DRIVER=local`.

Open http://localhost:3000, create or sign into an account, then upload images.

## Production readiness notes

- `HI3D_MODE=mock` is only for local/dev. Set `HI3D_MODE=real` in production.
- `AUTH_SECRET` is required outside mock/demo usage; use a long random value.
- `npm run worker` must be running for background submission, polling fallback, and result download processing.
- `HI3D_CALLBACK_SECRET` secures the callback endpoint. The app accepts either:
  - `Authorization: Bearer <secret>`
  - `x-hi3d-callback-secret: <secret>`
  - `x-hi3d-signature: sha256=<hmac(rawBody)>`
- `HI3D_CALLBACK_URL_FIELD`, `HI3D_CALLBACK_SECRET_FIELD`, and `HI3D_SUBMIT_EXTRA_FIELDS` let you adapt submit payload fields to the exact Hi3D production contract without code changes.
- Result downloads can be restricted with `HI3D_ALLOWED_RESULT_HOSTS=host1,host2`.
- `/api/health` is restricted to signed-in admins unless you provide `HEALTHCHECK_TOKEN` via `Authorization: Bearer ...` or `x-healthcheck-token`.
- R2 is the default object storage backend. Set `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`.
- For no-cloud local testing only, set `STORAGE_DRIVER=local`; otherwise leave it as `r2`.

## Operator checks

Run these before launch or after infrastructure changes:

```bash
npm run lint
npm test
npm run build
npm run healthcheck
```

`npm run healthcheck` verifies PostgreSQL schema access, Redis/queue connectivity, storage readiness, and the active Hi3D mode/configuration.
