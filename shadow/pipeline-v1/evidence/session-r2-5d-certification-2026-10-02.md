# SessionGraph R2 — 5D certification evidence

Date: 2026-10-02
Scope: V0.12.4 certified SessionGraph R2 pipeline, shadow/certification only.

## Certified candidate identity

The certified runtime was uploaded from the locally validated `repair-targets-validation` snapshot with `railway.cmd up --path-as-root`.

Local file SHA-256 identities used by preflight:

- `shadow/pipeline-v1/session-provider.mjs`: `50d1885890ad3463f40d28a1446da68dcf9a807aeea38bcccada5658a8d0afc2`
- `shadow/pipeline-v1/tests/session-provider.test.mjs`: `ef06c32bf16a2e517b373187b741496c1599d28870a285bfa67667bf12612b7a`

The runtime also emitted `expected_head=3011171b4289bc32a409857441751550a5f332fe` as the branch reference used during certification. Important provenance note: the Railway deployment was a local snapshot upload, not a Git checkout, and the certified local bytes are identified by the SHA-256 values above. They are not asserted here to be byte-identical to the Git blob objects at commit `3011171...`.

Locked provider/model configuration:

- model: `gemini-3.5-flash-lite`
- execution mode: `CERTIFIED_R2`
- durable evidence: enabled
- production execution policy checks: enabled

Source artifact hashes:

- constraints: `231186405b12537fc00f9cb7d644bb98e7c79b2cc9eb7cae401aecc399c5400a`
- curriculum: `e67ab1bb301cebefc9f31f500d0a2e4d8d795ab26a4f26b6840749cca6e9a5bf`
- methodology: `9d2b4be07b5837ac7f4b181fcbfa95b50dfb404a737698c908cf231837ed9cf6`

## 5D-P — positive certification

Railway deployment:

`292a100c-489b-40b4-90df-9cfeeea64ecf`

Final marker:

`CERTIFIED_5D_P_PASS`

Result:

- status: `READY_FOR_TEACHER`
- `repair_count`: `1`
- ProjectBlueprint gate: `PASS`
- SessionGraph gate: `PASS`
- critical gate: `PASS`
- TeacherPlanProjection: present
- approved blueprint hash: `93125fa3d605a4b89470ad604524c1fa08e4f015148982f56e9a762b4d356e2f`
- approved SessionGraph hash: `4490609ddf78d85ab63db61e8a830ba5dd0c7f4ec4de939912019a2355c12eaa`
- projection hash: `7690d63fdb2c79b830211f96898d21ffb3ddc3606801a6cbca2a08c4b1f1660e`

The initial SessionGraph proposal contained deterministic authoring defects. The single allowed repair corrected them, after which the deterministic, semantic, and critical gates all passed. SGD-009 did not recur.

Provider evidence:

- 12 provider requests recorded
- all HTTP/provider status `200`
- all `finish_reason=STOP`
- total tokens recorded: `105524`

## 5D-A — adversarial certification

Final certified Railway deployment:

`bfce5fd6-a621-4f2c-93a4-c123a17b9762`

Final marker:

`CERTIFIED_5D_A_PASS`

Adversarial protocol:

1. Generate the base proposal.
2. Permit at most one repair before adversarial injection.
3. Require the repaired base proposal to compile deterministically.
4. Inject `SESSION_GRAPH_ADVERSARIAL_V1`, replacing real itinerant execution with hypothetical discussion/planning while preserving structural links.
5. Permit zero repairs after adversarial injection.
6. Require deterministic compile to pass and semantic and/or critical review to reject the graph.
7. Require no TeacherPlanProjection.

Observed result:

- status: `SESSION_GRAPH_REJECTED`
- `base_repair_count`: `1`
- `base_compile_passed`: `true`
- `adversarial_injected`: `true`
- post-adversarial `repair_count`: `0`
- ProjectBlueprint gate: `PASS`
- adversarial `SESSION_COMPILE`: `PASS`
- `SESSION_GATE`: `FAIL`
- `SESSION_CRITICAL_GATE`: `FAIL`
- TeacherPlanProjection: absent
- adversarial compiled graph hash: `c5c207bd860d1fa536a38517b9f49c9708e55dbf4c107db384da26c5ec137f2d`
- ProjectBlueprint approval hash in this run: `ed60d18a79a8f96dd9af317f2da63483a40563b14c075d82ed412ef33d8e8c11`

This demonstrates the intended distinction: the adversarial graph was structurally valid enough to pass deterministic compilation, but its semantic claim of real movement/reinstallation was false in the activity text. Both semantic gates rejected it, and projection to the teacher was blocked.

Provider evidence:

- 11 provider requests recorded
- all HTTP/provider status `200`
- all `finish_reason=STOP`
- total tokens recorded: `93490`

## Non-certifying attempts retained for audit context

- `7e6cb91c-69ed-49ca-803b-558b570aef23`: adversarial run was inconclusive because the base proposal failed deterministic compilation before semantic evaluation. It was not counted as certification.
- `897981bd-d366-498e-a27e-6a2e6125eb01`: Railway `redeploy` reused the previous frozen start command and executed another positive 5D-P instead of 5D-A. It was not counted as adversarial certification.
- Earlier preflight-only attempts stopped before provider execution when code identity did not match. Those attempts are not certification evidence.

## Certification conclusion

5D-P and 5D-A are both certified for the candidate identified above:

- a valid plan can reach `READY_FOR_TEACHER` only after deterministic, semantic, and critical gates pass;
- a structurally valid but semantically defective adversarial plan is rejected before TeacherPlanProjection;
- no post-adversarial repair was allowed in the certified 5D-A.

No change to `main`, production application code, PR #3, or PR #4 is part of this certification record.

## Railway cleanup

After certification, stale staged Railway environment patch `b87c5487-ef34-40c1-b8b2-e359968159ce` was discarded without deployment. Railway reported no active staged changes afterward (`stagedChanges: null`). The temporary certification service itself was left in place to preserve deployment logs and evidence; it was not redeployed or deleted during cleanup.
