import proyectosComunitarios from './modules/proyectos-comunitarios.mjs';
import abp from './modules/abp.mjs';
import steam from './modules/steam.mjs';
import aprendizajeServicio from './modules/aprendizaje-servicio.mjs';

export const METHODOLOGIES = Object.freeze({
  proyectos_comunitarios: proyectosComunitarios,
  abp,
  steam,
  aprendizaje_servicio: aprendizajeServicio,
});

export const COMPLEMENTARY_STRATEGIES = Object.freeze({
  indagacion_steam: { label:'Indagación STEAM', signals:['observar','medir','datos','experimentar','comparar','analizar','investigar'] },
  entrevista: { label:'Entrevista', signals:['entrevistar','testimonio','preguntar a','encuesta oral'] },
  debate: { label:'Debate', signals:['debatir','argumentar','postura','punto de vista'] },
  investigacion_documental: { label:'Investigación documental', signals:['consultar','fuentes','documental','leer información','libro de consulta'] },
  prototipado: { label:'Prototipado', signals:['prototipo','diseñar','crear modelo','probar diseño','mejorar diseño'] },
  intervencion_comunitaria: { label:'Intervención comunitaria', signals:['intervenir','campaña','comunidad','difundir','acción comunitaria'] },
});

export function methodologyById(id){
  return METHODOLOGIES[String(id||'').trim().toLowerCase()] || null;
}
