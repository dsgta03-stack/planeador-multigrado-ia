import {schemaErrors} from '../project-blueprint-v1/contracts.mjs';
import {SESSION_GRAPH_PROPOSAL_VERSION,CONTRIBUTION_MODES,PDA_MOBILIZATION_STATUSES,METHODOLOGY_OPERATION_SEMANTICS} from './catalog.mjs';

// These are instructions authored with the activity, never a post-generation rewrite.
export const TEACHER_NARRATIVE_INSTRUCTION='Redacta common_student_action como el desarrollo didáctico fluido de la actividad, no como resumen del rol docente: explica el punto de partida, la consigna, qué hace el alumnado y cómo avanza hasta un producto o registro observable. Integra secuencia, organización, materiales y acompañamiento necesarios en oraciones naturales, sin cuota de palabras ni relleno. El título expresa la acción o aprendizaje del alumnado, no Apoyo, Tutoría, Supervisión ni grados aislados. Orientaré, apoyaré o supervisaré no explican por sí solos qué harán los alumnos ni cómo. Conserva los detalles operativos coherentes en execution, teacher_role y grade_participation; no uses narrative como lugar para inventar decisiones nuevas. Si el docente atiende a un grado o subgrupo, precisa en grouping y en las filas de los demás grados qué hacen simultáneamente, con recursos, registro y apoyo para avanzar sin otro docente. No impongas rotaciones cuando todo el grupo trabaja junto. Comprueba propósito → acción del alumnado → output → evidencia → insumo de la siguiente actividad o sesión; no introduzcas apuntes, reglamentos, carteles ni exposiciones ajenos al problema, PDA y artefactos aprobados. En connection nombra el insumo concreto y su uso siguiente o cierre terminal, sin repetir fórmulas vacías como Este avance se incorpora a, Se conserva como parte de o vincular este trabajo con. La trazabilidad técnica queda en los IDs; una frase de vinculación no demuestra pertinencia. No copies ejemplos ni repitas mecánicamente un mismo párrafo entre actividades.';
export const TEACHER_EXECUTION_INSTRUCTION=TEACHER_NARRATIVE_INSTRUCTION+' Cada actividad debe ser ejecutable sin completar pasos: execution.preparation indica qué prepara el docente; instruction contiene la consigna concreta; student_steps son acciones ordenadas; grouping indica cómo se organiza el grupo; guidance contiene preguntas guía o modelado concreto cuando haga falta; resource_use explica el uso de cada recurso autorizado; contingency indica qué hace el docente si el alumno no avanza; connection explica el uso de la evidencia en la actividad siguiente o el cierre terminal. Conserva en teacher_role la intervención durante la actividad, en grade_participation la diferenciación real por grado, y en output/evidence/assessment_criteria el resultado y criterio observable. No uses títulos, frases genéricas, texto duplicado ni relleno como procedimiento. No inventes recursos, PDA, artefactos ni LTG. Para OPTIONAL pertinente registra ltg_decisions USE o NOT_RECOMMENDED con motivo concreto; si usas CORE o SUPPORT registra USE, sin forzar su repetición en cada sesión con el mismo PDA; CORE debe tener uso concreto al menos una vez en el grafo donde curricularmente corresponda; SUPPORT puede usarse cuando fortalezca una actividad, sin forzarlo en cada sesión. OPTIONAL exige uso concreto o motivo explícito por sesión. Cada ltg_use indica project_id, activity_id seleccionada y verificada (null sólo si selection.activity_ids está vacío), student_action, moment y purpose; libro/grado/páginas se resuelven exclusivamente del currículo. ltg_activity_ids debe coincidir con las actividades verificadas usadas.';

export const SESSION_GRAPH_AUTHORING_PREFLIGHT=Object.freeze({
 teacher_executability:TEACHER_EXECUTION_INSTRUCTION,
 worked_policy:'Para cada PDA seleccionado intenta diseñar una sola actividad auténticamente WORKED en todo el grafo; las demás movilizaciones deben ser DEVELOPING. WORKED exige que student_action de ESA MISMA actividad ejecute literalmente todos los componentes sustantivos y la finalidad del PDA. No basta repetir o conjugar los verbos del PDA ni describir un resultado como ya propuesto, investigado o compartido. Para indagación debe nombrar fuente/observación/consulta concreta, procesamiento o contraste, registro trazable y, si la finalidad lo exige, una acción explícita de compartir/explicar/comunicar la importancia. La fuente o consulta debe tratar los objetos sustantivos nombrados por el PDA, no un tema adyacente que luego sólo mencione el PDA en otra cláusula. Para explicar+proponer debe existir una acción explícita de explicar Y otra de proponer un acuerdo concreto; frases de propósito como “con la intención de proponer”, “para proponer” o “con miras a proponer” NO ejecutan la propuesta. Si falta una parte, usa DEVELOPING; nunca heredes componentes de otra actividad.',
 methodology_links:'Para CADA methodology_operation enlazada, compara la acción local con METHODOLOGY_OPERATION_SEMANTICS[operation].required y rechaza cualquier caso que sólo cumpla not_enough. RECONOCIMIENTO exige una acción observable de reconocer, identificar, comparar, revisar o detectar hallazgos, relaciones, dificultades, criterios, diferencias, avances o necesidades de ajuste; preparar, ordenar o producir sin esa revisión no basta. DIFUSION debe estar en la actividad que realmente comunica/presenta/explica ante audiencia real; no en montaje, traslado o planeación de ruta. COMPRENSION_Y_PRODUCCION debe estar en la actividad que comprende/procesa Y produce/construye en esa misma actividad.',
 functional_links:'Para CADA functional_requirement_id enlazado, la misma actividad debe ejecutar concretamente el criterio y producir o registrar la evidencia pertinente dentro de una etapa autorizada. No agrupes requisitos por pertenecer al mismo producto. at_least_two_viable_spaces_or_audiences sólo puede enlazarse donde la actividad realmente presenta/actúa en dos espacios o audiencias, no donde sólo planea una ruta. circulation_evidence sólo donde se registra circulación ya realizada. Montaje, explicación, mediación, movimiento y reinstalación son afirmaciones distintas y requieren acción/evidencia local.',
 contribution_links:'Regla mecánica sin excepciones: contributes_to_artifact_ids no vacío => contribution_mode DIRECT. contribution_mode COMPLEMENTARY => contributes_to_artifact_ids vacío y una actividad posterior de ESA MISMA sesión incluye activity_key en input_refs. Un output que sea sólo análisis, notas, selección, esquema preliminar o preparación es COMPLEMENTARY salvo que el artefacto esperado del Blueprint sea precisamente ese análisis/plan. Si una actividad produce, monta, media, mueve, reinstala o registra circulación y deja un componente observable del artefacto esperado, debe ser DIRECT.',
 deterministic_contract:'Antes de devolver, verifica literalmente: (1) minutos totales por sesión <= minutes_per_session; (2) cada operación metodológica de la sesión aparece en actividad que cumple su semántica required y no sólo not_enough; (3) recursos/apoyos exactamente autorizados; (4) DIRECT implica artefacto no vacío; (5) COMPLEMENTARY implica artefacto vacío y consumidor posterior; (6) cada artefacto esperado tiene DIRECT; (7) sin dependencias futuras; (8) requisitos dentro de stage_ids; (9) no enlaces un requisito a una actividad que sólo prepara su ejecución posterior; (10) toda fila WORKED pasa el preflight determinista local: indagación exige fuente/consulta, procesamiento/contraste y registro; las finalidades de compartir/proponer y la acción de explicar deben aparecer explícitamente cuando el PDA oficial las exige.'
});

export const SESSION_GRAPH_AUTHORING_INSTRUCTION=`${TEACHER_EXECUTION_INSTRUCTION}\n\nConvierte el ProjectBlueprint aprobado en actividades ejecutables sin cambiar problema, pregunta, metodología, PDA, producto, etapas, estados, artefactos ni operaciones. Mantén una cadena input→acción del alumnado→output→evidencia→criterio. Aplica sin excepciones: contributes_to_artifact_ids.length>0 => contribution_mode=DIRECT; contribution_mode=COMPLEMENTARY => contributes_to_artifact_ids=[] y una actividad posterior de la misma sesión consume activity_key mediante input_refs. DIRECT significa que el output YA ES un componente observable del artefacto esperado; análisis, notas, selección, bosquejo, ensayo o preparación que sólo sirven a una actividad posterior son COMPLEMENTARY, salvo que el artefacto esperado del Blueprint sea exactamente ese tipo de producto. Si la actividad ejecuta un requisito constitutivo y deja resultado observable del artefacto, debe ser DIRECT.

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


const executionText=()=>({type:'string',minLength:1,maxLength:2000});
export function teacherExecutionSchema(){
 const t=executionText;
 return {type:'object',additionalProperties:false,required:['preparation','instruction','student_steps','grouping','guidance','resource_use','contingency','connection'],properties:{
 preparation:t(),instruction:t(),student_steps:{type:'array',minItems:1,maxItems:8,items:t()},grouping:t(),guidance:{type:'array',maxItems:8,items:t()},
 resource_use:{type:'array',maxItems:20,items:{type:'object',additionalProperties:false,required:['resource','use'],properties:{resource:t(),use:t()}}},contingency:t(),connection:t()
 }};
}
export const ltgUseSchema=()=>({type:'object',additionalProperties:false,required:['project_id','activity_id','student_action','moment','purpose'],properties:{project_id:executionText(),activity_id:{anyOf:[executionText(),{type:'null'}]},student_action:executionText(),moment:executionText(),purpose:executionText()}});
export const ltgDecisionSchema=()=>({type:'object',additionalProperties:false,required:['project_id','decision','reason'],properties:{project_id:executionText(),decision:{type:'string',enum:['USE','NOT_RECOMMENDED']},reason:executionText()}});
const GENERIC_EXECUTION=/^(registro de rutinas|diseno de plantillas|trabajo colaborativo|reflexion colectiva|modelado de listas|realizan la actividad curricular especifica de su bloque|modela|facilita|observa|comparan situaciones|indaga|explica|organiza|escribe|dibuja|participa adecuadamente|comprende claramente|sin apoyo|no aplica|segun sea necesario|orientar|orientare|orienta|apoyar|apoyare|apoya|supervisar|supervisare|supervisa)$/;
// Negative cases only: attention labels and bare assistance claims, not allowed verbs.
const GENERIC_ATTENTION_TITLE=/^(apoyo(?: tecnico)?|tutoria|supervision|orientacion)(?:\s+(?:a\s+|de\s+)?[1-6 .º°,y]+)?$/;
const GENERIC_TEACHER_TASK=/^(orient(?:ar|are|a)|apoy(?:ar|are|a)|supervis(?:ar|are|a))(?:\s+(?:a\s+)?(?:los\s+|las\s+)?(?:alumnos|alumnas|estudiantes)(?:\s+de)?(?:\s+[1-6]\s*[.º°o]*|\s*(?:y|,)\s*)*(?:\s+en\s+(?:el\s+uso|el\s+diseno|la\s+elaboracion|la\s+actividad|su\s+trabajo)(?:\s+[^,.;!?]+)?)?|\s+el\s+diseno(?:\s+[^,.;!?]+)?)?$/;
// Free-text sufficiency belongs to SGS-011, not a deterministic verb whitelist.
// Structure and known generic labels remain fail-closed.
export function teacherExecutabilityMissing(activity){
 const a=activity||{},e=a.execution,missing=schemaErrors(e,teacherExecutionSchema());
 const concrete=(value,label)=>{const n=normalized(value).trim().replace(/[.!;]+$/,'');if(!n||GENERIC_EXECUTION.test(n)||(label==='common_student_action'||label.startsWith('execution.student_steps')||/^grade_\d+\.student_action$/.test(label))&&GENERIC_TEACHER_TASK.test(n))missing.push(label);};
 if(GENERIC_ATTENTION_TITLE.test(normalized(a.title).trim()))missing.push('title.teacher_attention_only');
 if(!e||schemaErrors(e,teacherExecutionSchema()).length)return missing;
 for(const key of ['preparation','instruction','contingency','connection'])concrete(e[key],`execution.${key}`);
 for(const [i,step] of (Array.isArray(e.student_steps)?e.student_steps:[]).entries())concrete(step,`execution.student_steps[${i}]`);
 if(new Set((e.student_steps||[]).map(normalized)).size!==(e.student_steps||[]).length)missing.push('execution.repeated_steps');
 if(!/\b(grupo|pareja|equip|individual|plenaria|circulo|grado|turno)/.test(normalized(e.grouping)))missing.push('execution.grouping');
 for(const row of e.resource_use||[])if(!(a.resources||[]).includes(row.resource))missing.push('execution.unauthorized_resource');else concrete(row.use,'execution.resource_use');
 for(const resource of a.resources||[])if(!(e.resource_use||[]).some(row=>row.resource===resource))missing.push('execution.missing_resource_use');
 concrete(a.common_student_action,'common_student_action');concrete(a.teacher_role,'teacher_role');
 if(/\b(model|ejempl|pregunt)/.test(normalized(a.teacher_role))&&!e.guidance.length)missing.push('execution.guidance_required');
 if((a.grade_participation||[]).length>1&&new Set(a.grade_participation.map(g=>normalized(g.student_action)+'|'+normalized(g.differentiation))).size===1)missing.push('grade_differentiation_identical');
 for(const g of a.grade_participation||[]){concrete(g.student_action,`grade_${g.grade}.student_action`);if(GENERIC_EXECUTION.test(normalized(g.differentiation)))missing.push(`grade_${g.grade}.differentiation`);}
 for(const criterion of a.assessment_criteria||[])if(GENERIC_EXECUTION.test(normalized(criterion)))missing.push('assessment_criteria');
 return missing;
}

export function ltgExecutionErrors(sessions,source){
 const errors=[],selections=source.blueprint.ltg_strategy.selections||[],catalog=new Map((source.curriculum.ltg||[]).map(p=>[p.project_id,p]));
 const selectionMap=new Map(selections.map(p=>[p.project_id,p]));
 for(const session of sessions){
  const focus=source.blueprint.session_progression.find(s=>s.session_number===session.session_number)?.pda_focus||[];
  const uses=(session.activities||[]).flatMap(a=>(a.ltg_use||[]).map(use=>({a,use})));
  const decisions=session.ltg_decisions||[];
  if(selections.length&&!Array.isArray(session.ltg_decisions))errors.push('SGD-013 LTG decisions array required');
  for(const a of session.activities||[])if(!Array.isArray(a.ltg_use))errors.push('SGD-013 concrete LTG use array required');
  if(new Set(decisions.map(d=>d.project_id)).size!==decisions.length)errors.push('SGD-013 duplicate LTG decision');
  for(const {a,use} of uses){
   errors.push(...schemaErrors(use,ltgUseSchema()).map(e=>'SGD-013 '+e));
   const sel=selectionMap.get(use.project_id),project=catalog.get(use.project_id);
   if(!sel||!project||!(a.grade_participation||[]).some(g=>g.grade===project.grade)||!sel.pda_ids.some(id=>focus.includes(id)&&project.verified_pda_links.includes(id)))errors.push('SGD-013 LTG use without verified grade/PDA link');
   if(use.activity_id===null&&(sel?.activity_ids||[]).length)errors.push('SGD-013 selected LTG activity required');
   if(use.activity_id!==null&&(!sel?.activity_ids.includes(use.activity_id)||!project?.verified_activities.some(x=>x.activity_id===use.activity_id&&x.verification_status==='verified')))errors.push('SGD-013 unverified LTG activity');
   if(GENERIC_EXECUTION.test(normalized(use.student_action)))errors.push('SGD-013 generic LTG use');
  }
  for(const a of session.activities||[]){const actual=(a.ltg_use||[]).map(u=>u.activity_id).filter(id=>id!==null);if(actual.length!==(a.ltg_activity_ids||[]).length||actual.some(id=>!a.ltg_activity_ids.includes(id)))errors.push('SGD-013 LTG IDs without concrete use');}
  for(const d of decisions){errors.push(...schemaErrors(d,ltgDecisionSchema()).map(e=>'SGD-013 '+e));if(!selectionMap.has(d.project_id)||!d.reason?.trim()||GENERIC_EXECUTION.test(normalized(d.reason)))errors.push('SGD-013 invalid LTG decision');if((d.decision==='USE')!==uses.some(x=>x.use.project_id===d.project_id))errors.push('SGD-013 LTG decision/use mismatch');}
  for(const sel of selections){
   if(!sel.pda_ids.some(id=>focus.includes(id)))continue;
   const d=decisions.find(d=>d.project_id===sel.project_id);
   const used=uses.some(x=>x.use.project_id===sel.project_id);
   if(!d&&(sel.role==='OPTIONAL'||used))errors.push(`SGD-013 ${sel.role} requires explicit session LTG decision`);
  }
 }
 for(const sel of selections)if(sel.role==='CORE'&&!sessions.some(s=>s.activities.some(a=>(a.ltg_use||[]).some(u=>u.project_id===sel.project_id))))errors.push('SGD-013 CORE disappeared');
 return errors;
}
export function resolveLtgUse(use,curriculum){
 const project=(curriculum.ltg||[]).find(p=>p.project_id===use.project_id);
 if(!project)throw Error('SGD-013 LTG source missing');
 const activity=use.activity_id===null?null:project.verified_activities.find(a=>a.activity_id===use.activity_id&&a.verification_status==='verified');
 if(use.activity_id!==null&&!activity)throw Error('SGD-013 LTG activity missing');
 return {...structuredClone(use),reference:{book:project.book,project:project.name,grade:project.grade,pages:activity?{start:activity.page_start,end:activity.page_end}:structuredClone(project.pages),verified_activity:activity?structuredClone(activity):null}};
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
 const activity={type:'object',additionalProperties:false,required:['execution','ltg_use','activity_key','title','contribution_mode','contribution_rationale','common_student_action','grade_participation','teacher_role','resources','supports','minutes','input_refs','output','contributes_to_artifact_ids','methodology_operations','functional_requirement_ids','ltg_activity_ids','evidence','assessment_criteria'],properties:{
  execution:teacherExecutionSchema(),ltg_use:arr(ltgUseSchema()),activity_key:str(120),title:str(240),contribution_mode:{type:'string',enum:[...CONTRIBUTION_MODES]},contribution_rationale:str(1200),common_student_action:str(2000),
  grade_participation:{type:'array',minItems:1,maxItems:constraints.grades.length,items:gradeParticipation},teacher_role:str(1200),
  resources:arr({type:'string',enum:[...(constraints.available_resources||[])]}),supports:arr({type:'string',enum:[...(constraints.supports||[])]}),minutes:{type:'integer',minimum:1,maximum:constraints.minutes_per_session},
  input_refs:arr(str(160)),output:str(2000),contributes_to_artifact_ids:arr({type:'string',enum:blueprint.project_stages.map(s=>s.output_artifact_id)}),methodology_operations:arr({type:'string',enum:ops}),
  functional_requirement_ids:arr({type:'string',enum:reqIds}),ltg_activity_ids:arr({type:'string',enum:ltgIds}),evidence:str(2000),assessment_criteria:{type:'array',minItems:1,maxItems:8,items:str(1200)}
 }};
 const session={type:'object',additionalProperties:false,required:['session_number','activities',...(ltgIds.length||blueprint.ltg_strategy.selections.length?['ltg_decisions']:[])],properties:{ltg_decisions:arr(ltgDecisionSchema()),session_number:{type:'integer',enum:blueprint.session_progression.map(s=>s.session_number)},activities:{type:'array',minItems:1,maxItems:8,items:activity}}};
 return {type:'object',additionalProperties:false,required:['authoring_version','sessions'],properties:{authoring_version:{type:'string',enum:[SESSION_GRAPH_PROPOSAL_VERSION]},sessions:{type:'array',minItems:blueprint.session_progression.length,maxItems:blueprint.session_progression.length,items:session}}};
}

export function providerAuthoringShapeSchema(source){return projectShape(sessionGraphAuthoringSchema(source));}
function projectShape(n){const o={};if(n.anyOf){o.type=n.anyOf.map(child=>child.type);return o;}if(n.type!==undefined)o.type=n.type;if(n.properties){o.properties={};for(const [k,v] of Object.entries(n.properties))o.properties[k]=projectShape(v);o.required=[...(n.required||[])];}if(n.items)o.items=projectShape(n.items);return o;}

export function normalizeSessionGraphAuthoring(proposal,source,previousProposal=null){
 const copy=structuredClone(proposal);
 if(!Array.isArray(copy.sessions))return copy;
 const {blueprint,curriculum}=source;
 const pdaById=new Map((curriculum.pdas||[]).map(p=>[p.pda_id,p]));
 const selections=new Map((blueprint.ltg_strategy.selections||[]).map(s=>[s.project_id,s]));
 const ltgCatalog=new Map((curriculum.ltg||[]).map(p=>[p.project_id,p]));
 const previousSessions=new Map((previousProposal?.sessions||[]).map(s=>[s.session_number,s]));
 for(const session of copy.sessions){
  const b=blueprint.session_progression.find(s=>s.session_number===session.session_number);
  const previousSession=previousSessions.get(session.session_number);
  const focus=new Set(b?.pda_focus||[]);
  const methods=new Set(b?.methodology_operations||[]);
  const artifacts=new Set(b?.expected_output_artifact_ids||[]);
  for(const activity of session.activities||[]){
   const previousActivity=(previousSession?.activities||[]).find(a=>a.activity_key===activity.activity_key);
   activity.methodology_operations=(activity.methodology_operations||[]).filter(op=>methods.has(op));
   activity.contributes_to_artifact_ids=(activity.contributes_to_artifact_ids||[]).filter(id=>artifacts.has(id));
   for(const grade of activity.grade_participation||[]){
    grade.pda_mobilization=(grade.pda_mobilization||[]).filter(m=>{
     const p=pdaById.get(m.pda_id);
     return !!p&&p.grade===grade.grade&&focus.has(m.pda_id);
    });
    const previousGrade=(previousActivity?.grade_participation||[]).find(g=>g.grade===grade.grade);
    for(const m of previousGrade?.pda_mobilization||[]){
     const p=pdaById.get(m.pda_id);
     if(p&&p.grade===grade.grade&&focus.has(m.pda_id)&&!grade.pda_mobilization.some(x=>x.pda_id===m.pda_id)){
      grade.pda_mobilization.push({pda_id:m.pda_id,status:'DEVELOPING'});
     }
    }
   }
   activity.ltg_use=(activity.ltg_use||[]).filter(use=>{
    const sel=selections.get(use.project_id),project=ltgCatalog.get(use.project_id);
    if(!sel||!project)return false;
    const gradeOk=(activity.grade_participation||[]).some(g=>g.grade===project.grade);
    const pdaOk=(sel.pda_ids||[]).some(id=>focus.has(id)&&(project.verified_pda_links||[]).includes(id));
    if(!gradeOk||!pdaOk)return false;
    if(use.activity_id===null)return !(sel.activity_ids||[]).length;
    return (sel.activity_ids||[]).includes(use.activity_id)&&(project.verified_activities||[]).some(v=>v.activity_id===use.activity_id&&v.verification_status==='verified');
   });
   activity.ltg_activity_ids=[...new Set(activity.ltg_use.map(u=>u.activity_id).filter(id=>id!==null))];
  }
  const usedProjects=new Set((session.activities||[]).flatMap(a=>(a.ltg_use||[]).map(u=>u.project_id)));
  session.ltg_decisions=(session.ltg_decisions||[])
   .filter(d=>selections.has(d.project_id))
   .map(d=>({...d,decision:usedProjects.has(d.project_id)?'USE':'NOT_RECOMMENDED'}));
 }
 return copy;
}

export function validateSessionGraphAuthoring(proposal,source){
 const schema=sessionGraphAuthoringSchema(source);const errors=schemaErrors(proposal,schema);
 const extra=(v,s,p='$')=>{if(Array.isArray(v)){if(s.maxItems!==undefined&&v.length>s.maxItems)errors.push(`${p}: maxItems`);v.forEach((x,i)=>extra(x,s.items,`${p}[${i}]`));return}if(v&&typeof v==='object'){for(const [k,x] of Object.entries(v))if(s.properties?.[k])extra(x,s.properties[k],`${p}.${k}`);return}if(typeof v==='string'&&s.maxLength!==undefined&&v.length>s.maxLength)errors.push(`${p}: maxLength ${s.maxLength}`);};
 extra(proposal,schema);
 const {blueprint,curriculum}=source;
 errors.push(...ltgExecutionErrors(Array.isArray(proposal?.sessions)?proposal.sessions:[],source));
 const stageByArtifact=new Map((blueprint.project_stages||[]).map(s=>[s.output_artifact_id,s.stage_id]));
 const authoredSessions=Array.isArray(proposal?.sessions)?proposal.sessions:[];
 for(const [sessionIndex,session] of authoredSessions.entries()){
  const activities=Array.isArray(session?.activities)?session.activities:[];
  for(let activityIndex=0;activityIndex<activities.length;activityIndex++){
   const activity=activities[activityIndex];
   const missing=teacherExecutabilityMissing(activity);if(missing.length)errors.push(`$.sessions[${sessionIndex}].${activity.activity_key}: SGD-017 teacher executability missing ${missing.join(',')}`);
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
