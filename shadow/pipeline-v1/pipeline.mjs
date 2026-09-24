import {randomUUID} from 'node:crypto';
import {deepFreeze,hash} from '../project-blueprint-v1/contracts.mjs';
import {compileSessionGraph} from '../session-graph-v1/session-graph.mjs';
import {sessionGraphGate,approveSessionGraph} from '../session-graph-v1/gate.mjs';
import {buildSessionGraphReviewRequest} from '../session-graph-v1/reviewer.mjs';
import {projectTeacherPlan} from './projection.mjs';

export const PIPELINE_VERSION='MULTIPLAN_SHADOW_PIPELINE_V1';
export const PIPELINE_STATUSES=Object.freeze([
 'BLUEPRINT_NOT_APPROVED',
 'BLUEPRINT_STAGE_FAILED',
 'BLUEPRINT_REVISION_REQUIRED',
 'SESSION_AUTHOR_DRIVER_REQUIRED',
 'SESSION_AUTHORING_FAILED',
 'SESSION_GRAPH_CONTRACT_REJECTED',
 'SESSION_REVIEW_UNAVAILABLE',
 'SESSION_GRAPH_REJECTED',
 'SESSION_REPAIR_FAILED',
 'READY_FOR_TEACHER'
]);

const freezeClone=value=>deepFreeze(structuredClone(value));
const errorInfo=e=>({code:e?.code||'ERROR',rule:e?.rule||null,message:String(e?.message||e)});
const exactSourceKeys=s=>Object.keys(s||{}).sort().join(',')==='constraints,curriculum,methodology';

export function assertApprovedBlueprintEnvelope(envelope){
 const blueprintHash=envelope?.blueprint?hash(envelope.blueprint):null;
 if(!envelope||envelope.status!=='APPROVED'||envelope.gate?.gate_version!=='BLUEPRINT_GATE_V1'||envelope.gate?.status!=='PASS'||!blueprintHash||envelope.approved_blueprint_hash!==blueprintHash||envelope.gate.evaluated_blueprint_hash!==blueprintHash)throw Error('APPROVED_BLUEPRINT_TAMPERED_OR_NOT_APPROVED');
 return blueprintHash;
}

export function blueprintApprovalFromEnvelope(envelope){
 const blueprint_hash=assertApprovedBlueprintEnvelope(envelope);
 return deepFreeze({
  approval_version:'PROJECT_BLUEPRINT_APPROVAL_V1',
  status:'APPROVED',
  gate_version:'BLUEPRINT_GATE_V1',
  blueprint_hash,
  evaluated_blueprint_hash:envelope.gate.evaluated_blueprint_hash,
  approved_blueprint_hash:envelope.approved_blueprint_hash
 });
}

function normalizeProposal(result){
 if(result?.status==='BLUEPRINT_REVISION_REQUIRED')return {revision_required:true,reason:result.reason||'SessionGraph author reports approved Blueprint cannot be executed under current constraints'};
 const proposal=result?.proposal??result?.output??result;
 if(!proposal||typeof proposal!=='object')throw Error('SESSION_AUTHORING_PROPOSAL_REQUIRED');
 return {proposal};
}

function normalizeSemantic(result){
 const semantic=result?.semantic??result?.output??result;
 if(!semantic||typeof semantic!=='object')throw Error('SESSION_SEMANTIC_REVIEW_REQUIRED');
 return semantic;
}

async function defaultBlueprintRunner(sources,{blueprintOptions={},blueprintProvider}={}){
 const {generateShadow}=await import('../project-blueprint-v1/shadow.mjs');
 return generateShadow(sources,blueprintOptions,blueprintProvider);
}

function resultBase({status,stages,blueprintEnvelope=null,blueprintApproval=null,graph=null,graphGate=null,graphApproval=null,repairCount=0,errors=[]}){
 return {pipeline_version:PIPELINE_VERSION,status,stages,blueprint:blueprintEnvelope?.blueprint||null,blueprint_gate:blueprintEnvelope?.gate||null,blueprint_approval:blueprintApproval,session_graph:graph,session_gate:graphGate,session_approval:graphApproval,repair_count:repairCount,errors};
}

/**
 * Shadow-only orchestration boundary.
 *
 * Authority is monotonic:
 * TeacherConstraints/Curriculum/Methodology -> approved ProjectBlueprint -> approved SessionGraph -> teacher projection.
 * A downstream driver receives frozen clones and cannot rewrite an approved upstream artifact.
 */
export async function runShadowPipeline({sources,drivers={},options={}}){
 if(!exactSourceKeys(sources))throw Error('PIPELINE_REQUIRES_EXACT_SOURCE_ARTIFACTS');
 const frozenSources=freezeClone(sources);
 const stages=[];const errors=[];
 const blueprintRunner=drivers.blueprintRunner||defaultBlueprintRunner;
 let blueprintEnvelope;
 try{
  blueprintEnvelope=await blueprintRunner(freezeClone(frozenSources),{blueprintOptions:options.blueprintOptions||{},blueprintProvider:options.blueprintProvider});
 }catch(e){
  errors.push({stage:'PROJECT_BLUEPRINT',...errorInfo(e)});
  return deepFreeze(resultBase({status:'BLUEPRINT_STAGE_FAILED',stages:[...stages,{stage:'PROJECT_BLUEPRINT',status:'ERROR'}],errors}));
 }
 stages.push({stage:'PROJECT_BLUEPRINT',status:blueprintEnvelope?.status||'UNKNOWN'});
 if(blueprintEnvelope?.status!=='APPROVED')return deepFreeze(resultBase({status:'BLUEPRINT_NOT_APPROVED',stages,blueprintEnvelope,errors}));
 let blueprintApproval;
 try{blueprintApproval=blueprintApprovalFromEnvelope(blueprintEnvelope)}catch(e){
  errors.push({stage:'PROJECT_BLUEPRINT_APPROVAL',...errorInfo(e)});
  return deepFreeze(resultBase({status:'BLUEPRINT_STAGE_FAILED',stages:[...stages,{stage:'PROJECT_BLUEPRINT_APPROVAL',status:'ERROR'}],blueprintEnvelope,errors}));
 }
 stages.push({stage:'PROJECT_BLUEPRINT_APPROVAL',status:'APPROVED',hash:blueprintApproval.approved_blueprint_hash});
 const authoritativeBlueprint=freezeClone(blueprintEnvelope.blueprint);
 const authoritativeBlueprintHash=hash(authoritativeBlueprint);
 if(authoritativeBlueprintHash!==blueprintApproval.approved_blueprint_hash)throw Error('PIPELINE_BLUEPRINT_HASH_BINDING_MISMATCH');
 if(typeof drivers.sessionAuthor!=='function')return deepFreeze(resultBase({status:'SESSION_AUTHOR_DRIVER_REQUIRED',stages,blueprintEnvelope,blueprintApproval,errors}));
 const source={...frozenSources,blueprint:authoritativeBlueprint,approval:blueprintApproval};
 const maxRepairs=options.maxSessionRepairs===0?0:1;
 const graphId=options.graphId||randomUUID();
 let proposal;let repairCount=0;let graph=null;let graphGate=null;let graphApproval=null;
 try{
  const authored=normalizeProposal(await drivers.sessionAuthor(freezeClone({sources:frozenSources,blueprint:authoritativeBlueprint,approval:blueprintApproval})));
  if(authored.revision_required){
   stages.push({stage:'SESSION_AUTHORING',status:'BLUEPRINT_REVISION_REQUIRED'});
   return deepFreeze({...resultBase({status:'BLUEPRINT_REVISION_REQUIRED',stages,blueprintEnvelope,blueprintApproval,repairCount,errors}),reason:authored.reason});
  }
  proposal=authored.proposal;
  stages.push({stage:'SESSION_AUTHORING',status:'PROPOSED'});
 }catch(e){
  errors.push({stage:'SESSION_AUTHORING',...errorInfo(e)});stages.push({stage:'SESSION_AUTHORING',status:'ERROR'});
  return deepFreeze(resultBase({status:'SESSION_AUTHORING_FAILED',stages,blueprintEnvelope,blueprintApproval,repairCount,errors}));
 }

 for(let attempt=0;attempt<=maxRepairs;attempt++){
  try{
   const compiled=compileSessionGraph(freezeClone(proposal),source,{graph_id:graphId,revision:attempt+1});
   graph=compiled.graph;
   stages.push({stage:'SESSION_COMPILE',attempt:attempt+1,status:'PASS',graph_hash:hash(graph)});
  }catch(e){
   errors.push({stage:'SESSION_COMPILE',attempt:attempt+1,...errorInfo(e)});stages.push({stage:'SESSION_COMPILE',attempt:attempt+1,status:'FAIL'});
   if(attempt===0&&maxRepairs&&typeof drivers.sessionRepair==='function'){
    try{
     const repaired=normalizeProposal(await drivers.sessionRepair(freezeClone({sources:frozenSources,blueprint:authoritativeBlueprint,approval:blueprintApproval,previous_proposal:proposal,compile_error:errorInfo(e)})));
     if(repaired.revision_required)return deepFreeze({...resultBase({status:'BLUEPRINT_REVISION_REQUIRED',stages:[...stages,{stage:'SESSION_REPAIR',status:'BLUEPRINT_REVISION_REQUIRED'}],blueprintEnvelope,blueprintApproval,repairCount,errors}),reason:repaired.reason});
     proposal=repaired.proposal;repairCount=1;stages.push({stage:'SESSION_REPAIR',status:'REPAIRED',reason:'DETERMINISTIC'});continue;
    }catch(repairError){errors.push({stage:'SESSION_REPAIR',...errorInfo(repairError)});stages.push({stage:'SESSION_REPAIR',status:'ERROR'});return deepFreeze(resultBase({status:'SESSION_REPAIR_FAILED',stages,blueprintEnvelope,blueprintApproval,repairCount,errors}));}
   }
   return deepFreeze(resultBase({status:'SESSION_GRAPH_CONTRACT_REJECTED',stages,blueprintEnvelope,blueprintApproval,repairCount,errors}));
  }

  if(hash(authoritativeBlueprint)!==authoritativeBlueprintHash)throw Error('PIPELINE_BLUEPRINT_MUTATED_DURING_SESSION_STAGE');
  const input={...source,graph};
  let semantic;
  try{
   if(typeof drivers.sessionReview!=='function')throw Error('SESSION_REVIEW_DRIVER_REQUIRED');
   const request=buildSessionGraphReviewRequest(input);
   semantic=normalizeSemantic(await drivers.sessionReview(freezeClone({input,request})));
  }catch(e){
   errors.push({stage:'SESSION_REVIEW',attempt:attempt+1,...errorInfo(e)});stages.push({stage:'SESSION_REVIEW',attempt:attempt+1,status:'UNAVAILABLE'});
   return deepFreeze(resultBase({status:'SESSION_REVIEW_UNAVAILABLE',stages,blueprintEnvelope,blueprintApproval,graph,repairCount,errors}));
  }
  graphGate=sessionGraphGate(input,semantic);
  stages.push({stage:'SESSION_GATE',attempt:attempt+1,status:graphGate.status,graph_hash:graphGate.evaluated_graph_hash});
  if(graphGate.status==='PASS'){
   graphApproval=approveSessionGraph(input,graphGate);
   stages.push({stage:'SESSION_APPROVAL',status:'APPROVED',hash:graphApproval.approved_graph_hash});
   break;
  }
  if(graphGate.status==='NOT_EVALUABLE')return deepFreeze(resultBase({status:'SESSION_REVIEW_UNAVAILABLE',stages,blueprintEnvelope,blueprintApproval,graph,graphGate,repairCount,errors}));
  if(attempt===0&&maxRepairs&&typeof drivers.sessionRepair==='function'){
   try{
    const repaired=normalizeProposal(await drivers.sessionRepair(freezeClone({sources:frozenSources,blueprint:authoritativeBlueprint,approval:blueprintApproval,previous_proposal:proposal,graph,gate:graphGate,triggering_rules:[...graphGate.deterministic_findings,...graphGate.semantic_findings].filter(x=>x.status!=='PASS')})));
    if(repaired.revision_required)return deepFreeze({...resultBase({status:'BLUEPRINT_REVISION_REQUIRED',stages:[...stages,{stage:'SESSION_REPAIR',status:'BLUEPRINT_REVISION_REQUIRED'}],blueprintEnvelope,blueprintApproval,graph,graphGate,repairCount,errors}),reason:repaired.reason});
    proposal=repaired.proposal;repairCount=1;stages.push({stage:'SESSION_REPAIR',status:'REPAIRED',reason:'SEMANTIC'});continue;
   }catch(e){errors.push({stage:'SESSION_REPAIR',...errorInfo(e)});stages.push({stage:'SESSION_REPAIR',status:'ERROR'});return deepFreeze(resultBase({status:'SESSION_REPAIR_FAILED',stages,blueprintEnvelope,blueprintApproval,graph,graphGate,repairCount,errors}));}
  }
  return deepFreeze(resultBase({status:'SESSION_GRAPH_REJECTED',stages,blueprintEnvelope,blueprintApproval,graph,graphGate,repairCount,errors}));
 }

 if(!graphApproval)return deepFreeze(resultBase({status:'SESSION_GRAPH_REJECTED',stages,blueprintEnvelope,blueprintApproval,graph,graphGate,repairCount,errors}));
 const teacherPlan=projectTeacherPlan({blueprint:authoritativeBlueprint,blueprintApproval,graph,graphApproval});
 stages.push({stage:'TEACHER_PROJECTION',status:'READY'});
 return deepFreeze({...resultBase({status:'READY_FOR_TEACHER',stages,blueprintEnvelope,blueprintApproval,graph,graphGate,graphApproval,repairCount,errors}),teacher_plan:teacherPlan});
}
