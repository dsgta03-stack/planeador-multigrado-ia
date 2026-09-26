# SessionGraph R2 live v6/v6b transport diagnostics — 2026-09-26

Scope: shadow only. This is **not** a READY_FOR_TEACHER certification.

## v6

Runner used the split critical-review protocol validated after v5, but its temporary transport schema did not pin the authoring envelope strongly enough.

Provider call:

- `sessiongraph-generate-7d83a0a9-fff0-4fb0-ab39-1b812f801809`
- model `gemini-3.5-flash-lite`
- Google HTTP 200
- finish reason `STOP`
- prompt tokens 7,190
- candidate tokens 4,839
- total tokens 12,029

The local preflight stopped immediately with `AUTHORING_SHAPE`. No compile, semantic review, critical review, repair, Gate approval, or TeacherPlanProjection occurred.

## v6b

The temporary runner then attempted to enforce enums/min/max directly in the schema sent to Gemini. Google rejected the request before generation:

- `sessiongraph-generate-264d105a-dda9-42db-bb2c-a0af2276545e`
- Google HTTP 400
- message: `Request contains an invalid argument.`
- no usage
- no repair

This reconfirms the established provider boundary: local authoring constraints may be strict, but the Gemini transport schema must use the compact provider-compatible shape. The checked-in branch already implements this separation through `providerAuthoringShapeSchema`; the temporary runner did not.

## Source bundle

The exact d552 Blueprint/source bundle was persisted to the private shadow evidence bucket only after recomputing the Blueprint hash:

`d552b9680a8f48eadef9c6cca36c4c3849b96eef10a472a803b8f24911ae7690`

The write preflight returned PASS. This bundle is shadow evidence only and is not a production plan.

## Current code-side fix

The branch now contains:

- `session-provider-split-critical.mjs`: WORKED / METHODOLOGY / FUNCTIONAL critical reviews split into independent literal audits;
- exact shared `input_hash` required for all three partial results;
- unchanged `criticalClaimsGate` downstream;
- 8.2-second minimum spacing between focused critical requests;
- unit coverage for merge/hash fail-closed behavior;
- `live-shadow.mjs` wired to the split critical reviewer.

A focused real-Gemini probe of the split protocol passed all three claim families with literal quotes accepted by deterministic checks.

## External execution blocker

A subsequent attempt to deploy a larger durable v7 runner through the current ChatGPT Supabase tool was blocked by the platform safety control before deployment. This is a tool-channel limitation, not a Gemini or Multiplan failure. It must not be bypassed.

The correct next execution path is to run the checked-in branch in a repository-capable environment (Codex/Work/local CI) rather than continue rebuilding temporary Edge runners.

## Cleanup

After the tool block:

- `pipeline-v1-session-evaluate` restored to `410 PIPELINE_SHADOW_DISABLED`, `verify_jwt=true`;
- `pipeline-v1-session-preflight` restored to `410 PIPELINE_SHADOW_DISABLED`, `verify_jwt=true`;
- `plan-multiplan-pipeline-v1-shadow` confirmed `410 PIPELINE_SHADOW_DISABLED`, `verify_jwt=true`.

Production and `main` remain untouched.
