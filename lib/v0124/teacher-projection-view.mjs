import {deepFreeze,hash} from '../../shadow/project-blueprint-v1/contracts.mjs';
import {assertTeacherPlanView} from '../../shadow/presentation-v1/teacher-plan-view.mjs';

export const V0124_CERTIFIED_TEACHER_VIEW_VERSION='V0124_CERTIFIED_TEACHER_VIEW_V1';

const clone=value=>structuredClone(value);
const withoutModelHash=value=>Object.fromEntries(Object.entries(value||{}).filter(([key])=>key!=='view_model_hash'));
export const certifiedTeacherViewModelHash=model=>hash(withoutModelHash(model));

/** Reversible grouping of an already validated TeacherPlanView; no content is authored here. */
export function toV0124TeacherProjectionView(view){
 assertTeacherPlanView(view);
 if(!view.project||typeof view.project!=='object'||Array.isArray(view.project)||
    !Object.hasOwn(view.project,'pda_analysis')||!Object.hasOwn(view.project,'methodology')||
    !Array.isArray(view.project.pda_analysis)||!view.project.methodology||
    !Array.isArray(view.sessions)||!view.traceability||typeof view.traceability!=='object'){
  throw Error('CERTIFIED_TEACHER_VIEW_INCOMPLETE');
 }
 const {pda_analysis,methodology,...project}=view.project;
 const body={
  view_model_version:V0124_CERTIFIED_TEACHER_VIEW_VERSION,
  status:view.status,
  source:{...clone(view.source),view_version:view.view_version,view_hash:view.view_hash},
  project:clone(project),
  pda_analysis:clone(pda_analysis),
  methodology:clone(methodology),
  sessions:clone(view.sessions),
  traceability:clone(view.traceability),
  teacher_context:clone(view.teacher_context)
 };
 return deepFreeze({...body,view_model_hash:hash(body)});
}

export function assertV0124TeacherProjectionView(model){
 if(!model||model.view_model_version!==V0124_CERTIFIED_TEACHER_VIEW_VERSION||
    model.status!=='READY_FOR_TEACHER'||typeof model.view_model_hash!=='string'||
    model.view_model_hash!==certifiedTeacherViewModelHash(model))throw Error('V0124_CERTIFIED_TEACHER_VIEW_TAMPERED');
 if(!model.source||!model.project||!Array.isArray(model.pda_analysis)||
    !model.methodology||!Array.isArray(model.sessions)||!model.traceability)throw Error('V0124_CERTIFIED_TEACHER_VIEW_INCOMPLETE');
 const {view_version,view_hash,...source}=model.source;
 const view={
  view_version,view_hash,status:model.status,source,
  teacher_context:model.teacher_context,
  project:{...model.project,methodology:model.methodology,pda_analysis:model.pda_analysis},
  sessions:model.sessions,traceability:model.traceability
 };
 assertTeacherPlanView(view);
 return true;
}
