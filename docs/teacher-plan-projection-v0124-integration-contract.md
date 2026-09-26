# TeacherPlanProjection V1 -> v0.12.4 integration contract

Status: **shadow design contract**. Do not merge to production until SessionGraph R2 has a live positive `READY_FOR_TEACHER` plus adversarial rejection.

## Purpose

Integrate the new canonical pipeline with the existing v0.12.4 shadow UI/history/review/DOCX work **without letting the presentation layer reinterpret pedagogy**.

Canonical chain:

`TeacherConstraintsV1 -> CurriculumSnapshotV1 -> MethodologyDecisionV1 -> approved ProjectBlueprintV1 -> approved SessionGraphV1 -> TeacherPlanProjectionV1`

`TeacherPlanProjectionV1` is the first artifact that may be rendered as a teacher plan.

## Non-negotiable boundary

The UI, history layer, pedagogical review UI and DOCX exporter may:

- format;
- group;
- label already-approved information;
- hide/show sections;
- preserve validated teacher context metadata;
- export the exact semantic source.

They may **not**:

- invent project progression;
- synthesize missing phases or products;
- create a fallback common product;
- assign a PDA to another grade;
- add methodology operations;
- change `WORKED` / `DEVELOPING` claims;
- create missing evidence;
- repair a rejected graph;
- turn any non-ready pipeline state into a visible successful plan.

## Rendering eligibility

A plan is renderable only when all of the following hold:

1. `projection.projection_version === "TEACHER_PLAN_PROJECTION_V1"`;
2. `projection.status === "READY_FOR_TEACHER"`;
3. the deterministic `assertTeacherProjection()` passes;
4. the projection is bound to an approved Blueprint and approved SessionGraph through its `source` hashes/ids;
5. the request/user context shown alongside the plan is the same validated context used to build the source constraints.

Any other pipeline state must surface as an explicit non-success state (`NEEDS_TEACHER_INPUT`, `BLUEPRINT_REJECTED`, `SESSION_GRAPH_REJECTED`, `SESSION_REVIEW_UNAVAILABLE`, provider/transport error, etc.).

## Mapping to the existing v0.12.4 UI

### Project identity

Existing UI expects `plan.project` with title, mission, final product and grade contributions.

Source from projection:

- title <- `projection.project.final_outcome.name`
- final product <- `projection.project.final_outcome.description` / `name` (display only; do not invent a different product)
- purpose <- `projection.project.final_outcome.purpose`
- beneficiary <- `projection.project.final_outcome.audience_or_beneficiary`
- use/destination <- `projection.project.final_outcome.use_or_destination`
- guiding question <- `projection.project.guiding_question.question`
- pedagogical focus <- `projection.project.problem_frame.pedagogical_focus`
- grade contributions <- `projection.project.grade_contributions`

The old `PROJECT-COHERENCE-V1` fallback synthesis must not run on a TeacherPlanProjection. It can remain only for legacy plans until migration is complete.

### Project sequence

Do not manufacture `project_advance` or `partial_product` from generic fallbacks.

For every `projection.sessions[]` use directly:

- session number <- `session_number`
- project state before <- `project_state_before`
- goal <- `session_project_goal`
- methodology operations <- `methodology_operations`
- input artifacts <- `input_artifact_ids`
- partial product <- `expected_partial_product`
- expected artifacts <- `expected_output_artifact_ids`
- project state after <- `project_state_after`
- next dependency <- `next_session_dependency`
- terminal <- `terminal`
- total time <- `total_minutes`

A presentation-only label may humanize known methodology operation IDs, but the original ID must remain available for traceability.

### Session detail

Render each approved `session.activities[]` without rewriting:

- title
- minutes
- common student action
- differentiated `grade_participation`
- teacher role
- resources
- supports
- output
- evidence
- assessment criteria
- methodology operation links
- functional requirement links
- LTG links
- contribution mode/rationale

This replaces synthesized `work_moments` for new-pipeline plans.

### PDA section

Use `projection.project.pda_analysis` as the authoritative plan-side PDA analysis.

Show at minimum:

- PDA ID;
- grade;
- exact official text;
- central cognitive action;
- expected performance;
- observable evidence conditions;
- integration strength/reason.

Never derive the selected PDA set from free text or UI cards after generation.

### Methodology section

Use exactly:

- `projection.project.methodology.selected_id`;
- `catalog_version`;
- `required_operations`;
- each session's `methodology_operations`;
- traceability from `projection.traceability.methodology`.

The UI may show friendly names, but not reorder or omit operations in a way that changes meaning.

## Teacher context metadata

`TeacherPlanProjectionV1` currently does not carry the complete original teacher context/resources profile as a presentation block.

Until the projection contract is deliberately expanded, keep the validated request/TeacherConstraints alongside the projection as **separate immutable display metadata**. Do not regenerate context from session prose.

Before production integration, either:

- bind the displayed TeacherConstraints hash explicitly in the persisted final-plan snapshot; or
- add an additive source binding to a future projection contract revision with tests and migration.

Do not silently change `TEACHER_PLAN_PROJECTION_V1` during SessionGraph R2 certification.

## History fidelity

For a new-pipeline plan, `FINAL-PLAN-SNAPSHOT-V1` should persist at least:

- `projection_version`;
- `projection_hash`;
- full TeacherPlanProjection semantic payload;
- approved Blueprint hash;
- approved SessionGraph hash;
- validated teacher-context/constraints binding;
- pipeline version;
- model/provider evidence references when available.

Reopening history must render from this snapshot, not rerun AI or `PROJECT-COHERENCE-V1`.

A hash mismatch is fail-closed and must not display a plan as validated.

## Pedagogical review V1.1 relationship

The existing v0.12.4 pedagogical review can remain an **advisory/post-render review** for usability and diagnostics, but it must not override canonical pipeline approval.

Rules:

- no TeacherPlanProjection -> review button cannot imply a valid generated plan;
- canonical Gate rejection always wins;
- advisory review cannot upgrade a rejected/non-evaluable SessionGraph;
- its cache key for new-pipeline plans must include `projection_hash` (preferably use it as the primary semantic identity);
- changing request inputs invalidates both display and cached review unless a new approved projection is produced.

## DOCX integration

The v0.12.4 DOCX exporter already consumes a view-shaped plan. For new-pipeline plans, introduce a deterministic presentation adapter rather than modifying the projection itself.

DOCX source must remain the same semantic projection shown on screen/history.

Required sections:

1. general data / teacher context metadata;
2. project name, guiding question, purpose and common product;
3. PDA by grade with official text;
4. differentiated grade contributions;
5. project/session progression;
6. each approved activity with grade actions, teacher role, time, resources/supports, evidence and criteria;
7. methodology operations and LTG traceability where pedagogically useful;
8. teacher observations as an empty editable section only.

No fallback pedagogy may be invented by the exporter.

## UI error states required before production

The presentation layer must explicitly distinguish:

- `NEEDS_TEACHER_INPUT` — teacher must complete constraints;
- `BLUEPRINT_REJECTED` / `NEEDS_TEACHER_DECISION`;
- `SESSION_AUTHORING_FAILED`;
- `SESSION_GRAPH_CONTRACT_REJECTED`;
- `SESSION_GRAPH_REJECTED`;
- `SESSION_REVIEW_UNAVAILABLE`;
- provider unavailable / quota / transport-auth error;
- `READY_FOR_TEACHER`.

Only the last state mounts the final plan card, history-save success and DOCX export control.

## Migration order

1. certify SessionGraph R2 live positive;
2. certify an adversarial SessionGraph rejection;
3. freeze the projection shape/checkpoint;
4. create a new integration branch based on the v0.12.4 shadow branch (do not mutate PR #4 in place);
5. add deterministic TeacherPlanProjection -> UI view adapter;
6. update UI eligibility/error states;
7. bind history snapshot/cache to `projection_hash`;
8. adapt DOCX to the same view source;
9. run full-cycle regression: projection -> UI view -> snapshot -> reopen -> review -> DOCX;
10. run authenticated smoke on an isolated preview;
11. only then prepare a promotion PR.

## Acceptance criteria for web-ready integration

- no synthesized pedagogy for new-pipeline plans;
- exact grade/PDA traceability preserved;
- same projection hash drives current view, history and DOCX;
- rejected/non-evaluable graph never appears as a completed plan;
- all required pipeline error states have teacher-facing recovery text;
- existing v0.12.4 history/review/DOCX fidelity guarantees remain green;
- production and `main` remain untouched until explicit promotion.
