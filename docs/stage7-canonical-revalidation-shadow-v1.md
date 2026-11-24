# Recovery Stage 7 — Canonical curricular revalidation (shadow V1)

Date: 2026-11-24 UTC. Base: `consolidation-single-app-r1`, isolated PR #9.

## Scope and guardrails

The new `shadow/recovery-v1/canonical-revalidation.mjs` uses the same authenticated, atomic recovery bundle expected by `lab-bundle-reader.mjs`. A stored checkpoint cannot act as its own independently persisted canonical context. The source run **must** have retained the original `constraints`, `curriculum`, `methodology`, immutable binding hashes and code/checkpoint versions under the verified teacher/run ownership. All must match the attempt and recovered checkpoint exactly.

An authenticated caller receives a *read-only assessment*, not permission to call Gemini, restart a project, modify a lease/fence, publish, or return `READY_FOR_TEACHER`.

The flow is:

1. Supabase Auth identity verification (injected implementation).
2. One scope-bound trusted transactional bundle read (injected implementation).
3. Run/attempt ownership and independent canonical context equality check.
4. Existing `assessStage7Recovery` for SHA-256, inner digest, binding integrity, operation status and durability.
5. On `SNAPSHOT_AVAILABLE` or `FINAL_SNAPSHOT_FOUND` only, invoke eight explicit injected *curricular* validators on an immutable, structured-cloned snapshot: `projectComposition`, `blueprint`, `sessionGraph`, `worked`, `methodology`, `functional`, `ltg`, `canonicalProjection`.
6. A validator must return exactly `{status:'PASS'}`. Any rejection, exception or incomplete proof blocks all subsequent gates. Even all eight passing yields only `SHADOW_GATES_PASSED`; an actual certified pipeline and final promotion gate are still required.

`PENDING`, `ACCEPTED`, retryable `FAILED`, `UNKNOWN`, missing canonical inputs, ownership mismatch and corrupt digests never cause a provider call. No request IDs are generated here.

## Verification with mocks

Execute from the repository root on Node.js 22 or later:

```bash
node --check shadow/recovery-v1/canonical-revalidation.mjs
node --test shadow/recovery-v1/tests/*.test.mjs
```

Observed locally: **46/46 PASS** (the prior 31 tests plus 15 new tests). Tested identity, fail-closed handling, missing original canonical context, hash tampering, pending after ambiguous ACK, no checkpoint, ordered eight-gate revalidation, first-failure stop, exceptions, exact PASS semantics, single bundle read and deeply frozen snapshot.

These tests run **mock validators**, not the certified curriculum gate implementations. `SHADOW_GATES_PASSED` therefore means only that the test seam honors the specified control flow.

## Outstanding live/lab integration blocker

The SQL function `multiplan_recovery.read_bundle(uuid,uuid)` is **not installed** in MULTIPLAN-LAB. The last isolated migration attempt failed `42501 permission denied for schema multiplan_recovery`. The schema belongs to `multiplan_recovery_owner`, and the accessible PostgreSQL administrative role lacks `CREATE` and `SET ROLE` for that owner. No privileges were widened or bypassed. The SQL script in `docs/stage7-lab-bundle-read.sql` must be reviewed and installed by an authorized schema owner before the existing lab worker can expose the read action.

The laboratory's synthetic `public.plan_runs.input_json` only contains fixture markers, not independently retained canonical source artifacts. Even after the read function is installed, this test fixture **must** fail closed with `CANONICAL_CONTEXT_NOT_PERSISTED` until an explicit immutable canonical source storage contract is added to the run creation flow.

No changes to `main`, production Supabase, Railway, Gemini, existing certified files or pipeline routes. This PR remains a draft and must not be auto-merged.
