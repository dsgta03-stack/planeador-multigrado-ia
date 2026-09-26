# Presentation V1 local evidence — 2026-09-26

Scope: deterministic presentation/history boundary only. This evidence does **not** certify SessionGraph R2 live or production readiness.

## Modules covered

- `shadow/presentation-v1/teacher-plan-view.mjs`
- `shadow/presentation-v1/final-plan-snapshot.mjs`
- `shadow/presentation-v1/tests/teacher-plan-view.test.mjs`
- `shadow/presentation-v1/tests/final-plan-snapshot.test.mjs`

The test harness used the exact presentation/snapshot module code plus the exact `assertTeacherProjection` / `teacherProjectionHash` behavior and the `hash` / `deepFreeze` dependency surface consumed by these modules. No network, AI call, database, production service or v0.12.4 UI was involved.

## Command

```text
node --test shadow/presentation-v1/tests/*.test.mjs
```

## Result

```text
1..10
# tests 10
# suites 0
# pass 10
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

Validated properties:

1. only a valid `READY_FOR_TEACHER` + valid `TeacherPlanProjectionV1` is renderable;
2. rejected/unavailable pipeline states remain fail-closed;
3. a tampered TeacherPlanProjection is not renderable even if the outer pipeline status says ready;
4. the view adapter preserves PDA, grade contributions, sessions and activities without fallback pedagogy;
5. teacher-context metadata must be explicitly bound to the same projection hash and a valid constraints hash;
6. only `READY_FOR_TEACHER` is a success UI state;
7. history snapshot persists/restores the exact validated view without rerunning AI;
8. semantic tampering invalidates the snapshot hash;
9. duplicated source binding tampering is detected independently;
10. teacher context cannot be snapshotted without its constraints binding.

## CI status

`.github/workflows/session-graph-shadow.yml` now includes the presentation tests, but GitHub Actions currently reports no runs for `session-graph-authoring-r2-shadow`. Therefore this local deterministic evidence is retained separately and the repository-wide CI status remains pending.
