# MULTIPLAN Stage 7 — Recovery operation supersession (shadow)

Date: 2026-11-24 UTC. Only on draft branch `stage7-recovery-r1-shadow-20261123`.

## Bug uncovered before certified integration

The existing PostgreSQL `multiplan_recovery.append_state` deliberately allows a NEW `PENDING` operation after a **confirmed** retryable failure (`429`, `500`, `502`, `503`, `504`) if `p_allow_retry=true`, the same input hash is retained, and the caller holds a valid lease/fence. The new operation row has `supersedes = previous.request_id`. Multiple durable rows within one review family are therefore legitimate.

The initial pure `assessStage7Recovery` guard rejected all repeated families as `DURABLE_OPERATION_NOT_UNIQUE`, even when they formed a valid retried chain. It would deny safe recovery after a recorded retry.

## Defensive correction

- Require at most one linear supersession chain per family: exactly one root, no forks, no cycles, no missing predecessor, and exactly one latest leaf.
- The current checkpoint's `request_id` must equal that terminal leaf; previously registered IDs remain historical.
- All historical rows must match the fixed critical input hash and code version. Registered revisions must strictly increase when supplied.
- A `PENDING` latest request still results in `UNKNOWN_OUTCOME`, **never** authorization to send another provider request.
- A completed latest request only permits revalidation of the curriculum, not publication.
- Malformed chains fail closed. Older test expectations for orphan and wrong active IDs remain unchanged.

Local verification: **53/53 tests PASS**, including **seven** new chain tests. These are pure mocks and do not prove the live SQL action was invoked. No Gemini, secrets, credential changes, production Supabase or Railway operations.

## Still blocked

The lab `read_bundle` SQL migration remains uninstalled because the privileged `postgres` connection lacks CREATE access to the private `multiplan_recovery` schema. No permissions were enlarged. The synthetic lab `plan_runs` do not hold independent original canonical sources and must be rejected by the revalidation guard until such sources are recorded.

The branch remains a DRAFT and must not be merged without the tests present in GitHub and full CI results.
