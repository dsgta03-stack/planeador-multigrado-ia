export default {
  id: 'steam',
  label: 'Aprendizaje Basado en Indagación con enfoque STEAM',
  shortLabel: 'STEAM',
  sourceScenarioHints: [],
  selectionSignals: ['formular preguntas','observar','investigar','medir','experimentar','datos','comparar','analizar','modelar','diseñar','construir','probar','fenómeno','evidencia'],
  complementaryExclusions: ['indagacion_steam','observacion','medicion','experimentacion','analisis_datos','prototipado'],
  phases: [
    { id:'steam_identificacion', order:1, label:'Fase 1 — Introducción e identificación', purpose:'Introducir el tema, recuperar saberes, identificar la problemática y formular preguntas iniciales.', signals:['introducir','saberes previos','problema','pregunta inicial','qué sabemos','fenómeno'], expansionWeight:1 },
    { id:'steam_diseno', order:2, label:'Fase 2 — Diseño de la indagación', purpose:'Definir qué se necesita saber, cómo investigar, qué datos y materiales se requieren y cómo registrar.', signals:['cómo investigar','diseñar indagación','datos necesarios','materiales','registro','hipótesis','plan de observación'], expansionWeight:1 },
    { id:'steam_indagacion', order:3, label:'Fase 3 — Desarrollo de la indagación', purpose:'Realizar observaciones, experimentos, mediciones, investigaciones, pruebas y búsqueda de evidencias.', signals:['observar','experimentar','medir','investigar','probar','evidencia','registrar datos','recopilar'], expansionWeight:5 },
    { id:'steam_respuestas', order:4, label:'Fase 4 — Organización y construcción de respuestas', purpose:'Organizar resultados, comparar, analizar, interpretar y construir conclusiones.', signals:['organizar resultados','comparar','analizar','interpretar','conclusión','explicar','tabla','gráfica'], expansionWeight:3 },
    { id:'steam_aplicacion', order:5, label:'Fase 5 — Presentación y aplicación', purpose:'Comunicar resultados y, cuando sea pertinente, proponer, diseñar, construir o aplicar soluciones.', signals:['comunicar','presentar','aplicar','solución','diseñar','construir','crear','proponer'], expansionWeight:2 },
    { id:'steam_reflexion', order:6, label:'Fase 6 — Reflexión / metacognición', purpose:'Reflexionar sobre lo aprendido, el proceso de indagación, lo que funcionó y nuevas preguntas.', signals:['reflexionar','qué aprendimos','qué funcionó','mejorar','nuevas preguntas','metacognición','evaluar proceso'], expansionWeight:1 },
  ],
  rules: [
    'No obligar a fabricar prototipos si el proyecto no lo necesita.',
    'Diseñar → crear → probar → evaluar → mejorar sólo cuando exista una necesidad tecnológica o de diseño.',
    'La indagación debe producir evidencia útil para los PDA y el producto.'
  ]
};
