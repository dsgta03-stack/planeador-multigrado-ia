# ProjectBlueprint V1 — isolated shadow

Experimental domain contracts, fixtures, generation and validation. Nothing in the
production server imports this directory. No SessionGraph or executable activity
generator is implemented. No production database persistence is used.

## Reproduce local verification

```sh
node --test shadow/project-blueprint-v1/tests/*.test.mjs
node shadow/project-blueprint-v1/report.mjs
```

Do not rebuild fixtures to run tests: their versioned inputs and hashes are already
committed. `fixtures/build.mjs` and `fixtures/extend.mjs` are authoring utilities.
The latter writes specifically authored five/twelve-session architectures; it does
not allocate methodology phases proportionally.

## Explicit live execution

Use an external, permission-600 JSON file containing `endpoint`, `token`, `identity`.
Never commit that file. The endpoint must be the separately deployed function
`plan-project-blueprint-v1-shadow`. Only synthetic fixture data and public official
PDA text were sent in this experiment; no production user records were sent.

```sh
MULTIPLAN_SHADOW_RUN=1 NODE_ENV=test \
MULTIPLAN_SHADOW_AUTH_FILE=/absolute/path/to/private-auth.json \
node shadow/project-blueprint-v1/run-live.mjs PB-001 PB-002

MULTIPLAN_SHADOW_RUN=1 NODE_ENV=test \
MULTIPLAN_SHADOW_AUTH_FILE=/absolute/path/to/private-auth.json \
node shadow/project-blueprint-v1/run-live.mjs generate abp
```

The local provider refuses execution without the explicit switch and refuses
`NODE_ENV=production`. Checked-in Edge configuration is disabled. The isolated
deployment uses an expiring random machine token, its SHA-256 hash, and one exact
test identity. It neither accepts arbitrary user IDs nor bypasses production
Supabase Auth. `verify_jwt=false` applies only to this separately authenticated
experimental function. It has no database client, queries, user creation or writes.
The temporary token expires automatically. No browser/public preview is provided.

## Validation and evidence

The JSON Schema interpreter supports only the keywords used by these five schemas;
it is not a general replacement for a complete JSON Schema implementation.
`blueprintGate` is pure. Missing/incomplete semantic review never means PASS.
Explicit missing functional profile requirements fail BPS-003 even if the reviewer
overlooks them. Satisfying their structure still requires semantic evaluation.

Generation receives the three source contracts only. One repair attempt maximum
is allowed per run. Original output, structural diff, triggering rules and failures
are retained. Transport errors preserve earlier revisions and remain NEEDS_REPAIR.
Saved evidence is archived before a subsequent run writes the same filename.

Approval is on an immutable envelope. The evaluated Blueprint remains DRAFT with
`gate_result=null` so its exact reviewed bytes and hash do not change after approval.
Consumers must call `assertApproved(envelope)`, not inspect Blueprint.status alone.
No production consumer is connected in this stage.

`evidence/` contains real Gemini results separately from explicitly labeled test
doubles. Read `DELIVERY.md` for results, limitations and the full schemas. The
experiment is not ready for promotion or the SessionGraph phase.
