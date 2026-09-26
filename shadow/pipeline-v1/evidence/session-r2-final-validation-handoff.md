# SessionGraph R2 — final validation handoff

Use this file only from branch `session-graph-authoring-r2-shadow`.

## Safety boundary

Do not touch:

- `main`;
- production Railway service `planeador-multigrado-ia-v084c-gemini`;
- PR #3 `ui-v0123-workflow-guidance`;
- PR #4 `pedagogical-review-v1-shadow`;
- production UI, DidacticWriter, materials or Word rendering.

Do not weaken ProjectBlueprint, SessionGraph, Session Gate or Critical Gate rules.

## Goal

Obtain one canonical real-provider positive run:

`TeacherConstraintsV1 + CurriculumSnapshotV1 + MethodologyDecisionV1 → approved ProjectBlueprint → SessionGraph R2 → compile → semantic review → split critical review → Gates → TeacherPlanProjection`

Then execute the prepared adversarial case and prove it is rejected.

Model lock: `gemini-3.5-flash-lite`.

SessionGraph repairs: max 1. `NOT_EVALUABLE` / reviewer unavailable must **not** consume repair and must not become success.

## Fixed source hashes

- constraints: `231186405b12537fc00f9cb7d644bb98e7c79b2cc9eb7cae401aecc399c5400a`
- curriculum: `e67ab1bb301cebefc9f31f500d0a2e4d8d795ab26a4f26b6840749cca6e9a5bf`
- methodology: `9d2b4be07b5837ac7f4b181fcbfa95b50dfb404a737698c908cf231837ed9cf6`

## Provider / authoring rules already fixed

Use the checked-in provider path. Do not recreate a temporary schema by hand.

`session-provider.mjs` already separates the strict local authoring schema from the Gemini-compatible `providerAuthoringShapeSchema` transport schema.

`session-provider-split-critical.mjs` now performs focused critical reviews for:

1. WORKED claims;
2. methodology links;
3. functional links.

Every partial critical response must repeat the same canonical input hash. `criticalClaimsGate` remains unchanged.

The split driver rate-limits focused requests with a minimum 8.2-second interval.

## Known live evidence

v5:

- Session Gate PASS;
- SGD-001..016 PASS;
- SGS-001..012 PASS;
- Critical Gate NOT_EVALUABLE because one monolithic reviewer paraphrased several exact quotes;
- the two critical WORKED claims passed;
- one repair was consumed in that diagnostic runner, but note that its orchestration repaired after NOT_EVALUABLE and therefore v5 is not canonical certification evidence.

A later real Gemini split-review probe passed WORKED, METHODOLOGY and FUNCTIONAL families with literal exact quotations accepted by deterministic checks.

v6/v6b confirmed that hand-built temporary runner schemas are the wrong path: v6 local AUTHORING_SHAPE failure; v6b Google 400 when strict enums/min/max were sent directly. Use the checked-in transport projection instead.

## Canonical code paths to use

- `shadow/project-blueprint-v1/*`
- `shadow/session-graph-v1/*`
- `shadow/pipeline-v1/pipeline.mjs`
- `shadow/pipeline-v1/session-provider.mjs`
- `shadow/pipeline-v1/session-provider-split-critical.mjs`
- `shadow/pipeline-v1/live-shadow.mjs`
- `shadow/pipeline-v1/critical-audit.mjs`
- `shadow/pipeline-v1/projection.mjs`
- `shadow/presentation-v1/*`

## Tests to run first

Run the current branch tests before any live provider call:

```text
npm run test:shadow:core
```

If any test fails, fix only the shadow branch and rerun affected tests. Do not call Gemini until deterministic tests pass.

## Live positive acceptance criteria

Record:

- branch HEAD;
- model;
- provider request IDs;
- prompt/candidate/total token usage per call;
- approved Blueprint hash;
- SessionGraph hash;
- repair count;
- Session Gate status;
- Critical Gate status;
- TeacherPlanProjection hash.

Positive is certified only if final canonical status is exactly `READY_FOR_TEACHER` and both Session Gate + Critical Gate are PASS.

## Adversarial acceptance criteria

After the positive passes, run the existing/prepared adversarial SessionGraph case. It must remain rejected; no TeacherPlanProjection may be produced.

## After certification

1. persist evidence/checkpoint on this branch;
2. pass the real READY_FOR_TEACHER result through `PresentationGateway` / `TeacherPlanView`;
3. verify snapshot/history/export source without rerunning AI;
4. perform the authenticated web smoke on an isolated preview;
5. keep `main` and production untouched until explicit promotion decision.

## Temporary Supabase surfaces

At handoff time these are neutralized with HTTP 410 and `verify_jwt=true`:

- `pipeline-v1-session-evaluate`;
- `pipeline-v1-session-preflight`;
- `plan-multiplan-pipeline-v1-shadow`.

Do not reopen them unless the chosen validation path explicitly needs them, and neutralize them again after use.
