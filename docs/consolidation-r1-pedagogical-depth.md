# Profundidad narrativa y ejecutabilidad — Consolidation R1

## Base y diagnóstico

Rama remota verificada: `consolidation-single-app-r1`.
Commit exacto: `aae123ae7cf8d3137b8d298cae5d7713963fe1f2`.
Se descargó el ZIP de ese commit; la copia local no contiene `.git`.
La corrección de `explicit_ltg_selections` permanece intacta.

El flujo vigente es una sola app: server consolidado → ruta canónica → runtime
certificado → Blueprint aprobado → autoría/compilación de SessionGraph → Session
Gate y Critical Gate → TeacherPlanProjection → adaptador canónico → presentación,
historial, revisión y DOCX. No se incorporó otro servidor, wrapper o escritor IA.

La brevedad tiene dos causas verificables en código:

1. La instrucción de autoría exige un procedimiento distribuido en campos, pero
   no exige explícitamente que `common_student_action` desarrolle el episodio
   didáctico completo. SGD-017 rechaza frases genéricas exactas, pero dejaba pasar
   títulos de atención y variantes como “Orientaré a los alumnos…”.
2. La proyección y el adaptador conservan los textos: no los recortan. El adaptador
   usa `common_student_action` como `development`; la UI lo acompañaba con una
   lista de campos y duplicaba el cierre de la última actividad a nivel sesión.

No se identificó en este flujo un truncamiento de contenido pedagógico por la
proyección. Los límites de texto, modelo, presupuestos y provider no cambiaron.
No se inspeccionó una nueva generación real: el diagnóstico se funda en código y
los ejemplos proporcionados, sin atribuirles falsamente un request de proveedor.

## Responsabilidades y criterio

Blueprint sigue definiendo problema, metodología, resultados, etapas y artefactos.
SessionGraph debe desarrollar la microsecuencia docente dentro de esas decisiones.
La presentación sólo ordena textos aprobados; no completa ni reescribe pedagogía.

La política de autoría, compartida por GENERATE y la única reparación disponible,
exige ahora:

- desarrollo fluido en `common_student_action`, centrado en acciones del alumnado;
- punto de partida, consigna, secuencia, organización, recursos y resultado claros;
- título de acción/aprendizaje en lugar de modalidad de atención;
- trabajo simultáneo de los demás grados cuando hay atención focalizada, expresado
  en `grouping` y `grade_participation`, sin forzar rotaciones;
- coherencia propósito → acción → producto → evidencia → insumo siguiente;
- conexiones concretas, sin fórmulas repetidas ni productos ajenos al Blueprint.

SGD-017 amplía exclusivamente los casos negativos conocidos de apoyo genérico y
los títulos de atención. No hay whitelist de verbos, cuota de palabras ni número
nuevo de pasos. Las afirmaciones genéricas de apoyo se bloquean cuando sustituyen
la acción del alumnado; un rol docente conciso no invalida un procedimiento que
ya desarrolla esa acción. SGS-011 mantiene la evaluación semántica de profundidad,
viabilidad y simultaneidad; SGS-006 explicita coherencia curricular/proyectual.
El reviewer debe identificar y citar la insuficiencia, sin redactar la reparación.
Critical Gate y los demás gates conservan íntegramente sus contratos.

## Presentación y conservación

La narrativa aprobada permanece en primer plano, junto a acciones por grado,
producto, evidencia, criterios, LTG y conexión. Preparación, consigna, pasos,
organización, intervención, preguntas, recursos y apoyos quedan disponibles en
un desplegable operativo. El detalle técnico previo se conserva.
Sólo se evita una duplicación visual si `closure_narrative` es exactamente igual
al `execution.connection` de la última actividad; los textos distintos se muestran.
No se elimina información del plan canónico ni del DOCX, y no se filtran conexiones
formulares ya generadas: su calidad se exige en autoría/revisión.

## Archivos

Modificados:

- `shadow/session-graph-v1/authoring.mjs`
- `shadow/session-graph-v1/catalog.mjs`
- `shadow/session-graph-v1/reviewer.mjs`
- `lib/consolidation-r1/ui/teacher-presentation-ui.mjs`
- `shadow/session-graph-v1/tests/teacher-executability.test.mjs`
- `shadow/pipeline-v1/tests/session-provider-scalar-policy.test.mjs`
- `tests/consolidation-r1-teacher-executability.test.mjs`

Añadido: este informe.

Sin cambios: schemas V1, Blueprint/Gates, provider, split critical, modelo,
reparaciones, lookup, locks, LTG, proyección, adaptador canónico, hashes, historial,
review, exportadores DOCX, entrypoint, package.json y normalización LTG del cliente.
El mantenimiento previo del endpoint de tests ya pertenece a la base y no se mezcla
con este diff.

## Regresiones

Se añaden cuatro tests, sin quitar aserciones existentes:

1. Rechazo de “orientar/apoyar/supervisar” sin desarrollo y títulos de atención;
   aceptación de primera persona docente desarrollada y rol breve contextualizado.
2. Contrato de revisión para profundidad, simultaneidad y coherencia; un FAIL de
   SGS-011 o SGS-006 nunca se convierte en aprobación.
3. Propagación de la misma política narrativa a GENERATE/REPAIR mediante el provider
   real con fetch simulado, preservando fuentes, Blueprint y modelo.
4. Narrativa fluida y simultaneidad conservadas en grafo → proyección → canónico →
   UI/DOCX; cierre idéntico visible una vez; PDA, foco, recursos y LTG intactos.

Suite completa local final: **318 PASS / 0 FAIL**, sin cancelados ni omitidos.
Comando: `node --test tests/*.mjs shadow/project-blueprint-v1/tests/*.test.mjs shadow/session-graph-v1/tests/*.test.mjs shadow/pipeline-v1/tests/*.test.mjs shadow/presentation-v1/tests/*.test.mjs shadow/integration-v1/tests/*.test.mjs shadow/router-integration-v1/tests/*.test.mjs`.

`npm run check:v0124`, `npm test` y `npm run test:routes`: PASS.
Pruebas focalizadas: 22 PASS en autoría/presentación y 3 PASS en política de provider.
Las pruebas existentes incluyen zero-PDA, Grade/Transversal Lock, LTG CORE/SUPPORT/
OPTIONAL/NONE, compatibilidad V1, gates, hash binding, historial, review y DOCX.
Se bloqueó red externa en los procesos de tests; sólo loopback y dobles locales.
Hubo dos errores iniciales de preparación/test: guard temporal ausente y una
aserción nueva dirigida al objeto request en lugar de la instrucción exportada.
Se corrigieron; no se relajó ninguna validación para obtener PASS.

## Riesgos y siguiente paso

Los tests deterministas prueban contratos y conservación; no prueban que Gemini
vaya a producir siempre una narrativa suficiente. SGS-011/006 deben juzgarla y
mantener el rechazo cuando falte desarrollo. La narrativa puede aumentar consumo
sin cambiar límites existentes; no se verificó truncamiento ni latencia live.
Los casos negativos son conservadores, no una comprensión semántica universal.
Las planeaciones históricas siguen mostrando sus textos existentes sin reescritura.

Queda preparado un patch contra el commit exacto para revisión y aplicación en
shadow. No se hicieron commit, push, deploy, generación real ni cambios a main,
producción o configuración del shadow estable. No se repitió 5D. Una prueba nueva
debe hacerse sólo en el shadow autorizado, antes de cualquier promoción productiva.
