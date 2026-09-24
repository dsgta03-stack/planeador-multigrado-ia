# Propuesta compacta de autoría — implementación inicial offline

Provider Authoring Proposal → compilador de construcción → ProjectBlueprintV1 completo → contrato de dominio → Gate determinista → revisión semántica sobre el mismo hash.

**No habilitada en el runner/proveedor vivo. No validada con Gemini.** La primera versión está implementada en `authoring-proposal.mjs`, tiene contrato de transporte propio y pruebas sintéticas locales. No se modifica la representación final de dominio, ni se usa una salida histórica truncada para construir un candidato.

## Propiedad de la información

| Información | Propietario | Tratamiento |
|---|---|---|
| Problema interpretado, propósito, pregunta, aportación por grado | MODEL_OWNED | Se conservan exactamente los textos del modelo |
| Operación del alumnado, evidencia, criterios, estados conceptuales | MODEL_OWNED | No se sintetizan ni reemplazan con código |
| Interpretación cognitiva y su base textual | MODEL_OWNED | La selección de un fragmento del PDA es una decisión razonada; no se elimina |
| Texto oficial, grado del PDA, problema original | REFERENCE_ONLY | PDA referenciado por ID; copia exacta del snapshot/contexto |
| Source hashes, metodología elegida/catálogo | COMPILER_OWNED | Copia de las tres fuentes validadas |
| DAG, orden, vínculos etapa/sesión, artefactos, destino común | COMPILER_OWNED | Plan determinista, sin atribución proporcional de operaciones |
| Presupuesto disponible | COMPILER_OWNED | Sesiones × minutos reales del docente |
| Estimación de esfuerzo, riesgos y factibilidad | MODEL_OWNED | Se conserva y verifica; nunca se reduce automáticamente |
| IDs de contribución, estado DRAFT, revisión, cierre y siguiente sesión | COMPILER_OWNED | Identidad del grado y secuencia cerrada del plan actual |
| Citas repetidas de evidencia en matriz | REDUNDANT | Referencia exacta a expected_output o índice de acceptance_criteria |
| Cita de acción para cada operación | MODEL_OWNED / repetición necesaria inicial | Se conserva la asociación literal. El compilador comprueba pertenencia; la semántica juzga cumplimiento |

El alcance sigue limitado al plan actual de Proyectos Comunitarios de 1 o 3 sesiones. No es SessionGraph. La cobertura puede compartir etapa; once operaciones no significan once etapas.

## Autoría y tamaño

La medición real conservada encuentra 89.698 caracteres observables en support_need, un campo incompleto. Una secuencia de doce palabras aparece 88 veces. Esta evidencia indica repetición descontrolada dentro de un campo, no solamente redundancia de metadatos. Los 37.608 caracteres no conservados son desconocidos; no se reconstruyeron.

La instrucción de autoría exige una idea concreta por campo, sin introducciones, repetición completa del PDA ni explicación reiterada del método. Política inicial de propuesta: support_need hasta 1.200 caracteres; otros textos hasta 4.000 caracteres por valor. Permite detalle pedagógico sustancial y múltiples criterios. Los límites se envían en el schema de autoría y se comprueban localmente: se rechaza exceso, **nunca se trunca ni se reescribe**. Su adecuación real aún requiere una futura prueba autorizada; no se afirma ahorro real de tokens.

El compilador rechaza campos adicionales: el proveedor no puede suplantar source, grade del PDA, texto oficial o metadatos de aprobación. Comprueba la identidad del plan frente a las fuentes. Expande referencias a evidencia ya escrita por el modelo; no inventa acciones. El resultado pasa `assertContract(ProjectBlueprintV1)` completo. No hay salida APPROVED desde este módulo; el Gate y el revisor conservan su autoridad.

## Pendiente

Integrar explícitamente esta propuesta y la instrucción en una futura versión de GENERATE/REPAIR, registrar versión/hash efectivo y evaluar compatibilidad del schema y fidelidad pedagógica con autorización nueva. El protocolo vivo de esta ronda sólo incorpora el máximo diagnóstico configurable. No se hacen llamadas para probar compactación en esta fase.
