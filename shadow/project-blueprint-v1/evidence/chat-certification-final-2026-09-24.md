# ProjectBlueprint V1 — chat certification checkpoint (2026-09-24)

Branch: `project-blueprint-v1-shadow`

Source HEAD evaluated: `6fb51edb7a8862ffd97d937603344e238bdfc0ed`

## Positive case

A repaired `BLUEPRINT_AUTHORING_COMPACT_V1` candidate was generated with `gemini-3.5-flash-lite` using the current provider shape strategy and effective output budget of 22,000 tokens.

Generation result:

- HTTP Google: 200
- finish reason: `STOP`
- prompt tokens: 7,350
- candidate tokens: 5,328
- total tokens: 12,678
- candidate length: 21,540 characters
- repair count: 1

The candidate explicitly implemented the semantic corrections requested after revision 1: traceable `INDAGA`, explicit source consultation/contrast and written record, interdependent contributions by grades 1 and 3, and concrete construction of the evidence required by the `MUSEUM + ITINERANT` functional contract.

Certification result on the same compiled Blueprint:

- Authoring validation: PASS
- compileAuthoring-equivalent compilation against current construction ownership: PASS
- ProjectBlueprintV1 contract checks: PASS
- BPD-001..BPD-020: PASS
- BPD-TIME: PASS
- BPD-LTG: PASS
- BPS-001..BPS-012 independent semantic review: PASS
- final status: `APPROVED`
- blueprint hash: `ec6c5a1436ff1798bef4a44f55ba4cd8ac699529b41ce4217e4f1084f4802620`
- approved blueprint hash: `ec6c5a1436ff1798bef4a44f55ba4cd8ac699529b41ce4217e4f1084f4802620`

Semantic review usage:

- HTTP: 200
- finish reason: `STOP`
- prompt tokens: 5,736
- candidate tokens: 1,424
- total tokens: 7,160

## Adversarial case

A semantic adversarial mutation was applied to the approved Blueprint without changing IDs, source bindings, resource budget, artifact IDs, methodology catalog metadata, or structural operation assignments.

Mutation: the intervention/session-3 prose was changed so the museum was presented only in the classroom and explicitly did **not** move or reinstall in a second space, while the final outcome still declared `MUSEUM + ITINERANT` and its functional requirements.

Adversarial hash: `2d4811f63d2df9904e642caa0970655ed34139680a652cdfe7ebc1c385073c3b`

Independent semantic review result:

- HTTP: 200
- finish reason: `STOP`
- prompt tokens: 4,620
- candidate tokens: 1,183
- total tokens: 5,803
- status: `REJECTED_CORRECTLY`
- failed semantic rules: `BPS-003`, `BPS-007`

The rejection was due to a genuine project inconsistency: the declared itinerant outcome required movement, reinstallation, and circulation evidence, but the actual progression explicitly removed those operations. It was **not** rejected because of auth, transport, provider schema, JSON parsing, MAX_TOKENS, missing files, or runner failure.

## Infrastructure notes

The earlier Gemini `400 INVALID_ARGUMENT` transport/schema incident is no longer the active blocker. The current provider-shape approach produced complete structured candidates. Temporary chat-only Edge Functions used to invoke/read/certify the shadow evidence were returned to disabled `410` handlers after the checkpoint. Production, `main`, PR3, PR4, and SessionGraph were not modified.

## Decision

The positive case is `APPROVED` and the semantic adversarial is correctly rejected. This closes the ProjectBlueprint V1 validation checkpoint for the evaluated source HEAD and approved Blueprint hash.

`PROJECTBLUEPRINT V1 VALIDADO`
