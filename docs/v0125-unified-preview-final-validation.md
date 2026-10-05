# v0.12.5 Unified Preview — final validation evidence

Date: 2026-10-05
Branch: `v0125-unified-preview-shadow`

## Scope

This record covers the v0.12.5 unified preview shadow work only. It does not promote or modify `main`, production, PR #3, or PR #4.

## Certified immutable base reused by v0.12.5

v0.12.4 certified base remains the reference runtime. The certified provider/session implementation was not modified in v0.12.5; v0.12.5 adds the unified preview integration and an endpoint transport adapter around the certified runtime.

Certified source hashes from 5D-P:

- constraints: `231186405b12537fc00f9cb7d644bb98e7c79b2cc9eb7cae401aecc399c5400a`
- curriculum: `e67ab1bb301cebefc9f31f500d0a2e4d8d795ab26a4f26b6840749cca6e9a5bf`
- methodology: `9d2b4be07b5837ac7f4b181fcbfa95b50dfb404a737698c908cf231837ed9cf6`

Certified 5D-P result recovered from Railway deployment evidence:

- pipeline status: `READY_FOR_TEACHER`
- repair_count: `1`
- Blueprint gate: `PASS`
- SessionGraph gate: `PASS`
- critical gate: `PASS`
- approved Blueprint hash: `93125fa3d605a4b89470ad604524c1fa08e4f015148982f56e9a762b4d356e2f`
- SessionGraph hash: `4490609ddf78d85ab63db61e8a830ba5dd0c7f4ec4de939912019a2355c12eaa`
- TeacherPlanProjection hash: `7690d63fdb2c79b830211f96898d21ffb3ddc3606801a6cbca2a08c4b1f1660e`
- model: `gemini-3.5-flash-lite`
- 12 provider calls, all HTTP/provider 200 with `STOP`

The single repair was expected and certified. The first SessionGraph compile failed closed for explicit authoring rules and the certified repair path produced the approved graph.

## v0.12.5 deterministic integration status

The following v0.12.5 blocks were completed and their targeted deterministic tests passed:

- `PROJECT_BLUEPRINT_CANONICAL_ADAPTER_V1`
- pipeline canonical bridge
- canonical lifecycle
- unified preview orchestrator
- production-style unified preview route
- self-contained v0.12.5 server route
- canonical review/DOCX services and server routes
- canonical history semantics
- v0.12.5 certified-provider transport adapter

The broader v0.12.5 combined deterministic suite passed. Existing `npm test` and `test:routes` regressions were also previously green; they were not repeated unnecessarily during this final validation.

## Provider endpoint compatibility fix

A real integration mismatch was discovered before relying on live provider validation:

- Railway `SHADOW_PROVIDER_ENDPOINT` resolves to the real Supabase Edge pathname `/functions/v1/plan-project-blueprint-v1-shadow`.
- v0.12.4 certified runtime intentionally accepts the logical pathname `/plan-project-blueprint-v1-shadow` only.

v0.12.5 therefore adds `lib/v0125/certified-provider-transport.mjs`, preserving the v0.12.4 endpoint lock while mapping outbound fetches to the real Supabase Edge URL. Targeted provider transport and unified server-route tests passed.

A real-config, no-network construction preflight successfully instantiated the certified runtime with the adapter.

## Authenticated caller / RLS validation

The actual browser Authorization credential was identified from a successful `/api/history` request. It is a JWT distinct from the opaque `multiplan.auth.v1` local-storage token.

Using that browser bearer with the Supabase publishable key:

- direct authenticated read-only REST calls returned HTTP 200;
- role-specific RLS access worked;
- `createSupabaseCurriculumLookup` returned authoritative verified PDA and LTG rows;
- no `service_role` substitution was used for the caller-path validation.

A 3rd/4th-grade real lookup returned four verified PDA and four LTG projects.

## Production-style source-adapter validation

A controlled 3rd/4th-grade production-style request was converted by the real v0.12.5 source boundary to:

- status: `READY_FOR_PIPELINE`
- four selected PDA == four authoritative curriculum PDA
- four LTG rows
- methodology: `proyectos_comunitarios`

This proved the request -> authenticated RLS lookup -> immutable Pipeline source path.

A first smoke request with 2 sessions was correctly rejected before provider execution by the construction policy:

`CONSTRUCTION_REJECTED: This limited construction policy supports community projects with 1 or 3 sessions only`

The same controlled case with 3 sessions passed `constructionPlan()`.

A real live run of that artificial 3rd/4th-grade case then reached the ProjectBlueprint pipeline and returned:

- HTTP 409
- `BLUEPRINT_NOT_APPROVED`
- `PIPELINE_NOT_READY`

This is not an infrastructure or auth failure; it demonstrates fail-closed behavior for a generated Blueprint that did not satisfy the gate.

## Certified source object revalidation

The current Railway/Supabase source object referenced by `SHADOW_EVIDENCE_BUCKET` + `SHADOW_SOURCE_OBJECT` was fetched read-only and re-hashed locally. It returned HTTP 200 and exactly the original certified 5D-P hashes:

- constraints: `231186405b12537fc00f9cb7d644bb98e7c79b2cc9eb7cae401aecc399c5400a`
- curriculum: `e67ab1bb301cebefc9f31f500d0a2e4d8d795ab26a4f26b6840749cca6e9a5bf`
- methodology: `9d2b4be07b5837ac7f4b181fcbfa95b50dfb404a737698c908cf231837ed9cf6`

Therefore the certified source bundle has not drifted.

The constraints hash is the same source case used by `PB-013-COMUNITARIO-PASS`: grades 1 and 3, three sessions, 90 minutes, `proyectos_comunitarios`, PDA `F3-DHC-1-010` and `F4-DHC-3-001`.

Current Supabase rows for those PDA are active and `Verificado`. `F3-DHC-1-010` is linked by a verified `project_pda` row to LTG project `F3-LTG-1-ESC-007`, `Frases y expresiones de cortesía`, with six `verified` activity rows. Reconstructing the current v0.12.5 curriculum lookup output from these rows produces snapshot hash:

`e67ab1bb301cebefc9f31f500d0a2e4d8d795ab26a4f26b6840749cca6e9a5bf`

This is exactly the certified 5D-P curriculum hash, confirming that the authoritative curriculum data required by the positive certification case still reproduces the certified snapshot.

## Final interpretation

The final validation distinguishes two facts that must not be conflated:

1. The artificial 3rd/4th-grade smoke case is not a certification fixture and its live generated Blueprint was correctly rejected by the gate.
2. The exact positive 5D source bundle remains byte-semantically unchanged at the source-artifact level, and the authoritative Supabase curriculum still reconstructs the certified curriculum snapshot hash.

Given the unchanged certified source bundle, the recovered `READY_FOR_TEACHER` 5D result, green deterministic v0.12.5 integration tests, successful real endpoint transport construction, and successful authenticated RLS/source-boundary validation, repeating the entire 105k+ token 5D certification solely to reconfirm the same immutable v0.12.4 runtime is not required for this evidence record.

A final exact positive live replay through the v0.12.5 production-style route remains an optional additional smoke check before any future shadow deployment; if performed, it should use the PB-013/5D positive case rather than an invented request.
