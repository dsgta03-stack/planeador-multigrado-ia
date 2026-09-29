import {deepFreeze,hash} from '../project-blueprint-v1/contracts.mjs';
import {assertTeacherPlanView} from './teacher-plan-view.mjs';

export const FINAL_PLAN_SNAPSHOT_VERSION='FINAL_TEACHER_PLAN_SNAPSHOT_V1';

const clone=value=>structuredClone(value);
const withoutHash=value=>Object.fromEntries(Object.entries(value||{}).filter(([key])=>key!=='snapshot_hash'));
export const finalPlanSnapshotHash=snapshot=>hash(withoutHash(snapshot));

/**
 * Immutable history payload for new-pipeline plans.
 * No AI call, fallback synthesis, or pedagogical reinterpretation is allowed.
 */
export function createFinalPlanSnapshot({view,pipelineEvidence=null,createdAt=new Date().toISOString()}={}){
 assertTeacherPlanView(view);
 if(typeof createdAt!=='string'||!createdAt.trim())throw Error('FINAL_PLAN_SNAPSHOT_CREATED_AT_REQUIRED');
 if(view.teacher_context!==null&&typeof view.source?.constraints_hash!=='string')throw Error('FINAL_PLAN_SNAPSHOT_CONTEXT_BINDING_REQUIRED');
 if(pipelineEvidence!==null&&(!pipelineEvidence||typeof pipelineEvidence!=='object'||Array.isArray(pipelineEvidence)))throw Error('FINAL_PLAN_SNAPSHOT_EVIDENCE_INVALID');
 const body={
  snapshot_version:FINAL_PLAN_SNAPSHOT_VERSION,
  created_at:createdAt,
  status:'READY_FOR_TEACHER',
  source:{
   projection_hash:view.source.projection_hash,
   view_hash:view.view_hash,
   approved_blueprint_hash:view.source.approved_blueprint_hash,
   approved_graph_hash:view.source.approved_graph_hash,
   constraints_hash:view.source.constraints_hash||null,
   pipeline_version:view.source.pipeline_version||null
  },
  plan_view:clone(view),
  pipeline_evidence:pipelineEvidence===null?null:clone(pipelineEvidence)
 };
 return deepFreeze({...body,snapshot_hash:hash(body)});
}

export function assertFinalPlanSnapshot(snapshot){
 if(!snapshot||snapshot.snapshot_version!==FINAL_PLAN_SNAPSHOT_VERSION||snapshot.status!=='READY_FOR_TEACHER'||typeof snapshot.snapshot_hash!=='string'||snapshot.snapshot_hash!==finalPlanSnapshotHash(snapshot))throw Error('FINAL_PLAN_SNAPSHOT_TAMPERED');
 assertTeacherPlanView(snapshot.plan_view);
 if(snapshot.source?.projection_hash!==snapshot.plan_view.source.projection_hash||snapshot.source?.view_hash!==snapshot.plan_view.view_hash||snapshot.source?.approved_blueprint_hash!==snapshot.plan_view.source.approved_blueprint_hash||snapshot.source?.approved_graph_hash!==snapshot.plan_view.source.approved_graph_hash||snapshot.source?.constraints_hash!==(snapshot.plan_view.source.constraints_hash||null))throw Error('FINAL_PLAN_SNAPSHOT_SOURCE_BINDING_MISMATCH');
 return true;
}

export function restoreTeacherPlanView(snapshot){
 assertFinalPlanSnapshot(snapshot);
 return deepFreeze(clone(snapshot.plan_view));
}
