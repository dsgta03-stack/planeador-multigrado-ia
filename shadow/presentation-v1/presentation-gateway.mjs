import {deepFreeze} from '../project-blueprint-v1/contracts.mjs';
import {pipelinePresentationState,toTeacherPlanView} from './teacher-plan-view.mjs';
import {createFinalPlanSnapshot} from './final-plan-snapshot.mjs';

export const PRESENTATION_GATEWAY_VERSION='PRESENTATION_GATEWAY_V1';

const clone=value=>structuredClone(value);

/**
 * Single fail-closed boundary between the validated pipeline and any UI/history/export surface.
 * Non-ready states never receive a TeacherPlanView or snapshot.
 */
export function buildTeacherPresentationEnvelope({pipelineResult,teacherContextBinding=null,pipelineEvidence=null,createdAt=new Date().toISOString()}={}){
 const presentation=pipelinePresentationState(pipelineResult);
 const base={
  gateway_version:PRESENTATION_GATEWAY_VERSION,
  status:presentation.status,
  renderable:presentation.renderable,
  descriptor:clone(presentation.descriptor),
  repair_count:presentation.repair_count,
  pipeline_version:presentation.pipeline_version,
  projection_valid:presentation.projection_valid,
  projection_error:presentation.projection_error
 };
 if(!presentation.renderable){
  return deepFreeze({...base,teacher_plan_view:null,final_snapshot:null});
 }
 const view=toTeacherPlanView({pipelineResult,teacherContextBinding});
 const snapshot=createFinalPlanSnapshot({view,pipelineEvidence,createdAt});
 return deepFreeze({...base,teacher_plan_view:view,final_snapshot:snapshot});
}

export function assertRenderablePresentationEnvelope(envelope){
 if(!envelope||envelope.gateway_version!==PRESENTATION_GATEWAY_VERSION)throw Error('PRESENTATION_GATEWAY_INVALID');
 if(envelope.renderable!==true||envelope.status!=='READY_FOR_TEACHER'||!envelope.teacher_plan_view||!envelope.final_snapshot)throw Error('PRESENTATION_GATEWAY_NOT_RENDERABLE');
 if(envelope.teacher_plan_view.view_hash!==envelope.final_snapshot.source.view_hash)throw Error('PRESENTATION_GATEWAY_VIEW_SNAPSHOT_MISMATCH');
 if(envelope.teacher_plan_view.source.projection_hash!==envelope.final_snapshot.source.projection_hash)throw Error('PRESENTATION_GATEWAY_PROJECTION_SNAPSHOT_MISMATCH');
 return true;
}
