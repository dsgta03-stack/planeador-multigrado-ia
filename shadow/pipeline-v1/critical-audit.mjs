import {deepFreeze,hash} from '../project-blueprint-v1/contracts.mjs';
import {METHODOLOGY_OPERATION_SEMANTICS} from '../session-graph-v1/catalog.mjs';

export const SESSION_CRITICAL_AUDIT_VERSION='SESSION_CRITICAL_CLAIMS_AUDIT_V1';
export const SESSION_CRITICAL_GATE_VERSION='SESSION_CRITICAL_GATE_V1';

const activityRows=graph=>graph.sessions.flatMap(session=>session.activities.map(activity=>({session,activity})));

export function buildCriticalClaimsInput({blueprint,graph,curriculum}){
 const pdaById=new Map((curriculum.pdas||[]).map(p=>[p.pda_id,p]));
 const reqById=new Map((blueprint.final_outcome?.functional_requirements||[]).map(r=>[r.requirement_id,r]));
 const worked=[];const methodology_links=[];const functional_links=[];
 for(const {session,activity} of activityRows(graph)){
  for(const g of activity.grade_participation||[])for(const m of g.pda_mobilization||[])if(m.status==='WORKED'){
   const p=pdaById.get(m.pda_id);
   worked.push({activity_id:activity.activity_id,session_number:session.session_number,grade:g.grade,pda_id:m.pda_id,official_pda:p?.pda_official||'',student_action:g.student_action,evidence:g.evidence,activity_evidence:activity.evidence,assessment_criteria:[...activity.assessment_criteria]});
  }
  for(const operation of activity.methodology_operations||[])methodology_links.push({operation,semantics:METHODOLOGY_OPERATION_SEMANTICS[operation]||null,activity_id:activity.activity_id,session_number:session.session_number,title:activity.title,common_student_action:activity.common_student_action,grade_actions:(activity.grade_participation||[]).map(g=>({grade:g.grade,student_action:g.student_action})),output:activity.output,evidence:activity.evidence});
  for(const requirement_id of activity.functional_requirement_ids||[]){
   const r=reqById.get(requirement_id);
   functional_links.push({requirement_id,requirement:{criterion:r?.criterion||'',evidence:r?.evidence||'',stage_ids:[...(r?.stage_ids||[])]},activity_id:activity.activity_id,session_number:session.session_number,stage_ids:[...session.stage_ids],title:activity.title,common_student_action:activity.common_student_action,grade_actions:(activity.grade_participation||[]).map(g=>({grade:g.grade,student_action:g.student_action,evidence:g.evidence})),output:activity.output,evidence:activity.evidence});
  }
 }
 return deepFreeze({audit_version:SESSION_CRITICAL_AUDIT_VERSION,worked,methodology_links,functional_links});
}

export const SESSION_CRITICAL_AUDIT_INSTRUCTION=`Audita únicamente afirmaciones semánticas críticas del SessionGraph y hazlo vínculo por vínculo. No repares ni reescribas. No infieras acciones ausentes, no uses título/rationale/status como evidencia y no permitas heredar una acción de otra actividad.

WORKED. Trata el PDA oficial como conjunción de todos sus componentes sustantivos. Una fila WORKED es PASS sólo si student_action DE ESA MISMA ACTIVIDAD ejecuta todos. Repetir o conjugar verbos del PDA no basta. Para explicar+proponer debe existir una acción explícita de explicar una situación y otra de proponer un acuerdo concreto; frases como “con intención de proponer”, “acuerdos acordados” o “acuerdos prioritarios” sin propuesta ejecutada son FAIL. Para indagar+compartir importancia debe existir en la misma actividad: fuente/observación/consulta concreta, procesamiento o contraste de información, registro trazable y una acción explícita de compartir/explicar/comunicar la importancia. Decir sólo “indaga”, “consulta fuentes”, “organiza información” o “comparte su importancia” sin esas operaciones observables es FAIL. Copia fragmentos literales de student_action para cada componente satisfecho.

METODOLOGÍA. Evalúa cada vínculo activity_id→operation localmente usando claim.semantics como contrato. PASS exige evidencia literal de que la acción satisface semantics.required y NO se limita a semantics.not_enough. Una cita que sólo demuestra not_enough obliga a FAIL. En particular, COMPRENSION_Y_PRODUCCION requiere comprensión/procesamiento Y producción/construcción real en la misma actividad; sólo revisar, analizar o comprender es FAIL. DIFUSION requiere comunicar, presentar o explicar a una audiencia real en la misma actividad; montar piezas, trasladarlas, diseñar una ruta, ensayar o preparar una presentación es FAIL. CONSIDERACIONES requiere considerar resultados/comentarios/dificultades o efectos; AVANCES requiere comparar, registrar o explicar avances/cambios/pendientes con evidencia. No concedas PASS porque la etiqueta de la operación sea correcta.

REQUISITOS FUNCIONALES. Evalúa cada vínculo activity_id→requirement_id localmente. La actividad debe ejecutar el criterio y producir evidencia pertinente en etapa autorizada. at_least_two_viable_spaces_or_audiences sólo es PASS donde la actividad usa/presenta realmente en al menos dos espacios o audiencias; planear una ruta o mencionar dos lugares es FAIL. circulation_evidence exige que la circulación ya haya ocurrido y que la actividad produzca su registro; anticiparla es FAIL. movement exige desplazamiento real; relocation_or_reinstallation exige reinstalación real; mediation exige interacción explicativa real con visitantes; mounting exige montaje físico; piece_explanation exige explicación real de piezas. selection_criteria no es pieces y un requisito completado después no vuelve verdadero un vínculo local falso.

Toda cita de una fila PASS debe ser literal y contigua en los campos del claim recibido: student_action para WORKED; common_student_action o grade_actions.student_action para metodología y acción funcional; output, evidence o grade_actions.evidence para evidencia funcional. No inventes ni parafrasees citas. Devuelve una fila por cada claim recibido con los mismos identificadores y status=FAIL ante cualquier componente sustantivo ausente.`;

export const criticalAuditResponseShape={
 type:'object',properties:{
  input_hash:{type:'string'},
  worked_audits:{type:'array',items:{type:'object',properties:{activity_id:{type:'string'},grade:{type:'integer'},pda_id:{type:'string'},status:{type:'string'},component_checks:{type:'array',items:{type:'object',properties:{component:{type:'string'},satisfied:{type:'boolean'},exact_quote:{type:'string'}},required:['component','satisfied','exact_quote']}},reason:{type:'string'}},required:['activity_id','grade','pda_id','status','component_checks','reason']}},
  methodology_link_audits:{type:'array',items:{type:'object',properties:{operation:{type:'string'},activity_id:{type:'string'},status:{type:'string'},exact_quote:{type:'string'},reason:{type:'string'}},required:['operation','activity_id','status','exact_quote','reason']}},
  functional_link_audits:{type:'array',items:{type:'object',properties:{requirement_id:{type:'string'},activity_id:{type:'string'},status:{type:'string'},action_quote:{type:'string'},evidence_quote:{type:'string'},reason:{type:'string'}},required:['requirement_id','activity_id','status','action_quote','evidence_quote','reason']}}
 },required:['input_hash','worked_audits','methodology_link_audits','functional_link_audits']
};

export function buildCriticalClaimsReviewRequest(input){
 const claims=buildCriticalClaimsInput(input);
 const input_hash=hash({blueprint:input.blueprint,graph:input.graph,claims});
 return deepFreeze({audit_version:SESSION_CRITICAL_AUDIT_VERSION,input_hash,instruction:SESSION_CRITICAL_AUDIT_INSTRUCTION,claims,output_contract:{input_hash:'repeat exact input_hash',worked_audits:'exactly one row per worked claim',methodology_link_audits:'exactly one row per methodology link; PASS requires literal action satisfying claim.semantics.required and not merely claim.semantics.not_enough',functional_link_audits:'exactly one row per functional requirement link'}});
}

const keyWorked=x=>`${x.activity_id}|${x.grade}|${x.pda_id}`;
const keyMethod=x=>`${x.activity_id}|${x.operation}`;
const keyFunctional=x=>`${x.activity_id}|${x.requirement_id}`;
const exactRows=(expected,actual,key)=>{
 if(!Array.isArray(actual)||actual.length!==expected.length)return false;
 const e=new Set(expected.map(key));const a=actual.map(key);return a.length===new Set(a).size&&a.every(k=>e.has(k));
};
const nonEmpty=s=>typeof s==='string'&&s.trim().length>0;
const literalIn=(quote,texts)=>nonEmpty(quote)&&texts.some(text=>typeof text==='string'&&text.includes(quote));
const actionTexts=claim=>[claim?.common_student_action,...(claim?.grade_actions||[]).map(g=>g.student_action)];
const evidenceTexts=claim=>[claim?.output,claim?.evidence,...(claim?.grade_actions||[]).map(g=>g.evidence)];
const validWorked=(row,claim)=>{
 if(!['PASS','FAIL'].includes(row.status)||typeof row.reason!=='string'||!Array.isArray(row.component_checks)||row.component_checks.length===0)return false;
 for(const c of row.component_checks){
  if(typeof c.component!=='string'||typeof c.satisfied!=='boolean'||typeof c.exact_quote!=='string')return false;
  if(c.satisfied&&!literalIn(c.exact_quote,[claim.student_action]))return false;
 }
 if(row.status==='PASS')return row.component_checks.every(c=>c.satisfied&&literalIn(c.exact_quote,[claim.student_action]));
 return row.component_checks.some(c=>c.satisfied===false);
};
const validMethod=(row,claim)=>{
 if(!['PASS','FAIL'].includes(row.status)||typeof row.exact_quote!=='string'||typeof row.reason!=='string')return false;
 if(row.status==='PASS')return literalIn(row.exact_quote,actionTexts(claim));
 return !nonEmpty(row.exact_quote)||literalIn(row.exact_quote,actionTexts(claim));
};
const validFunctional=(row,claim)=>{
 if(!['PASS','FAIL'].includes(row.status)||typeof row.action_quote!=='string'||typeof row.evidence_quote!=='string'||typeof row.reason!=='string')return false;
 if(row.status==='PASS')return literalIn(row.action_quote,actionTexts(claim))&&literalIn(row.evidence_quote,evidenceTexts(claim));
 const actionOk=!nonEmpty(row.action_quote)||literalIn(row.action_quote,actionTexts(claim));
 const evidenceOk=!nonEmpty(row.evidence_quote)||literalIn(row.evidence_quote,evidenceTexts(claim));
 return actionOk&&evidenceOk;
};

export function criticalClaimsGate(input,audit=null){
 const request=buildCriticalClaimsReviewRequest(input),claims=request.claims;
 const findings=[];const add=(claim_type,key,status,observed,expected)=>findings.push({claim_type,key,severity:'CRITICAL',status,observed,expected});
 if(!audit||audit.input_hash!==request.input_hash){add('audit','binding','NOT_EVALUABLE','Critical audit missing or bound to another graph','Exact critical audit input hash');return deepFreeze({gate_version:SESSION_CRITICAL_GATE_VERSION,status:'NOT_EVALUABLE',critical_count:0,input_hash:request.input_hash,evaluated_graph_hash:hash(input.graph),findings});}
 const groups=[
  {type:'WORKED',expected:claims.worked,actual:audit.worked_audits,key:keyWorked,valid:validWorked},
  {type:'METHODOLOGY_LINK',expected:claims.methodology_links,actual:audit.methodology_link_audits,key:keyMethod,valid:validMethod},
  {type:'FUNCTIONAL_LINK',expected:claims.functional_links,actual:audit.functional_link_audits,key:keyFunctional,valid:validFunctional}
 ];
 for(const group of groups){
  if(!exactRows(group.expected,group.actual,group.key)){add(group.type,'coverage','NOT_EVALUABLE','Missing, duplicated or foreign audit rows','Exactly one audit row per critical claim');continue;}
  const expectedByKey=new Map(group.expected.map(row=>[group.key(row),row]));
  for(const row of group.actual){const key=group.key(row),claim=expectedByKey.get(key);const valid=group.valid(row,claim);const status=!valid?'NOT_EVALUABLE':row.status;const reason=valid?(row.reason||'Critical claim evaluated'):'Audit row is malformed or its claimed literal evidence is not present in the local claim';add(group.type,key,status,reason,'Critical semantic claim must be locally true and any PASS quote must be literal evidence from this exact claim');}
 }
 const failed=findings.some(x=>x.status==='FAIL'),incomplete=findings.some(x=>x.status==='NOT_EVALUABLE');
 return deepFreeze({gate_version:SESSION_CRITICAL_GATE_VERSION,status:failed?'FAIL':incomplete?'NOT_EVALUABLE':'PASS',critical_count:findings.filter(x=>x.status==='FAIL').length,input_hash:request.input_hash,evaluated_graph_hash:hash(input.graph),findings});
}

export function approvePipelineSessionGraph(input,sessionGraphApproval,criticalGate){
 const graph_hash=hash(input.graph),blueprint_hash=hash(input.blueprint);
 if(!sessionGraphApproval||sessionGraphApproval.status!=='APPROVED'||sessionGraphApproval.approved_graph_hash!==graph_hash||sessionGraphApproval.approved_blueprint_hash!==blueprint_hash)throw Error('PIPELINE_SESSION_BASE_APPROVAL_INVALID');
 if(!criticalGate||criticalGate.gate_version!==SESSION_CRITICAL_GATE_VERSION||criticalGate.status!=='PASS'||criticalGate.evaluated_graph_hash!==graph_hash)throw Error('PIPELINE_SESSION_CRITICAL_GATE_NOT_PASS');
 return deepFreeze({approval_version:'PIPELINE_SESSION_APPROVAL_V1',status:'APPROVED',graph_hash,approved_graph_hash:graph_hash,approved_blueprint_hash:blueprint_hash,session_graph_gate_version:sessionGraphApproval.gate_version,critical_gate_version:criticalGate.gate_version,critical_audit_hash:hash(criticalGate)});
}
