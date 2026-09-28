import {compileAuthoring} from './authoring-proposal.mjs';
import {compileConstruction} from './construction.mjs';
import {applyEvidenceAudit} from './semantic-evidence.mjs';
import {randomUUID} from 'node:crypto';
import {assertContract,hash,deepFreeze,sourceBinding} from './contracts.mjs';
import {blueprintGate,semanticInputHash,functionalDiagnostics} from './gate.mjs';
import {callProvider} from './provider.mjs';
export function structuralDiff(a,b,path='$'){
 if(JSON.stringify(a)===JSON.stringify(b))return [];
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b))return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>structuralDiff(a[k],b[k],`${path}.${k}`));
 return [{changed_field:path,previous_value:a??null,new_value:b??null}];
}
export async function reviewBlueprint(input,options={},provider=callProvider){
 if(provider!==callProvider){const r=await provider('REVIEW',input,options);return {input_hash:semanticInputHash(input),findings:r.output.audit_version?applyEvidenceAudit(input,r.output):r.output.findings,audit:r.output.audit_version?r.output:null,telemetry:r.telemetry}}
 const audit={audit_version:'LOCAL_EVIDENCE_V1'},calls=[];
 for(const reviewFocus of ['GLOBAL','PDA','STAGES','METHOD']){
  try{const r=await provider('REVIEW',input,{...options,reviewFocus});Object.assign(audit,r.output);calls.push(r.telemetry)}
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
 for(let revision=1;revision<=2;revision++){
  const previous=revisions.at(-1);
  const semanticRepair=previous?{previous_blueprint:previous.blueprint,triggering_rules:[...previous.gate.deterministic_findings,...previous.gate.semantic_findings].filter(x=>x.status!=='PASS'),instruction:'Repara sólo el Blueprint. Conserva decisiones docentes, texto oficial, método y fuentes. No añadas frases para aparentar PASS.'}:null;
  const repair=constructionRepair||semanticRepair;constructionRepair=null;

  let r;try{r=await provider(revision===1?'GENERATE':'REPAIR',frozen,{...options,repair})}catch(e){
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
    if(repairable){constructionRepair={previous_authoring_proposal:structuredClone(raw),triggering_rules:[{rule_id:e.rule||e.code||'AUTHORING_CONSTRUCTION',status:'FAIL',scope:'AUTHORING_CONSTRUCTION',observed:String(e),expected:'La propuesta de autoría debe superar sin excepciones el contrato y la construcción local estricta.'}],instruction:'Repara sólo la propuesta de autoría compacta que falló la construcción local. Corrige todas las incidencias reportadas sin alterar fuentes, plan de construcción ni decisiones no relacionadas. Para BPD-019 revisa TODAS las filas coverage contra la versión FINAL de project_stages. Toda coverage.action_quote que ya era válida en la propuesta anterior se considera inmutable: consérvala carácter por carácter como subcadena literal contigua dentro del student_operation final de su misma etapa. Si necesitas agregar una acción faltante, añádela sin reescribir ni cambiar puntuación o conjunciones de las citas válidas existentes. Sólo modifica una coverage.action_quote previamente inválida cuando sea necesario para que copie exactamente una subcadena literal contigua de la acción final. Antes de devolver la reparación verifica fila por fila que cada action_quote aparezca literalmente en su student_operation final y que cada evidence_ref siga apuntando a expected_output o acceptance_criteria de la misma etapa. No inventes evidencia, no relajes criterios y no cambies metadatos del compilador. Para BPD-019, cuando repares una cobertura inválida, conserva carácter por carácter como subcadena literal contigua cada coverage.action_quote que ya era válida en la propuesta anterior y mantenla dentro del student_operation de su mismo stage_id. Puedes reescribir libremente el resto del student_operation. Modifica únicamente las action_quote que eran inválidas o que deban citar una nueva acción añadida. Antes de responder, verifica todas las filas coverage contra los project_stages finales para confirmar que cada action_quote sigue siendo literal y contigua.'};continue;}
    errors.push({revision,task:'CONSTRUCT',code:e.code||'CONSTRUCTION_REJECTED',error:String(e)});break;
   }
  }
  // Envelope IDs are assigned by the orchestrator, never pedagogy or source fields.
  const b={...raw,blueprint_id:id,revision,status:'DRAFT',gate_result:null};
  const input={...frozen,blueprint:b};let gate=blueprintGate(input),semantic=null,reviewUnavailable=false;
  // Full gate is rerun after semantic review. Invalid schema is never sent for review.
  if(!gate.deterministic_findings.some(x=>(options.constructionPlan||x.rule_id==='BPD-SCHEMA')&&x.status!=='PASS')){
   try{semantic=await reviewBlueprint(input,options,provider);telemetry.push({...semantic.telemetry,repair_count:revision-1})}catch(e){telemetry.push({...e.telemetry,task:'REVIEW',error:String(e),repair_count:revision-1});reviewUnavailable=true;errors.push({revision,task:'REVIEW',code:e.code||'PROVIDER_ERROR',error:String(e)})}
   gate=blueprintGate(input,semantic);
  }
  const status=reviewUnavailable?errors.at(-1).code:gate.status==='PASS'?'APPROVED':b.pda_analysis?.some(x=>['WEAK','INCOMPATIBLE'].includes(x.integration_strength))?'NEEDS_TEACHER_DECISION':revision===1?'NEEDS_REPAIR':gate.status==='NOT_EVALUABLE'?'NEEDS_REPAIR':'REJECTED';
  revisions.push({revision,label:reviewUnavailable?errors.at(-1).code:revision===1?(status==='APPROVED'?'PASS':'FAIL'):(status==='APPROVED'?'REPAIRED':'REPAIR_FAILED'),status,blueprint:b,gate,semantic,functional_diagnostics:b.final_outcome&&b.project_stages?functionalDiagnostics(b):[],diff:previous?structuralDiff(previous.blueprint,b):[],triggering_rules:repair?.triggering_rules.map(x=>x.rule_id)||[]});
  if(options.constructionPlan&&gate.deterministic_findings.some(f=>f.status!=='PASS'))break;
  if(reviewUnavailable||['APPROVED','NEEDS_TEACHER_DECISION'].includes(status))break;
 }
 const final=revisions.at(-1);
 // Keep the evaluated DRAFT bytes immutable. Approval is an external envelope;
 // do not mutate the candidate to set gate_result/status after hashing/reviewing.
 return deepFreeze({mode:'SHADOW',status:errors.length?errors.at(-1).code:final.status,blueprint:final?.blueprint||null,gate:final?.gate||null,approved_blueprint_hash:!errors.length&&final?.status==='APPROVED'?hash(final.blueprint):null,revisions,telemetry,errors,construction_attempts,repair_count:repairCount});
}
