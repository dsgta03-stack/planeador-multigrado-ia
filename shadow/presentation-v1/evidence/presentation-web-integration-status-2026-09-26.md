# Presentation/Web integration status — 2026-09-26

Scope: `session-graph-authoring-r2-shadow` only. No production, `main`, PR #3 or PR #4 changes are included.

## Completed in this stage

A fail-closed presentation boundary was added after `TeacherPlanProjectionV1`:

1. `teacher-plan-view.mjs`
   - accepts only a valid `READY_FOR_TEACHER` pipeline result;
   - validates `TeacherPlanProjectionV1` before rendering;
   - preserves ProjectBlueprint/SessionGraph semantics without AI rewrite or fallback synthesis;
   - optionally binds teacher-facing metadata to the exact projection hash and constraints hash.

2. `final-plan-snapshot.mjs`
   - persists the exact validated teacher view;
   - stores projection/view/Blueprint/SessionGraph bindings;
   - restores history without rerunning AI;
   - detects semantic or duplicated-binding tampering.

3. `presentation-gateway.mjs`
   - is the single boundary for UI/history surfaces;
   - creates a teacher view and final snapshot only when the pipeline is truly renderable;
   - rejected, unavailable or malformed states remain closed and produce neither artifact.

4. `export-source.mjs`
   - defines the only acceptable source contract for future DOCX/PDF exporters;
   - exporters consume an already validated `TeacherPlanView` or validated final snapshot;
   - raw provider output, partial pipeline output and rejected graphs are not valid export sources.

5. `web-response.mjs`
   - maps validated pipeline states to deterministic HTTP/UI states;
   - only `READY_FOR_TEACHER` can return a plan payload;
   - missing teacher input, rejection and provider/review outages remain non-renderable;
   - no partial plan payload is leaked on failed states.

## Added regression coverage

- `teacher-plan-view.test.mjs`
- `final-plan-snapshot.test.mjs`
- `presentation-gateway.test.mjs`
- `export-source.test.mjs`
- `web-response.test.mjs`

The repository script `test:shadow:presentation` covers all tests under `shadow/presentation-v1/tests/*.test.mjs`.

## Evidence status

The earlier deterministic presentation/snapshot set recorded 10/10 passing in isolated local evidence. The newly added gateway/export/web-response tests have been committed but are **not yet claimed as executed in repository CI**.

GitHub Actions is currently not producing runs for `session-graph-authoring-r2-shadow`, so CI remains a blocking external/infrastructure condition. This must not be represented as a pedagogical or pipeline approval.

## Current certification boundary

Still not certified as production-ready.

To cross the boundary safely, all of the following remain required:

- execute the full deterministic shadow suites from the current branch head;
- complete the controlled live Gemini pipeline validation using the already-certified model/config and real authoritative Supabase curriculum path;
- obtain an actual `READY_FOR_TEACHER` result with ProjectBlueprint approval, SessionGraph deterministic + semantic + critical gates passing, and bounded repair behavior;
- pass the real result through PresentationGateway and verify exact view/snapshot bindings;
- integrate the gateway into an isolated web preview, not production;
- run authenticated smoke tests for create → render → history reopen → review → export;
- only after that decide whether to promote the new pipeline/UI architecture.

## Explicitly unchanged

- `main` production line;
- stable Railway production service;
- PR #3 and PR #4;
- current production pedagogical Gates/contracts;
- Supabase RLS/grants.
