# Initial Implementation Spec — 3D File Generation Service

## 1. Product goal

- Build a web service where users upload one or more images.
- Backend submits the images to Hi3D.
- Backend tracks generation status.
- User downloads the final 3D model file.
- MVP target output: .glb.
- Later outputs: .obj, .stl, .fbx, .usdz.

## 2. Non-negotiable architecture decision

- Do not call Hi3D directly from the browser.
- Browser should never see:
  - Hi3D client_id
  - Hi3D client_secret
  - Hi3D access token
- Browser uploads to your backend or storage.
- Backend owns:
  - Hi3D authentication
  - task creation
  - polling/callback handling
  - result download
  - file retention
  - billing/credits logic

## 3. Recommended MVP stack

- Frontend:
  - React / Next.js
  - Uppy Dashboard
  - @uppy/xhr-upload for MVP upload to backend
- Backend:
  - Node.js / Express or Next.js API routes
  - PostgreSQL for jobs/users/files
  - Redis + BullMQ for background jobs
- Storage:
  - S3-compatible storage:
    - AWS S3
    - Cloudflare R2
    - DigitalOcean Spaces
    - MinIO for local/dev
- Deployment:
  - Web app: VPS, Render, Fly.io, Railway, or your existing server
  - Worker: separate Node process
  - Database: Neon/Postgres
  - Redis: Upstash/Redis container
- Later optimization:
  - Move from browser → backend upload to browser → S3 signed upload if traffic grows.

## 4. User flow

- User opens upload page.
- User chooses mode:
  - Single image to 3D
  - Multi-view to 3D
- User uploads image(s) using Uppy.
- Frontend sends metadata:
  - selected mode
  - desired output format
  - model version
  - resolution
  - face count
  - PBR on/off
- Backend validates files.
- Backend stores original uploads.
- Backend creates internal generation_job.
- Worker submits job to Hi3D.
- Hi3D returns task_id.
- Backend stores task_id.
- Backend tracks status by:
  - callback endpoint, preferred
  - polling fallback
- On success:
  - backend downloads Hi3D result immediately
  - stores permanent copy in your storage
  - stores final model URL
  - marks job as completed
- User sees download/viewer page.
- User downloads .glb.

## 5. Upload rules

- Single-image mode:
  - allow exactly 1 file
  - allowed MIME types:
    - image/png
    - image/jpeg
    - image/jpg
    - image/webp
  - max size: 20 MB
- Multi-view mode:
  - allow 2–4 files
  - max size: 20 MB per image
  - view order must be explicit:
    - front
    - back
    - left
    - right
- Reject:
  - empty file
  - unsupported file type
  - more than 4 multi-view images
  - both images and multi_images in same Hi3D request
  - missing images
- Normalize filenames:
  - remove spaces
  - remove unsafe symbols
  - store with generated UUID, not user filename only

## 6. Uppy frontend implementation

- Use Uppy Dashboard for the MVP.
- Configure restrictions:
  - max file size: 20 * 1024 * 1024
  - allowed file types: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  - max number of files:
    - 1 for single mode
    - 4 for multi-view mode
- Use @uppy/xhr-upload initially.
- Upload endpoint:
  - POST /api/uploads
- Send metadata with upload:
  - mode
  - view_role
  - job_id if job created before upload
- Frontend states:
  - idle
  - uploading
  - uploaded
  - queued
  - processing
  - completed
  - failed
- After upload succeeds:
  - call POST /api/generations
  - then redirect to /jobs/:jobId

## 7. Backend API endpoints

- POST /api/uploads
  - receives image files from Uppy
  - validates MIME type and size
  - stores original file
  - creates file_asset records
  - returns uploaded asset IDs

- POST /api/generations
  - creates a 3D generation job
  - accepts:
    - asset IDs
    - mode
    - model
    - resolution
    - face count
    - output format
    - PBR option
  - validates Hi3D-compatible parameters
  - queues background job
  - returns job_id

- GET /api/generations/:jobId
  - returns job status
  - returns result URL if completed
  - returns failure message if failed

- POST /api/hi3d/callback
  - receives Hi3D status callbacks
  - verifies task exists
  - updates job state
  - if success, queues result download job

- GET /api/generations/:jobId/download
  - requires job ownership
  - returns signed download URL or streams file

- POST /api/generations/:jobId/retry
  - retries failed job
  - should create a new Hi3D task, not overwrite the old one blindly

## 8. Hi3D integration layer

- Create a dedicated service module:
  - hi3dClient.ts
- Responsibilities:
  - get access token
  - cache access token
  - submit task
  - query task
  - map Hi3D errors into internal errors
  - download result file
- Authentication:
  - use Basic auth to request token
  - use Bearer token for task submission/query
- Submit task:
  - endpoint: /open-api/v1/submit-task
  - method: POST
  - content type: multipart/form-data
- Query task:
  - endpoint: /open-api/v1/query-task
  - method: GET
  - query param: task_id

## 9. Hi3D task parameters

- Default MVP parameters:
  - request_type = 3
  - meaning: geometry + texture in one task
  - model = hitem3dv2.1
  - format = 2
  - meaning: .glb
  - resolution = 1536fast for fast mode
  - resolution = 1536pro for quality mode
  - pbr = 1
- Portrait mode:
  - use portrait model option when the uploaded subject is a human/character portrait
  - expose this as an advanced setting later
- Face count:
  - hide from normal users in MVP
  - set server-side preset
  - expose later as:
    - low
    - standard
    - high
- Output format:
  - MVP: .glb
  - Later:
    - .stl for 3D printing geometry
    - .obj for workflows needing separate texture files
    - .fbx for game/animation pipelines
    - .usdz for Apple ecosystem previews

## 10. Job state machine

- Internal statuses:
  - draft
  - uploaded
  - queued
  - submitted_to_hi3d
  - hi3d_created
  - hi3d_queueing
  - hi3d_processing
  - downloading_result
  - completed
  - failed
  - expired
  - cancelled
- Hi3D status mapping:
  - created → hi3d_created
  - queueing → hi3d_queueing
  - processing → hi3d_processing
  - success → downloading_result
  - failed → failed

## 11. Critical result-handling rule

- Hi3D result URLs are temporary.
- On success, backend must immediately:
  - fetch generated model URL
  - fetch cover image URL
  - save both to your own storage
  - never rely on Hi3D URL as the permanent customer download link
- If result download fails:
  - retry download
  - keep original Hi3D task_id
  - mark job as result_download_failed
  - alert admin if repeated failure

## 12. Database schema

- users
  - id
  - email
  - name
  - created_at

- file_assets
  - id
  - user_id
  - storage_key
  - original_filename
  - mime_type
  - size_bytes
  - sha256
  - role
  - values:
    - single
    - front
    - back
    - left
    - right
  - created_at

- generation_jobs
  - id
  - user_id
  - mode
  - values:
    - single_image
    - multi_view
  - status
  - model
  - resolution
  - face_count
  - pbr
  - output_format
  - hi3d_task_id
  - result_asset_id
  - cover_asset_id
  - error_code
  - error_message
  - created_at
  - updated_at
  - completed_at

- job_events
  - id
  - job_id
  - event_type
  - payload
  - created_at

- billing_events
  - id
  - user_id
  - job_id
  - event_type
  - credit_delta
  - created_at

## 13. Background workers

- submitHi3DJob
  - loads job
  - loads file assets
  - gets Hi3D token
  - submits multipart request
  - stores task_id
  - updates job status

- pollHi3DJob
  - fallback if callback not received
  - polls until terminal status
  - use backoff:
    - 10s
    - 20s
    - 30s
    - 60s
    - then every 2–5 minutes

- downloadHi3DResult
  - downloads final model
  - downloads cover image
  - uploads both to your storage
  - marks job completed

- cleanupExpiredFiles
  - deletes abandoned uploads
  - deletes old temporary files
  - preserves paid completed outputs according to retention policy

## 14. Security requirements

- Store Hi3D credentials only in server environment variables.
- Never log access tokens.
- Never log full Hi3D Authorization headers.
- Validate uploaded content by:
  - MIME type
  - file extension
  - magic bytes
  - size
- Apply rate limits:
  - per IP
  - per user
  - per account tier
- Use signed URLs for downloads.
- Add ownership checks to every job/file endpoint.
- Add virus/malware scanning later if accepting arbitrary files.
- Reject SVG uploads for MVP.
- Strip EXIF metadata from images if privacy matters.
- Do not expose raw storage bucket URLs if access control matters.

## 15. User-facing MVP screens

- Upload page:
  - image upload area
  - single/multi-view selector
  - quality selector:
    - fast
    - high quality
  - generate button

- Job progress page:
  - uploaded images preview
  - status timeline
  - current status
  - retry button if failed
  - download button if completed

- Result page:
  - cover image
  - embedded 3D viewer for .glb
  - download file
  - regenerate button
  - report bad result button

- Admin page:
  - recent jobs
  - failed jobs
  - Hi3D error codes
  - user email
  - cost/credit consumed
  - retry/download-result action

## 16. Error handling

- User upload errors:
  - unsupported file type
  - file too large
  - missing required view
  - duplicate view role
- Hi3D submission errors:
  - insufficient balance
  - invalid resolution
  - invalid face count
  - unsupported model
  - bad image
  - system error
- Result errors:
  - temporary URL expired
  - download failed
  - storage upload failed
- Internal errors:
  - database failure
  - worker crash
  - Redis unavailable
  - duplicate callback

## 17. Observability

- Log every job event.
- Track:
  - upload success rate
  - Hi3D submission success rate
  - generation success rate
  - average generation time
  - result download failure rate
  - cost per completed model
  - retry rate
- Add alerting for:
  - repeated Hi3D failures
  - insufficient balance
  - callback failures
  - result download failures
  - worker queue backlog

## 18. MVP scope

- Include:
  - account login
  - Uppy upload
  - single image generation
  - multi-view generation
  - .glb output
  - job progress page
  - callback endpoint
  - polling fallback
  - permanent result storage
  - basic admin dashboard

- Exclude initially:
  - payment integration
  - public marketplace
  - full 3D editing
  - Blender repair pipeline
  - automatic model quality scoring
  - multi-format batch exports
  - mobile app
  - advanced mesh repair
  - print-preparation tools

## 19. Implementation phases

- Phase 1 — Local proof of concept
  - upload one image
  - submit to Hi3D
  - poll task status
  - download .glb
  - save locally

- Phase 2 — MVP web flow
  - Uppy upload UI
  - backend upload endpoint
  - database job tracking
  - worker queue
  - result page

- Phase 3 — Storage hardening
  - S3/R2 storage
  - signed URLs
  - result retention policy
  - cleanup jobs

- Phase 4 — Multi-view support
  - enforce front/back/left/right ordering
  - support multi_images
  - add view labeling UI

- Phase 5 — Productization
  - user accounts
  - usage limits
  - admin dashboard
  - billing
  - quality presets
  - retry/regenerate controls

## 20. Biggest risks

- Result URL expiry:
  - solve by downloading immediately after success.
- Bad input images:
  - solve with upload guidance, examples, and pre-processing.
- Cost leakage:
  - solve with authenticated users, rate limits, and credit checks before submitting to Hi3D.
- Long-running jobs:
  - solve with queue workers and async status pages.
- Failed callbacks:
  - solve with polling fallback.
- Users expecting print-ready models:
  - do not promise that initially.
  - generation output is not the same as watertight, repaired, print-ready mesh.