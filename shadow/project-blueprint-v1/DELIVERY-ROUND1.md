# ProjectBlueprint V1 — entrega de etapa 1

Estado: **NO LISTA para promoción ni para iniciar SessionGraph**. Contratos, fixtures y gate están implementados y probados; no se obtuvo todavía un Blueprint generado aprobado. Hay omisiones semánticas por regla y fallos 503 del proveedor.

Fecha: 2026-09-23T11:53:46.749Z. Rama aislada: project-blueprint-v1-shadow. Base: df21810bcec69be34f4df950e4474283ad7bb079. Checkpoint publicado antes de continuar: 8a44a95d42c3a42003e19ecf9985317545d3fd31 (árbol idéntico al checkpoint local 7345a7ee5028514ccd1d99f0a6423055feffb4a6).

## A. Archivos

Todos los archivos de esta tarea están bajo shadow/project-blueprint-v1. Ningún archivo previo de producción se modificó.

```text
catalog.mjs
contracts.mjs
DELIVERY.md
edge/config.ts
edge/index.ts
evidence/automated-tests.tap
evidence/generated-attempt-1-rejected.json
evidence/generated-blueprint-attempt-1790164209246.json
evidence/generated-blueprint.json
evidence/metrics.json
evidence/PB-001.json
evidence/PB-002.json
evidence/PB-003.json
evidence/PB-004.json
evidence/PB-005.json
evidence/PB-006-attempt-1790164136881.json
evidence/PB-006.json
evidence/PB-007.json
evidence/PB-008.json
evidence/PB-009.json
evidence/PB-010.json
evidence/PB-011-STEAM-PASS-attempt-1790164141331.json
evidence/PB-011-STEAM-PASS.json
evidence/PB-012-SERVICIO-PASS-attempt-1790164159958.json
evidence/PB-012-SERVICIO-PASS.json
evidence/PB-013-COMUNITARIO-PASS-attempt-1790164167310.json
evidence/PB-013-COMUNITARIO-PASS.json
evidence/PB-014-UN-GRADO-UNA-SESION.json
evidence/PB-015-SEIS-GRADOS-DOS-SESIONES-attempt-1790164171179.json
evidence/PB-015-SEIS-GRADOS-DOS-SESIONES.json
evidence/PB-016-LTG-CORE.json
evidence/PB-017-LTG-SUPPORT-attempt-1790164179678.json
evidence/PB-017-LTG-SUPPORT.json
evidence/PB-018-LTG-OPTIONAL.json
evidence/PB-019-WEAK.json
evidence/PB-020-MUSEO-REAL.json
evidence/PB-021-CINCO-SESIONES-attempt-1790164186823.json
evidence/PB-021-CINCO-SESIONES.json
evidence/PB-022-MAS-SESIONES-QUE-OPERACIONES-attempt-1790164191983.json
evidence/PB-022-MAS-SESIONES-QUE-OPERACIONES.json
evidence/production-readonly-check.json
evidence/provider-incident.json
evidence/shadow-auth-negative.json
fixtures/build.mjs
fixtures/extend.mjs
fixtures/museum-regression-origin.json
fixtures/official-corpus.json
fixtures/PB-001.json
fixtures/PB-002.json
fixtures/PB-003.json
fixtures/PB-004.json
fixtures/PB-005.json
fixtures/PB-006.json
fixtures/PB-007.json
fixtures/PB-008.json
fixtures/PB-009.json
fixtures/PB-010.json
fixtures/PB-011-STEAM-PASS.json
fixtures/PB-012-SERVICIO-PASS.json
fixtures/PB-013-COMUNITARIO-PASS.json
fixtures/PB-014-UN-GRADO-UNA-SESION.json
fixtures/PB-015-SEIS-GRADOS-DOS-SESIONES.json
fixtures/PB-016-LTG-CORE.json
fixtures/PB-017-LTG-SUPPORT.json
fixtures/PB-018-LTG-OPTIONAL.json
fixtures/PB-019-WEAK.json
fixtures/PB-020-MUSEO-REAL.json
fixtures/PB-021-CINCO-SESIONES.json
fixtures/PB-022-MAS-SESIONES-QUE-OPERACIONES.json
gate.mjs
provider.mjs
README.md
report.mjs
run-live.mjs
schemas/BlueprintGateV1.json
schemas/CurriculumSnapshotV1.json
schemas/MethodologyDecisionV1.json
schemas/ProjectBlueprintV1.json
schemas/TeacherConstraintsV1.json
shadow.mjs
tests/contracts-gate.test.mjs
tests/coverage.test.mjs
```

## B. Contratos completos

Los cinco schemas completos están en el apéndice de este informe y en schemas/. Son contratos de dominio independientes. Los hashes cubren todos los campos pedagógicos; sólo excluyen UUID, fecha y el propio hash. La decisión metodológica también queda ligada por hash. El validador implementa el subconjunto de JSON Schema utilizado, no todos los keywords del estándar.

## C. Catálogo único

```json
{
  "CATALOG": {
    "abp": [
      "PRESENTEMOS",
      "RECOLECTEMOS",
      "FORMULEMOS_PROBLEMA",
      "ORGANICEMOS_EXPERIENCIA",
      "VIVAMOS_EXPERIENCIA",
      "RESULTADOS_ANALISIS"
    ],
    "steam": [
      "INTRODUCCION_PROBLEMATIZACION",
      "DISENO_Y_DESARROLLO_INDAGACION",
      "ORGANIZACION_DE_RESPUESTAS",
      "PRESENTACION_Y_APLICACION",
      "METACOGNICION"
    ],
    "aprendizaje_servicio": [
      "PUNTO_DE_PARTIDA",
      "LO_QUE_SE_Y_QUIERO_SABER",
      "ORGANICEMOS_ACTIVIDADES",
      "CREATIVIDAD_EN_MARCHA",
      "COMPARTIMOS_Y_EVALUAMOS"
    ],
    "proyectos_comunitarios": [
      "IDENTIFICACION",
      "RECUPERACION",
      "PLANIFICACION",
      "ACERCAMIENTO",
      "COMPRENSION_Y_PRODUCCION",
      "RECONOCIMIENTO",
      "CONCRECION",
      "INTEGRACION",
      "DIFUSION",
      "CONSIDERACIONES",
      "AVANCES"
    ]
  },
  "COMMUNITY_GROUPS": {
    "PLANEACION": [
      "IDENTIFICACION",
      "RECUPERACION",
      "PLANIFICACION"
    ],
    "ACCION": [
      "ACERCAMIENTO",
      "COMPRENSION_Y_PRODUCCION",
      "RECONOCIMIENTO",
      "CONCRECION"
    ],
    "INTERVENCION": [
      "INTEGRACION",
      "DIFUSION",
      "CONSIDERACIONES",
      "AVANCES"
    ]
  }
}
```

Las secuencias se diseñan por propósito y dependencias. No existe asignación proporcional de fases en el módulo.

## D. Reglas implementadas

| Regla | Condición |
|---|---|
| BPD-SCHEMA | Contrato completo, tipado y sin campos desconocidos |
| BPD-SCHEMA | Contrato completo, tipado y sin campos desconocidos |
| BPD-SCHEMA | Contrato completo, tipado y sin campos desconocidos |
| BPD-SCHEMA | Contrato completo, tipado y sin campos desconocidos |
| BPD-001 | Una fila por PDA seleccionado; sólo IDs autorizados existentes, sin duplicados |
| BPD-002 | Grado y texto exactos del corpus verificado |
| BPD-003 | Todos los grados y PDA con aportación autorizada; IDs de aportación únicos |
| BPD-004 | Transversal sin PDA atribuido; grados con selección mantienen aporte curricular |
| BPD-005 | Exactamente un resultado final y todas las aportaciones dirigidas a él |
| BPD-006 | Cada etapa tiene cadena explícita y orden único |
| BPD-007 | Todo parcial tiene consumidor posterior real o integración al resultado |
| BPD-008 | Dependencias existentes, posteriores y sin ciclos |
| BPD-009 | true |
| BPD-010 | null |
| BPD-011 | Sólo última terminal; cada sesión intermedia enlaza la siguiente |
| BPD-012 | 3 |
| BPD-013 | Numeración continua desde 1 |
| BPD-014 | IDs únicos distintos de inputs externos y resultado |
| BPD-015 | Inputs anteriores; etapas dependientes en la misma sesión o posteriores al productor; cada artefacto producido una vez |
| BPD-016 | Una decisión del catálogo versionado, sin alteraciones |
| BPD-017 | abp |
| BPD-018 | Recursos autorizados o alternativa autorizada justificada; equivalencia se revisa semánticamente |
| BPD-019 | Operaciones completas y vinculadas al artefacto de etapa, sin reparto por índice |
| BPD-020 | Fuentes íntegramente vinculadas; problemática original exacta |
| BPD-TIME | Estimaciones positivas justificadas dentro de cada sesión; BPS-010 juzga realismo |
| BPD-LTG | Trazabilidad verificada y respeto a selección explícita |
| BPS-001 | Problema, propósito y resultado están vinculados. |
| BPS-002 | La pregunta sostiene el proyecto y es accesible a todos los grados. |
| BPS-003 | El resultado cumple su semántica funcional, incluso atributos implícitos; no basta declarar requisitos. |
| BPS-004 | El PDA completo se desarrolla mediante su aportación, sin reducirlo a coincidencia temática. |
| BPS-005 | La evidencia corresponde al desempeño cognitivo del PDA completo. |
| BPS-006 | Existe un proyecto común construido con aportaciones interdependientes, no proyectos paralelos. |
| BPS-007 | La progresión produce el resultado y cada avance tiene operación, artefacto y evidencia. |
| BPS-008 | Las operaciones realizan auténticamente la metodología; reflexión no sustituye servicio, intervención o indagación. |
| BPS-009 | Complejidad, autonomía y apoyos adecuados a los grados y perfiles. |
| BPS-010 | Factibilidad temporal por complejidad y etapas, no sólo multiplicación de minutos. |
| BPS-011 | Los grados transversales no heredan contenidos ni exigencias de PDA ajenos. |
| BPS-012 | LTG pertinente, autorizado y al servicio del mismo proyecto; sin LTG puede ser PASS justificado. |

BPD-SCHEMA falla cerrado antes de acceder a campos inválidos. En ese caso puede sustituir el diagnóstico específico de BPD-006/016. BPS-003 añade una condición necesaria local: los requisitos explícitos del perfil no pueden faltar, aunque el revisor los omita. Su presencia nunca basta para aprobar. Los validadores no escriben ni corrigen el Blueprint.

## E. Fixtures y resultado observado

PASS/FAIL de la última columna significa coincidencia de todas las expectativas, no aprobación del proyecto. La tabla aplica el gate final a la revisión guardada ligada al mismo hash; no inventa una revisión nueva.

| Fixture | Método | Esperado | Actual | Reglas activadas | Prueba |
|---|---|---|---|---|---|
| PB-001 | proyectos_comunitarios | {"semantic":["BPS-003"]} | FAIL | BPS-003 | PASS |
| PB-002 | proyectos_comunitarios | {"functional_pass":true} | PASS | — | PASS |
| PB-003 | abp | {"deterministic":["BPD-008","BPD-009","BPD-010"]} | FAIL | BPD-008, BPD-009, BPD-010 | PASS |
| PB-004 | aprendizaje_servicio | {"semantic":["BPS-008"]} | FAIL | BPS-003, BPS-008 | PASS |
| PB-005 | steam | {"deterministic":["BPD-019"],"semantic":["BPS-008"]} | FAIL | BPD-019, BPS-003, BPS-007, BPS-008 | PASS |
| PB-006 | abp | {"deterministic":["BPD-007"]} | FAIL | BPD-007 | PASS |
| PB-007 | abp | {"semantic":["BPS-004","BPS-005"]} | FAIL | BPS-005 | FAIL |
| PB-008 | proyectos_comunitarios | {"semantic":["BPS-006","BPS-007"]} | FAIL | BPS-003, BPS-006, BPS-007 | PASS |
| PB-009 | proyectos_comunitarios | {"semantic":["BPS-008"]} | FAIL | BPS-003, BPS-007, BPS-008 | PASS |
| PB-010 | abp | {"pass":true} | PASS | — | PASS |
| PB-011-STEAM-PASS | steam | {"pass":true} | PASS | — | PASS |
| PB-012-SERVICIO-PASS | aprendizaje_servicio | {"pass":true} | PASS | — | PASS |
| PB-013-COMUNITARIO-PASS | proyectos_comunitarios | {"pass":true} | PASS | — | PASS |
| PB-014-UN-GRADO-UNA-SESION | abp | {"pass":true} | PASS | — | PASS |
| PB-015-SEIS-GRADOS-DOS-SESIONES | proyectos_comunitarios | {"pass":true} | PASS | — | PASS |
| PB-016-LTG-CORE | abp | {"deterministic_pass":true} | PASS | — | PASS |
| PB-017-LTG-SUPPORT | abp | {"deterministic_pass":true} | PASS | — | PASS |
| PB-018-LTG-OPTIONAL | abp | {"deterministic_pass":true} | PASS | — | PASS |
| PB-019-WEAK | abp | {"teacher_decision":true} | NEEDS_TEACHER_DECISION | — | PASS |
| PB-020-MUSEO-REAL | proyectos_comunitarios | {"semantic":["BPS-003","BPS-007","BPS-008"],"deterministic":["BPD-008","BPD-009","BPD-010"]} | FAIL | BPD-008, BPD-009, BPD-010, BPS-003 | FAIL |
| PB-021-CINCO-SESIONES | abp | {"pass":true} | PASS | — | PASS |
| PB-022-MAS-SESIONES-QUE-OPERACIONES | abp | {"pass":true} | PASS | — | PASS |

20/22 expectativas completas. Cobertura: cuatro métodos con casos positivos y negativos; 1/2/6 grados; todos/algunos con PDA; transversales; pocos recursos, sin internet, baja autonomía; 1/2/3/5/12 sesiones; LTG CORE/SUPPORT/OPTIONAL/NONE. LTG es sintético y marcado explícitamente como no oficial.

## F. Regresión del museo

El caso se rechaza. No es una reproducción exacta del input histórico: preserva el patrón observado en una adaptación anónima de tres sesiones. El original tenía cinco. Véase fixtures/museum-regression-origin.json para los hechos conservados y los límites.

| Aspecto | Legacy observado | Shadow |
|---|---|---|
| Resultado | Museo itinerante de identidad nacional | Mismo resultado declarado en fixture anónima |
| Cierre | Asamblea y cuaderno | No producen exposición ni circulación |
| Siguiente | Anuncia evaluación posterior al cierre | Dependencia inexistente rechazada |
| Gate | PROJECT_COHERENCE PASS | BlueprintGate FAIL |

Entrada completa: [PB-020-MUSEO-REAL.json](fixtures/PB-020-MUSEO-REAL.json). Revisión original completa: [evidencia](evidence/PB-020-MUSEO-REAL.json). Resultado completo del gate final:

```json
{
  "gate_version": "BLUEPRINT_GATE_V1",
  "status": "FAIL",
  "critical_count": 4,
  "warning_count": 0,
  "deterministic_findings": [
    {
      "rule_id": "BPD-SCHEMA",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "TeacherConstraintsV1",
      "observed": "Contrato válido",
      "expected": "Contrato completo, tipado y sin campos desconocidos"
    },
    {
      "rule_id": "BPD-SCHEMA",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "CurriculumSnapshotV1",
      "observed": "Contrato válido",
      "expected": "Contrato completo, tipado y sin campos desconocidos"
    },
    {
      "rule_id": "BPD-SCHEMA",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "MethodologyDecisionV1",
      "observed": "Contrato válido",
      "expected": "Contrato completo, tipado y sin campos desconocidos"
    },
    {
      "rule_id": "BPD-SCHEMA",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "ProjectBlueprintV1",
      "observed": "Contrato válido",
      "expected": "Contrato completo, tipado y sin campos desconocidos"
    },
    {
      "rule_id": "BPD-001",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "pda_analysis",
      "observed": "F3-DHC-1-010,F4-DHC-3-001,F3-DHC-1-010,F4-DHC-3-001,F3-DHC-1-010,F4-DHC-3-001,F3-DHC-1-010,F4-DHC-3-001,F3-DHC-1-010,F4-DHC-3-001",
      "expected": "Una fila por PDA seleccionado; sólo IDs autorizados existentes, sin duplicados"
    },
    {
      "rule_id": "BPD-002",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "pda_analysis/grade_contributions",
      "observed": "Correspondencia de grados y texto oficial",
      "expected": "Grado y texto exactos del corpus verificado"
    },
    {
      "rule_id": "BPD-003",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "grade_contributions",
      "observed": "1,3",
      "expected": "Todos los grados y PDA con aportación autorizada; IDs de aportación únicos"
    },
    {
      "rule_id": "BPD-004",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "grade_contributions",
      "observed": "Modos curriculares revisados",
      "expected": "Transversal sin PDA atribuido; grados con selección mantienen aporte curricular"
    },
    {
      "rule_id": "BPD-005",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "final_outcome",
      "observed": "Un objeto final y destinos",
      "expected": "Exactamente un resultado final y todas las aportaciones dirigidas a él"
    },
    {
      "rule_id": "BPD-006",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "project_stages",
      "observed": "Entradas/operación/salida",
      "expected": "Cada etapa tiene cadena explícita y orden único"
    },
    {
      "rule_id": "BPD-007",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "project_stages.consumed_by",
      "observed": "Destinos y enlaces recíprocos",
      "expected": "Todo parcial tiene consumidor posterior real o integración al resultado"
    },
    {
      "rule_id": "BPD-008",
      "severity": "CRITICAL",
      "status": "FAIL",
      "scope": "dependencies",
      "observed": "Etapas/sesiones referidas",
      "expected": "Dependencias existentes, posteriores y sin ciclos"
    },
    {
      "rule_id": "BPD-009",
      "severity": "CRITICAL",
      "status": "FAIL",
      "scope": "session_progression.last.terminal",
      "observed": "false",
      "expected": "true"
    },
    {
      "rule_id": "BPD-010",
      "severity": "CRITICAL",
      "status": "FAIL",
      "scope": "session_progression.last.next_session_dependency",
      "observed": "4",
      "expected": "null"
    },
    {
      "rule_id": "BPD-011",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "session_progression",
      "observed": "Terminalidad y encadenamiento",
      "expected": "Sólo última terminal; cada sesión intermedia enlaza la siguiente"
    },
    {
      "rule_id": "BPD-012",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "session_progression.length",
      "observed": "3",
      "expected": "3"
    },
    {
      "rule_id": "BPD-013",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "numbering",
      "observed": "Orden de sesiones y etapas",
      "expected": "Numeración continua desde 1"
    },
    {
      "rule_id": "BPD-014",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "output_artifact_id",
      "observed": "Unicidad de artefactos",
      "expected": "IDs únicos distintos de inputs externos y resultado"
    },
    {
      "rule_id": "BPD-015",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "artifact_inputs",
      "observed": "Procedencia y producción única",
      "expected": "Inputs anteriores; etapas dependientes en la misma sesión o posteriores al productor; cada artefacto producido una vez"
    },
    {
      "rule_id": "BPD-016",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "methodology",
      "observed": "Catálogo y operaciones",
      "expected": "Una decisión del catálogo versionado, sin alteraciones"
    },
    {
      "rule_id": "BPD-017",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "methodology.selected_id",
      "observed": "proyectos_comunitarios",
      "expected": "proyectos_comunitarios"
    },
    {
      "rule_id": "BPD-018",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "final_outcome.required_resources",
      "observed": "Recursos/alternativas",
      "expected": "Recursos autorizados o alternativa autorizada justificada; equivalencia se revisa semánticamente"
    },
    {
      "rule_id": "BPD-019",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "methodology_operations",
      "observed": "Cobertura en etapas/progresión",
      "expected": "Operaciones completas y vinculadas al artefacto de etapa, sin reparto por índice"
    },
    {
      "rule_id": "BPD-020",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "source",
      "observed": "Hashes y problemática",
      "expected": "Fuentes íntegramente vinculadas; problemática original exacta"
    },
    {
      "rule_id": "BPD-TIME",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "feasibility",
      "observed": "Estimaciones por etapa/sesión",
      "expected": "Estimaciones positivas justificadas dentro de cada sesión; BPS-010 juzga realismo"
    },
    {
      "rule_id": "BPD-LTG",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "ltg_strategy",
      "observed": "LTG y decisiones explícitas",
      "expected": "Trazabilidad verificada y respeto a selección explícita"
    }
  ],
  "semantic_findings": [
    {
      "rule_id": "BPS-001",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "Problem, purpose, and outcome",
      "observed": "The problem of unknown school agreements is linked to the purpose of explaining them, resulting in a museum-style outcome.",
      "expected": "Clear linkage between problem, purpose, and result."
    },
    {
      "rule_id": "BPS-002",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "Guiding question",
      "observed": "The question '¿Cómo podemos explicar y poner en práctica nuestros acuerdos para convivir mejor?' is accessible to both 1st and 3rd grades.",
      "expected": "Accessible question for all involved grades."
    },
    {
      "rule_id": "BPS-003",
      "severity": "CRITICAL",
      "status": "FAIL",
      "scope": "final_outcome.functional_requirements",
      "observed": "Necessary profile requirements missing: [{\"profile\":\"ITINERANT\",\"missing\":[\"movement\",\"at_least_two_viable_spaces_or_audiences\",\"relocation_or_reinstallation\",\"circulation_evidence\"]}]",
      "expected": "El resultado cumple su semántica funcional, incluso atributos implícitos; no basta declarar requisitos."
    },
    {
      "rule_id": "BPS-004",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "PDA development",
      "observed": "1st grade explains situations (F3-DHC-1-010) and 3rd grade investigates practices (F4-DHC-3-001) as core operations.",
      "expected": "Full PDA development."
    },
    {
      "rule_id": "BPS-005",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "Evidence of cognitive performance",
      "observed": "Evidence includes drawings with dictated explanations (1st) and registered consultations (3rd).",
      "expected": "Evidence corresponding to the cognitive action of the PDA."
    },
    {
      "rule_id": "BPS-006",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "Integrated project",
      "observed": "Both grades contribute to a single set of shared explanations for the same museum pieces.",
      "expected": "Interdependent contributions to a common project."
    },
    {
      "rule_id": "BPS-007",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "Progression and operations",
      "observed": "Each stage (frame, investigate, apply) has defined operations, artifacts, and evidence.",
      "expected": "Progression with operation, artifact, and evidence at each step."
    },
    {
      "rule_id": "BPS-008",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "Methodology authenticity",
      "observed": "Operations (identification, investigation, application) are consistent with the Proyectos Comunitarios methodology.",
      "expected": "Authentic methodology operations."
    },
    {
      "rule_id": "BPS-009",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "Complexity and autonomy",
      "observed": "Supports like teacher modeling and peer support are explicitly included for the low-autonomy profile.",
      "expected": "Complexity and supports aligned with student profiles."
    },
    {
      "rule_id": "BPS-010",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "Temporal feasibility",
      "observed": "The 3-session structure is feasible for the defined complexity and scope.",
      "expected": "Feasibility based on complexity and stages."
    },
    {
      "rule_id": "BPS-011",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "Transversal grades",
      "observed": "Each grade works on its own PDA (F3-DHC-1-010 and F4-DHC-3-001) without inheriting requirements from the other.",
      "expected": "No inheritance of PDA requirements between grades."
    },
    {
      "rule_id": "BPS-012",
      "severity": "CRITICAL",
      "status": "PASS",
      "scope": "LTG",
      "observed": "LTG is absent; justified by the context of using internal school experiences.",
      "expected": "Pertinent LTG or justified absence."
    }
  ],
  "evaluated_blueprint_hash": "e972d2209171dde1bfcd689af6a97d3bf1643697bcbc09d3bb0dceefc10cc876",
  "source_hash": "cf77e2ac227505be0f2b23ccb5ce5e17db88d84c2ed9ffcc614c951577c11018"
}
```

## G. Blueprint válido generado

**Pendiente: no se obtuvo un ejemplo generado aprobado.** Los ejemplos authored positivos no se presentan como generación de Gemini. La última ejecución y las anteriores se conservan; no se relajó el gate para convertirlas en PASS.

```json
[
  {
    "file": "generated-attempt-1-rejected.json",
    "status": "REJECTED",
    "methodology": "proyectos_comunitarios",
    "repair_count": 1,
    "errors": [],
    "revisions": [
      {
        "revision": 1,
        "status": "NEEDS_REPAIR",
        "df": [
          "BPD-SCHEMA"
        ],
        "sf": []
      },
      {
        "revision": 2,
        "status": "REJECTED",
        "df": [
          "BPD-005",
          "BPD-014",
          "BPD-018",
          "BPD-019"
        ],
        "sf": []
      }
    ]
  },
  {
    "file": "generated-blueprint-attempt-1790164209246.json",
    "status": "NEEDS_REPAIR",
    "methodology": "proyectos_comunitarios",
    "repair_count": 1,
    "errors": [
      {
        "revision": 2,
        "task": "REPAIR",
        "error": "Error: PROVIDER_ERROR:503"
      }
    ],
    "revisions": [
      {
        "revision": 1,
        "status": "NEEDS_REPAIR",
        "df": [
          "BPD-019"
        ],
        "sf": [
          "BPS-003"
        ]
      }
    ]
  },
  {
    "file": "generated-blueprint.json",
    "status": "NEEDS_REPAIR",
    "methodology": "abp",
    "repair_count": 1,
    "errors": [
      {
        "revision": 2,
        "task": "REPAIR",
        "error": "Error: PROVIDER_ERROR:503"
      }
    ],
    "revisions": [
      {
        "revision": 1,
        "status": "NEEDS_REPAIR",
        "df": [
          "BPD-008"
        ],
        "sf": [
          "BPS-003"
        ]
      }
    ]
  }
]
```

## H. Ejemplo rechazado

[evidence/generated-attempt-1-rejected.json](evidence/generated-attempt-1-rejected.json) contiene fuentes, revisiones 1/2, diff estructurado, reglas disparadoras y telemetría. Rechazado por destinos inconsistentes, colisión del artefacto terminal con el resultado, recursos no autorizados y cobertura metodológica incompleta. Los intentos posteriores con 503 permanecen NEEDS_REPAIR y no se confunden con rechazo pedagógico.

## I. Tests automatizados

```text
# tests 54
# pass 54
# fail 0
# cancelled 0
# skipped 0
# duration_ms 736.588436
```

Las 47 pruebas originales se reconfirmaron antes y después del checkpoint. Se añadieron pruebas de sesiones largas, dependencias temporales, falso PASS funcional, aislamiento del entorno y preservación de revisiones ante fallo del proveedor. Los dobles semánticos de tests están etiquetados y sólo prueban el cableado; la evidencia Gemini está separada.

## J. Errores, falsos positivos y límites

- Corregido: el generador recibía hashes fuente incompletamente explicitados; ahora recibe expected_source, incluidas decisiones metodológicas.
- Corregido: una etapa podía depender de un artefacto producido en una sesión posterior si se omitía de los inputs de sesión; BPD-015 comprueba ambas ordenaciones.
- Corregido: una revisión falsa positiva podía pasar por alto requisitos explícitos de itinerancia ausentes; la condición necesaria local lo impide.
- Corregido: errores de transporte en reparación podían perder revisión 1; ahora se conserva junto al error y la telemetría disponible.
- Corregido en el prompt: Gemini extrapolaba itinerancia a servicio/investigación/propuestas. Se restringió la aplicación al significado del producto y se volvieron a evaluar sólo los casos afectados, preservando todos los resultados anteriores.
- Pendiente: PB-007 se rechaza por BPS-005 pero el revisor omitió BPS-004. PB-020 se rechaza pero omitió BPS-007/008. Son falsos negativos por regla, aunque no resultaron en aprobación global incorrecta.
- La muestra no estima tasas poblacionales ni estabilidad. Una ejecución positiva por fixture no demuestra fiabilidad sostenida.
- La generación todavía incumple referencias, requisitos funcionales o cobertura. Los 503 impidieron completar algunas reparaciones. No se hizo una segunda reparación automática sobre el mismo intento.
- El primer error de generación interrumpió el proceso antes de persistir su salida; sólo se conserva la observación técnica en provider-incident.json. La corrección evita repetir esa pérdida.
- No se verificó una reproducción exacta del input histórico del museo. El contrato de aprobación usa envelope inmutable; blueprint.status sigue DRAFT para conservar los bytes evaluados. Debe revisarse ese diseño antes de conectar consumidores.

## K. Métricas

```json
{
  "recorded_calls": 35,
  "recorded_tokens": 207170,
  "recorded_latency_ms": 319869,
  "cost": null,
  "note": "Recorded calls only; early interrupted/failed calls had incomplete telemetry. Cost was not returned by provider. No guessed price."
}
```

[evidence/metrics.json](evidence/metrics.json) incluye estado por fixture, fallos, warnings, reparaciones, latencias y metadatos por llamada. Los tiempos acumulados son suma de llamadas, no tiempo de pared; el coste monetario no fue informado y no se inventa.

## L. Aislamiento y producción

Producción no fue desplegada ni modificada por esta tarea. Verificación GET de salud:

```json
{
  "checked_at": "2026-09-23T11:49:43.847164+00:00",
  "url": "https://planeador-multigrado-ia-v084c-gemini-production.up.railway.app/v0122_health",
  "http_status": 200,
  "body": {
    "ok": true,
    "version": "0.12.2",
    "methodologyUi": "OBSERVER_REENTRANCY_GUARD",
    "dataChanges": "NONE",
    "base": "0.12.1"
  }
}
```

main conserva df21810bcec69be34f4df950e4474283ad7bb079. PR #3 y #4 siguen abiertos, en borrador y sin fusionarse; no se modificaron desde esta tarea. La lectura actual de PR #4 mostró ba4782655ba495d37af9fe236a2d26c0f03a44a9, distinto del SHA de la auditoría previa: no se afirma que terceros no hayan avanzado esa rama.

No se creó ni modificó historial, tablas ni autenticación productiva. Se desplegó únicamente la función nueva plan-project-blueprint-v1-shadow en el mismo proyecto Supabase, con identidad de máquina separada y caducidad. El proveedor Gemini se consume desde esa función; no es un proyecto cloud completamente separado. El código no usa clientes de base de datos. La llamada sin token devolvió 401. El repositorio guarda config deshabilitada; el token temporal está fuera del repositorio. Las entradas de prueba son sintéticas y PDA oficiales públicos. No hay preview de interfaz, porque esta etapa sólo implementa contratos/generador/gate.

La auto-revisión bloqueó inicialmente la ejecución por alcance auditoría/datos potencialmente sensibles. Se verificaron la autorización de implementación shadow, el contenido ficticio y el destino exacto; el intento limitado posterior y las pruebas descritas pudieron ejecutarse sin eludir controles.

## M. Siguiente etapa propuesta, no implementada

Primero resolver la generación rechazada/503 y las omisiones BPS, obtener un Blueprint generado aprobado con evidencia y revisión pedagógica. Sólo tras autorización: SessionGraph V1 Shadow consumirá un envelope APPROVED verificado por hash, producirá actividades desde sus etapas sin modificarlo y tendrá su propio gate. No se implementó SessionGraph, no se conectó UI, no se eliminó ninguna Edge anterior, no se promocionó nada.

## Apéndice: schemas completos

### BlueprintGateV1.json

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:multiplan:shadow:BlueprintGateV1",
  "type": "object",
  "properties": {
    "gate_version": {
      "const": "BLUEPRINT_GATE_V1"
    },
    "status": {
      "type": "string",
      "enum": [
        "PASS",
        "FAIL",
        "NOT_EVALUABLE",
        "NEEDS_TEACHER_DECISION"
      ]
    },
    "critical_count": {
      "type": "integer",
      "minimum": 0
    },
    "warning_count": {
      "type": "integer",
      "minimum": 0
    },
    "deterministic_findings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "rule_id": {
            "type": "string",
            "minLength": 1
          },
          "severity": {
            "type": "string",
            "enum": [
              "CRITICAL",
              "WARNING"
            ]
          },
          "status": {
            "type": "string",
            "enum": [
              "PASS",
              "FAIL",
              "NOT_EVALUABLE"
            ]
          },
          "scope": {
            "type": "string",
            "minLength": 1
          },
          "observed": {
            "type": "string",
            "minLength": 1
          },
          "expected": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": [
          "rule_id",
          "severity",
          "status",
          "scope",
          "observed",
          "expected"
        ],
        "additionalProperties": false
      },
      "minItems": 0
    },
    "semantic_findings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "rule_id": {
            "type": "string",
            "minLength": 1
          },
          "severity": {
            "type": "string",
            "enum": [
              "CRITICAL",
              "WARNING"
            ]
          },
          "status": {
            "type": "string",
            "enum": [
              "PASS",
              "FAIL",
              "NOT_EVALUABLE"
            ]
          },
          "scope": {
            "type": "string",
            "minLength": 1
          },
          "observed": {
            "type": "string",
            "minLength": 1
          },
          "expected": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": [
          "rule_id",
          "severity",
          "status",
          "scope",
          "observed",
          "expected"
        ],
        "additionalProperties": false
      },
      "minItems": 0
    },
    "evaluated_blueprint_hash": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    },
    "source_hash": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    }
  },
  "required": [
    "gate_version",
    "status",
    "critical_count",
    "warning_count",
    "deterministic_findings",
    "semantic_findings",
    "evaluated_blueprint_hash",
    "source_hash"
  ],
  "additionalProperties": false
}
```

### CurriculumSnapshotV1.json

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:multiplan:shadow:CurriculumSnapshotV1",
  "type": "object",
  "properties": {
    "schema_version": {
      "const": "CURRICULUM_SNAPSHOT_V1"
    },
    "snapshot_id": {
      "type": "string",
      "minLength": 1
    },
    "snapshot_hash": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    },
    "created_at": {
      "type": "string",
      "minLength": 1
    },
    "corpus_version_or_provenance": {
      "type": "string",
      "minLength": 1
    },
    "pdas": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "pda_id": {
            "type": "string",
            "minLength": 1
          },
          "grade": {
            "type": "integer",
            "minimum": 1,
            "maximum": 6
          },
          "field": {
            "type": "string",
            "minLength": 1
          },
          "content_official": {
            "type": "string",
            "minLength": 1
          },
          "pda_official": {
            "type": "string",
            "minLength": 1
          },
          "verification_status": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": [
          "pda_id",
          "grade",
          "field",
          "content_official",
          "pda_official",
          "verification_status"
        ],
        "additionalProperties": false
      },
      "minItems": 0
    },
    "ltg": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "project_id": {
            "type": "string",
            "minLength": 1
          },
          "grade": {
            "type": "integer",
            "minimum": 1,
            "maximum": 6
          },
          "book": {
            "type": "string",
            "minLength": 1
          },
          "scenario": {
            "type": "string",
            "minLength": 1
          },
          "name": {
            "type": "string",
            "minLength": 1
          },
          "pages": {
            "type": "object",
            "properties": {
              "start": {
                "type": "integer",
                "minimum": 1
              },
              "end": {
                "type": "integer",
                "minimum": 1
              }
            },
            "required": [
              "start",
              "end"
            ],
            "additionalProperties": false
          },
          "verified_pda_links": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            },
            "minItems": 0,
            "uniqueItems": true
          },
          "verified_activities": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "activity_id": {
                  "type": "string",
                  "minLength": 1
                },
                "activity_order": {
                  "type": "integer",
                  "minimum": 1
                },
                "summary": {
                  "type": "string",
                  "minLength": 1
                },
                "page_start": {
                  "type": "integer",
                  "minimum": 1
                },
                "page_end": {
                  "type": "integer",
                  "minimum": 1
                },
                "verification_status": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "required": [
                "activity_id",
                "activity_order",
                "summary",
                "page_start",
                "page_end",
                "verification_status"
              ],
              "additionalProperties": false
            },
            "minItems": 0
          }
        },
        "required": [
          "project_id",
          "grade",
          "book",
          "scenario",
          "name",
          "pages",
          "verified_pda_links",
          "verified_activities"
        ],
        "additionalProperties": false
      },
      "minItems": 0
    }
  },
  "required": [
    "schema_version",
    "snapshot_id",
    "snapshot_hash",
    "created_at",
    "corpus_version_or_provenance",
    "pdas",
    "ltg"
  ],
  "additionalProperties": false
}
```

### MethodologyDecisionV1.json

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:multiplan:shadow:MethodologyDecisionV1",
  "type": "object",
  "properties": {
    "schema_version": {
      "const": "METHODOLOGY_DECISION_V1"
    },
    "methodology_decision_id": {
      "type": "string",
      "minLength": 1
    },
    "recommended_id": {
      "anyOf": [
        {
          "type": "string",
          "enum": [
            "abp",
            "steam",
            "aprendizaje_servicio",
            "proyectos_comunitarios"
          ]
        },
        {
          "type": "null"
        }
      ]
    },
    "selected_id": {
      "type": "string",
      "enum": [
        "abp",
        "steam",
        "aprendizaje_servicio",
        "proyectos_comunitarios"
      ]
    },
    "selection_source": {
      "type": "string",
      "enum": [
        "TEACHER",
        "TEACHER_ACCEPTED_RECOMMENDATION"
      ]
    },
    "catalog_version": {
      "const": "METHODOLOGY_CATALOG_V1"
    },
    "required_operations": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "minItems": 1,
      "uniqueItems": true
    }
  },
  "required": [
    "schema_version",
    "methodology_decision_id",
    "recommended_id",
    "selected_id",
    "selection_source",
    "catalog_version",
    "required_operations"
  ],
  "additionalProperties": false
}
```

### ProjectBlueprintV1.json

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:multiplan:shadow:ProjectBlueprintV1",
  "type": "object",
  "properties": {
    "schema_version": {
      "const": "PROJECT_BLUEPRINT_V1"
    },
    "blueprint_id": {
      "type": "string",
      "minLength": 1
    },
    "revision": {
      "type": "integer",
      "minimum": 1
    },
    "status": {
      "type": "string",
      "enum": [
        "DRAFT",
        "NEEDS_REPAIR",
        "NEEDS_TEACHER_DECISION",
        "APPROVED",
        "REJECTED"
      ]
    },
    "source": {
      "type": "object",
      "properties": {
        "constraints_hash": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        },
        "curriculum_snapshot_hash": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        },
        "methodology_decision_id": {
          "type": "string",
          "minLength": 1
        },
        "methodology_decision_hash": {
          "type": "string",
          "pattern": "^[a-f0-9]{64}$"
        }
      },
      "required": [
        "constraints_hash",
        "curriculum_snapshot_hash",
        "methodology_decision_id",
        "methodology_decision_hash"
      ],
      "additionalProperties": false
    },
    "problem_frame": {
      "type": "object",
      "properties": {
        "original_problem": {
          "type": "string",
          "minLength": 1
        },
        "pedagogical_focus": {
          "type": "string",
          "minLength": 1
        },
        "context_relevance": {
          "type": "string",
          "minLength": 1
        },
        "why_project_is_needed": {
          "type": "string",
          "minLength": 1
        },
        "scope": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
        },
        "out_of_scope": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 0
        }
      },
      "required": [
        "original_problem",
        "pedagogical_focus",
        "context_relevance",
        "why_project_is_needed",
        "scope",
        "out_of_scope"
      ],
      "additionalProperties": false
    },
    "methodology": {
      "type": "object",
      "properties": {
        "selected_id": {
          "type": "string",
          "enum": [
            "abp",
            "steam",
            "aprendizaje_servicio",
            "proyectos_comunitarios"
          ]
        },
        "catalog_version": {
          "const": "METHODOLOGY_CATALOG_V1"
        },
        "required_operations": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1,
          "uniqueItems": true
        }
      },
      "required": [
        "selected_id",
        "catalog_version",
        "required_operations"
      ],
      "additionalProperties": false
    },
    "guiding_question": {
      "type": "object",
      "properties": {
        "question": {
          "type": "string",
          "minLength": 1
        },
        "problem_link": {
          "type": "string",
          "minLength": 1
        },
        "product_link": {
          "type": "string",
          "minLength": 1
        },
        "grade_accessibility": {
          "type": "string",
          "enum": [
            "ALL_GRADES"
          ]
        }
      },
      "required": [
        "question",
        "problem_link",
        "product_link",
        "grade_accessibility"
      ],
      "additionalProperties": false
    },
    "final_outcome": {
      "type": "object",
      "properties": {
        "outcome_id": {
          "type": "string",
          "minLength": 1
        },
        "name": {
          "type": "string",
          "minLength": 1
        },
        "type": {
          "type": "string",
          "enum": [
            "MATERIAL_PRODUCT",
            "EXHIBITION",
            "MUSEUM",
            "CAMPAIGN",
            "INVESTIGATION",
            "PROPOSAL",
            "PROTOTYPE",
            "SERVICE",
            "INTERVENTION",
            "COMMUNICATION",
            "COLLECTIVE_DOCUMENT",
            "TRANSFORMATION",
            "OTHER"
          ]
        },
        "description": {
          "type": "string",
          "minLength": 1
        },
        "purpose": {
          "type": "string",
          "minLength": 1
        },
        "audience_or_beneficiary": {
          "type": "string",
          "minLength": 1
        },
        "use_or_destination": {
          "type": "string",
          "minLength": 1
        },
        "functional_profiles": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 0,
          "uniqueItems": true
        },
        "functional_requirements": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "requirement_id": {
                "type": "string",
                "minLength": 1
              },
              "criterion": {
                "type": "string",
                "minLength": 1
              },
              "stage_ids": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                },
                "minItems": 1,
                "uniqueItems": true
              },
              "evidence": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "requirement_id",
              "criterion",
              "stage_ids",
              "evidence"
            ],
            "additionalProperties": false
          },
          "minItems": 1
        },
        "completion_evidence": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
        },
        "authenticity_conditions": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 1
        },
        "required_resources": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "resource": {
                "type": "string",
                "minLength": 1
              },
              "essential": {
                "type": "boolean"
              },
              "alternative": {
                "anyOf": [
                  {
                    "type": "string",
                    "minLength": 1
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "alternative_rationale": {
                "anyOf": [
                  {
                    "type": "string",
                    "minLength": 1
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            },
            "required": [
              "resource",
              "essential",
              "alternative",
              "alternative_rationale"
            ],
            "additionalProperties": false
          },
          "minItems": 0
        }
      },
      "required": [
        "outcome_id",
        "name",
        "type",
        "description",
        "purpose",
        "audience_or_beneficiary",
        "use_or_destination",
        "functional_profiles",
        "functional_requirements",
        "completion_evidence",
        "authenticity_conditions",
        "required_resources"
      ],
      "additionalProperties": false
    },
    "pda_analysis": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "pda_id": {
            "type": "string",
            "minLength": 1
          },
          "grade": {
            "type": "integer",
            "minimum": 1,
            "maximum": 6
          },
          "official_text": {
            "type": "string",
            "minLength": 1
          },
          "central_cognitive_action": {
            "type": "string",
            "minLength": 1
          },
          "cognitive_interpretation": {
            "type": "object",
            "properties": {
              "official_text_basis": {
                "type": "string",
                "minLength": 1
              },
              "reasoning": {
                "type": "string",
                "minLength": 1
              },
              "performance_indicators": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                },
                "minItems": 1
              }
            },
            "required": [
              "official_text_basis",
              "reasoning",
              "performance_indicators"
            ],
            "additionalProperties": false
          },
          "expected_performance": {
            "type": "string",
            "minLength": 1
          },
          "observable_evidence_conditions": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            },
            "minItems": 1
          },
          "possible_project_contribution": {
            "type": "string",
            "minLength": 1
          },
          "integration_strength": {
            "type": "string",
            "enum": [
              "DIRECT",
              "VIABLE_WITH_SPECIFIC_CONTRIBUTION",
              "SECONDARY",
              "WEAK",
              "INCOMPATIBLE"
            ]
          },
          "integration_reason": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": [
          "pda_id",
          "grade",
          "official_text",
          "central_cognitive_action",
          "cognitive_interpretation",
          "expected_performance",
          "observable_evidence_conditions",
          "possible_project_contribution",
          "integration_strength",
          "integration_reason"
        ],
        "additionalProperties": false
      },
      "minItems": 0
    },
    "grade_contributions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "contribution_id": {
            "type": "string",
            "minLength": 1
          },
          "grade": {
            "type": "integer",
            "minimum": 1,
            "maximum": 6
          },
          "curriculum_mode": {
            "type": "string",
            "enum": [
              "PDA_SELECTED",
              "TRANSVERSAL_PROJECT"
            ]
          },
          "pda_ids": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            },
            "minItems": 0,
            "uniqueItems": true
          },
          "learning_role": {
            "type": "string",
            "minLength": 1
          },
          "project_contribution": {
            "type": "string",
            "minLength": 1
          },
          "expected_evidence": {
            "type": "string",
            "minLength": 1
          },
          "complexity_level": {
            "type": "string",
            "minLength": 1
          },
          "support_need": {
            "type": "string",
            "minLength": 1
          },
          "integration_destination": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": [
          "contribution_id",
          "grade",
          "curriculum_mode",
          "pda_ids",
          "learning_role",
          "project_contribution",
          "expected_evidence",
          "complexity_level",
          "support_need",
          "integration_destination"
        ],
        "additionalProperties": false
      },
      "minItems": 1
    },
    "project_stages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "stage_id": {
            "type": "string",
            "minLength": 1
          },
          "order": {
            "type": "integer",
            "minimum": 1
          },
          "purpose": {
            "type": "string",
            "minLength": 1
          },
          "required_inputs": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            },
            "minItems": 1,
            "uniqueItems": true
          },
          "student_operation": {
            "type": "string",
            "minLength": 1
          },
          "methodology_operations": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            },
            "minItems": 0,
            "uniqueItems": true
          },
          "expected_output": {
            "type": "string",
            "minLength": 1
          },
          "output_artifact_id": {
            "type": "string",
            "minLength": 1
          },
          "consumed_by": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            },
            "minItems": 1,
            "uniqueItems": true
          },
          "acceptance_criteria": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            },
            "minItems": 1
          },
          "estimated_minutes": {
            "type": "integer",
            "minimum": 1
          },
          "estimate_rationale": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": [
          "stage_id",
          "order",
          "purpose",
          "required_inputs",
          "student_operation",
          "methodology_operations",
          "expected_output",
          "output_artifact_id",
          "consumed_by",
          "acceptance_criteria",
          "estimated_minutes",
          "estimate_rationale"
        ],
        "additionalProperties": false
      },
      "minItems": 1
    },
    "session_progression": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "session_number": {
            "type": "integer",
            "minimum": 1
          },
          "project_state_before": {
            "type": "string",
            "minLength": 1
          },
          "session_project_goal": {
            "type": "string",
            "minLength": 1
          },
          "required_learning": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            },
            "minItems": 1
          },
          "methodology_operations": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            },
            "minItems": 0,
            "uniqueItems": true
          },
          "pda_focus": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            },
            "minItems": 0,
            "uniqueItems": true
          },
          "input_artifact_ids": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            },
            "minItems": 1,
            "uniqueItems": true
          },
          "expected_output_artifact_ids": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            },
            "minItems": 1,
            "uniqueItems": true
          },
          "expected_partial_product": {
            "type": "string",
            "minLength": 1
          },
          "acceptance_criteria": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            },
            "minItems": 1
          },
          "project_state_after": {
            "type": "string",
            "minLength": 1
          },
          "next_session_dependency": {
            "anyOf": [
              {
                "type": "integer",
                "minimum": 1
              },
              {
                "type": "null"
              }
            ]
          },
          "terminal": {
            "type": "boolean"
          }
        },
        "required": [
          "session_number",
          "project_state_before",
          "session_project_goal",
          "required_learning",
          "methodology_operations",
          "pda_focus",
          "input_artifact_ids",
          "expected_output_artifact_ids",
          "expected_partial_product",
          "acceptance_criteria",
          "project_state_after",
          "next_session_dependency",
          "terminal"
        ],
        "additionalProperties": false
      },
      "minItems": 1
    },
    "ltg_strategy": {
      "type": "object",
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "CORE",
            "SUPPORT",
            "OPTIONAL",
            "NONE"
          ]
        },
        "selections": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "project_id": {
                "type": "string",
                "minLength": 1
              },
              "role": {
                "type": "string",
                "enum": [
                  "CORE",
                  "SUPPORT",
                  "OPTIONAL"
                ]
              },
              "pda_ids": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                },
                "minItems": 1,
                "uniqueItems": true
              },
              "activity_ids": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                },
                "minItems": 0,
                "uniqueItems": true
              },
              "reason": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "project_id",
              "role",
              "pda_ids",
              "activity_ids",
              "reason"
            ],
            "additionalProperties": false
          },
          "minItems": 0
        },
        "reason": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "mode",
        "selections",
        "reason"
      ],
      "additionalProperties": false
    },
    "feasibility": {
      "type": "object",
      "properties": {
        "requested_sessions": {
          "type": "integer",
          "minimum": 1
        },
        "minutes_per_session": {
          "type": "integer",
          "minimum": 1
        },
        "total_available_minutes": {
          "type": "integer",
          "minimum": 1
        },
        "complexity": {
          "type": "string",
          "enum": [
            "LOW",
            "MEDIUM",
            "HIGH"
          ]
        },
        "resource_feasibility": {
          "type": "string",
          "enum": [
            "PASS",
            "FAIL",
            "UNKNOWN"
          ]
        },
        "time_feasibility": {
          "type": "string",
          "enum": [
            "PASS",
            "FAIL",
            "UNKNOWN"
          ]
        },
        "multigrade_feasibility": {
          "type": "string",
          "enum": [
            "PASS",
            "FAIL",
            "UNKNOWN"
          ]
        },
        "risks": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 0
        },
        "assumptions": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          },
          "minItems": 0
        }
      },
      "required": [
        "requested_sessions",
        "minutes_per_session",
        "total_available_minutes",
        "complexity",
        "resource_feasibility",
        "time_feasibility",
        "multigrade_feasibility",
        "risks",
        "assumptions"
      ],
      "additionalProperties": false
    },
    "gate_result": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "gate_version": {
              "const": "BLUEPRINT_GATE_V1"
            },
            "status": {
              "type": "string",
              "enum": [
                "PASS",
                "FAIL",
                "NOT_EVALUABLE",
                "NEEDS_TEACHER_DECISION"
              ]
            },
            "critical_count": {
              "type": "integer",
              "minimum": 0
            },
            "warning_count": {
              "type": "integer",
              "minimum": 0
            },
            "deterministic_findings": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "rule_id": {
                    "type": "string",
                    "minLength": 1
                  },
                  "severity": {
                    "type": "string",
                    "enum": [
                      "CRITICAL",
                      "WARNING"
                    ]
                  },
                  "status": {
                    "type": "string",
                    "enum": [
                      "PASS",
                      "FAIL",
                      "NOT_EVALUABLE"
                    ]
                  },
                  "scope": {
                    "type": "string",
                    "minLength": 1
                  },
                  "observed": {
                    "type": "string",
                    "minLength": 1
                  },
                  "expected": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "rule_id",
                  "severity",
                  "status",
                  "scope",
                  "observed",
                  "expected"
                ],
                "additionalProperties": false
              },
              "minItems": 0
            },
            "semantic_findings": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "rule_id": {
                    "type": "string",
                    "minLength": 1
                  },
                  "severity": {
                    "type": "string",
                    "enum": [
                      "CRITICAL",
                      "WARNING"
                    ]
                  },
                  "status": {
                    "type": "string",
                    "enum": [
                      "PASS",
                      "FAIL",
                      "NOT_EVALUABLE"
                    ]
                  },
                  "scope": {
                    "type": "string",
                    "minLength": 1
                  },
                  "observed": {
                    "type": "string",
                    "minLength": 1
                  },
                  "expected": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "rule_id",
                  "severity",
                  "status",
                  "scope",
                  "observed",
                  "expected"
                ],
                "additionalProperties": false
              },
              "minItems": 0
            },
            "evaluated_blueprint_hash": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            },
            "source_hash": {
              "type": "string",
              "pattern": "^[a-f0-9]{64}$"
            }
          },
          "required": [
            "gate_version",
            "status",
            "critical_count",
            "warning_count",
            "deterministic_findings",
            "semantic_findings",
            "evaluated_blueprint_hash",
            "source_hash"
          ],
          "additionalProperties": false
        },
        {
          "type": "null"
        }
      ]
    }
  },
  "required": [
    "schema_version",
    "blueprint_id",
    "revision",
    "status",
    "source",
    "problem_frame",
    "methodology",
    "guiding_question",
    "final_outcome",
    "pda_analysis",
    "grade_contributions",
    "project_stages",
    "session_progression",
    "ltg_strategy",
    "feasibility",
    "gate_result"
  ],
  "additionalProperties": false
}
```

### TeacherConstraintsV1.json

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:multiplan:shadow:TeacherConstraintsV1",
  "type": "object",
  "properties": {
    "schema_version": {
      "const": "TEACHER_CONSTRAINTS_V1"
    },
    "constraints_id": {
      "type": "string",
      "minLength": 1
    },
    "constraints_hash": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    },
    "created_at": {
      "type": "string",
      "minLength": 1
    },
    "grades": {
      "type": "array",
      "items": {
        "type": "integer",
        "minimum": 1,
        "maximum": 6
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "selected_pda_ids": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "minItems": 0,
      "uniqueItems": true
    },
    "explicit_ltg_selections": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "project_id": {
            "type": "string",
            "minLength": 1
          },
          "pda_ids": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            },
            "minItems": 1,
            "uniqueItems": true
          },
          "intent": {
            "type": "string",
            "enum": [
              "CORE",
              "SUPPORT",
              "OPTIONAL"
            ]
          }
        },
        "required": [
          "project_id",
          "pda_ids",
          "intent"
        ],
        "additionalProperties": false
      },
      "minItems": 0
    },
    "requested_sessions": {
      "type": "integer",
      "minimum": 1
    },
    "minutes_per_session": {
      "type": "integer",
      "minimum": 1
    },
    "original_problem": {
      "type": "string",
      "minLength": 1
    },
    "original_context": {
      "type": "string",
      "minLength": 1
    },
    "students_by_grade": {
      "type": "object",
      "additionalProperties": {
        "type": "integer",
        "minimum": 1
      }
    },
    "reading_profile": {
      "type": "string",
      "minLength": 1
    },
    "writing_profile": {
      "type": "string",
      "minLength": 1
    },
    "autonomy_profile": {
      "type": "string",
      "minLength": 1
    },
    "connectivity": {
      "type": "string",
      "minLength": 1
    },
    "available_resources": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "minItems": 0,
      "uniqueItems": true
    },
    "supports": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "minItems": 0
    },
    "teacher_explicit_constraints": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      },
      "minItems": 0
    }
  },
  "required": [
    "schema_version",
    "constraints_id",
    "constraints_hash",
    "created_at",
    "grades",
    "selected_pda_ids",
    "explicit_ltg_selections",
    "requested_sessions",
    "minutes_per_session",
    "original_problem",
    "original_context",
    "students_by_grade",
    "reading_profile",
    "writing_profile",
    "autonomy_profile",
    "connectivity",
    "available_resources",
    "supports",
    "teacher_explicit_constraints"
  ],
  "additionalProperties": false
}
```

