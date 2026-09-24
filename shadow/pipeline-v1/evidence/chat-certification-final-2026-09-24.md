# Multiplan Pipeline V1 — final shadow certification checkpoint (2026-09-24)

Branch: `pipeline-v1-shadow`

Source HEAD evaluated before recording this evidence:

`6da429c1da34c1f770a8efe5516670528a8e45cb`

Certified upstream SessionGraph checkpoint:

`24a33e1d51705c692e23fbd450bf00c12ece15bb`

Approved ProjectBlueprint hash:

`ec6c5a1436ff1798bef4a44f55ba4cd8ac699529b41ce4217e4f1084f4802620`

## Scope and authority boundary

Pipeline V1 connects the already validated authority chain without reopening upstream decisions:

`TeacherConstraintsV1 + CurriculumSnapshotV1 + MethodologyDecisionV1`

→ approved `ProjectBlueprintV1`

→ compiled and approved `SessionGraphV1`

→ deterministic `TeacherPlanProjectionV1`.

A compare from the certified SessionGraph checkpoint to the Pipeline source HEAD showed the Pipeline branch ahead with changes restricted to `.github/workflows/pipeline-v1-shadow.yml` and `shadow/pipeline-v1/**`. No `shadow/project-blueprint-v1/**` or `shadow/session-graph-v1/**` source file changed, so their prior certifications remain the upstream authority for this checkpoint.

## Deterministic Pipeline tests

The exact current Pipeline source was materialized from GitHub and executed with Node `v22.16.0`:

`node --test shadow/pipeline-v1/tests/*.test.mjs`

Result:

- tests: 26
- pass: 26
- fail: 0
- cancelled: 0
- skipped: 0
- todo: 0

The focal suite covers critical-audit binding, literal-evidence validation, one-repair control, Blueprint immutability, cross-artifact hashes, fail-closed behavior, provider transport behavior, deterministic teacher projection, and tamper rejection.

The repository contains a GitHub Actions workflow for the same Blueprint, SessionGraph and Pipeline focal boundaries, but GitHub reported zero workflow runs for this branch at certification time. Therefore this checkpoint does **not** claim a CI execution; the 26/26 result above is the exact-source Node execution used for this certification.

## Critical semantic gate

Pipeline V1 adds `SESSION_CRITICAL_CLAIMS_AUDIT_V1` / `SESSION_CRITICAL_GATE_V1` after the general SessionGraph semantic review. It audits every:

- `WORKED` PDA row,
- activity → methodology-operation link,
- activity → functional-requirement link.

The deterministic gate verifies exact input-hash binding, exact claim coverage, no duplicated or foreign rows, and literal local evidence for every semantic PASS. Invented or non-local PASS quotes become `NOT_EVALUABLE`. A valid critical FAIL blocks Pipeline approval even when the general SGS review says PASS.

## Fresh positive Pipeline preflight

The first fresh Pipeline candidate exposed six real local semantic false positives despite a general SGS PASS:

1. grade-3 `WORKED` performed inquiry but did not explicitly share its importance in socialization;
2. grade-1 `WORKED` explained the need for agreements but did not propose a concrete agreement;
3. `COMPRENSION_Y_PRODUCCION` was attached to analysis without real production;
4. `DIFUSION` was attached to transfer without real communication to an audience;
5. `at_least_two_viable_spaces_or_audiences` was attached to a first-space-only activity;
6. `circulation_evidence` was attached to a first-space count only.

These findings were passed to the existing one-repair boundary. Exactly one logical semantic repair was allowed.

Repair provider result:

- model: `gemini-3.5-flash-lite`
- finish reason: `STOP`
- prompt tokens: 9,979
- candidate tokens: 5,330
- total tokens: 15,309
- candidate length: 24,035 characters
- logical repair count: 1

The repair kept the approved Blueprint immutable and corrected only SessionGraph microarchitecture. In particular:

- grade 3 performs consultation/contrast, a traceable record, and explicitly shares the importance of the findings in the same `WORKED` activity;
- grade 1 explains a concrete situation and proposes a concrete coexistence agreement in the same `WORKED` activity;
- real material production owns `COMPRENSION_Y_PRODUCCION`;
- real audience communication owns `DIFUSION`;
- multi-space movement, reinstallation and circulation evidence are claimed only by the activity that actually executes them.

Repaired positive graph:

`fade6b26bc728f1bf5c7e24401a2edb44a1975c3868585a567f72eacb41dce1f`

General SGS review after repair:

- gate: `PASS`
- finish reason: `STOP`
- prompt tokens: 10,800
- candidate tokens: 1,451
- total tokens: 12,251
- failed findings: none
- semantic input hash: `111fb2271fc149c5d3c6e84b3818c02ab16ad9ea12d73f6de80a607b86cab77f`

Critical claim-level review after repair:

- gate: `PASS`
- finish reason: `STOP`
- prompt tokens: 6,257
- candidate tokens: 3,033
- total tokens: 9,290
- failed claims: none
- invalid audit rows: none
- critical input hash: `3b716613c3d13ab33cb8ce87bdf0dac61f5a0ac6387eb14c250b237958d75232`

Positive status at the isolated Pipeline checkpoint: `READY_FOR_TEACHER_PREFLIGHT`.

## Semantic adversarial

A semantic-only adversarial mutation was applied to `session_3_activity_2`. It preserved deterministic sessions, IDs, minutes, inputs, artifact links, methodology links, functional links, approved-Blueprint binding and traceability, but changed the student action from real movement/reinstallation/diffusion into a hypothetical discussion that explicitly did **not** execute those actions.

Adversarial graph hash:

`e4b17e477b1577be1f95a73c417553d8f2608551c7001bf3002bd19116f5f528`

Critical adversarial input hash:

`4665b8fd90ab69e06166516ea4965a47f0e70fc4d57cfe2bfd1bcda9f1543597`

Provider result:

- HTTP: 200
- finish reason: `STOP`
- prompt tokens: 6,108
- candidate tokens: 3,244
- total tokens: 9,352
- invalid audit rows: none
- critical gate: `FAIL`
- adversarial status: `REJECTED_CORRECTLY`

The exact failed local claims were:

- methodology: `session_3_activity_2|DIFUSION`
- functional: `session_3_activity_2|movement`
- functional: `session_3_activity_2|relocation_or_reinstallation`
- functional: `session_3_activity_2|at_least_two_viable_spaces_or_audiences`
- functional: `session_3_activity_2|circulation_evidence`

The adversarial was therefore rejected for genuine semantic non-execution, not for auth, transport, JSON, schema, tokens, missing files or an artificial deterministic break.

## Shadow infrastructure cleanup

The temporary Pipeline-only Edge helpers used for certification were returned to inert `410 PIPELINE_SHADOW_DISABLED` handlers with JWT verification enabled:

- `pipeline-v1-repo-probe`
- `plan-multiplan-pipeline-v1-shadow`
- `pipeline-v1-session-preflight`
- `pipeline-v1-session-evaluate`
- `pipeline-v1-worked-audit`
- `pipeline-v1-claims-audit`
- `pipeline-v1-session-repair`
- `pipeline-v1-repair-certify`

The previously established protected ProjectBlueprint shadow endpoint was not weakened or repurposed by this cleanup.

Production, `main`, PR3 and PR4 were not modified or promoted.

## Decision

The authority chain is hash-bound, the Pipeline focal suite passes 26/26, the fresh positive survives exactly one repair and then passes both the broad and critical semantic gates, and a deterministic-structure-preserving semantic adversarial is correctly rejected.

`PIPELINE V1 VALIDADO en shadow`

This is a shadow-architecture certification only. It is not a production promotion or a claim that the new Pipeline is already serving production traffic.
