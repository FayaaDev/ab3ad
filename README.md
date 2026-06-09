# ab3ad

Initial implementation of the `plan.md` 3D file generation service.

## What is included

- Next.js web app with upload page, job page, and admin page
- Uppy Dashboard upload flow
- `POST /api/uploads`
- `POST /api/generations`
- `GET /api/generations/:jobId`
- `GET /api/generations/:jobId/download`
- `POST /api/generations/:jobId/retry`
- `POST /api/hi3d/callback`
- Dedicated `lib/hi3d-client.ts`
- PostgreSQL persistence for users, assets, jobs, events, and billing entries
- Redis + BullMQ queueing for generation work
- S3-compatible object storage for uploads and generated results
- Mock Hi3D mode for local development

## Run locally

```bash
cp .env.example .env.local
npm install
docker compose up -d
npm run seed
npm run worker
npm run dev
```

Open http://localhost:3000.

## Notes

- `HI3D_MODE=mock` lets the full flow run without real Hi3D credentials.
- Local infrastructure uses PostgreSQL + Redis + MinIO so development matches production architecture.
- The app auto-creates its PostgreSQL tables on first use.
- `npm run worker` must be running for background submission/poll/download processing.
- Replace the MinIO/S3 settings with AWS S3 or Cloudflare R2 values in production.
- For Cloudflare R2, set `STORAGE_DRIVER=r2`, `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`.
- Multi-view upload validation exists server-side, but the UI still needs explicit per-image front/back/left/right labeling before production release.
