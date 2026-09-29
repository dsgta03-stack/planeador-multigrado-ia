import {deepFreeze} from '../project-blueprint-v1/contracts.mjs';
import {assertTeacherPlanView} from './teacher-plan-view.mjs';
import {assertFinalPlanSnapshot,restoreTeacherPlanView} from './final-plan-snapshot.mjs';

export const EXPORT_SOURCE_VERSION='TEACHER_EXPORT_SOURCE_V1';

const clone=value=>structuredClone(value);

/**
 * Canonical source selector for future DOCX/PDF/exporters.
 * Exporters may consume only an already validated TeacherPlanView or a validated final snapshot.
 * They may never read raw provider output, rejected pipeline results, or invent fallback pedagogy.
 */
export function exportSourceFromView(view){
 assertTeacherPlanView(view);
 return deepFreeze({
  export_source_version:EXPORT_SOURCE_VERSION,
  source_kind:'TEACHER_PLAN_VIEW',
  projection_hash:view.source.projection_hash,
  view_hash:view.view_hash,
  snapshot_hash:null,
  plan_view:clone(view)
 });
}

export function exportSourceFromSnapshot(snapshot){
 assertFinalPlanSnapshot(snapshot);
 const view=restoreTeacherPlanView(snapshot);
 return deepFreeze({
  export_source_version:EXPORT_SOURCE_VERSION,
  source_kind:'FINAL_PLAN_SNAPSHOT',
  projection_hash:view.source.projection_hash,
  view_hash:view.view_hash,
  snapshot_hash:snapshot.snapshot_hash,
  plan_view:clone(view)
 });
}

export function assertExportSource(source){
 if(!source||source.export_source_version!==EXPORT_SOURCE_VERSION)throw Error('EXPORT_SOURCE_INVALID');
 assertTeacherPlanView(source.plan_view);
 if(source.projection_hash!==source.plan_view.source.projection_hash||source.view_hash!==source.plan_view.view_hash)throw Error('EXPORT_SOURCE_BINDING_MISMATCH');
 if(source.source_kind==='FINAL_PLAN_SNAPSHOT'&&typeof source.snapshot_hash!=='string')throw Error('EXPORT_SOURCE_SNAPSHOT_HASH_REQUIRED');
 if(!['TEACHER_PLAN_VIEW','FINAL_PLAN_SNAPSHOT'].includes(source.source_kind))throw Error('EXPORT_SOURCE_KIND_INVALID');
 return true;
}
