# V6.5-METHODOLOGY-ENGINE-BETA

V6.5 is an isolated methodology layer built on top of the current V6.4 outputs. It does not replace V6.4 and is not routed by the production Railway service.

## Contract

V6.4 remains responsible for the project problem, PDA, content, LTG base/adaptation, product, session structure, times, multigrade groups and traceability. V6.5 selects one primary methodology and organizes the pedagogical progression through its phases/moments.

Supported primary methodologies:

- Aprendizaje Basado en Proyectos Comunitarios
- Aprendizaje Basado en Problemas (ABP)
- Indagación con enfoque STEAM
- Aprendizaje Servicio

Manual selection: `methodology_selection` = `proyectos_comunitarios | abp | steam | aprendizaje_servicio`.
Automatic recommendation: `methodology_selection` = `auto`.

Only the selected methodology module is included in the generative session prompt. Complementary strategies are optional, discrete, justified and may not replace the primary methodology.

## Safety / rollback

- V6.4 functions are not modified.
- Railway production router is not modified.
- No destructive database migrations are introduced.
- V6.5 writes only a new `plan_runs` record when invoked directly.
- Removing or ignoring the isolated V6.5 function returns the system immediately to V6.4 behavior.

## Tests

`node tests/v65-methodology.test.mjs`

The suite contains the 10 required methodology cases and checks manual/automatic selection, complementarity, LTG preference and preservation of multigrade structure.
