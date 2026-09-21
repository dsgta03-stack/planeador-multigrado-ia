export default {
  id: 'abp',
  label: 'Aprendizaje Basado en Problemas',
  shortLabel: 'ABP',
  sourceScenarioHints: [],
  selectionSignals: ['problema','causa','consecuencia','comprender','explicar','resolver','solucionar','alternativa','analizar','decidir'],
  complementaryExclusions: ['resolucion_problemas','debate'],
  phases: [
    { id:'abp_presentemos', order:1, label:'Momento 1 — Presentemos', purpose:'Presentar una situación relevante que active la reflexión sobre el problema.', signals:['presentar','situación','caso','detonante','observar problema','pregunta inicial'], expansionWeight:1 },
    { id:'abp_recolectemos', order:2, label:'Momento 2 — Recolectemos', purpose:'Recuperar conocimientos, experiencias e información vinculada con el problema.', signals:['recuperar','experiencias','información','saberes previos','indagar antecedentes','recolectar'], expansionWeight:1 },
    { id:'abp_formulemos', order:3, label:'Momento 3 — Formulemos el problema', purpose:'Delimitar con claridad qué se necesita comprender, explicar o solucionar.', signals:['formular problema','delimitar','definir problema','qué necesitamos','pregunta problema'], expansionWeight:1 },
    { id:'abp_organicemos', order:4, label:'Momento 4 — Organicemos la experiencia', purpose:'Definir cómo se investigará o abordará el problema.', signals:['planificar','organizar','cómo investigar','roles','ruta','estrategia'], expansionWeight:1 },
    { id:'abp_vivamos', order:5, label:'Momento 5 — Vivamos la experiencia', purpose:'Desarrollar las acciones, investigaciones y experiencias necesarias para atender el problema.', signals:['investigar','probar','observar','entrevistar','analizar','resolver','experimentar','desarrollar'], expansionWeight:5 },
    { id:'abp_resultados', order:6, label:'Momento 6 — Resultados y análisis', purpose:'Organizar resultados, explicar, proponer alternativas y reflexionar.', signals:['resultado','analizar','explicar','alternativa','conclusión','reflexionar','evaluar','comunicar'], expansionWeight:2 },
  ],
  rules: [
    'El problema debe ser el núcleo organizador de todo el proyecto.',
    'No insertar fases completas de STEAM, Servicio o Proyectos Comunitarios.',
    'Las acciones de investigación son válidas cuando ayudan a comprender o atender el problema.'
  ]
};
