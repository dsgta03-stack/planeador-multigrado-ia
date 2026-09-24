# Router Shadow E2E Validation — 2026-09-24

## Scope

Validated from checkpoint `5234211b59df18361b254f92b14c24f57cd798dd` without modifying `main`, production, PR #3, or PR #4.

Validation branch: `pipeline-v1-router-e2e-validated-shadow`.

Goal: verify the non-governing router boundary for a real-shaped planning request through request normalization, teacher constraints, authoritative Supabase curriculum resolution, `MethodologyDecisionV1`, `ProjectBlueprintV1`, `SessionGraphV1`, and final teacher projection; verify fail-closed behavior for incomplete teacher input and downstream pedagogical rejection.

## Authoritative curriculum capture

Fresh read-only capture from Supabase project `dvcrwzxznuqongutnifn` at `2026-09-24 23:30:03 UTC`.

Verified PDA rows used by the validation:

- `F3-DHC-1-010`, grade 1, `De lo Humano y lo Comunitario`, active + `Verificado`.
- `F4-DHC-3-001`, grade 3, `De lo Humano y lo Comunitario`, active + `Verificado`.
- Verified LTG link: `F3-LTG-1-ESC-007` -> `F3-DHC-1-010`.
- Verified project: `Frases y expresiones de cortesía`, `Proyectos Escolares`, pages 82–91.
- Verified LTG activities: 6 (`1692`–`1697`).

The request deliberately included fake legacy PDA text and a loose legacy `recursos` string. Assertions verify neither becomes curricular/resource authority.

## Defect found during validation

The checkpoint implementation of `buildCriticalClaimsInput()` read `p?.official_text` from `CurriculumSnapshotV1`. The authoritative curriculum contract exposes the official PDA text as `pda_official`.

Impact: a `WORKED` critical claim could reach the critical semantic auditor with an empty `official_pda`, weakening the already-defined rule that the complete official PDA must be audited locally.

Shadow-only correction:

```diff
- official_pda:p?.official_text||''
+ official_pda:p?.pda_official||''
```

This does not change pedagogy, architecture, routing authority, methodology rules, product rules, or teacher constraints. It binds the existing critical audit to the authoritative field already defined by `CurriculumSnapshotV1`.

A dedicated regression was added: `shadow/pipeline-v1/tests/critical-audit-pda-binding.test.mjs`.

## Executed validation cases

### 1. Complete request — PASS

Observed result:

```json
{
  "case": "complete",
  "status": "READY_FOR_TEACHER",
  "eligible": true,
  "blueprint_hash": "853f862e238639f3c51c5955d68411f8fbe46830ed0b3929356d1a09e8ccc677",
  "graph_hash": "ebc6e2716c2fa37b4f8ec5dc3d70ae98b3dd3c098096c3598743da1373169ed2",
  "source_hash": "7f4d866cf830f2a485038218093d85c643b03a5c230a66a33e3e94f0b2544347",
  "pipeline_version": "MULTIPLAN_SHADOW_PIPELINE_V1"
}
```

Assertions included:

- authoritative PDA text comes from the Supabase capture, not the legacy request;
- `LEGACY_RESOURCE_MUST_NOT_BECOME_AUTHORIZED` is absent from `TeacherConstraintsV1.available_resources`;
- no permissive `NOT_PROVIDED` / `UNKNOWN` defaults are introduced;
- methodology remains the teacher-selected `abp` with `selection_source=TEACHER`;
- the verified LTG project and all 6 verified activities are preserved in the curriculum snapshot;
- approved Blueprint hash is carried into SessionGraph authority and final projection.

### 2. Incomplete request — PASS

Observed result:

```json
{
  "case": "incomplete",
  "status": "NEEDS_TEACHER_INPUT",
  "eligible": false,
  "missing_teacher_fields": [
    "students_by_grade",
    "reading_profile",
    "writing_profile",
    "autonomy_profile",
    "connectivity",
    "available_resources",
    "supports",
    "teacher_explicit_constraints"
  ]
}
```

Assertions verify zero curriculum-resolution calls and zero Pipeline calls after this status.

### 3. Downstream pedagogical rejection — PASS

The SessionGraph semantic reviewer was made to reject `SGS-005` on both allowed attempts.

Observed result:

```json
{
  "case": "pedagogical_rejection",
  "status": "SESSION_GRAPH_REJECTED",
  "eligible": true,
  "graph_hash": null,
  "repair_count": 1,
  "blueprint_hash": "8cc5fa89d5b3ca6130940e369d2e3975780380ab1cc62925c7285e164083b09d"
}
```

The router preserved the downstream rejection. It did not convert it into `READY_FOR_TEACHER` or otherwise govern the pedagogical decision.

## Critical PDA binding regression

Executed isolated regression:

```text
WORKED critical claim carries exact authoritative pda_official text ... PASS
1 test
1 pass
0 fail
```

The E2E harness also asserts every generated `WORKED` critical claim carries the matching authoritative `pda_official` text.

## Router governance / fail-closed checks

Verified by execution and source inspection:

- router does not invent pedagogical status; downstream `result.status` is propagated;
- incomplete teacher constraints stop before curriculum and Pipeline;
- legacy PDA prose is a hint only and never replaces authoritative Supabase curriculum;
- legacy free-text `recursos` is not promoted into authorized resources;
- methodology must be an explicit valid catalog selection; no unknown-method fallback exists;
- ProjectBlueprint and SessionGraph remain hash-bound to immutable source artifacts;
- SessionGraph cannot mutate approved Blueprint authority;
- only one SessionGraph repair is allowed; a second pedagogical failure terminates as rejection;
- final teacher plan is a deterministic projection of approved artifacts.

## Execution note

The three boundary cases were executed in an isolated local shadow harness using the current router/pipeline/gate implementation and the fresh authoritative Supabase curriculum capture above. Provider-facing generation/review drivers were deterministic and fixture-bound for reproducibility; this validation did **not** claim a live Gemini transaction. The purpose of this run was to validate the router/Pipeline boundaries, source authority, rejection preservation, and end-to-end artifact chain without touching production.

GitHub Actions was not available for this repository during the run (no workflow runs/check runs were emitted), so the regression evidence above comes from the isolated executable validation plus repository/source inspection.

## Change scope from base checkpoint

Relative to `5234211b59df18361b254f92b14c24f57cd798dd`, the validation branch contains only:

- E2E router validation test;
- shadow workflow definition for that validation surface;
- one-field authoritative PDA binding correction in the critical audit;
- one focused regression for that binding;
- this durable evidence record.

No production code, `main`, PR #3, PR #4, final UI, DidacticWriter, materials, or Word work was performed as part of this checkpoint.
