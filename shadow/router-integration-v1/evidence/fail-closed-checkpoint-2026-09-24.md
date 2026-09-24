# Router integration fail-closed checkpoint — 2026-09-24

Base branch: `pipeline-v1-router-safe-shadow`

Base checkpoint: `7c13e9f08b3dd3985ab5a582a252e0607f1ab1c2`

Scope: selective shadow integration of authoritative Supabase curriculum lookup, fail-closed source adapter, non-governing router bridge, and focused tests. No production, `main`, PR #3 or PR #4 changes.

## Preserved authority boundaries

- Missing explicit teacher constraints returns `NEEDS_TEACHER_INPUT` before curriculum lookup or Pipeline execution.
- Legacy free-text `recursos` remains evidence only and is never promoted to `available_resources`.
- Missing teacher fields remain `null`/missing; the adapter does not inject `NOT_PROVIDED`, `UNKNOWN`, or equivalent defaults.
- Authoritative PDA/LTG resolution happens server-side through the injected curriculum lookup.
- The router forwards only `{constraints,curriculum,methodology}` to the existing Pipeline runner and does not reinterpret ProjectBlueprint, SessionGraph, or their gates.
- Pipeline rejection statuses pass through unchanged.

## Selective integration from `pipeline-v1-router-shadow`

- `supabase-curriculum.mjs`: retained the authoritative REST lookup pattern over `pda`, `project_pda`, `projects_ltg`, and `ltg_project_activities`, including active/verified filtering, bearer authorization, and unsafe-ID rejection.
- `source-adapter.mjs`: intentionally NOT copied as-is. The lax fallback/default behavior was replaced by delegation to the already certified `legacy-request-adapter.mjs` fail-closed boundary.
- `router-shadow.mjs`: retained the non-governing bridge shape, but now blocks before lookup/Pipeline when teacher input is incomplete and never upgrades a rejected Pipeline result.
- Added focused router integration tests; the earlier router branch had no persisted test directory.

## Local validation

Runtime: Node `v22.16.0`.

Executed:

`node --test shadow/integration-v1/tests/legacy-request-adapter.test.mjs shadow/router-integration-v1/tests/router-integration.test.mjs`

Result:

- tests: 15
- pass: 15
- fail: 0
- cancelled: 0
- skipped: 0
- todo: 0

This checkpoint validates only the shadow integration boundary described above. It is not a production promotion.
