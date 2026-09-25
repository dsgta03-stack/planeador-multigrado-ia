# Router → Pipeline V1 live-provider validation — blocked transport checkpoint

Date: 2026-09-25 UTC

Starting certified checkpoint requested for this validation:

`7c37c1fd2907c888ad207ef65742d7a85a5160be`

Validation branch:

`pipeline-v1-router-e2e-validated-shadow`

The branch subsequently added only validation harness/workflow/evidence surfaces. No architecture, Gate, pedagogical rule, source contract, production route, `main`, PR #3, or PR #4 was changed.

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

The temporary runner attempted to materialize the exact validation branch at runtime and anonymous GitHub access from that runtime returned 404. A later repository metadata check reports the repository visibility as public, so this evidence does not classify that 404 as proof of repository privacy. The failure still occurred before ProjectBlueprint authoring and before Gemini was called.

### Railway isolated-candidate host

Only the old non-production candidate service `planeador-multigrado-ia-v0112-candidate` was used. Stable production was not touched.

A fresh image deployment was created as deployment:

`6e46d7e0-b2d5-410d-8148-68d6d19f8e9a`

The container failed to bootstrap the exact validation branch:

- `could not fetch https://github.com/dsgta03-stack/planeador-multigrado-ia`
- `could not find commit hash for pipeline-v1-router-e2e-validated-shadow`

The deployment ultimately settled as `FAILED` at the healthcheck stage.

Classification:

`HOSTING/TRANSPORT`

After pointing the candidate source configuration back to the repository, Railway's repository deployment operation independently reported that no active GitHub installation was available for `dsgta03-stack/planeador-multigrado-ia`, so it could not resolve/fetch the branch for a fresh source deployment. No Gemini Pipeline call was issued from Railway.

The immediately prior candidate deployment `7baa5b26-3d73-45e1-9589-0361cd335f05` remains recorded as `SUCCESS`; the current control-plane configuration has been restored to `main` + `node server-v0113-v65beta10-promoted.mjs` + `/health`, but a fresh deployment cannot be created until Railway repository access is restored.

## GitHub Actions execution-path check

A branch-local workflow `router-live-provider-shadow.yml` exists and a harmless marker commit was added solely to trigger the branch workflow:

`5b032823e2f80a46fd1409ff003815890703f011`

GitHub's Actions run collection still reported `total_count: 0` for the repository and for the validation branch after that commit. Therefore no workflow execution is claimed and GitHub Actions did not provide an alternate execution host in this validation window.

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

The single provider availability probe above returned HTTP 200 but is not counted as the Pipeline run.

## Required external control-plane action before rerun

The remaining executable path is to restore Railway's GitHub repository authorization for `dsgta03-stack/planeador-multigrado-ia`. Railway's current control plane cannot perform that authorization on behalf of the account owner.

Required user-side control-plane sequence:

1. Railway → `planeador-multigrado-ia-v0112-candidate` → Settings → Source.
2. Reconnect the repository source. If the repository is not selectable, verify/re-authorize the Railway GitHub App for `dsgta03-stack/planeador-multigrado-ia` and accept any pending permission update.
3. Return to Railway and refresh/reselect the repository.

Once repository access is restored, rerun only the isolated candidate against `pipeline-v1-router-e2e-validated-shadow` and resume the same controlled validation without changing Gates, pedagogical rules or contracts.

## Decision

The deterministic E2E router/Pipeline checkpoint remains valid, and the certified Gemini model was independently reachable. The requested new live operational chain could not yet be executed end-to-end because the remaining full-chain execution host is blocked at its repository authorization boundary, while the production-shaped anon curriculum path also remains correctly fail-closed.

No retry loop was used, no rule was weakened, no candidate was rewritten to force a PASS, and no pedagogical rejection was converted into success.

**Result: LIVE ROUTER VALIDATION BLOCKED BY TRANSPORT/AUTH. NOT CERTIFIED AS `READY_FOR_TEACHER`.**
