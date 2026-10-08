import {schemaFor} from './contracts.mjs';
import {BPS} from './catalog.mjs';
const str={type:'string'},strings={type:'array',items:str};
const status={type:'string',enum:['PASS','FAIL','NOT_EVALUABLE']};
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const array=items=>({type:'array',items});
export const REVIEW_SCHEMA=object({
 audit_version:{type:'string',enum:['LOCAL_EVIDENCE_V1']},
 pda_checks:array(object({pda_id:str,grade:{type:'integer'},contribution_ids:strings,stage_ids:strings,operation_quote:str,artifact_ids:strings,evidence_reason:str,bps004:status,bps005:status})),
 stage_checks:array(object({stage_id:str,operation_quote:str,artifact_id:str,criteria_quote:str,consumed_by:strings,outcome_link:str,bps007:status})),
 methodology_checks:array(object({operation_id:str,stage_ids:strings,operation_quote:str,artifact_ids:strings,evidence_reason:str,bps008:status})),
 findings:array(schemaFor('BlueprintGateV1').properties.semantic_findings.items),
});
export function localEvidenceInput(input){
 const b=input.blueprint;
 return {
  pda_units:input.curriculum.pdas.filter(p=>input.constraints.selected_pda_ids.includes(p.pda_id)).map(p=>({official_pda:p,analysis:b.pda_analysis.find(a=>a.pda_id===p.pda_id),own_grade_contributions:b.grade_contributions.filter(c=>c.grade===p.grade&&c.pda_ids.includes(p.pda_id))})),
  stage_chains:b.project_stages.map(s=>({...s,requirements:b.final_outcome.functional_requirements.filter(r=>r.stage_ids.includes(s.stage_id))})),
  required_methodology_operations:input.methodology.required_operations,
 };
}
// Aggregates explicit local judgements. Never infers pedagogy from verb keywords.
export function applyEvidenceAudit(input,output){
 const b=input.blueprint,stages=new Map(b.project_stages.map(s=>[s.stage_id,s]));
 const quoteValid=(ids,q)=>typeof q==='string'&&q.trim().length>0&&ids.some(id=>stages.get(id)?.student_operation.includes(q));
 const artifactsValid=(ids,artifacts)=>artifacts.length>0&&artifacts.every(id=>ids.some(s=>stages.get(s)?.output_artifact_id===id));
 const aggregate=(rule,units,checks,idKey,judge,validate)=>{
  const results=units.map(unit=>{
   const rows=(checks||[]).filter(c=>c[idKey]===unit[idKey]);
   if(rows.length!==1)return 'NOT_EVALUABLE';
   const c=rows[0];if(!['PASS','FAIL','NOT_EVALUABLE'].includes(c[judge]))return 'NOT_EVALUABLE';
   return c[judge]==='PASS'&&!validate(c,unit)?'NOT_EVALUABLE':c[judge];
  });
  const result=results.includes('FAIL')?'FAIL':results.includes('NOT_EVALUABLE')||!results.length?'NOT_EVALUABLE':'PASS';
  const previous=output.findings?.find(f=>f.rule_id===rule);
  // An existing FAIL can never be washed out by an audit summary PASS.
  return {rule_id:rule,severity:'CRITICAL',status:previous?.status==='FAIL'?'FAIL':result,scope:rule==='BPS-004'||rule==='BPS-005'?'pda_checks':rule==='BPS-007'?'stage_checks':'methodology_checks',observed:JSON.stringify(checks||[]),expected:BPS[rule]};
 };
 const pdaUnits=input.curriculum.pdas.filter(p=>input.constraints.selected_pda_ids.includes(p.pda_id));
 const validatePda=(c,p)=>{
  const detail={
   pda_id:p.pda_id,
   grade_match:c.grade===p.grade,
   contributions_present:c.contribution_ids.length>0,
   contributions_valid:c.contribution_ids.every(id=>b.grade_contributions.some(g=>g.contribution_id===id&&g.grade===p.grade&&g.pda_ids.includes(p.pda_id))),
   stages_valid:c.stage_ids.every(id=>stages.has(id)),
   quote_valid:quoteValid(c.stage_ids,c.operation_quote),
   artifacts_valid:artifactsValid(c.stage_ids,c.artifact_ids),
   evidence_reason_present:c.evidence_reason.trim().length>0
  };
  const valid=detail.grade_match&&detail.contributions_present&&detail.contributions_valid&&detail.stages_valid&&detail.quote_valid&&detail.artifacts_valid&&detail.evidence_reason_present;
  if(!valid)console.error('[BLUEPRINT_PDA_EVIDENCE_INVALID]',JSON.stringify(detail));
  return valid;
 };
 const findings=(output.findings||[]).filter(f=>!['BPS-004','BPS-005','BPS-007','BPS-008'].includes(f.rule_id));
 findings.push(aggregate('BPS-004',pdaUnits,output.pda_checks,'pda_id','bps004',validatePda),aggregate('BPS-005',pdaUnits,output.pda_checks,'pda_id','bps005',validatePda));
 findings.push(aggregate('BPS-007',b.project_stages,output.stage_checks,'stage_id','bps007',(c,s)=>quoteValid([s.stage_id],c.operation_quote)&&c.artifact_id===s.output_artifact_id&&c.criteria_quote.trim().length>0&&s.acceptance_criteria.some(a=>a.includes(c.criteria_quote))&&c.consumed_by.length>0&&c.consumed_by.every(id=>s.consumed_by.includes(id))&&c.outcome_link.trim().length>0));
 findings.push(aggregate('BPS-008',input.methodology.required_operations.map(operation_id=>({operation_id})),output.methodology_checks,'operation_id','bps008',(c,u)=>c.stage_ids.length>0&&c.stage_ids.every(id=>stages.get(id)?.methodology_operations.includes(u.operation_id))&&quoteValid(c.stage_ids,c.operation_quote)&&artifactsValid(c.stage_ids,c.artifact_ids)&&c.evidence_reason.trim().length>0));
 return findings;
}
export const EVIDENCE_INSTRUCTIONS=`Principio obligatorio: una declaración no constituye evidencia de su propio cumplimiento.
Antes de resumir hallazgos completa pda_checks para CADA PDA, stage_checks para CADA etapa y methodology_checks para CADA operación requerida. Cita fragmentos literales de student_operation y acceptance_criteria; no inventes citas. Evalúa cada regla independientemente: un mismo defecto puede fallar varias reglas.
BPS-004 LOCAL: PDA oficial completo -> acción cognitiva -> aportación DEL MISMO GRADO que posee ese PDA -> operación de ese grado en student_operation -> artefacto/evidencia. No transfieras a este grado la investigación de otro grado ni la intención global. Una aportación concreta que no realiza el desempeño falla BPS-004 aunque pda_analysis o el resto del proyecto lo prometa. Generaliza a explica, argumenta, propone, compara y cualquier desempeño, no a un verbo específico. BPS-005 contrasta evidencia del MISMO grado con ese desempeño.
BPS-007: por etapa sigue acción observable -> artefacto -> criterio/evidencia -> consumidor -> condición del resultado. Si expected_output promete algo que student_operation no produce, FAIL aunque exista output_artifact_id y orden correcto. Compara contradicciones entre intención y operación. No confundas el nombre de un artefacto con su realización.
BPS-008: por cada operación del catálogo identifica acción observable y resultado verificable, no uses metodología_operations como prueba. Reflexión no es intervención; difusión necesita comunicar a destinatarios; servicio requiere prestación; indagación requiere obtención/análisis de evidencia; presentación/aplicación debe realizarse. Una etapa puede realizar varias operaciones con una acción integrada viable: no exijas una sesión o artefacto separado por cada etiqueta. Si la acción explícitamente excluye el desempeño o sólo declara un resultado, FAIL. No apruebes por propósito futuro.
Si una condición no puede comprobarse, NOT_EVALUABLE; si está contradicha o ausente, FAIL. Cada cita debe ser literal de los datos originales. Para FAIL puedes dejar las citas/IDs que no existen vacíos, explica lo que falta. Devuelve el schema de revisión completo; no reescribas el Blueprint.`;
