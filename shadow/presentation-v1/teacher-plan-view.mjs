import {deepFreeze,hash} from '../project-blueprint-v1/contracts.mjs';
import {assertTeacherProjection} from '../pipeline-v1/projection.mjs';

export const TEACHER_PLAN_VIEW_VERSION='TEACHER_PLAN_VIEW_V1';
export const RENDERABLE_PIPELINE_STATUS='READY_FOR_TEACHER';

export const PIPELINE_UI_STATES=deepFreeze({
 NEEDS_TEACHER_INPUT:{kind:'teacher_input',title:'Falta información docente',message:'Completa las restricciones y condiciones de trabajo antes de generar la planeación.',retryable:false},
 BLUEPRINT_NOT_APPROVED:{kind:'blocked',title:'El proyecto pedagógico requiere revisión',message:'El proyecto base no fue aprobado y no puede convertirse en planeación.',retryable:false},
 BLUEPRINT_STAGE_FAILED:{kind:'error',title:'No se pudo construir el proyecto pedagógico',message:'La etapa de ProjectBlueprint terminó con error. No se generó una planeación final.',retryable:true},
 BLUEPRINT_REVISION_REQUIRED:{kind:'blocked',title:'El proyecto necesita una revisión estructural',message:'La microarquitectura de sesiones no puede resolverse sin revisar el ProjectBlueprint aprobado.',retryable:false},
 SESSION_AUTHOR_DRIVER_REQUIRED:{kind:'error',title:'Autor de sesiones no disponible',message:'El servicio de autoría de sesiones no está disponible. No se generó una planeación final.',retryable:true},
 SESSION_AUTHORING_FAILED:{kind:'error',title:'No se pudieron construir las actividades',message:'La autoría del SessionGraph falló y el sistema se detuvo antes de presentar una planeación.',retryable:true},
 SESSION_GRAPH_CONTRACT_REJECTED:{kind:'rejected',title:'La secuencia no cumple el contrato',message:'La secuencia de sesiones fue rechazada por validaciones deterministas. No se mostrará como planeación terminada.',retryable:true},
 SESSION_REVIEW_UNAVAILABLE:{kind:'error',title:'No fue posible revisar la secuencia',message:'La revisión pedagógica crítica no estuvo disponible. El sistema mantiene el resultado cerrado por seguridad.',retryable:true},
 SESSION_GRAPH_REJECTED:{kind:'rejected',title:'La secuencia fue rechazada',message:'Los Gates pedagógicos detectaron defectos en la secuencia. No se produjo una planeación final.',retryable:true},
 SESSION_REPAIR_FAILED:{kind:'error',title:'La reparación de sesiones falló',message:'La única reparación permitida no pudo completarse de forma válida.',retryable:true},
 PIPELINE_RUNNER_UNAVAILABLE:{kind:'error',title:'Motor de planeación no disponible',message:'El motor del pipeline no está disponible temporalmente.',retryable:true},
 SHADOW_ERROR:{kind:'error',title:'Error del flujo de validación',message:'El flujo se detuvo sin convertir el error en una planeación exitosa.',retryable:true},
 READY_FOR_TEACHER:{kind:'ready',title:'Planeación lista',message:'La planeación superó ProjectBlueprint, SessionGraph y los Gates pedagógicos.',retryable:false}
});

const clone=value=>structuredClone(value);
const defaultUnknown=status=>deepFreeze({kind:'error',title:'Estado no reconocido',message:`El pipeline devolvió un estado no reconocido (${String(status||'UNKNOWN')}). No se mostrará una planeación final.`,retryable:false});

export function pipelinePresentationState(result){
 const status=result?.status||'UNKNOWN';
 const descriptor=PIPELINE_UI_STATES[status]||defaultUnknown(status);
 const ready=status===RENDERABLE_PIPELINE_STATUS;
 let projection_valid=false;
 let projection_error=null;
 if(ready){
  try{assertTeacherProjection(result?.teacher_plan);projection_valid=true;}
  catch(error){projection_error=String(error?.message||error);}
 }
 return deepFreeze({
  status,
  renderable:ready&&projection_valid,
  projection_valid,
  projection_error,
  descriptor:clone(descriptor),
  repair_count:Number(result?.repair_count||0),
  pipeline_version:result?.pipeline_version||null
 });
}

function assertTeacherContextBinding(binding,projection){
 if(binding===null||binding===undefined)return null;
 if(!binding||typeof binding!=='object'||Array.isArray(binding))throw Error('TEACHER_CONTEXT_BINDING_INVALID');
 if(binding.projection_hash!==projection.projection_hash)throw Error('TEACHER_CONTEXT_PROJECTION_HASH_MISMATCH');
 if(typeof binding.constraints_hash!=='string'||!/^[a-f0-9]{64}$/.test(binding.constraints_hash))throw Error('TEACHER_CONTEXT_CONSTRAINTS_HASH_REQUIRED');
 if(!binding.teacher_context||typeof binding.teacher_context!=='object'||Array.isArray(binding.teacher_context))throw Error('TEACHER_CONTEXT_METADATA_REQUIRED');
 return clone(binding);
}

/**
 * Pure presentation adapter for the new pipeline.
 * It only renames/groups fields already present in TeacherPlanProjectionV1.
 * It cannot synthesize pedagogy, fill missing stages, or repair rejected plans.
 */
export function toTeacherPlanView({pipelineResult,teacherContextBinding=null}={}){
 const state=pipelinePresentationState(pipelineResult);
 if(!state.renderable)throw Object.assign(Error(`TEACHER_PLAN_NOT_RENDERABLE:${state.status}:${state.projection_error||''}`),{code:'TEACHER_PLAN_NOT_RENDERABLE',status:state.status});
 const projection=pipelineResult.teacher_plan;
 const contextBinding=assertTeacherContextBinding(teacherContextBinding,projection);
 const body={
  view_version:TEACHER_PLAN_VIEW_VERSION,
  status:'READY_FOR_TEACHER',
  source:{
   projection_version:projection.projection_version,
   projection_hash:projection.projection_hash,
   blueprint_id:projection.source.blueprint_id,
   blueprint_revision:projection.source.blueprint_revision,
   approved_blueprint_hash:projection.source.approved_blueprint_hash,
   graph_id:projection.source.graph_id,
   graph_revision:projection.source.graph_revision,
   approved_graph_hash:projection.source.approved_graph_hash,
   pipeline_version:pipelineResult.pipeline_version||null,
   constraints_hash:contextBinding?.constraints_hash||null
  },
  teacher_context:contextBinding?.teacher_context||null,
  project:{
   name:projection.project.final_outcome.name,
   description:projection.project.final_outcome.description,
   purpose:projection.project.final_outcome.purpose,
   audience_or_beneficiary:projection.project.final_outcome.audience_or_beneficiary,
   use_or_destination:projection.project.final_outcome.use_or_destination,
   guiding_question:projection.project.guiding_question.question,
   problem_frame:clone(projection.project.problem_frame),
   methodology:clone(projection.project.methodology),
   final_outcome:clone(projection.project.final_outcome),
   pda_analysis:clone(projection.project.pda_analysis),
   grade_contributions:clone(projection.project.grade_contributions),
   project_stages:clone(projection.project.project_stages),
   ltg_strategy:clone(projection.project.ltg_strategy)
  },
  sessions:projection.sessions.map(session=>({
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
   acceptance_criteria:clone(session.acceptance_criteria),
   project_state_after:session.project_state_after,
   terminal:session.terminal,
   next_session_dependency:session.next_session_dependency,
   total_minutes:session.total_minutes,
   activities:clone(session.activities)
  })),
  traceability:clone(projection.traceability)
 };
 return deepFreeze({...body,view_hash:hash(body)});
}

export const teacherPlanViewHash=view=>hash(Object.fromEntries(Object.entries(view||{}).filter(([key])=>key!=='view_hash')));

export function assertTeacherPlanView(view){
 if(!view||view.view_version!==TEACHER_PLAN_VIEW_VERSION||view.status!=='READY_FOR_TEACHER'||typeof view.view_hash!=='string'||teacherPlanViewHash(view)!==view.view_hash)throw Error('TEACHER_PLAN_VIEW_TAMPERED');
 if(view.source?.projection_hash===null||typeof view.source?.projection_hash!=='string')throw Error('TEACHER_PLAN_VIEW_PROJECTION_BINDING_REQUIRED');
 return true;
}
