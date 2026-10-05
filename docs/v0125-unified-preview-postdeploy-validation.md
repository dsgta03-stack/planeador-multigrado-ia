# v0.12.5 Unified Preview — post-deploy shadow validation

Date: 2026-10-05
Integration branch: `v0125-unified-preview-integration-shadow`
Validated source head before this evidence commit: `bfefa91c6f9c990e1eeff85c43bd7976689ed9d0`

## Scope

This record documents post-deployment validation of the isolated v0.12.5 unified preview shadow service only. It does not modify or promote `main`, product production, PR #3, or PR #4.

## Railway deployment

Shadow project: `Multiplan SessionGraph R2 Shadow`
Service: `v0125-unified-preview-shadow`
Service ID: `b20d39a6-d786-412f-8fb4-32e3418be399`
Deployment ID: `5b7388a6-e52d-4df2-bfcc-380c5acda40a`
Deployment status: `SUCCESS`
Public domain: `https://v0125-unified-preview-shadow-production.up.railway.app`

Runtime health after validation:

- state: Online
- running replicas: 1
- crashed replicas: 0
- warning count: 0
- critical count: 0
- recent failures: 0
- no volume attached

## Public health smoke

`GET /v0125_health` returned `ok: true` with:

- version `0.12.5-unified-preview-shadow`
- `UNIFIED_PREVIEW_SERVER_ROUTE_V1`
- canonical review enabled
- canonical DOCX enabled
- canonical snapshot persistence enabled
- `legacyWrapperChainSpawned: false`
- `productionModified: false`

## Authenticated route smoke without provider execution

A fresh browser Authorization bearer was first validated against the existing production `/api/history` endpoint with HTTP 200. The credential was not committed or recorded.

An authenticated `POST /api/v0125/unified-plan` with structurally valid grades, PDA, methodology, sessions, duration, problem and context, but intentionally without teacher constraints, returned:

- HTTP 422
- status `NEEDS_TEACHER_INPUT`
- `renderable: false`
- `canonical_plan_hash: null`
- `plan: null`
- code `NEEDS_TEACHER_INPUT`

Missing fields were exactly:

- `students_by_grade`
- `reading_profile`
- `writing_profile`
- `autonomy_profile`
- `connectivity`
- `available_resources`
- `supports`
- `teacher_explicit_constraints`

Railway recorded the request as HTTP 422 with a 2 ms total duration. The v0.12.5 route returns at the teacher-input boundary before pipeline/provider execution for this state.

## PB-013 source-only authenticated preflight

The exact `PB-013-COMUNITARIO-PASS` fixture inputs were adapted through the production-style source boundary using the authenticated Supabase curriculum lookup. No Gemini/provider generation was invoked.

Result:

- status: `READY_FOR_PIPELINE`
- constraints hash: `231186405b12537fc00f9cb7d644bb98e7c79b2cc9eb7cae401aecc399c5400a`
- curriculum snapshot hash: `e67ab1bb301cebefc9f31f500d0a2e4d8d795ab26a4f26b6840749cca6e9a5bf`
- selected methodology: `proyectos_comunitarios`
- methodology selection source: `TEACHER`
- required operations: `IDENTIFICACION`, `RECUPERACION`, `PLANIFICACION`, `ACERCAMIENTO`, `COMPRENSION_Y_PRODUCCION`, `RECONOCIMIENTO`, `CONCRECION`, `INTEGRACION`, `DIFUSION`, `CONSIDERACIONES`, `AVANCES`

The constraints and curriculum hashes exactly reproduce the certified 5D-P source hashes.

### Methodology decision identity note

`makeDecision()` creates a fresh `methodology_decision_id` with `randomUUID()` on each reconstruction. `sourceBinding()` hashes the complete methodology decision object, so a newly reconstructed methodology decision is not expected to reproduce the historical decision UUID/hash byte-for-byte even when `selected_id`, `selection_source`, catalog version and required operations are identical. This is expected identity behavior, not curriculum or methodology drift.

## Interpretation

Post-deploy evidence confirms that the isolated v0.12.5 service is reachable, healthy, feature-enabled, authenticated caller validation works, the teacher-input boundary fails closed before generation, and the certified PB-013 constraints/curriculum sources are still reproduced exactly from the live authoritative source path.

The immutable v0.12.4 certified runtime remains the reused certification basis. A full PB-013 live replay through Gemini would repeat a historically expensive 105k+ token certification path and is not required by this post-deploy record. It remains an optional additional smoke check before any future product-production promotion.

## Promotion boundary

This integration branch is suitable as the frozen shadow integration candidate. Promotion to product production is explicitly out of scope until separately authorized.
