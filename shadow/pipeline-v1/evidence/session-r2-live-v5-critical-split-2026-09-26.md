# SessionGraph R2 live v5 — critical review diagnosis

Date: 2026-09-26
Branch: `session-graph-authoring-r2-shadow`
Model: `gemini-3.5-flash-lite`
Blueprint hash: `d552b9680a8f48eadef9c6cca36c4c3849b96eef10a472a803b8f24911ae7690`

## Result

The live v5 diagnostic produced a compiled SessionGraph after the single permitted repair.

- Session Gate: **PASS**
- deterministic `SGD-001..SGD-016`: **PASS**
- semantic `SGS-001..SGS-012`: **PASS**
- Critical Gate: **NOT_EVALUABLE**
- final pipeline certification: **NOT READY_FOR_TEACHER**

The Critical Gate did not report a confirmed pedagogical FAIL. It correctly rejected several model-supplied PASS rows because their purported exact quotes were not literal contiguous substrings of the audited claim.

Affected methodology links included `CONCRECION`, `DIFUSION`, and `CONSIDERACIONES`. Affected functional links included `audience_or_route`, `at_least_two_viable_spaces_or_audiences`, `movement`, `relocation_or_reinstallation`, and `mediation`.

The two critical WORKED claims were accepted by the literal gate, including grade 1 `F3-DHC-1-010` and grade 3 `F4-DHC-3-001`.

## Provider requests

- GENERATE `sessiongraph-generate-225049b9-18ec-4ae6-a4f3-f31331e6454d`
- REVIEW `sessiongraph-review-56548427-dc00-498d-83d7-03f094a37fb9`
- critical REVIEW `sessiongraph-review-54efa142-1b76-4d9e-a8fa-8756cc365477`
- REPAIR `sessiongraph-repair-8497ad84-1043-42d5-8c2d-0dc8a3eee015`
- REVIEW `sessiongraph-review-3308fdf9-a275-4fa2-8bd8-d7fb2af7d9bf`
- critical REVIEW `sessiongraph-review-54029c3b-d8d2-406e-909c-4189eb0a8f8a`

All calls returned Google HTTP 200 / `STOP`.

## Important orchestration caveat

The temporary v5 diagnostic runner used its repair after a `NOT_EVALUABLE` critical result. The canonical `pipeline.mjs` does **not** do that: `NOT_EVALUABLE` becomes `SESSION_REVIEW_UNAVAILABLE` and does not consume a repair. Therefore v5 is diagnostic evidence only and is not a canonical pipeline certification.

## Fix introduced after v5

The Critical Gate was **not relaxed**.

A new adapter, `session-provider-split-critical.mjs`, splits the critical review into three focused model calls:

1. WORKED claims;
2. methodology links;
3. functional requirement links.

Each partial call:

- receives only its claim family;
- must repeat the same canonical critical `input_hash`;
- uses a response schema containing only that family's result array;
- explicitly requires short, contiguous, exact quotes and forbids paraphrase, normalization, ellipses, or stitched quotations.

The three outputs are then merged into the unchanged `criticalAuditResponseShape` and passed to the unchanged `criticalClaimsGate`.

`live-shadow.mjs` now uses `createSessionGraphDriversSplitCritical` for future live shadow validations.

## Certification boundary

This change is a reviewer robustness change, not evidence of `READY_FOR_TEACHER` by itself. A new canonical live execution is still required. GitHub Actions remains unavailable for this branch, so repository-wide CI is still pending.
