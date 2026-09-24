# SessionGraph V1 — positive compile checkpoint (2026-09-24)

Base approved ProjectBlueprint hash:

`ec6c5a1436ff1798bef4a44f55ba4cd8ac699529b41ce4217e4f1084f4802620`

This checkpoint remains shadow-only. It does **not** declare SessionGraph V1 validated.

## First real authoring generation

Gemini model: `gemini-3.5-flash-lite`

- HTTP: 200
- finish reason: `STOP`
- prompt tokens: 5,066
- candidate tokens: 6,058
- total tokens: 11,124
- candidate length: 25,412 characters

The local compiler rejected this candidate deterministically under `SGD-010` because activities labelled `COMPLEMENTARY` also claimed contribution to the expected session artifact. This was useful evidence that the DIRECT/COMPLEMENTARY distinction was not explicit enough in authoring guidance.

The shadow contract was tightened so that:

- any activity that builds any part of the expected session artifact is `DIRECT`, even if its output is consumed later;
- `COMPLEMENTARY` requires an empty `contributes_to_artifact_ids` and a later activity consuming its `activity_key`;
- methodology operations must be attached to the activity that actually executes them;
- PDA mobilization and functional-requirement links must not be claimed where the concrete action does not perform them.

A focal regression test was also added for a complementary activity incorrectly claiming an expected artifact.

## Repair generation

The first repair call returned provider `503 UNAVAILABLE` with no candidate/usage. A later retry completed:

- HTTP: 200
- finish reason: `STOP`
- prompt tokens: 9,017
- candidate tokens: 5,791
- total tokens: 14,808
- candidate length: 24,476 characters
- repair count: 1

## Repaired compilation

The repaired proposal passed the SessionGraph authoring contract and deterministic compiler.

- compile: `PASS`
- proposal hash: `cbacec9ba03dd3da5867ca4421c74b2131d31d377079cf7b84ac2682149d217a`
- compiled graph hash: `57783afbcfcc3fe39fa7bbcd61878971d715d996c14e20cf78c89880400e4cd0`
- sessions: 3
- activities per session: 3 / 3 / 3
- minutes per session: 90 / 90 / 90

Deterministic traceability after compilation includes all 11 community-project methodology operations and all 11 functional requirements of the approved `MUSEUM + ITINERANT` outcome.

PDA traceability counts in the compiled graph:

- `F3-DHC-1-010`: 5 activity-grade mobilizations
- `F4-DHC-3-001`: 7 activity-grade mobilizations

Methodology traceability counts:

- IDENTIFICACION: 1
- RECUPERACION: 2
- PLANIFICACION: 1
- ACERCAMIENTO: 1
- COMPRENSION_Y_PRODUCCION: 1
- RECONOCIMIENTO: 1
- CONCRECION: 1
- INTEGRACION: 1
- DIFUSION: 2
- CONSIDERACIONES: 1
- AVANCES: 1

Functional-requirement coverage:

- selection_criteria: 2
- audience_or_route: 1
- pieces: 2
- organization: 1
- piece_explanation: 1
- mounting: 1
- mediation: 1
- movement: 1
- at_least_two_viable_spaces_or_audiences: 1
- relocation_or_reinstallation: 1
- circulation_evidence: 1

## Semantic certification status

Independent `SGS-001..SGS-012` review was attempted after deterministic compilation. The provider returned `503 UNAVAILABLE — high demand` before candidate creation on repeated attempts; there was no semantic candidate and no token usage for those failed review attempts.

Therefore the correct current status is:

`SESSIONGRAPH V1 AÚN NO VALIDADO`

The next authoritative step is an independent semantic review bound to graph hash `57783afbcfcc3fe39fa7bbcd61878971d715d996c14e20cf78c89880400e4cd0`. Only if that review passes should an activity-level semantic adversarial be executed.