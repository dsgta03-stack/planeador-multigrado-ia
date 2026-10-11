import {compileAuthoring} from './authoring-proposal.mjs';
import {compileConstruction} from './construction.mjs';
import {applyEvidenceAudit,stageReviewTelemetry} from './semantic-evidence.mjs';
import {randomUUID} from 'node:crypto';
import {assertContract,hash,deepFreeze,sourceBinding} from './contracts.mjs';
import {blueprintGate,semanticInputHash,functionalDiagnostics} from './gate.mjs';
import {callProvider} from './provider.mjs';
import {assertProjectCompositionBinding,bindProjectCompositionToBlueprint} from '../project-composition-v1/blueprint-binding.mjs';
export function structuralDiff(a,b,path='$'){
 if(JSON.stringify(a)===JSON.stringify(b))return [];
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b))return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>structuralDiff(a[k],b[k],`${path}.${k}`));
 return [{changed_field:path,previous_value:a??null,new_value:b??null}];
}
export async function reviewBlueprint(input,options={},provider=callProvider){
 if(provider!==callProvider){const r=await provider('REVIEW',input,options);return {input_hash:semanticInputHash(input),findings:r.output.audit_version?applyEvidenceAudit(input,r.output):r.output.findings,audit:r.output.audit_version?r.output:null,telemetry:{...r.telemetry,...(r.output.audit_version?{stages_review:stageReviewTelemetry(r.output,r.telemetry)}:{})}}}
 const audit={audit_version:'LOCAL_EVIDENCE_V1'},calls=[];
 for(const reviewFocus of ['GLOBAL','PDA','STAGES','METHOD']){
  try{const r=await provider('REVIEW',input,{...options,reviewFocus});Object.assign(audit,r.output);calls.push({...r.telemetry,...(reviewFocus==='STAGES'?{stages_review:stageReviewTelemetry(r.output,r.telemetry)}:{})})}
  catch(e){e.telemetry={...e.telemetry,completed_review_calls:calls};throw e}
 }
 return {input_hash:semanticInputHash(input),findings:applyEvidenceAudit(input,audit),audit,telemetry:{task:'REVIEW',provider:'google',model:calls[0].model,prompt_version:calls[0].prompt_version,input_hash:semanticInputHash(input),output_hash:hash(audit),latency_ms:calls.reduce((n,c)=>n+c.latency_ms,0),calls}};
}
export function assertApproved(envelope){
 if(envelope.status!=='APPROVED'||envelope.gate.status!=='PASS'||hash(envelope.blueprint)!==envelope.approved_blueprint_hash||envelope.gate.evaluated_blueprint_hash!==envelope.approved_blueprint_hash)throw Error('APPROVED_BLUEPRINT_TAMPERED_OR_NOT_APPROVED');return true;
}
export async function generateShadow(sources,options={},provider=callProvider){
 if(Object.keys(sources).sort().join(',')!=='constraints,curriculum,methodology')throw Error('ONLY_SOURCE_ARTIFACTS_ALLOWED_NO_LEGACY_PLAN');
 for(const [name,key] of [['TeacherConstraintsV1','constraints'],['CurriculumSnapshotV1','curriculum'],['MethodologyDecisionV1','methodology']])assertContract(name,sources[key]);
 const frozen=deepFreeze(structuredClone(sources)),revisions=[],telemetry=[],errors=[],construction_attempts=[];const id=randomUUID();let repairCount=0,constructionRepair=null;
 const projectComposition=options.projectComposition?deepFreeze(structuredClone(options.projectComposition)):null;
 if(projectComposition){
  if(projectComposition.schema_version!=='PROJECT_COMPOSITION_V1')throw Error('PROJECT_COMPOSITION_V1_REQUIRED');
  const expectedCompositionSource=sourceBinding(frozen);
  const actualCompositionSource=projectComposition.source||{};
  for(const key of ['constraints_hash','curriculum_snapshot_hash','methodology_decision_id','methodology_decision_hash']){
   if(actualCompositionSource[key]!==expectedCompositionSource[key])throw Error(`PROJECT_COMPOSITION_SOURCE_MISMATCH:${key}`);
  }
 }
 for(let revision=1;revision<=2;revision++){
  const previous=revisions.at(-1);
  const semanticRepair=previous?{previous_blueprint:previous.blueprint,triggering_rules:[...previous.gate.deterministic_findings,...previous.gate.semantic_findings].filter(x=>x.status!=='PASS'),instruction:'Repara sólo el Blueprint. Conserva decisiones docentes, texto oficial, método y fuentes. No añadas frases para aparentar PASS.'}:null;
  const repair=constructionRepair||semanticRepair;constructionRepair=null;

  let r;try{r=await provider(revision===1?'GENERATE':'REPAIR',frozen,{...options,projectComposition,repair})}catch(e){
   errors.push({revision,task:revision===1?'GENERATE':'REPAIR',error:String(e),code:e.code||'PROVIDER_ERROR'});
   telemetry.push({...e.telemetry,task:revision===1?'GENERATE':'REPAIR',error:String(e),repair_count:repairCount});
   break; // Preserve prior revisions; transport failure is not a pedagogical rejection.
  }
  repairCount=revision-1;
  telemetry.push({...r.telemetry,repair_count:repairCount});
  let raw=structuredClone(r.output);
  if(options.constructionPlan){
   try{const built=options.authoringCompact?compileAuthoring(raw,frozen,options.constructionPlan,{blueprint_id:id,revision}):compileConstruction(raw,options.constructionPlan);construction_attempts.push({revision,status:'CONSTRUCTED',...built.record});raw=built.blueprint;}
   catch(e){
    construction_attempts.push({revision,status:'CONSTRUCTION_REJECTED',raw_proposal:raw,rule:e.rule||null,error:String(e)});
    const repairable=revision===1&&(e.code==='CONSTRUCTION_REJECTED'||e.code==='AUTHORING_CONTRACT_INVALID'||e.code==='AUTHORING_FIELD_EXCESSIVE_LENGTH'||String(e?.message||e)==='AUTHORING_EVIDENCE_REFERENCE_INVALID');
    if(repairable){constructionRepair={previous_authoring_proposal:structuredClone(raw),...(e.functional_profile_targets?{functional_profile_targets:structuredClone(e.functional_profile_targets)}:{}),triggering_rules:[{rule_id:e.rule||e.code||'AUTHORING_CONSTRUCTION',status:'FAIL',scope:'AUTHORING_CONSTRUCTION',observed:String(e),expected:'La propuesta de autoría debe superar sin excepciones el contrato y la construcción local estricta.'}],instruction:'Repara sólo la propuesta de autoría compacta que falló la construcción local. Corrige todas las incidencias reportadas sin alterar fuentes, plan de construcción ni decisiones no relacionadas. Para BPD-019 revisa TODAS las filas coverage contra la versión FINAL de project_stages. Toda coverage.action_quote que ya era válida en la propuesta anterior se considera inmutable: consérvala carácter por carácter como subcadena literal contigua dentro del student_operation final de su misma etapa. Si necesitas agregar una acción faltante, añádela sin reescribir ni cambiar puntuación o conjunciones de las citas válidas existentes. Sólo modifica una coverage.action_quote previamente inválida cuando sea necesario para que copie exactamente una subcadena literal contigua de la acción final. Antes de devolver la reparación verifica fila por fila que cada action_quote aparezca literalmente en su student_operation final y que cada evidence_ref siga apuntando a expected_output o acceptance_criteria de la misma etapa. No inventes evidencia, no relajes criterios y no cambies metadatos del compilador. Para BPD-019, cuando repares una cobertura inválida, conserva carácter por carácter como subcadena literal contigua cada coverage.action_quote que ya era válida en la propuesta anterior y mantenla dentro del student_operation de su mismo stage_id. Puedes reescribir libremente el resto del student_operation. Modifica únicamente las action_quote que eran inválidas o que deban citar una nueva acción añadida. Antes de responder, verifica todas las filas coverage contra los project_stages finales para confirmar que cada action_quote sigue siendo literal y contigua.'};continue;}
    errors.push({revision,task:'CONSTRUCT',code:e.code||'CONSTRUCTION_REJECTED',error:String(e)});break;
   }
  }
  // Envelope IDs are assigned by the orchestrator, never pedagogy or source fields.
  if(projectComposition){
   raw=bindProjectCompositionToBlueprint(
    raw,
    projectComposition,
    frozen
   );
  }
  const b={...raw,blueprint_id:id,revision,status:'DRAFT',gate_result:null};
  const input={...frozen,blueprint:b};let gate=blueprintGate(input),semantic=null,reviewUnavailable=false;
   if(projectComposition){
    try{
     assertProjectCompositionBinding(b,projectComposition,frozen);
    }catch(e){
     const bindingFinding={
      rule_id:'PCB-BINDING',
      severity:'CRITICAL',
      status:'FAIL',
      scope:'project_composition',
      observed:String(e?.message||e),
      expected:'El Blueprint debe conservar exactamente el proyecto central, outcome y uso operacional de LTG aprobados por PROJECT_COMPOSITION_V1.'
     };
     gate=deepFreeze({
      ...gate,
      status:'FAIL',
      critical_count:gate.critical_count+1,
      deterministic_findings:[
       ...gate.deterministic_findings,
       bindingFinding
      ]
     });
    }
   }
  // Full gate is rerun after semantic review. Invalid schema is never sent for review.
  if(!gate.deterministic_findings.some(x=>(options.constructionPlan||x.rule_id==='BPD-SCHEMA'||x.rule_id==='PCB-BINDING')&&x.status!=='PASS')){
   try{semantic=await reviewBlueprint(input,options,provider);telemetry.push({...semantic.telemetry,repair_count:revision-1})}catch(e){telemetry.push({...e.telemetry,task:'REVIEW',error:String(e),repair_count:revision-1});reviewUnavailable=true;errors.push({revision,task:'REVIEW',code:e.code||'PROVIDER_ERROR',error:String(e)})}
   gate=blueprintGate(input,semantic);
  }
  const status=reviewUnavailable?errors.at(-1).code:gate.status==='PASS'?'APPROVED':b.pda_analysis?.some(x=>['WEAK','INCOMPATIBLE'].includes(x.integration_strength))?'NEEDS_TEACHER_DECISION':revision===1?'NEEDS_REPAIR':gate.status==='NOT_EVALUABLE'?'NEEDS_REPAIR':'REJECTED';
  revisions.push({revision,label:reviewUnavailable?errors.at(-1).code:revision===1?(status==='APPROVED'?'PASS':'FAIL'):(status==='APPROVED'?'REPAIRED':'REPAIR_FAILED'),status,blueprint:b,gate,semantic,functional_diagnostics:b.final_outcome&&b.project_stages?functionalDiagnostics(b):[],diff:previous?structuralDiff(previous.blueprint,b):[],triggering_rules:repair?.triggering_rules.map(x=>x.rule_id)||[]});
  if(options.constructionPlan&&gate.deterministic_findings.some(f=>f.status!=='PASS'&&f.rule_id!=='PCB-BINDING'))break;
  if(reviewUnavailable||['APPROVED','NEEDS_TEACHER_DECISION'].includes(status))break;
 }
 const final=revisions.at(-1);
 if(final&&(final.status==='NEEDS_REPAIR'||final.gate?.status==='NOT_EVALUABLE')){
  const finding=final.gate?.semantic_findings.find(x=>x.rule_id==='BPS-007');
  let summary;try{if(final.semantic?.audit)summary=JSON.parse(finding?.observed||'null')}catch{}
  const stagesReview=final.semantic?.telemetry?.stages_review||final.semantic?.telemetry?.calls?.find(x=>x.review_focus==='STAGES')?.stages_review;
  console.error('[BLUEPRINT_BPS007_DIAGNOSTIC]',JSON.stringify({
   status:finding?.status??null,
   stage_diagnostics:Array.isArray(summary?.stage_diagnostics)?summary.stage_diagnostics.slice(0,24).map(x=>({
    stage_id:/^[a-z][a-z0-9_]{0,63}$/.test(x.stage_id)?x.stage_id:'REDACTED_STAGE_ID',
    status:x.status,reasons:x.reasons
   })):[],
   finish_reason:['STOP','MAX_TOKENS','SAFETY','RECITATION','OTHER'].includes(stagesReview?.finish_reason)?stagesReview.finish_reason:null,
   stage_checks_count:Number.isInteger(stagesReview?.stage_checks_count)&&stagesReview.stage_checks_count>=0?stagesReview.stage_checks_count:null,
   omitted_count:summary?.omitted_count??0
  }));
 }
 // Keep the evaluated DRAFT bytes immutable. Approval is an external envelope;
 // do not mutate the candidate to set gate_result/status after hashing/reviewing.
 return deepFreeze({mode:'SHADOW',status:errors.length?errors.at(-1).code:final.status,blueprint:final?.blueprint||null,gate:final?.gate||null,approved_blueprint_hash:!errors.length&&final?.status==='APPROVED'?hash(final.blueprint):null,revisions,telemetry,errors,construction_attempts,repair_count:repairCount});
}
