# SessionGraph V1 — final shadow certification checkpoint (2026-09-24)

Branch: `session-graph-v1-shadow`

Source HEAD evaluated before recording this evidence:

`044212b0d33553468eff240fce9d131e2a3dfde8`

Approved ProjectBlueprint hash:

`ec6c5a1436ff1798bef4a44f55ba4cd8ac699529b41ce4217e4f1084f4802620`

## Why the SessionGraph authoring/reviewer was tightened

A previous candidate exposed a semantic false-positive risk: `WORKED` could be accepted even when the concrete activity performed only part of a multi-clause PDA, and some preparatory activities could be mislabeled `DIRECT`. The shadow authoring and reviewer instructions were therefore tightened before final certification.

The final rules require that `WORKED` be judged from the same activity, not inherited from prior activity context. For grade 1 PDA `F3-DHC-1-010`, a `WORKED` activity must both explain a concrete situation and propose an agreement. For grade 3 PDA `F4-DHC-3-001`, a `WORKED` activity must include accessible inquiry/source consultation, processing or contrast, a traceable record, and sharing why the finding matters for socialization. The reviewer must audit every `WORKED` row individually.

## Positive candidate and repair

A fresh candidate was generated as `sessiongraph-generate-v7` with `gemini-3.5-flash-lite` under the tightened authoring rules.

Generation result:

- HTTP Google: 200
- finish reason: `STOP`
- prompt tokens: 4,868
- candidate tokens: 4,128
- total tokens: 8,996
- candidate length: 17,380 characters

The v7 candidate was substantially improved but still had four targeted issues: grade-3 `WORKED` did not yet explicitly include sharing importance in the same inquiry activity; the first intervention activity mounted and mediated but was still marked `COMPLEMENTARY`; the first circulation record was not explicitly linked to `circulation_evidence`; and two assessment criteria remained too vague.

One logical semantic repair was requested. The first transport attempt (`sessiongraph-repair-v8`) returned provider `503 UNAVAILABLE` and produced no candidate. The same repair was retried as `sessiongraph-repair-v8b` after the temporary provider availability failure.

Repair result:

- HTTP Google: 200
- finish reason: `STOP`
- prompt tokens: 7,658
- candidate tokens: 4,421
- total tokens: 12,079
- candidate length: 18,895 characters
- logical repair count: 1

The repaired proposal made session-1 activity 1 complementary with a verifiable handoff, made grade-3 inquiry `WORKED` only where inquiry + contrast + traceable record + sharing importance all occur in the same activity, retained later grade-3 rows as `DEVELOPING`, made the first real mounting/mediation/circulation activity `DIRECT`, and strengthened observable criteria.

## Positive certification

The repaired proposal passed authoring preflight and deterministic compilation against the approved Blueprint binding.

- Authoring: PASS
- deterministic compile / SGD invariants: PASS
- semantic review SGS-001..SGS-012: PASS
- positive status: `APPROVED`
- graph hash: `1f5ec5905e1bf5928697633736ff9a276e93a00505659e144241028897779a1e`
- approved graph hash: `1f5ec5905e1bf5928697633736ff9a276e93a00505659e144241028897779a1e`
- semantic input hash: `be1e26a4da729404f2a8e0fe2f105ef38744422ed720622f59308667958d2f6d`

Independent semantic review usage:

- HTTP Google: 200
- finish reason: `STOP`
- prompt tokens: 10,357
- candidate tokens: 1,492
- total tokens: 11,849

The independent reviewer explicitly audited the complete set of `WORKED` rows. It found exactly two: session 1 activity 2 grade 3, which performs inquiry/source consultation + contrast + traceable record + sharing importance; and session 2 activity 2 grade 1, which explains a concrete situation and proposes an agreement in the same activity. All other partial mobilizations remained `DEVELOPING`.

## Adversarial certification

A semantic-only adversarial mutation preserved the graph structure, methodology links, artifact links, PDA links and functional-requirement IDs but replaced actual movement/reinstallation with hypothetical discussion.

- adversarial deterministic compile: PASS
- adversarial graph hash: `ad7cb54d3e608de4ed32c8f95942da3e4ea97726f644cf96d2a8d64b4e10f074`
- adversarial semantic input hash: `cfa9cb5a19bf5ddc4849815cd163ebb69d2a7d7ca54b37b2330ec76e641dae0b`
- semantic review HTTP Google: 200
- finish reason: `STOP`
- prompt tokens: 10,142
- candidate tokens: 1,199
- total tokens: 11,341
- adversarial status: `REJECTED_CORRECTLY`
- failed semantic rules: `SGS-005`, `SGS-008`, `SGS-012`

The adversarial failed for genuine semantic reasons: a `DIRECT` activity only discussed a hypothetical transfer instead of producing the promised intervention artifact; declared movement/reinstallation/circulation requirements were no longer executed; and the final closure no longer completed the approved itinerant outcome. It did not fail because of auth, transport, schema, JSON parsing, token limits, missing files or an artificial structural break.

## Infrastructure and scope

The final shadow certification used the approved Blueprint stored for the ProjectBlueprint checkpoint and a shadow certification harness reproducing the current SessionGraph deterministic ownership/invariants. It was not a Work checkout execution because Work's GitHub CLI environment was unavailable earlier in the session. The semantic reviews and adversarial were provider-generated with Gemini 3.5 Flash-Lite.

Temporary chat-only SessionGraph helper Edge Functions used for this checkpoint were returned to disabled `410` handlers with JWT verification after completion. The authoritative ProjectBlueprint shadow endpoint was not weakened.

Production, `main`, PR3 and PR4 were not modified or promoted.

## Decision

Positive SessionGraph = `APPROVED` and its exact graph hash equals the approved graph hash.

Semantic adversarial = deterministically compilable and correctly rejected by SGS semantic rules.

`SESSIONGRAPH V1 VALIDADO`
