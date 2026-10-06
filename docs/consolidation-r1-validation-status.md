# Consolidation R1 — validation status

Branch: `consolidation-single-app-r1`  
Current evidence head: `63b8c710c04c7c937f523940742e21ef54c31082`

## Safety boundary

- Production was not modified by this branch.
- Production remains on restored deployment `4492933c-4423-4b19-80eb-f262d74da2f8`.
- The existing shadow deployment `4391b4a4-5ece-4dba-aaea-e98accc1e3b7` remains active and healthy.
- The shadow service source/config was restored to its prior v0.12.5 reference after Railway refused a source deploy because the Railway GitHub App is not installed/authorized for the repository.
- Compared with `main`, Consolidation R1 is additive only: 25 added files and **zero modifications to existing certified v0.12.4/v0.12.5 files**.

## Architecture established

The new entrypoint is:

```text
server-consolidation-r1.mjs
  → lib/consolidation-r1/server.mjs
      → one HTML authority
      → canonical v0.12.5 generation route
      → canonical review
      → canonical DOCX
      → canonical history
      → auth-protected retrieve/material/methodology proxies
```

The new runtime does not start historical `server-v*.mjs` processes. Historical layers are represented only by extracted UI assets or by retained invariants/modules.

## Static syntax audit

All 23 new JavaScript module/test files were parsed in an isolated V8 syntax pass. Result:

- 23 passed
- 0 syntax failures

The `import.meta.url` expression in the Node test was normalized only for the V8 script-mode parser; its module syntax remains valid Node ESM.

## Single UI authority evaluation

The assembled UI was executed as a pure build in isolation. Results:

- valid HTML document: yes
- legacy remote v0.8.4b Railway UI dependency: absent
- professional dashboard style: exactly 1
- professional dashboard script: exactly 1
- methodology UI: exactly 1
- teacher presentation UI: exactly 1
- official methodology sequence UI: exactly 1
- history UI: exactly 1
- workflow UI: exactly 1
- v0.12.4 review/project UI: exactly 1
- canonical client bridge: exactly 1
- auth UI present
- review control present
- DOCX control present
- methodology observer reentrancy fix compiled in
- broken observer form absent

The assembled HTML is approximately 130 KB and is served directly by the single process; it is not fetched from another local port or another Railway service.

## HTTP ownership

The UI requires these product APIs, all of which are owned directly by the consolidated server:

- `/api/retrieve`
- `/api/material`
- `/api/methodology-recommendation`
- `/api/gemini-plan`
- `/api/history`
- `/api/history/:run_id`
- `/api/pedagogical-review`
- `/api/export/docx`

The canonical v0.12.5 aliases and certified route are also mounted.

## Canonical binding

The generation compatibility path delegates to the existing certified v0.12.5 unified route. A successful generation supplies the canonical plan to the legacy-visible endpoint and exposes the exact canonical hash in `x-multiplan-canonical-plan-hash`.

The browser bridge retains that hash and supplies it to review and DOCX. Reopened canonical history also restores the canonical hash. Existing v0.12.5 services continue to reject divergent plan/hash pairs before review/export.

No existing certified v0.12.5 module was edited by this branch.

## History consolidation

History now has direct handlers in the single server. Snapshot enrichment uses the injected single-app fetch path rather than silently escaping to another wrapper/server. New isolated history tests cover:

- owner-auth boundary;
- canonical final snapshot promotion;
- history list metadata derived from the final snapshot;
- detail hash recomputation and binding.

## Tests prepared for the runtime gate

The isolated suite now includes:

- consolidation manifest/invariants;
- UI authority;
- single-server and no-child-process checks;
- fail-closed HTTP boundaries;
- canonical history routes;
- v0.12.5 canonical adapter;
- pipeline/canonical bridge;
- canonical lifecycle;
- unified orchestrator/route/server route;
- canonical review/DOCX services and HTTP routes;
- canonical history;
- SessionGraph contribution-repair regression.

## Remaining gate before shadow preview

A real Node execution of the complete suite is still required. GitHub Actions has produced no runs for this repository, and Railway cannot fetch the consolidation branch because its GitHub App installation is currently unavailable. Therefore this document does **not** claim runtime test PASS yet.

After the Node suite passes, the next step is an isolated shadow deploy and then visual/functional parity review. Production must remain frozen until both gates pass.
