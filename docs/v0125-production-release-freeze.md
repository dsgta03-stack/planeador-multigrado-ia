# v0.12.5 Production Release Freeze

Date: 2026-10-05

## Frozen production artifact

- Production code commit: `825723d354321d5be7a15edf66cc23f6220fc0a7`
- Frozen reference branch: `v0125-production-frozen`
- Production Railway deployment: `a566ecb1-0d26-465b-ba29-6986b7f383db`
- Railway service: `planeador-multigrado-ia-v0112-candidate`
- Production domain: `https://planeador-multigrado-ia-v0112-candidate-production.up.railway.app`
- Start command: `node server-v0125-consolidated-mainline.mjs`
- Healthcheck: `/v0125_health`

The frozen branch points to the exact source commit that produced the current production deployment. Documentation commits after this point do not change the deployed artifact.

## Pre-deploy gate

The production deployment executed the same targeted gate used by the integrated shadow rehearsal:

- `shadow/pipeline-v1/tests/session-contribution-repair.test.mjs`
- `tests/v0125-unified-preview-server-route-v1.mjs`
- `tests/v0125-canonical-plan-server-routes-v1.mjs`

Result:

- tests: 20
- pass: 20
- fail: 0
- cancelled: 0
- skipped: 0

Railway deployment status: `SUCCESS`.

## Runtime status

After deployment:

- service state: `Online`
- running replicas: 1
- crashed replicas: 0
- warning count: 0
- critical count: 0
- recent failed deployments: 0

The public root was independently checked from the client machine and returned:

`HTTP 200 | text/html; charset=utf-8`

## v0.12.5 health smoke

`GET /v0125_health` returned HTTP 200 with:

- `ok: true`
- version: `0.12.5-consolidated-mainline`
- base: `0.12.4-current-mainline`
- unified preview enabled: true
- canonical review enabled: true
- canonical DOCX enabled: true
- canonical snapshot persistence enabled: true
- legacy wrapper chain spawned: true
- production compatibility wrapper: true

This confirms that v0.12.5 is active while the v0.12.4-compatible application chain remains preserved for production compatibility.

## Authentication and fail-closed production smokes

Read-only/no-generation HTTP smokes against the live production domain produced:

- unauthenticated `POST /api/v0125/unified-plan` -> HTTP 401, `USER_AUTHORIZATION_REQUIRED`, no plan and no canonical hash;
- unauthenticated `POST /api/v0125/pedagogical-review` -> HTTP 401, `AUTH_REQUIRED`;
- empty `POST /api/v0125/export/docx` -> HTTP 400, `CANONICAL_PLAN_REQUIRED`;
- structurally valid request with non-SHA hash -> HTTP 400, `CANONICAL_PLAN_HASH_REQUIRED`;
- fabricated 64-hex SHA-256 hash that does not bind to the submitted plan -> HTTP 409, `CANONICAL_PLAN_HASH_MISMATCH`.

No DOCX file was emitted for rejected binding cases.

## HTTP reliability after promotion

Production HTTP logs for the post-deploy smoke window contain the expected 200/401/400/409 responses above and no 5xx responses. Railway's HTTP error-rate metric reported 0% 5xx for the post-deploy validation window.

A favicon 404 may occur from normal browser requests and is not considered an application failure.

## Certified source references

The positive certified source references remain:

- constraints hash: `231186405b12537fc00f9cb7d644bb98e7c79b2cc9eb7cae401aecc399c5400a`
- curriculum hash: `e67ab1bb301cebefc9f31f500d0a2e4d8d795ab26a4f26b6840749cca6e9a5bf`
- historical methodology hash: `9d2b4be07b5837ac7f4b181fcbfa95b50dfb404a737698c908cf231837ed9cf`

The methodology hash typo in `docs/v0125-unified-preview-final-validation.md` was corrected separately in documentation only.

## Rollback point

Known prior production deployment:

- deployment: `acee2855-fa89-42e1-909d-48c8bf44716c`
- original status before replacement: `SUCCESS`
- current Railway history state: `REMOVED` because it was superseded
- Railway still reports `canRollback: true` and `canRedeploy: true`

Do not delete or otherwise invalidate this deployment record. It remains the immediate known rollback artifact if v0.12.5 must be reverted.

## Release interpretation

v0.12.5 is the production integration release that connects the certified ProjectBlueprint/SessionGraph path to the canonical plan surface used by review, history and DOCX, while preserving the prior product application chain for compatibility.

The release is frozen at `825723d354321d5be7a15edf66cc23f6220fc0a7`. Any later consolidation work belongs to a separate v0.12.6 shadow branch and must not modify this frozen reference or the current production deployment without a new validation/promotion decision.
