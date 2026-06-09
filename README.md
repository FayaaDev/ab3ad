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
- Persistent local file storage under `data/storage`
- Local JSON persistence for users, assets, jobs, and events
- Mock Hi3D mode for local development

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000.

## Notes

- `HI3D_MODE=mock` lets the full flow run without real Hi3D credentials.
- The current implementation uses local JSON + filesystem persistence so the MVP can run in an empty repo without external services.
- Swap the storage/repository layers for PostgreSQL, Redis/BullMQ, and S3/R2 when moving from local MVP to production.
- Multi-view upload validation exists server-side, but the UI still needs explicit per-image front/back/left/right labeling before production release.
