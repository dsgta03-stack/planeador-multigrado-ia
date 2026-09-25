# Router → Pipeline V1 live-provider validation — blocked transport checkpoint

Date: 2026-09-25 UTC

Starting certified checkpoint requested for this validation:

`7c37c1fd2907c888ad207ef65742d7a85a5160be`

Validation branch:

`pipeline-v1-router-e2e-validated-shadow`

The branch subsequently added only a validation harness/workflow surface before this evidence record. No architecture, Gate, pedagogical rule, source contract, production route, `main`, PR #3, or PR #4 was changed.

## Requested operational chain

The intended controlled live validation was:

`request → TeacherConstraintsV1 → authoritative Supabase curriculum → MethodologyDecisionV1 → ProjectBlueprintV1 → SessionGraphV1 → TeacherPlanProjectionV1`

with the already certified provider/model:

- provider: Google Gemini through `plan-project-blueprint-v1-shadow`
- model: `gemini-3.5-flash-lite`
- prompt/config family: `PROJECT_BLUEPRINT_SHADOW_V1_R2`
- Blueprint repair boundary: existing maximum of one repair
- SessionGraph repair boundary: existing maximum of one repair

The positive request used grades 1 and 3, three 90-minute sessions, `proyectos_comunitarios`, and the already validated PDA pair `F3-DHC-1-010` + `F4-DHC-3-001`.

## Authoritative curriculum verification

A fresh read-only Supabase database check confirmed the positive case still resolves to active verified curriculum:

- `F3-DHC-1-010`, grade 1, active + `Verificado`;
- `F4-DHC-3-001`, grade 3, active + `Verificado`;
- verified LTG link `F3-LTG-1-ESC-007` → `F3-DHC-1-010`;
- verified project `Frases y expresiones de cortesía`, `Proyectos Escolares`, pages 82–91;
- six verified LTG activity rows, IDs 1692–1697.

No legacy request PDA prose was accepted as curricular authority.

## Integration defect classified before workaround

The production-shaped router lookup forwards the caller authorization to PostgREST. A real request against `public.pda` using the current anon/user-side credential path returned HTTP 401:

`permission denied for table pda`

Database inspection showed RLS enabled on the authoritative curriculum tables and no usable anon/authenticated SELECT path for this request.

Classification made **before any workaround**:

`TRANSPORT_OR_AUTH`

This is not a Gemini/provider failure and not a ProjectBlueprint/SessionGraph contract failure. No grants or RLS policies were changed because that would alter the production data-access boundary.

## Real Gemini provider availability probe

A single live probe was sent through the existing isolated `gemini-model-probe` surface using the certified model.

Observed result:

```json
{
  "pg_net_request_id": 400,
  "model": "gemini-3.5-flash-lite",
  "provider_http_status": 200,
  "ok": true,
  "error_status": null,
  "error_message": ""
}
```

Therefore the real provider/model was reachable during this validation window. This probe is **not** represented as an end-to-end Pipeline approval.

## Controlled execution-host attempts

### Supabase shadow runner attempt A

Durable request ID:

`910533c5-7fc9-482f-ba96-2fa561060b7e`

Result:

- status: `LIVE_PROVIDER_ROUTER_VALIDATION_FATAL`
- classification: `TRANSPORT_OR_AUTH`
- message: `The operation is not supported`
- provider requests recorded: `0`

The failure occurred in the temporary execution harness before a Gemini authoring/review call. It was isolated as an Edge-runtime execution/environment limitation; no pedagogical or contract change was made to force progress.

### Supabase shadow runner attempt B

Durable request ID:

`64a6148f-a1b5-48f8-a42b-197932df1bc1`

Result:

- status: `LIVE_PROVIDER_ROUTER_VALIDATION_FATAL`
- classification: `TRANSPORT_OR_AUTH`
- message: `GITHUB_BRANCH_404`
- provider requests recorded: `0`

The temporary runner attempted to materialize the exact private validation branch at runtime. Anonymous GitHub access from the Edge runtime could not resolve the private branch. The failure occurred before ProjectBlueprint authoring and before Gemini was called.

### Railway isolated-candidate host

Only the old non-production candidate service `planeador-multigrado-ia-v0112-candidate` was used. Stable production was not touched.

A fresh image deployment was successfully created as deployment:

`6e46d7e0-b2d5-410d-8148-68d6d19f8e9a`

The container then failed to bootstrap the exact validation branch because the repository is private:

- `could not fetch https://github.com/dsgta03-stack/planeador-multigrado-ia`
- `could not find commit hash for pipeline-v1-router-e2e-validated-shadow`

Classification:

`HOSTING/TRANSPORT`

After pointing the candidate back at the private GitHub source, Railway's repository deployment operation independently reported that its GitHub App/repository installation was no longer active, so it could not resolve or fetch the branch. No Gemini Pipeline call was issued from Railway.

## Gate / usage result for this requested run

Because every full-chain execution host failed **before ProjectBlueprint authoring**, there is no honest current-run Gate or usage record to fabricate:

- ProjectBlueprint Gate: **NOT RUN**
- SessionGraph deterministic/general Gate: **NOT RUN**
- Session critical-claims Gate: **NOT RUN**
- TeacherPlanProjection: **NOT PRODUCED**
- Blueprint provider request IDs: **none for the requested full-chain run**
- Session provider request IDs: **none for the requested full-chain run**
- Gemini tokens/usage for the requested full-chain run: **none**
- final status: **NOT `READY_FOR_TEACHER`**

The single provider availability probe above returned HTTP 200 but does not expose token usage and is not counted as the Pipeline run.

## Decision

The deterministic E2E router/Pipeline checkpoint remains valid, and the certified Gemini model was independently reachable. The requested new live operational chain could not be executed end-to-end because of two transport boundaries external to the pedagogical Gates:

1. current user/anon PostgREST authorization cannot read the authoritative curriculum tables;
2. the available isolated runtime could not materialize the private validation branch (Railway GitHub connection unavailable; anonymous Edge/GitHub access returns 404).

No retry loop was used, no rule was weakened, no candidate was rewritten to force a PASS, and no pedagogical rejection was converted into success.

**Result: LIVE ROUTER VALIDATION BLOCKED BY TRANSPORT/AUTH. NOT CERTIFIED AS `READY_FOR_TEACHER`.**
