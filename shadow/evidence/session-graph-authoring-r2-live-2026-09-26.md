# SessionGraph R2 — live authoring validation

Date: 2026-09-26 UTC

Branch: `session-graph-authoring-r2-shadow`

This evidence records the first live attempt after adding the deterministic `WORKED` guard and grade/PDA restrictions. It is intentionally fail-closed: the result below is **not** a successful certification and no TeacherPlanProjection was produced.

## Immutable source binding

The already-approved ProjectBlueprint was rehydrated from its durable provider evidence instead of being regenerated. Before the SessionGraph call, the isolated preflight recomputed and matched all four certified hashes exactly:

- TeacherConstraintsV1: `231186405b12537fc00f9cb7d644bb98e7c79b2cc9eb7cae401aecc399c5400a`
- CurriculumSnapshotV1: `e67ab1bb301cebefc9f31f500d0a2e4d8d795ab26a4f26b6840749cca6e9a5bf`
- MethodologyDecisionV1: `9d2b4be07b5837ac7f4b181fcbfa95b50dfb404a737698c908cf231837ed9cf6`
- approved ProjectBlueprintV1: `1d97fb4430ded1913031e343c863d57a3663a833b1fbe242ea942459636e9fad`

Blueprint ID: `d3daf0c8-29bc-4c03-a999-359640ebe29d`.

The curriculum normalization was also checked: the raw database transport includes technical fields such as `active`, while the certified source adapter removes them before constructing `CurriculumSnapshotV1`. After reproducing that normalization, the historical snapshot hash matched exactly; no curriculum drift was used to force the test.

## Live provider call

- task: `GENERATE`
- request_id: `sessiongraph-generate-c800afc9-15ea-42c2-aaf5-fd38b20be1f0`
- provider: Google Gemini through `plan-project-blueprint-v1-shadow`
- model: `gemini-3.5-flash-lite`
- prompt/config family: `PROJECT_BLUEPRINT_SHADOW_V1_R2`
- durable submit: HTTP 202
- durable result: HTTP 200
- provider status: 200
- finish_reason: `STOP`
- prompt tokens: 4,568
- candidate tokens: 4,898
- total tokens: 9,466

## Pipeline result

Final status: `SESSION_AUTHORING_FAILED`.

Stages reached:

1. `PROJECT_BLUEPRINT` → `APPROVED`
2. `PROJECT_BLUEPRINT_APPROVAL` → `APPROVED`
3. `SESSION_AUTHORING` → `ERROR`

Repair count: `0`.

The SessionGraph compiler, semantic Gate and critical-claims Gate were **not reached**. No graph approval and no TeacherPlanProjection were produced.

## Contract rejection

The provider output contained pedagogically meaningful text but changed scalar contract fields into nested structures. The local authoring contract rejected exactly these paths:

- `$.sessions[0].activities[0].grade_participation[1].student_action` — object instead of string.
- `$.sessions[0].activities[1].grade_participation[0].student_action` — object instead of string.
- `$.sessions[0].activities[1].grade_participation[0].evidence` — array instead of string.
- `$.sessions[0].activities[1].grade_participation[1].evidence` — array instead of string.

Inspection of the durable candidate showed the model was trying to structure semantic subcomponents such as `action`, `purpose`, `process`, `record` and `communication`. Those subcomponents were not coerced or flattened because doing so would transform provider output after authoring and weaken the exact contract.

## Decision and hardening

This run is classified as an **authoring contract failure**, not a transport, authentication or pedagogical Gate failure. The fail-closed behavior is correct.

The next change is preventive only: make the provider prompt explicitly state that scalar text fields — including `student_action`, grade/activity `evidence`, `common_student_action`, `teacher_role`, `output`, `contribution_rationale`, and each individual assessment criterion — must remain plain JSON strings. If several semantic components are needed, they must be expressed inside one string rather than by changing the JSON shape.

No schema coercion, Gate relaxation, architecture change, production route, `main`, PR #3 or PR #4 modification is authorized by this evidence.
