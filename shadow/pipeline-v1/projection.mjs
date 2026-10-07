import {deepFreeze,hash} from '../project-blueprint-v1/contracts.mjs';

export const TEACHER_PROJECTION_VERSION='TEACHER_PLAN_PROJECTION_V1';

const clone=x=>structuredClone(x);
export const teacherProjectionHash=projection=>hash(Object.fromEntries(Object.entries(projection).filter(([key])=>key!=='projection_hash')));

/**
 * Pure deterministic projection. It cannot invent, repair, summarize with AI,
 * or reinterpret an approved ProjectBlueprint/SessionGraph.
 */
export function projectTeacherPlan({blueprint,blueprintApproval,graph,graphApproval}){
 const blueprintHash=hash(blueprint),graphHash=hash(graph);
 if(!blueprintApproval||blueprintApproval.status!=='APPROVED'||blueprintApproval.approved_blueprint_hash!==blueprintHash||blueprintApproval.blueprint_hash!==blueprintHash)throw Error('TEACHER_PROJECTION_BLUEPRINT_NOT_APPROVED');
 if(!graphApproval||graphApproval.status!=='APPROVED'||graphApproval.approved_graph_hash!==graphHash||graphApproval.graph_hash!==graphHash)throw Error('TEACHER_PROJECTION_SESSION_GRAPH_NOT_APPROVED');
 if(graph.source_blueprint?.approved_blueprint_hash!==blueprintHash||graphApproval.approved_blueprint_hash!==blueprintHash)throw Error('TEACHER_PROJECTION_CROSS_ARTIFACT_BINDING_MISMATCH');

 const sessions=graph.sessions.map(session=>({
  session_number:session.session_number,
  stage_ids:[...session.stage_ids],
  project_state_before:session.project_state_before,
  session_project_goal:session.session_project_goal,
  required_learning:clone(session.required_learning),
  pda_focus:[...session.pda_focus],
  methodology_operations:[...session.methodology_operations],
  input_artifact_ids:[...session.input_artifact_ids],
  expected_output_artifact_ids:[...session.expected_output_artifact_ids],
  expected_partial_product:session.expected_partial_product,
  acceptance_criteria:clone(session.blueprint_acceptance_criteria),
  project_state_after:session.project_state_after,
  terminal:session.terminal,
  next_session_dependency:session.next_session_dependency,
  ...(session.ltg_decisions!==undefined?{ltg_decisions:clone(session.ltg_decisions)}:{}),
  total_minutes:session.activities.reduce((n,a)=>n+a.minutes,0),
  activities:session.activities.map(activity=>({
   ...(activity.execution!==undefined?{execution:clone(activity.execution)}:{}),
   ...(activity.ltg_use!==undefined?{ltg_use:clone(activity.ltg_use)}:{}),
   activity_id:activity.activity_id||null,
   output_ref:activity.output_ref||null,
   order:activity.order,
   title:activity.title,
   contribution_mode:activity.contribution_mode,
   contribution_rationale:activity.contribution_rationale,
   common_student_action:activity.common_student_action,
   grade_participation:clone(activity.grade_participation),
   teacher_role:activity.teacher_role,
   minutes:activity.minutes,
   resources:[...activity.resources],
   supports:[...activity.supports],
   input_refs:[...activity.input_refs],
   output:activity.output,
   contributes_to_artifact_ids:[...activity.contributes_to_artifact_ids],
   methodology_operations:[...activity.methodology_operations],
   functional_requirement_ids:[...activity.functional_requirement_ids],
   ltg_activity_ids:[...activity.ltg_activity_ids],
   evidence:activity.evidence,
   assessment_criteria:[...activity.assessment_criteria]
  }))
 }));

 const body={
  projection_version:TEACHER_PROJECTION_VERSION,
  status:'READY_FOR_TEACHER',
  source:{
   blueprint_id:blueprint.blueprint_id,
   blueprint_revision:blueprint.revision,
   approved_blueprint_hash:blueprintHash,
   graph_id:graph.graph_id,
   graph_revision:graph.revision,
   approved_graph_hash:graphHash
  },
  project:{
   problem_frame:clone(blueprint.problem_frame),
   guiding_question:clone(blueprint.guiding_question),
   methodology:clone(blueprint.methodology),
   final_outcome:clone(blueprint.final_outcome),
   pda_analysis:clone(blueprint.pda_analysis),
   grade_contributions:clone(blueprint.grade_contributions),
   project_stages:clone(blueprint.project_stages),
   ltg_strategy:clone(blueprint.ltg_strategy)
  },
  sessions,
  traceability:clone(graph.traceability)
 };
 return deepFreeze({...body,projection_hash:hash(body)});
}

export function assertTeacherProjection(projection){
 if(!projection||projection.projection_version!==TEACHER_PROJECTION_VERSION||projection.status!=='READY_FOR_TEACHER'||typeof projection.projection_hash!=='string'||projection.projection_hash!==teacherProjectionHash(projection))throw Error('TEACHER_PROJECTION_TAMPERED');
 return true;
}
