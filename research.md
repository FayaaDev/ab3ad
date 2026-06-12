# Research: PrintPal and Meshy image-to-3D APIs

## Summary
For a Next.js backend adapter, **Meshy** is the clearer fit: it uses **API-key Bearer auth**, a **task-based async lifecycle** (`create -> poll -> success/failure -> download result URLs`), and exposes dedicated **image-to-3D** flows with preview/refine-style generation and downloadable model assets. **PrintPal** could not be verified confidently from this environment, so its adapter contract should not be implemented until its live docs are confirmed directly at the vendor URL.

## Findings
1. **Meshy uses API-key authentication and async task polling** — Meshy’s API is built around authenticated task creation, then polling a task endpoint until completion. For a backend adapter, treat generation as a long-running job, persist the provider task ID, and never call it directly from the browser. [Source](https://docs.meshy.ai/en)
2. **Meshy supports image-to-3D as a distinct generation flow** — The provider exposes image-driven 3D generation rather than only text-driven creation. Adapter design should model at least: `submit image`, `check task`, `map terminal status`, and `collect result asset URLs/metadata`. [Source](https://docs.meshy.ai/en)
3. **Meshy’s lifecycle is task-oriented: request -> queued/running -> terminal status -> asset URLs** — The typical response shape includes a task identifier plus status/progress fields; terminal states include success/failure, after which the response includes generated asset locations. This maps cleanly to your app’s existing provider job model. [Source](https://docs.meshy.ai/en)
4. **Meshy adapter-relevant request options include model/quality/topology/output controls** — Meshy’s docs expose generation parameters around quality/detail and output characteristics (for example mesh topology/polycount/texture-related controls, depending on endpoint/version). In the adapter, keep a provider-specific option bag and normalize only the subset your UI actually needs. [Source](https://docs.meshy.ai/en)
5. **Meshy result handling should treat returned file URLs as transient provider outputs** — The API returns generated model assets and previews as URLs/fields in the task result. For your backend, download the final result into app-controlled storage before exposing it, matching your existing security model. [Source](https://docs.meshy.ai/en)
6. **PrintPal documentation needs direct confirmation before implementation** — I could not verify PrintPal’s auth scheme, endpoint shapes, statuses, generation types, or result fields confidently enough to recommend an adapter contract. The safe next step is to inspect the vendor docs directly and capture exact request/response examples before coding. [Source](https://printpal.io/api/documentation)

## Provider notes for adapter design

### Meshy
- **Auth:** Bearer API key in server-side requests. [Source](https://docs.meshy.ai/en)
- **Lifecycle:** create generation task -> store provider task ID -> poll status endpoint -> on success, read result URLs/metadata -> download into owned storage. [Source](https://docs.meshy.ai/en)
- **Generation types:** at minimum image-to-3D; Meshy also documents broader 3D/media generation capabilities, but the adapter can scope to image-to-3D first. [Source](https://docs.meshy.ai/en)
- **Parameters to model carefully:** source image input, model/version selection, preview/refine or draft/final quality stage, topology/polycount controls, texture/material options, and output format controls where supported. [Source](https://docs.meshy.ai/en)
- **Statuses to normalize:** non-terminal (`queued`/`pending`/`running`-style), terminal success, terminal failure, and cancellation if exposed by the endpoint. Confirm exact enum values from the current docs before hard-coding. [Source](https://docs.meshy.ai/en)
- **Result fields:** provider task ID, status/progress, preview thumbnail(s), and downloadable model asset URL(s) / file fields after success. [Source](https://docs.meshy.ai/en)
- **Constraints:** async-only flow; potentially long runtimes; external result URLs should be treated as untrusted/transient; provider-specific options likely vary by endpoint/model version. [Source](https://docs.meshy.ai/en)

### PrintPal
- **Status:** insufficiently verified from this environment. [Source](https://printpal.io/api/documentation)
- **Do not assume:** auth header names, sync vs async behavior, webhook support, status enums, or whether image-to-3D is a first-class endpoint vs a wrapper over another provider. [Source](https://printpal.io/api/documentation)

## Sources
- Kept: Meshy Docs (https://docs.meshy.ai/en) — authoritative vendor documentation for auth, task flow, and provider capabilities.
- Kept: PrintPal API Documentation (https://printpal.io/api/documentation) — authoritative vendor URL, but details still need live confirmation.
- Dropped: Third-party blogs/search results — not needed when vendor docs are the correct source of truth.

## Gaps
- I could not confidently verify **PrintPal’s** exact endpoint contract, auth method, status enums, request schema, or result fields from this environment.
- I also did not hard-code **Meshy’s exact current enum names/field names** without a live doc read, to avoid inventing details.
- Suggested next steps:
  1. Open both vendor docs directly and capture one concrete request/response example per image-to-3D flow.
  2. Confirm exact auth headers, status enums, output format fields, and whether webhooks are supported.
  3. Then define a minimal adapter interface: `createJob`, `getJob`, `cancelJob?`, `downloadResult`.
