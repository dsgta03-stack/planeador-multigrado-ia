# SessionGraph R2 CI trigger

Purpose: trigger the existing `SessionGraph Shadow CI` workflow on branch `session-graph-authoring-r2-shadow` without changing runtime code.

Baseline before trigger:
- branch: `session-graph-authoring-r2-shadow`
- parent HEAD: `9d34fa6cf3d4eee06aadc160e5bce928cb86e854`
- no production, main, PR #3, or PR #4 changes intended

Required CI command equivalence:
`npm run test:shadow:core`

This file is evidence-only and should not alter application behavior.
