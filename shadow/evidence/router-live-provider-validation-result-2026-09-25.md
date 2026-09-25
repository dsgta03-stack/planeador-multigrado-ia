# Router → Pipeline V1 live-provider validation — executed result

Date: 2026-09-25 UTC

Validation branch: `pipeline-v1-router-e2e-validated-shadow`

Starting validation commit: `a574842a758437adf264216e96503fb345339edd`

This record supersedes the earlier transport-blocked checkpoint only for the question of whether the live chain could be executed. The earlier file remains historical evidence of the transport failures that preceded this run.

No production route, `main`, PR #3, PR #4, pedagogical Gate, source contract, UI, DidacticWriter, materials or Word generation was changed.

## Requested chain

`request → TeacherConstraintsV1 → authoritative Supabase curriculum → MethodologyDecisionV1 → ProjectBlueprintV1 → SessionGraphV1 → TeacherPlanProjectionV1`

Provider/model/config were kept at the certified settings:

- provider: Google Gemini through `plan-project-blueprint-v1-shadow`
- model: `gemini-3.5-flash-lite`
- prompt/config: `PROJECT_BLUEPRINT_SHADOW_V1_R2`
- Blueprint repair limit: existing maximum one repair
- SessionGraph repair limit: existing maximum one repair

The positive request used grades 1 and 3, three 90-minute sessions, `proyectos_comunitarios`, PDA `F3-DHC-1-010` and `F4-DHC-3-001`, and explicit teacher constraints.

## Authoritative source binding

The successful live source resolution produced:

- TeacherConstraints ID: `b9bc8990-ed8f-4d4d-883d-7eaf60181122`
- TeacherConstraints hash: `231186405b12537fc00f9cb7d644bb98e7c79b2cc9eb7cae401aecc399c5400a`
- CurriculumSnapshot ID: `60933e9b-2e3e-488a-ba5a-779415f88006`
- CurriculumSnapshot hash: `e67ab1bb301cebefc9f31f500d0a2e4d8d795ab26a4f26b6840749cca6e9a5bf`
- MethodologyDecision ID: `367fc662-ed34-488b-9e67-14c380a9ef13`
- MethodologyDecision hash bound in the Blueprint: `9d2b4be07b5837ac7f4b181fcbfa95b50dfb404a737698c908cf231837ed9cf6`

The deliberately fake legacy request resource did **not** become an authorized resource. The authorized resources remained exactly the teacher-provided set: papel reutilizado, lápices, colores, mesas, aula and patio techado.

The authoritative curriculum remained the verified Supabase corpus, including `F3-LTG-1-ESC-007` and LTG activities 1692–1697.

## Live ProjectBlueprint result

The ProjectBlueprint live run completed with real Gemini and no Blueprint repair:

- Blueprint status: `APPROVED`
- Blueprint Gate: `PASS`
- Blueprint ID: `d3daf0c8-29bc-4c03-a999-359640ebe29d`
- approved Blueprint hash: `1d97fb4430ded1913031e343c863d57a3663a833b1fbe242ea942459636e9fad`
- Blueprint repair count: `0`
- provider errors: none

The generated outcome was a `MUSEUM` with `MUSEUM` + `ITINERANT` profiles and a real two-space route between aula and patio techado.

### Blueprint provider calls

| Task | request_id | HTTP | finish | prompt tokens | candidate tokens | total tokens |
|---|---|---:|---|---:|---:|---:|
| GENERATE | `3ad25b0f-cc89-4ef3-937f-533106a0e834` | 200 | STOP | 6130 | 5085 | 11215 |
| REVIEW | `0bfb6e02-9d37-4152-97f9-1195d734c41f` | 200 | STOP | 6945 | 1634 | 8579 |
| REVIEW | `5bfc2088-4cb8-4999-93cf-e1d862ac833a` | 200 | STOP | 2561 | 469 | 3030 |
| REVIEW | `0e8c3d2c-c902-493a-a008-9bbee6428055` | 200 | STOP | 2414 | 528 | 2942 |
| REVIEW | `2dda152d-6eef-4c38-9416-05526e4bec9f` | 200 | STOP | 2446 | 1478 | 3924 |

Blueprint total usage: 20,496 prompt + 9,194 candidate = **29,690 tokens**.

## Live SessionGraph result

The approved Blueprint was then passed unchanged to the real SessionGraph provider path.

Observed stage sequence:

1. `PROJECT_BLUEPRINT` → `APPROVED`
2. `PROJECT_BLUEPRINT_APPROVAL` → `APPROVED`
3. `SESSION_AUTHORING` → `PROPOSED`
4. `SESSION_COMPILE`, attempt 1 → `FAIL`
5. `SESSION_REPAIR` → `REPAIRED` (`DETERMINISTIC`)
6. `SESSION_COMPILE`, attempt 2 → `PASS`
7. `SESSION_GATE`, attempt 2 → `FAIL`
8. `SESSION_CRITICAL_GATE`, attempt 2 → `FAIL`

Compiled graph hash after the one allowed repair:

`5220c1f56ae1b66441d31fb57c9b6c99ed742dda70a009ee02a97bae046087e4`

The single SessionGraph repair budget was consumed by the deterministic compile failure. No second repair was attempted after semantic rejection.

### Session provider calls

| Task | request_id | HTTP | finish | prompt tokens | candidate tokens | total tokens |
|---|---|---:|---|---:|---:|---:|
| GENERATE | `sessiongraph-generate-841366d2-c312-40ec-b2d1-1df39419062e` | 200 | STOP | 6338 | 4157 | 10495 |
| REPAIR | `sessiongraph-repair-a6d20963-9ce8-4b1f-87e1-0eb57d3dbeda` | 200 | STOP | 9362 | 4244 | 13606 |
| REVIEW | `sessiongraph-review-0326de14-098b-4c5f-84a0-a7fb82f5fc0a` | 200 | STOP | 11217 | 1706 | 12923 |
| REVIEW | `sessiongraph-review-d127f2f8-7a30-45c3-9a53-dc3310c86dfb` | 200 | STOP | 5661 | 2902 | 8563 |

All four calls used `gemini-3.5-flash-lite`, `PROJECT_BLUEPRINT_SHADOW_V1_R2`, durable submit HTTP 202, durable result HTTP 200, provider HTTP 200, `max_output_tokens=22000`, and `finish_reason=STOP`.

Session total usage: 32,578 prompt + 13,009 candidate = **45,587 tokens**.

Combined Blueprint + Session live usage: **75,277 tokens**.

## Final Gate findings

All final deterministic SessionGraph findings passed after the repair. The final rejection came from the semantic and critical-claims Gates.

### `SESSION_GRAPH_GATE_V1`

Status: `FAIL`

Critical failures: 2

- `SGS-002` — the grade-3 `WORKED` claim for `F4-DHC-3-001` was not locally complete. The same activity performed the indagation component but did not perform the PDA's substantive purpose of sharing the importance of those agreements in socialization. That later action cannot be inherited from another activity.
- `SGS-008` — multiple distinct functional requirements for the museum/itinerancy were linked too broadly to one complementary activity instead of each link being backed by substantive, locally observable execution and evidence.

### `SESSION_CRITICAL_GATE_V1`

Status: `FAIL`

Critical failures: 1

- claim `session_1_activity_1|3|F4-DHC-3-001` failed because the `WORKED` activity indagated agreements and forms of organization but did not itself share/explain/communicate their importance in socialization.

This critical claim independently confirms the `SGS-002` failure.

## Final decision

- ProjectBlueprint: **APPROVED / PASS**
- SessionGraph deterministic compile after one repair: **PASS**
- Session semantic Gate: **FAIL**
- Session critical-claims Gate: **FAIL**
- Session repair count: **1**, maximum respected
- TeacherPlanProjection: **NOT PRODUCED**
- final Pipeline status: **`SESSION_GRAPH_REJECTED`**

This is a **pedagogical/semantic rejection**, not a provider, authentication, transport, schema or hosting failure. The real Gemini calls completed successfully and the Gates rejected the surviving semantic defects instead of converting them into success.

Therefore this live positive case is **not certified as `READY_FOR_TEACHER`**. It is evidence that the fail-closed chain operates correctly under real provider output: an approved Blueprint does not bypass SessionGraph quality controls, one repair does not become an unlimited retry loop, and no TeacherPlanProjection is produced after Gate failure.

## Cleanup

After capturing the result, the temporary Supabase execution surfaces were returned to neutral disabled state with `verify_jwt=true`:

- `pipeline-v1-session-preflight` → `410 PIPELINE_SHADOW_DISABLED`
- `plan-multiplan-pipeline-v1-shadow` → `410 PIPELINE_SHADOW_DISABLED`
- `pipeline-v1-repo-probe` → `410 PIPELINE_SHADOW_DISABLED`

The certified provider function `plan-project-blueprint-v1-shadow` was not modified.
