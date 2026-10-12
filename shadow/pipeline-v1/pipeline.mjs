import {randomUUID} from 'node:crypto';
import {deepFreeze,hash} from '../project-blueprint-v1/contracts.mjs';
import {compileSessionGraph} from '../session-graph-v1/session-graph.mjs';
import {normalizeSessionGraphAuthoring} from '../session-graph-v1/authoring.mjs';
import {sessionGraphGate,approveSessionGraph} from '../session-graph-v1/gate.mjs';
import {buildSessionGraphReviewRequest} from '../session-graph-v1/reviewer.mjs';
import {buildCriticalClaimsReviewRequest,criticalClaimsGate,approvePipelineSessionGraph} from './critical-audit.mjs';
import {projectTeacherPlan} from './projection.mjs';
import {buildProjectCandidatePool} from '../project-composition-v1/candidate-pool.mjs';
import {createProjectCompositionProvider} from '../project-composition-v1/provider.mjs';

export const PIPELINE_VERSION='MULTIPLAN_SHADOW_PIPELINE_V1';
export const PIPELINE_STATUSES=Object.freeze(['PROJECT_COMPOSITION_STAGE_FAILED','BLUEPRINT_NOT_APPROVED','BLUEPRINT_STAGE_FAILED','BLUEPRINT_REVISION_REQUIRED','SESSION_AUTHOR_DRIVER_REQUIRED','SESSION_AUTHORING_FAILED','SESSION_GRAPH_CONTRACT_REJECTED','SESSION_REVIEW_UNAVAILABLE','SESSION_GRAPH_REJECTED','SESSION_REPAIR_FAILED','READY_FOR_TEACHER']);
const freezeClone=value=>deepFreeze(structuredClone(value));
function globalPostRepairPreflight(proposal,source,{graph_id,revision,attempt,ltg_repair_diagnostics}){
 const normalized=normalizeSessionGraphAuthoring(proposal,source);
 try{compileSessionGraph(freezeClone(normalized),source,{graph_id,revision});}
 catch(e){
  if(ltg_repair_diagnostics)e.ltg_repair_diagnostics=ltg_repair_diagnostics;
  const session=String(e.message).match(/session (\d+)/),grade=String(e.message).match(/grade (\d+)/);
  e.global_post_repair_validation={provider_responded:true,proposal_normalized:true,rejected_at:'GLOBAL_POST_REPAIR_VALIDATION',rule:e.rule||null,...(session?{session:Number(session[1])}:{}),...(grade?{grade:Number(grade[1])}:{}),attempt};
  throw e;
 }
 return normalized;
}
const errorInfo=e=>({code:e?.code||'ERROR',rule:e?.rule||null,message:String(e?.message||e),...(e?.worked_critical_repair_diagnostics?{worked_critical_repair_diagnostics:e.worked_critical_repair_diagnostics}:{}),...(e?.direct_repair_diagnostics?{direct_repair_diagnostics:e.direct_repair_diagnostics}:{}),...(e?.ltg_repair_diagnostics?{ltg_repair_diagnostics:e.ltg_repair_diagnostics}:{}),...(e?.global_post_repair_validation?{global_post_repair_validation:e.global_post_repair_validation}:{}),...(e?.repair_local_validation?{repair_local_validation:{provider_responded:e.repair_local_validation.provider_responded===true,proposal_normalized:e.repair_local_validation.proposal_normalized===true,rejected_at:e.repair_local_validation.rejected_at==='validateSessionGraphAuthoring'?'validateSessionGraphAuthoring':'validateRepairTargets'},repair_target_diagnostics:(e.repair_target_diagnostics||[]).map(t=>({target_id:t.target_id,session:t.session,activity_key:t.activity_key,grade:t.grade,pda_id:t.pda_id,reason:t.reason,...(t.field==='execution.resource_use'?{field:t.field,missing_resources_count:t.missing_resources_count}:{})}))}:{})});
const exactSourceKeys=s=>Object.keys(s||{}).sort().join(',')==='constraints,curriculum,methodology';

export function assertApprovedBlueprintEnvelope(envelope){const h=envelope?.blueprint?hash(envelope.blueprint):null;if(!envelope||envelope.status!=='APPROVED'||envelope.gate?.gate_version!=='BLUEPRINT_GATE_V1'||envelope.gate?.status!=='PASS'||!h||envelope.approved_blueprint_hash!==h||envelope.gate.evaluated_blueprint_hash!==h)throw Error('APPROVED_BLUEPRINT_TAMPERED_OR_NOT_APPROVED');return h;}
export function blueprintApprovalFromEnvelope(envelope){const h=assertApprovedBlueprintEnvelope(envelope);return deepFreeze({approval_version:'PROJECT_BLUEPRINT_APPROVAL_V1',status:'APPROVED',gate_version:'BLUEPRINT_GATE_V1',blueprint_hash:h,evaluated_blueprint_hash:envelope.gate.evaluated_blueprint_hash,approved_blueprint_hash:envelope.approved_blueprint_hash});}
function normalizeProposal(result){if(result?.status==='BLUEPRINT_REVISION_REQUIRED')return {revision_required:true,reason:result.reason||'SessionGraph author reports approved Blueprint cannot be executed under current constraints'};const proposal=result?.proposal??result?.output??result;if(!proposal||typeof proposal!=='object')throw Error('SESSION_AUTHORING_PROPOSAL_REQUIRED');return {proposal,...(result?.worked_critical_repair_diagnostics?{worked_critical_repair_diagnostics:result.worked_critical_repair_diagnostics}:{}),...(result?.direct_repair_diagnostics?{direct_repair_diagnostics:result.direct_repair_diagnostics}:{}),...(result?.ltg_repair_diagnostics?{ltg_repair_diagnostics:result.ltg_repair_diagnostics}:{})};}
function normalizeSemantic(result,code='SESSION_SEMANTIC_REVIEW_REQUIRED'){const value=result?.semantic??result?.audit??result?.output??result;if(!value||typeof value!=='object')throw Error(code);return value;}
async function defaultBlueprintRunner(sources,{blueprintOptions={},blueprintProvider}={}){const {generateShadow}=await import('../project-blueprint-v1/shadow.mjs');return generateShadow(sources,blueprintOptions,blueprintProvider);}
function resultBase({status,stages,projectComposition=null,projectCompositionProvider=null,blueprintEnvelope=null,blueprintApproval=null,graph=null,graphGate=null,criticalGate=null,baseGraphApproval=null,graphApproval=null,repairCount=0,errors=[]}){return {pipeline_version:PIPELINE_VERSION,status,stages,...(projectComposition?{project_composition:projectComposition}:{}),...(projectCompositionProvider?{project_composition_provider:projectCompositionProvider}:{}),blueprint:blueprintEnvelope?.blueprint||null,blueprint_gate:blueprintEnvelope?.gate||null,blueprint_approval:blueprintApproval,session_graph:graph,session_gate:graphGate,session_critical_gate:criticalGate,session_graph_approval:baseGraphApproval,session_approval:graphApproval,repair_count:repairCount,errors};}

export async function runShadowPipeline({sources,drivers={},options={}}){
 if(!exactSourceKeys(sources))throw Error('PIPELINE_REQUIRES_EXACT_SOURCE_ARTIFACTS');
 const frozenSources=freezeClone(sources),stages=[],errors=[];const blueprintRunner=drivers.blueprintRunner||defaultBlueprintRunner;let blueprintEnvelope;

 let projectComposition=
  options.blueprintOptions?.projectComposition
   ? freezeClone(options.blueprintOptions.projectComposition)
   : null;

 let projectCompositionProviderMeta=null;

 const pipelineResult=args=>
  resultBase({
   ...args,
   projectComposition,
   projectCompositionProvider:
    projectCompositionProviderMeta
  });

 const compositionRunner=
  typeof drivers.projectCompositionProvider==='function'
   ? drivers.projectCompositionProvider
   : typeof options.projectCompositionInvoke==='function'
    ? createProjectCompositionProvider({
       invoke:options.projectCompositionInvoke
      })
    : null;

 if(compositionRunner){
  try{
   const candidatePool=
    buildProjectCandidatePool(
     freezeClone(frozenSources)
    );

   stages.push({
    stage:'PROJECT_COMPOSITION_CANDIDATES',
    status:'READY',
    candidate_count:
     Array.isArray(candidatePool?.candidates)
      ? candidatePool.candidates.length
      : null
   });

   const composed=
    await compositionRunner(
     freezeClone(frozenSources),
     freezeClone(candidatePool),
     options.projectCompositionOptions||{}
    );

   if(!composed?.composition){
    throw Error(
     'PROJECT_COMPOSITION_RESULT_REQUIRED'
    );
   }

   projectComposition=
    freezeClone(
     composed.composition
    );

   projectCompositionProviderMeta=
    composed.provider
     ? freezeClone(composed.provider)
     : null;

   stages.push({
    stage:'PROJECT_COMPOSITION',
    status:'COMPOSED',
    composition_id:
     projectComposition.composition_id,
    base_origin:
     projectComposition.base.origin,
    base_project_id:
     projectComposition.base.project_id,
    enrichment_count:
     projectComposition.enrichments.length
   });
  }catch(e){
   errors.push({
    stage:'PROJECT_COMPOSITION',
    ...errorInfo(e)
   });

   return deepFreeze(
    pipelineResult({
     status:'PROJECT_COMPOSITION_STAGE_FAILED',
     stages:[
      ...stages,
      {
       stage:'PROJECT_COMPOSITION',
       status:'ERROR'
      }
     ],
     errors
    })
   );
  }
 }
 try{blueprintEnvelope=await blueprintRunner(freezeClone(frozenSources),{blueprintOptions:{...(options.blueprintOptions||{}),...(projectComposition?{projectComposition}:{})},blueprintProvider:options.blueprintProvider});}catch(e){errors.push({stage:'PROJECT_BLUEPRINT',...errorInfo(e)});return deepFreeze(pipelineResult({status:'BLUEPRINT_STAGE_FAILED',stages:[...stages,{stage:'PROJECT_BLUEPRINT',status:'ERROR'}],projectComposition,projectCompositionProvider:projectCompositionProviderMeta,errors}));}
 stages.push({stage:'PROJECT_BLUEPRINT',status:blueprintEnvelope?.status||'UNKNOWN'});if(blueprintEnvelope?.status!=='APPROVED'){for(const item of blueprintEnvelope?.errors||[])errors.push({stage:'PROJECT_BLUEPRINT_PROVIDER',revision:item?.revision??null,task:item?.task??null,code:item?.code||'PROVIDER_ERROR',message:String(item?.error||item?.message||'Blueprint provider failed').slice(0,1000)});return deepFreeze(pipelineResult({status:'BLUEPRINT_NOT_APPROVED',stages,blueprintEnvelope,errors}));}
 let blueprintApproval;try{blueprintApproval=blueprintApprovalFromEnvelope(blueprintEnvelope);}catch(e){errors.push({stage:'PROJECT_BLUEPRINT_APPROVAL',...errorInfo(e)});return deepFreeze(pipelineResult({status:'BLUEPRINT_STAGE_FAILED',stages:[...stages,{stage:'PROJECT_BLUEPRINT_APPROVAL',status:'ERROR'}],blueprintEnvelope,errors}));}
 stages.push({stage:'PROJECT_BLUEPRINT_APPROVAL',status:'APPROVED',hash:blueprintApproval.approved_blueprint_hash});const authoritativeBlueprint=freezeClone(blueprintEnvelope.blueprint),authoritativeBlueprintHash=hash(authoritativeBlueprint);if(authoritativeBlueprintHash!==blueprintApproval.approved_blueprint_hash)throw Error('PIPELINE_BLUEPRINT_HASH_BINDING_MISMATCH');
 if(typeof drivers.sessionAuthor!=='function')return deepFreeze(pipelineResult({status:'SESSION_AUTHOR_DRIVER_REQUIRED',stages,blueprintEnvelope,blueprintApproval,errors}));
 const source={...frozenSources,blueprint:authoritativeBlueprint,approval:blueprintApproval};const maxRepairs=options.maxSessionRepairs===0?0:1,graphId=options.graphId||randomUUID();let proposal,repairCount=0,graph=null,graphGate=null,criticalGate=null,baseGraphApproval=null,graphApproval=null;
 try{const authored=normalizeProposal(await drivers.sessionAuthor(freezeClone({sources:frozenSources,blueprint:authoritativeBlueprint,approval:blueprintApproval})));if(authored.revision_required)return deepFreeze({...pipelineResult({status:'BLUEPRINT_REVISION_REQUIRED',stages:[...stages,{stage:'SESSION_AUTHORING',status:'BLUEPRINT_REVISION_REQUIRED'}],blueprintEnvelope,blueprintApproval,errors}),reason:authored.reason});proposal=authored.proposal;stages.push({stage:'SESSION_AUTHORING',status:'PROPOSED'});}catch(e){errors.push({stage:'SESSION_AUTHORING',...errorInfo(e)});return deepFreeze(pipelineResult({status:'SESSION_AUTHORING_FAILED',stages:[...stages,{stage:'SESSION_AUTHORING',status:'ERROR'}],blueprintEnvelope,blueprintApproval,errors}));}

 for(let attempt=0;attempt<=maxRepairs;attempt++){
  proposal=normalizeSessionGraphAuthoring(proposal,source);
  try{graph=compileSessionGraph(freezeClone(proposal),source,{graph_id:graphId,revision:attempt+1}).graph;stages.push({stage:'SESSION_COMPILE',attempt:attempt+1,status:'PASS',graph_hash:hash(graph)});}catch(e){errors.push({stage:'SESSION_COMPILE',attempt:attempt+1,...errorInfo(e)});stages.push({stage:'SESSION_COMPILE',attempt:attempt+1,status:'FAIL'});if(attempt===0&&maxRepairs&&typeof drivers.sessionRepair==='function'){try{const repaired=normalizeProposal(await drivers.sessionRepair(freezeClone({sources:frozenSources,blueprint:authoritativeBlueprint,approval:blueprintApproval,previous_proposal:proposal,compile_error:errorInfo(e)})));if(repaired.revision_required)return deepFreeze({...pipelineResult({status:'BLUEPRINT_REVISION_REQUIRED',stages:[...stages,{stage:'SESSION_REPAIR',status:'BLUEPRINT_REVISION_REQUIRED'}],blueprintEnvelope,blueprintApproval,repairCount,errors}),reason:repaired.reason});proposal=globalPostRepairPreflight(repaired.proposal,source,{graph_id:graphId,revision:attempt+2,attempt:attempt+2,ltg_repair_diagnostics:repaired.ltg_repair_diagnostics});repairCount=1;stages.push({stage:'SESSION_REPAIR',status:'REPAIRED',...(repaired.direct_repair_diagnostics?{direct_repair_diagnostics:repaired.direct_repair_diagnostics}:{}),...(repaired.ltg_repair_diagnostics?{ltg_repair_diagnostics:repaired.ltg_repair_diagnostics}:{}),reason:'DETERMINISTIC'});continue;}catch(re){errors.push({stage:'SESSION_REPAIR',...errorInfo(re)});return deepFreeze(pipelineResult({status:'SESSION_REPAIR_FAILED',stages:[...stages,{stage:'SESSION_REPAIR',status:'ERROR'}],blueprintEnvelope,blueprintApproval,repairCount,errors}));}}return deepFreeze(pipelineResult({status:'SESSION_GRAPH_CONTRACT_REJECTED',stages,blueprintEnvelope,blueprintApproval,repairCount,errors}));}
  if(hash(authoritativeBlueprint)!==authoritativeBlueprintHash)throw Error('PIPELINE_BLUEPRINT_MUTATED_DURING_SESSION_STAGE');
  const input={...source,graph};let semantic,criticalAudit;
  try{if(typeof drivers.sessionReview!=='function')throw Error('SESSION_REVIEW_DRIVER_REQUIRED');const request=buildSessionGraphReviewRequest(input);semantic=normalizeSemantic(await drivers.sessionReview(freezeClone({input,request})));}catch(e){errors.push({stage:'SESSION_REVIEW',attempt:attempt+1,...errorInfo(e)});return deepFreeze(pipelineResult({status:'SESSION_REVIEW_UNAVAILABLE',stages:[...stages,{stage:'SESSION_REVIEW',attempt:attempt+1,status:'UNAVAILABLE'}],blueprintEnvelope,blueprintApproval,graph,repairCount,errors}));}
  try{if(typeof drivers.sessionCriticalReview!=='function')throw Error('SESSION_CRITICAL_REVIEW_DRIVER_REQUIRED');const request=buildCriticalClaimsReviewRequest(input);criticalAudit=normalizeSemantic(await drivers.sessionCriticalReview(freezeClone({input,request})),'SESSION_CRITICAL_REVIEW_REQUIRED');}catch(e){errors.push({stage:'SESSION_CRITICAL_REVIEW',attempt:attempt+1,...errorInfo(e)});return deepFreeze(pipelineResult({status:'SESSION_REVIEW_UNAVAILABLE',stages:[...stages,{stage:'SESSION_REVIEW',attempt:attempt+1,status:'PASS'},{stage:'SESSION_CRITICAL_REVIEW',attempt:attempt+1,status:'UNAVAILABLE'}],blueprintEnvelope,blueprintApproval,graph,repairCount,errors}));}
  graphGate=sessionGraphGate(input,semantic);criticalGate=criticalClaimsGate(input,criticalAudit);stages.push({stage:'SESSION_GATE',attempt:attempt+1,status:graphGate.status,graph_hash:graphGate.evaluated_graph_hash},{stage:'SESSION_CRITICAL_GATE',attempt:attempt+1,status:criticalGate.status,graph_hash:criticalGate.evaluated_graph_hash});
  for(const finding of [...(graphGate.deterministic_findings||[]),...(graphGate.semantic_findings||[])].filter(x=>x.status!=='PASS')){
   errors.push({stage:'SESSION_GATE',attempt:attempt+1,rule:finding.rule_id||null,status:finding.status,scope:finding.scope||null,message:String(finding.observed||''),expected:String(finding.expected||'')});
  }
  for(const finding of (criticalGate.findings||[]).filter(x=>x.status!=='PASS')){
   errors.push({stage:'SESSION_CRITICAL_GATE',attempt:attempt+1,rule:finding.claim_type||null,status:finding.status,scope:finding.key||null,message:String(finding.observed||''),expected:String(finding.expected||'')});
  }
  if(graphGate.status==='PASS'&&criticalGate.status==='PASS'){baseGraphApproval=approveSessionGraph(input,graphGate);graphApproval=approvePipelineSessionGraph(input,baseGraphApproval,criticalGate);stages.push({stage:'SESSION_APPROVAL',status:'APPROVED',hash:graphApproval.approved_graph_hash,critical_audit_hash:graphApproval.critical_audit_hash});break;}
  if(graphGate.status==='NOT_EVALUABLE'||criticalGate.status==='NOT_EVALUABLE')return deepFreeze(pipelineResult({status:'SESSION_REVIEW_UNAVAILABLE',stages,blueprintEnvelope,blueprintApproval,graph,graphGate,criticalGate,repairCount,errors}));
  if(attempt===0&&maxRepairs&&typeof drivers.sessionRepair==='function'){
   try{const triggering_rules=[...graphGate.deterministic_findings,...graphGate.semantic_findings,...criticalGate.findings].filter(x=>x.status!=='PASS');const repaired=normalizeProposal(await drivers.sessionRepair(freezeClone({sources:frozenSources,blueprint:authoritativeBlueprint,approval:blueprintApproval,previous_proposal:proposal,graph,gate:graphGate,critical_gate:criticalGate,critical_audit:criticalAudit,triggering_rules})));if(repaired.revision_required)return deepFreeze({...pipelineResult({status:'BLUEPRINT_REVISION_REQUIRED',stages:[...stages,{stage:'SESSION_REPAIR',status:'BLUEPRINT_REVISION_REQUIRED'}],blueprintEnvelope,blueprintApproval,graph,graphGate,criticalGate,repairCount,errors}),reason:repaired.reason});proposal=globalPostRepairPreflight(repaired.proposal,source,{graph_id:graphId,revision:attempt+2,attempt:attempt+2,ltg_repair_diagnostics:repaired.ltg_repair_diagnostics});repairCount=1;stages.push({stage:'SESSION_REPAIR',status:'REPAIRED',...(repaired.worked_critical_repair_diagnostics?{worked_critical_repair_diagnostics:repaired.worked_critical_repair_diagnostics}:{}),reason:criticalGate.status==='FAIL'?'CRITICAL_SEMANTIC':'SEMANTIC'});continue;}catch(e){errors.push({stage:'SESSION_REPAIR',...errorInfo(e)});return deepFreeze(pipelineResult({status:'SESSION_REPAIR_FAILED',stages:[...stages,{stage:'SESSION_REPAIR',status:'ERROR'}],blueprintEnvelope,blueprintApproval,graph,graphGate,criticalGate,repairCount,errors}));}
  }
  return deepFreeze(pipelineResult({status:'SESSION_GRAPH_REJECTED',stages,blueprintEnvelope,blueprintApproval,graph,graphGate,criticalGate,repairCount,errors}));
 }
 if(!graphApproval)return deepFreeze(pipelineResult({status:'SESSION_GRAPH_REJECTED',stages,blueprintEnvelope,blueprintApproval,graph,graphGate,criticalGate,repairCount,errors}));
 const teacherPlan=projectTeacherPlan({blueprint:authoritativeBlueprint,blueprintApproval,graph,graphApproval});stages.push({stage:'TEACHER_PROJECTION',status:'READY'});return deepFreeze({...pipelineResult({status:'READY_FOR_TEACHER',stages,blueprintEnvelope,blueprintApproval,graph,graphGate,criticalGate,baseGraphApproval,graphApproval,repairCount,errors}),teacher_plan:teacherPlan});
}
