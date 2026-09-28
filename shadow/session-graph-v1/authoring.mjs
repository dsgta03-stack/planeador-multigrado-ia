import {schemaErrors} from '../project-blueprint-v1/contracts.mjs';
import {SESSION_GRAPH_PROPOSAL_VERSION,CONTRIBUTION_MODES,PDA_MOBILIZATION_STATUSES,METHODOLOGY_OPERATION_SEMANTICS} from './catalog.mjs';

export const SESSION_GRAPH_AUTHORING_PREFLIGHT=Object.freeze({
 worked_policy:'Para cada PDA seleccionado intenta diseñar una sola actividad auténticamente WORKED en todo el grafo; las demás movilizaciones deben ser DEVELOPING. WORKED exige que student_action de ESA MISMA actividad ejecute literalmente todos los componentes sustantivos y la finalidad del PDA. No basta repetir o conjugar los verbos del PDA ni describir un resultado como ya propuesto, investigado o compartido. Para indagación debe nombrar fuente/observación/consulta concreta, procesamiento o contraste, registro trazable y, si la finalidad lo exige, una acción explícita de compartir/explicar/comunicar la importancia. La fuente o consulta debe tratar los objetos sustantivos nombrados por el PDA, no un tema adyacente que luego sólo mencione el PDA en otra cláusula. Para explicar+proponer debe existir una acción explícita de explicar Y otra de proponer un acuerdo concreto; frases de propósito como “con la intención de proponer”, “para proponer” o “con miras a proponer” NO ejecutan la propuesta. Si falta una parte, usa DEVELOPING; nunca heredes componentes de otra actividad.',
 methodology_links:'Para CADA methodology_operation enlazada, compara la acción local con METHODOLOGY_OPERATION_SEMANTICS[operation].required y rechaza cualquier caso que sólo cumpla not_enough. RECONOCIMIENTO exige una acción observable de reconocer, identificar, comparar, revisar o detectar hallazgos, relaciones, dificultades, criterios, diferencias, avances o necesidades de ajuste; preparar, ordenar o producir sin esa revisión no basta. DIFUSION debe estar en la actividad que realmente comunica/presenta/explica ante audiencia real; no en montaje, traslado o planeación de ruta. COMPRENSION_Y_PRODUCCION debe estar en la actividad que comprende/procesa Y produce/construye en esa misma actividad.',
 functional_links:'Para CADA functional_requirement_id enlazado, la misma actividad debe ejecutar concretamente el criterio y producir o registrar la evidencia pertinente dentro de una etapa autorizada. No agrupes requisitos por pertenecer al mismo producto. at_least_two_viable_spaces_or_audiences sólo puede enlazarse donde la actividad realmente presenta/actúa en dos espacios o audiencias, no donde sólo planea una ruta. circulation_evidence sólo donde se registra circulación ya realizada. Montaje, explicación, mediación, movimiento y reinstalación son afirmaciones distintas y requieren acción/evidencia local.',
 contribution_links:'Regla mecánica sin excepciones: contributes_to_artifact_ids no vacío => contribution_mode DIRECT. contribution_mode COMPLEMENTARY => contributes_to_artifact_ids vacío y una actividad posterior de ESA MISMA sesión incluye activity_key en input_refs. Un output que sea sólo análisis, notas, selección, esquema preliminar o preparación es COMPLEMENTARY salvo que el artefacto esperado del Blueprint sea precisamente ese análisis/plan. Si una actividad produce, monta, media, mueve, reinstala o registra circulación y deja un componente observable del artefacto esperado, debe ser DIRECT.',
 deterministic_contract:'Antes de devolver, verifica literalmente: (1) minutos totales por sesión <= minutes_per_session; (2) cada operación metodológica de la sesión aparece en actividad que cumple su semántica required y no sólo not_enough; (3) recursos/apoyos exactamente autorizados; (4) DIRECT implica artefacto no vacío; (5) COMPLEMENTARY implica artefacto vacío y consumidor posterior; (6) cada artefacto esperado tiene DIRECT; (7) sin dependencias futuras; (8) requisitos dentro de stage_ids; (9) no enlaces un requisito a una actividad que sólo prepara su ejecución posterior; (10) toda fila WORKED pasa el preflight determinista local: indagación exige fuente/consulta, procesamiento/contraste y registro; las finalidades de compartir/proponer y la acción de explicar deben aparecer explícitamente cuando el PDA oficial las exige.'
});

export const SESSION_GRAPH_AUTHORING_INSTRUCTION=`Convierte el ProjectBlueprint aprobado en actividades ejecutables sin cambiar problema, pregunta, metodología, PDA, producto, etapas, estados, artefactos ni operaciones. Mantén una cadena input→acción del alumnado→output→evidencia→criterio. Aplica sin excepciones: contributes_to_artifact_ids.length>0 => contribution_mode=DIRECT; contribution_mode=COMPLEMENTARY => contributes_to_artifact_ids=[] y una actividad posterior de la misma sesión consume activity_key mediante input_refs. DIRECT significa que el output YA ES un componente observable del artefacto esperado; análisis, notas, selección, bosquejo, ensayo o preparación que sólo sirven a una actividad posterior son COMPLEMENTARY, salvo que el artefacto esperado del Blueprint sea exactamente ese tipo de producto. Si la actividad ejecuta un requisito constitutivo y deja resultado observable del artefacto, debe ser DIRECT.

WORKED es excepcional, no el estado por defecto. Para cada PDA seleccionado procura como máximo una actividad WORKED auténtica en todo el grafo y usa DEVELOPING en las demás movilizaciones. Antes de escribir WORKED compara student_action de esa misma fila contra el PDA oficial completo. Repetir el texto o los verbos del PDA NO demuestra el desempeño. Una forma nominal o pasiva como “acuerdos propuestos”, “información investigada” o “importancia registrada” no sustituye la acción requerida. Si el PDA combina explicar+proponer, student_action debe decir qué explica y qué acuerdo concreto propone; “con la intención de proponer”, “para proponer” o formulaciones de propósito equivalentes NO son una propuesta ejecutada. Si combina indagar+compartir importancia, la misma actividad debe indicar: qué fuente/observación/consulta accesible utiliza; que esa indagación se dirige realmente a las ideas, prácticas, formas de organización, acuerdos u otros objetos sustantivos nombrados por el PDA y no a un tema adyacente; qué información procesa, compara o contrasta; qué registro trazable produce; y a quién/cómo comparte, explica o comunica su importancia. Si falta cualquiera, usa DEVELOPING. No heredes indagación, explicación, propuesta o socialización desde otra actividad. El validador local rechazará una fila WORKED de indagación que no contenga fuente/consulta, procesamiento/contraste y registro trazable aunque el texto diga “indaga”; también rechazará WORKED si el PDA exige compartir, explicar o proponer y esa acción no aparece localmente.

Las operaciones metodológicas se enlazan sólo donde realmente se ejecutan y debes usar METHODOLOGY_OPERATION_SEMANTICS como contrato semántico explícito. Para cada operation comprueba required y evita not_enough. En particular: RECONOCIMIENTO sólo va en una actividad donde el alumnado reconoce, identifica, compara, revisa o detecta de manera observable hallazgos, relaciones, dificultades, criterios, diferencias, avances o necesidades de ajuste; producir, preparar, ordenar o trasladar sin esa revisión no es RECONOCIMIENTO. DIFUSION va en la actividad que realmente comunica, presenta o explica ante una audiencia real; montar, trasladar o diseñar la ruta no es DIFUSION. COMPRENSION_Y_PRODUCCION va en la actividad que comprende/procesa Y produce/construye algo concreto; sólo revisar o comprender no basta. CONSIDERACIONES exige recoger/considerar resultados, comentarios o dificultades; AVANCES exige comparar/registrar/reflexionar sobre avances o pendientes. Si la operación está en la sesión pero la actividad actual no la ejecuta, asigna la etiqueta a otra actividad de ESA MISMA sesión que sí la ejecute; no cambies las operaciones aprobadas del Blueprint ni inventes una acción artificial sólo para portar la etiqueta.

Cada functional_requirement_id se decide uno por uno y sólo se enlaza si esa misma actividad realiza el criterio y produce/registra su evidencia. No repartas IDs por conveniencia ni asignes todos los requisitos de una etapa a una actividad. at_least_two_viable_spaces_or_audiences exige que esa actividad efectivamente actúe/presente en dos espacios o audiencias; planear la ruta no basta. circulation_evidence exige registrar circulación ya realizada; anunciar que habrá traslado no basta. movement exige desplazamiento real; relocation_or_reinstallation exige reinstalación real; mediation exige interacción explicativa real; mounting exige montaje real; piece_explanation exige explicación real de piezas. Usa sólo recursos y apoyos autorizados.

Antes de devolver, recorre cada actividad y pregunta literalmente: ¿DIRECT produce el artefacto? ¿COMPLEMENTARY queda sin artefacto y es consumida después? ¿cada WORKED ejecuta PDA completo localmente y no sólo repite palabras? ¿cada operación cumple METHODOLOGY_OPERATION_SEMANTICS.required y evita not_enough? ¿cada requisito es verdadero en esta actividad con evidencia local? ¿minutos, recursos, apoyos y dependencias cumplen? Corrige la propuesta antes de responder.`;

export function methodologyOperationPolicy(blueprint){
 return (blueprint?.methodology?.required_operations||[]).map(operation=>({operation,...METHODOLOGY_OPERATION_SEMANTICS[operation]}));
}

const normalized=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const has=(text,re)=>re.test(normalized(text));
const WORKED_LOCAL_SIGNALS=Object.freeze({
 source:/\b(consult|entrevist|observ|revis|pregunt|encuest|fuente|recuerdo|testimoni|document|registro previo|libro|texto|nota previa)/,
 process:/\b(compar|contrast|analiz|relacion|clasific|organiza|interpre|sintetiz|disting|seleccion|ordena|define.*criter)/,
 trace:/\b(registr|anot|escrib|redact|ficha|nota|bitacora|lista|cuadro|esquema|dibuja.*registro)/,
 share:/\b(compart|explic|comunic|present|socializ|expone|dialoga con|cuenta a)/,
 explain:/\b(explic|describ|narra|cuenta)/,
 propose:/\b(propone|proponen|proponga|propongan|proponemos|sugiere|sugieren|formula(?:n)?(?:\s+\w+){0,6}\s+acuerdo|plantea(?:n)?(?:\s+\w+){0,6}\s+acuerdo|acuerda(?:n)?\s+que)\b/
});
const PDA_SCOPE_STOPWORDS=new Set(['acerca','desde','entre','hacia','hasta','sobre','segun','para','como','cuando','donde','quien','quienes','cuales','estas','estos','forma','formas','manera','maneras','importancia','socializacion','comparte','compartir','explica','explicar','comunica','comunicar','indaga','indagar','informacion','procesa','procesar']);
const scopeStems=text=>normalized(text).split(/[^a-z0-9]+/).filter(x=>x.length>=5&&!PDA_SCOPE_STOPWORDS.has(x)).map(x=>x.slice(0,6));
const sourceScopeClause=action=>{
 const a=normalized(action),m=WORKED_LOCAL_SIGNALS.source.exec(a);if(!m)return '';
 const tail=a.slice(m.index,Math.min(a.length,m.index+220));
 return tail.split(/[.;,]/)[0];
};
const indagaScopeMatches=(official,action)=>{
 const officialStems=scopeStems(official),clauseStems=scopeStems(sourceScopeClause(action));
 if(!officialStems.length||!clauseStems.length)return false;
 return officialStems.some(o=>clauseStems.some(c=>o===c||o.startsWith(c)||c.startsWith(o)));
};
const RECOGNITION_ACTION=/\b(reconoc|identific|compar|contrast|revis|detect|disting|analiz|valora|ubica)\w*/;
const RECOGNITION_OBJECT=/\b(hallazg|relacion|dificult|criter|diferenc|avance|ajust|necesidad|resultado|cambi|pendient|falta|mejor|calidad)\w*/;

export function complementaryConsumerMissing(activities,index){
 if(!Array.isArray(activities)||!Number.isInteger(index)||index<0||index>=activities.length)return false;
 const activity=activities[index];
 if(activity?.contribution_mode!=='COMPLEMENTARY')return false;
 return !activities.slice(index+1).some(next=>Array.isArray(next?.input_refs)&&next.input_refs.includes(activity.activity_key));
}
export function methodologySemanticMissing(operation,studentAction){
 const action=normalized(studentAction),missing=[];
 if(operation==='RECONOCIMIENTO'&&(!RECOGNITION_ACTION.test(action)||!RECOGNITION_OBJECT.test(action)))missing.push('RECONOCIMIENTO_LOCAL_ACTION');
 return missing;
}

/**
 * Conservative local guardrail for author self-claims. It never promotes a
 * mobilization to WORKED; it can only reject an overclaim before compilation.
 * The semantic and critical reviewers remain authoritative afterwards.
 */
export function workedSemanticMissing(officialText,studentAction){
 const official=normalized(officialText),action=normalized(studentAction),missing=[];
 if(/\bindag/.test(official)){
  if(!WORKED_LOCAL_SIGNALS.source.test(action))missing.push('INDAGA_SOURCE_OR_OBSERVATION');
  if(!WORKED_LOCAL_SIGNALS.process.test(action))missing.push('INDAGA_PROCESS_OR_CONTRAST');
  if(!WORKED_LOCAL_SIGNALS.trace.test(action))missing.push('INDAGA_TRACEABLE_RECORD');
  if(WORKED_LOCAL_SIGNALS.source.test(action)&&!indagaScopeMatches(official,action))missing.push('INDAGA_OFFICIAL_SCOPE');
 }
 if(/\bexplic/.test(official)&&!WORKED_LOCAL_SIGNALS.explain.test(action))missing.push('EXPLICA_LOCAL_ACTION');
 if(/\bpropon/.test(official)&&!WORKED_LOCAL_SIGNALS.propose.test(action))missing.push('PROPONE_LOCAL_ACTION');
 if(/\b(compart|socializ|comunic)/.test(official)&&!WORKED_LOCAL_SIGNALS.share.test(action))missing.push('SHARE_OR_COMMUNICATE_PURPOSE');
 return missing;
}

export function sessionGraphAuthoringSchema(source){
 const {constraints,curriculum,blueprint}=source;
 const pdaIds=(curriculum.pdas||[]).filter(p=>constraints.grades.includes(p.grade)).map(p=>p.pda_id);
 const ops=blueprint.methodology.required_operations||[];
 const reqIds=(blueprint.final_outcome.functional_requirements||[]).map(r=>r.requirement_id);
 const ltgIds=(blueprint.ltg_strategy.selections||[]).flatMap(x=>x.activity_ids||[]);
 const str=(maxLength=2000)=>({type:'string',minLength:1,maxLength});
 const arr=(items,maxItems=20)=>({type:'array',items,maxItems});
 const mobilization={type:'object',additionalProperties:false,required:['pda_id','status'],properties:{pda_id:{type:'string',enum:pdaIds},status:{type:'string',enum:[...PDA_MOBILIZATION_STATUSES]}}};
 const gradeParticipation={type:'object',additionalProperties:false,required:['grade','student_action','differentiation','pda_mobilization','evidence'],properties:{
  grade:{type:'integer',enum:[...constraints.grades]},student_action:str(2000),differentiation:str(1200),pda_mobilization:arr(mobilization),evidence:str(1600)
 }};
 const activity={type:'object',additionalProperties:false,required:['activity_key','title','contribution_mode','contribution_rationale','common_student_action','grade_participation','teacher_role','resources','supports','minutes','input_refs','output','contributes_to_artifact_ids','methodology_operations','functional_requirement_ids','ltg_activity_ids','evidence','assessment_criteria'],properties:{
  activity_key:str(120),title:str(240),contribution_mode:{type:'string',enum:[...CONTRIBUTION_MODES]},contribution_rationale:str(1200),common_student_action:str(2000),
  grade_participation:{type:'array',minItems:1,maxItems:constraints.grades.length,items:gradeParticipation},teacher_role:str(1200),
  resources:arr({type:'string',enum:[...(constraints.available_resources||[])]}),supports:arr({type:'string',enum:[...(constraints.supports||[])]}),minutes:{type:'integer',minimum:1,maximum:constraints.minutes_per_session},
  input_refs:arr(str(160)),output:str(2000),contributes_to_artifact_ids:arr({type:'string',enum:blueprint.project_stages.map(s=>s.output_artifact_id)}),methodology_operations:arr({type:'string',enum:ops}),
  functional_requirement_ids:arr({type:'string',enum:reqIds}),ltg_activity_ids:arr({type:'string',enum:ltgIds}),evidence:str(2000),assessment_criteria:{type:'array',minItems:1,maxItems:8,items:str(1200)}
 }};
 const session={type:'object',additionalProperties:false,required:['session_number','activities'],properties:{session_number:{type:'integer',enum:blueprint.session_progression.map(s=>s.session_number)},activities:{type:'array',minItems:1,maxItems:8,items:activity}}};
 return {type:'object',additionalProperties:false,required:['authoring_version','sessions'],properties:{authoring_version:{type:'string',enum:[SESSION_GRAPH_PROPOSAL_VERSION]},sessions:{type:'array',minItems:blueprint.session_progression.length,maxItems:blueprint.session_progression.length,items:session}}};
}

export function providerAuthoringShapeSchema(source){return projectShape(sessionGraphAuthoringSchema(source));}
function projectShape(n){const o={};if(n.type!==undefined)o.type=n.type;if(n.properties){o.properties={};for(const [k,v] of Object.entries(n.properties))o.properties[k]=projectShape(v);o.required=[...(n.required||[])];}if(n.items)o.items=projectShape(n.items);return o;}

export function validateSessionGraphAuthoring(proposal,source){
 const schema=sessionGraphAuthoringSchema(source);const errors=schemaErrors(proposal,schema);
 const extra=(v,s,p='$')=>{if(Array.isArray(v)){if(s.maxItems!==undefined&&v.length>s.maxItems)errors.push(`${p}: maxItems`);v.forEach((x,i)=>extra(x,s.items,`${p}[${i}]`));return}if(v&&typeof v==='object'){for(const [k,x] of Object.entries(v))if(s.properties?.[k])extra(x,s.properties[k],`${p}.${k}`);return}if(typeof v==='string'&&s.maxLength!==undefined&&v.length>s.maxLength)errors.push(`${p}: maxLength ${s.maxLength}`);};
 extra(proposal,schema);
 const {blueprint,curriculum}=source;
 const stageByArtifact=new Map((blueprint.project_stages||[]).map(s=>[s.output_artifact_id,s.stage_id]));
 const authoredSessions=Array.isArray(proposal?.sessions)?proposal.sessions:[];
 for(const [sessionIndex,session] of authoredSessions.entries()){
  const activities=Array.isArray(session?.activities)?session.activities:[];
  for(let activityIndex=0;activityIndex<activities.length;activityIndex++){
   const activity=activities[activityIndex];
   if(complementaryConsumerMissing(activities,activityIndex)){
    errors.push(`$.sessions[${sessionIndex}].${activity.activity_key}: SGD-010 orphan complementary; COMPLEMENTARY requires later same-session consumer via input_refs`);
   }
  }
 }
 const reqById=new Map((blueprint.final_outcome?.functional_requirements||[]).map(r=>[r.requirement_id,r]));
 const pdaById=new Map((curriculum.pdas||[]).map(p=>[p.pda_id,p]));
 for(const row of proposal?.sessions||[]){
  const b=blueprint.session_progression.find(s=>s.session_number===row.session_number);if(!b)continue;
  const stageIds=new Set((b.expected_output_artifact_ids||[]).map(id=>stageByArtifact.get(id)).filter(Boolean));
  const methods=new Set(b.methodology_operations||[]),artifacts=new Set(b.expected_output_artifact_ids||[]),pdas=new Set(b.pda_focus||[]);
  for(const a of row.activities||[]){
   if((a.methodology_operations||[]).some(op=>!methods.has(op)))errors.push(`$.sessions[${row.session_number}].${a.activity_key}: methodology operation outside session`);
   const localAction=[a.common_student_action,...(a.grade_participation||[]).map(g=>g.student_action)].join(' ');
   for(const op of a.methodology_operations||[]){const missing=methodologySemanticMissing(op,localAction);if(missing.length)errors.push(`$.sessions[${row.session_number}].${a.activity_key}: methodology ${op} missing ${missing.join(',')}`)}
   if((a.contributes_to_artifact_ids||[]).some(id=>!artifacts.has(id)))errors.push(`$.sessions[${row.session_number}].${a.activity_key}: artifact outside session`);
   if(a.contribution_mode==='DIRECT'&&!(a.contributes_to_artifact_ids||[]).length)errors.push(`$.sessions[${row.session_number}].${a.activity_key}: DIRECT requires artifact`);
   if(a.contribution_mode==='COMPLEMENTARY'&&(a.contributes_to_artifact_ids||[]).length)errors.push(`$.sessions[${row.session_number}].${a.activity_key}: COMPLEMENTARY cannot claim artifact`);
   for(const id of a.functional_requirement_ids||[]){const r=reqById.get(id);if(!r||!(r.stage_ids||[]).some(x=>stageIds.has(x)))errors.push(`$.sessions[${row.session_number}].${a.activity_key}: functional requirement ${id} outside authorized stage`)}
   for(const g of a.grade_participation||[])for(const m of g.pda_mobilization||[]){
    const p=pdaById.get(m.pda_id);
    if(!pdas.has(m.pda_id)||!p||p.grade!==g.grade)errors.push(`$.sessions[${row.session_number}].${a.activity_key}: PDA ${m.pda_id} outside session/grade`);
    if(m.status==='WORKED'&&p){const missing=workedSemanticMissing(p.pda_official,g.student_action);if(missing.length)errors.push(`$.sessions[${row.session_number}].${a.activity_key}.grade_${g.grade}: WORKED ${m.pda_id} missing ${missing.join(',')}`)}
   }
  }
 }
 if(errors.length){const e=Error(`SESSION_GRAPH_AUTHORING_CONTRACT: ${errors.join('; ')}`);e.code='SESSION_GRAPH_AUTHORING_INVALID';throw e}return true;
}
