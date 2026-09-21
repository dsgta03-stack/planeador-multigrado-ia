export default {
  id: 'proyectos_comunitarios',
  label: 'Aprendizaje Basado en Proyectos Comunitarios',
  shortLabel: 'Proyectos Comunitarios',
  sourceScenarioHints: ['comunitario'],
  selectionSignals: ['comunidad','comunitario','participar','intervenir','transformar','contexto','saberes','difundir','socializar','organizar acciones'],
  complementaryExclusions: ['intervencion_comunitaria','trabajo_colaborativo'],
  phases: [
    { id:'pc_planeacion', order:1, label:'Fase 1 — Planeación', purpose:'Reconocer la situación, recuperar saberes, formular preguntas y organizar inicialmente el proyecto.', signals:['identificar','reconocer','saberes previos','recuperar','pregunta','necesidad','propósito','planificar','organizar'] , expansionWeight:1},
    { id:'pc_accion', order:2, label:'Fase 2 — Acción', purpose:'Investigar, explorar, analizar, producir y construir los avances centrales del proyecto.', signals:['investigar','explorar','observar','entrevistar','analizar','producir','construir','elaborar','registrar','comparar','medir'] , expansionWeight:4},
    { id:'pc_intervencion', order:3, label:'Fase 3 — Intervención', purpose:'Integrar, poner en práctica, difundir, intervenir, valorar y mejorar el producto o acción realizada.', signals:['integrar','difundir','presentar','intervenir','socializar','poner en práctica','valorar','evaluar','reflexionar','mejorar','compartir'] , expansionWeight:2},
  ],
  rules: [
    'Mantener el problema, PDA, proyecto LTG y producto definidos por V6.4.',
    'La progresión general es Planeación → Acción → Intervención.',
    'Una fase puede ocupar varias sesiones.',
    'Las acciones comunitarias deben mantener el hilo del proyecto y no convertirse en servicio salvo que exista un beneficiario y una acción de servicio real.'
  ]
};
