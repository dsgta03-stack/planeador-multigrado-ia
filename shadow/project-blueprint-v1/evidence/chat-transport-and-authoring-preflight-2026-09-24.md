# ProjectBlueprint V1 — Gemini transport and compact-authoring preflight

Date: 2026-09-24
Scope: isolated `project-blueprint-v1-shadow` only. No production/main/PR3/PR4/SessionGraph changes.

## Transport diagnosis

Real calls against `gemini-3.5-flash-lite` established:

- `maxOutputTokens=22000` is accepted by the model; it is not the cause of the prior HTTP 400.
- The REST `responseFormat.text.mimeType` value accepted by the v1beta endpoint is `APPLICATION_JSON`.
- A minimal structured-output schema succeeds with HTTP 200 / `finish_reason=STOP`.
- The previous full compact-authoring provider constraint graph returned HTTP 400 `INVALID_ARGUMENT` before candidate generation.
- The same compact-authoring field graph projected to decoder shape (`AUTHORING_SHAPE_V1`) succeeds with HTTP 200.

The local authoring contract remains strict. The provider decoder receives a shape projection; local enums, field-length limits and domain validation remain authoritative after generation.

## Current positive preflight candidate

Durable evidence request id:

`6f11e481-7fdb-44c7-b644-ab34023bca86`

Provider result:

- model: `gemini-3.5-flash-lite`
- max output budget: 22000
- provider schema profile: `AUTHORING_SHAPE_V1`
- finish reason: `STOP`
- prompt tokens: 5484
- candidate tokens: 5272
- total tokens: 10756
- candidate length: 20969 chars
- JSON: complete/parseable

Focal local-contract preflight on the authoring proposal:

- requested PDA identifiers: present
- requested grades: present
- three authored stages: present
- three session-progression rows: present
- methodology coverage: 11/11 operations
- literal action-quote linkage: 11/11
- evidence references: 11/11
- `final_outcome.type`: `MUSEUM`
- `functional_profiles`: `MUSEUM`, `ITINERANT`
- feasibility enums: valid
- local string-length limits: no focal violation found

This is **not** a final `ProjectBlueprintV1` approval. The authoritative sequence still must run in the repository runtime:

`Authoring validation -> compileAuthoring -> ProjectBlueprintV1 Contract -> deterministic Gate -> semantic review -> (max one repair if allowed) -> APPROVED -> adversarial`.

## Semantic preflight observations

The candidate is substantially stronger than the earlier outputs: it has a real common museum, two-space itinerancy, physical relocation/reinstallation, grade-differentiated contributions, a three-stage progression, and all functional requirement IDs for `MUSEUM` + `ITINERANT`.

Two points should be judged by the independent semantic review rather than silently accepted:

1. The Grade 3 PDA uses the cognitive action `INDAGA`; the candidate names inquiry but its observable mechanism must actually show accessible source/observation, consultation or contrast, and traceable evidence rather than relying on the label alone.
2. `circulation_evidence` declares a group report/record. The semantic reviewer should verify that a student operation explicitly produces or records that evidence, rather than accepting a declared evidence field without a construction mechanism.

The compact-authoring instruction was therefore strengthened generically so that `INDAGA` requires a real accessible source/observation + consultation/contrast + traceable record, and every functional-requirement evidence item must be explicitly produced or recorded by a student operation in one of its stage IDs.

## Remaining certification boundary

Do not declare `PROJECTBLUEPRINT V1 VALIDADO` until all of the following are true on the same evaluated blueprint hash:

- Authoring validation PASS
- `compileAuthoring` PASS
- `ProjectBlueprintV1` Contract PASS
- deterministic BPD PASS
- semantic BPS PASS
- status `APPROVED`
- `approved_blueprint_hash` equals the evaluated blueprint hash
- prepared adversarial case is executed and correctly rejected for a genuine project inconsistency
- relevant final local suite passes

Do not start SessionGraph before that boundary is closed.
