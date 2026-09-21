export default {
  id: 'aprendizaje_servicio',
  label: 'Aprendizaje Servicio',
  shortLabel: 'Aprendizaje Servicio',
  sourceScenarioHints: [],
  selectionSignals: ['servicio','beneficiario','beneficiar','necesidad real','acción comunitaria','intervención real','apoyar a','campaña','jornada','mejorar para otros'],
  complementaryExclusions: ['servicio','intervencion_comunitaria'],
  requires: ['learning_objective','service_objective','beneficiary'],
  phases: [
    { id:'as_punto_partida', order:1, label:'Etapa 1 — Punto de partida', purpose:'Identificar la situación, necesidad, problema y posibilidades reales de servicio.', signals:['necesidad','problema','beneficiario','servicio posible','situación'], expansionWeight:1 },
    { id:'as_saberes', order:2, label:'Etapa 2 — Lo que sé y lo que quiero saber', purpose:'Recuperar saberes y formular preguntas necesarias para aprender y servir mejor.', signals:['qué sé','qué quiero saber','saberes previos','preguntas','investigar necesidad'], expansionWeight:1 },
    { id:'as_organizacion', order:3, label:'Etapa 3 — Organicemos las actividades', purpose:'Planificar acciones, responsabilidades, recursos, tiempos y organización del servicio.', signals:['planificar','responsabilidades','recursos','tiempos','organizar servicio','roles'], expansionWeight:1 },
    { id:'as_creatividad', order:4, label:'Etapa 4 — Creatividad en marcha', purpose:'Realizar investigaciones, producciones, acciones, intervención y servicio.', signals:['realizar','intervenir','servicio','acción','producir','implementar','campaña','jornada'], expansionWeight:5 },
    { id:'as_compartimos', order:5, label:'Etapa 5 — Compartimos y evaluamos lo aprendido', purpose:'Valorar resultados, compartir, reflexionar e identificar aprendizajes e impacto del servicio.', signals:['compartir','evaluar','impacto','reflexionar','aprendizajes','resultado del servicio','beneficiarios'], expansionWeight:2 },
  ],
  rules: [
    'Sólo usar cuando exista una necesidad real, aprendizaje curricular, acción de servicio y beneficiario identificable.',
    'Debe existir objetivo de aprendizaje y objetivo de servicio.',
    'No usar sólo porque el proyecto ocurra en la comunidad.'
  ]
};
