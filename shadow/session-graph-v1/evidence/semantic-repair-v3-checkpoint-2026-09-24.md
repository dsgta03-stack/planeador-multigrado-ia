# SessionGraph V1 — semantic repair v3 checkpoint

Base approved ProjectBlueprint hash:

`ec6c5a1436ff1798bef4a44f55ba4cd8ac699529b41ce4217e4f1084f4802620`

Previous compiled graph:

`57783afbcfcc3fe39fa7bbcd61878971d715d996c14e20cf78c89880400e4cd0`

A cross-provider diagnostic semantic review identified four material weaknesses in that graph: `SGS-002`, `SGS-003`, `SGS-005`, and `SGS-008`.

The SessionGraph authoring/reviewer contracts were tightened before constructing the next diagnostic revision:

- `WORKED` now explicitly means that the concrete activity performs the complete cognitive performance and purpose of the official PDA; partial work is `DEVELOPING` and irrelevant activities leave `pda_mobilization` empty.
- `DIRECT` now means the activity output is an observable constituent of the expected session artifact. Necessary preparation consumed later is `COMPLEMENTARY` and cannot claim the artifact.
- functional requirement links must correspond to the activity that actually performs the requirement and produces relevant evidence.
- assessment criteria must be observable, not generic statements such as “comprende claramente”.

Because Gemini 3.5 Flash-Lite continued returning provider `503 UNAVAILABLE`, an explicit diagnostic repair was applied to the existing proposal to verify that the tightened semantics are representable without changing the approved ProjectBlueprint. This repair is **not** being treated as the provider-generated final positive case.

Key diagnostic corrections included:

- session 1 activity 1 changed from false `DIRECT` to `COMPLEMENTARY`, and grade-1 PDA status changed from `WORKED` to `DEVELOPING`;
- session 1 inquiry no longer falsely claims `selection_criteria`;
- session 2 activities 1 and 2 changed from false `DIRECT` to `COMPLEMENTARY`;
- session 2 selection no longer falsely claims `pieces`;
- session 2 production now contains the complete grade-1 explain + propose performance and a grade-3 inquiry/contrast + communicate-importance performance;
- session 3 PDA claims were narrowed so relocation/counting alone does not claim the grade-3 inquiry PDA;
- vague criteria were replaced by observable criteria.

The diagnostic repaired proposal compiled successfully through the current SessionGraph authoring contract and deterministic compiler:

- compile: `PASS`
- proposal hash: `b0fdf9661b5b5275f87bcd8cbbb36a80bcf28544aa7da84db31254e64d6b8731`
- compiled graph hash: `14a30710928f72ad4b7fd8b64426d3b78395ee9971d991daddad3d07488f40b8`
- sessions: `3`
- activities: `3 / 3 / 3`
- minutes: `90 / 90 / 90`
- all 11 methodology operations remain covered
- all 11 `MUSEUM + ITINERANT` functional requirements remain covered, now once at their substantive construction points

A provider-bound independent semantic review was dispatched for this graph with semantic input hash:

`58833b3c96f235423c0edf352c5fd7bcc7553c14bc9f3a8b3c08d18762dbdb23`

Gemini again returned:

`503 UNAVAILABLE — This model is currently experiencing high demand.`

No semantic candidate was created.

Therefore this checkpoint proves that the revised SessionGraph semantics are structurally representable and deterministically compilable, but it does **not** close certification.

Current status:

`SESSIONGRAPH V1 AÚN NO VALIDADO`

Next authoritative step: obtain a provider-generated proposal under the tightened authoring rules, compile it, bind an independent `SGS-001..SGS-012` review to the exact graph hash, then run the adversarial only after positive approval.
