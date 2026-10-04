import { deepFreeze, hash } from '../../shadow/project-blueprint-v1/contracts.mjs';
import { assertTeacherProjection } from '../../shadow/pipeline-v1/projection.mjs';

export const CANONICAL_ADAPTER_VERSION = 'PROJECT_BLUEPRINT_CANONICAL_ADAPTER_V1';

const clone = value => structuredClone(value);
const arr = value => Array.isArray(value) ? value : [];
const text = value => String(value ?? '').trim();

export const canonicalPlanHash = plan => hash(plan);

function assertSources(sources) {
  if (!sources || typeof sources !== 'object') throw Error('CANONICAL_ADAPTER_SOURCES_REQUIRED');
  for (const key of ['constraints', 'curriculum', 'methodology']) {
    if (!sources[key] || typeof sources[key] !== 'object') throw Error(`CANONICAL_ADAPTER_${key.toUpperCase()}_REQUIRED`);
  }
}

function selectedPdas(constraints, curriculum) {
  const selected = new Set(arr(constraints.selected_pda_ids).map(String));
  return arr(curriculum.pdas)
    .filter(pda => selected.has(String(pda?.pda_id ?? '')))
    .map(pda => clone(pda));
}

function phaseOf(session) {
  return arr(session?.methodology_operations).map(text).filter(Boolean).join(' · ');
}

function activityBlocks(session) {
  return arr(session?.activities).map(activity => ({
    label: text(activity?.title) || text(activity?.contribution_mode) || 'Actividad',
    grades: [...new Set(arr(activity?.grade_participation).map(row => Number(row?.grade)).filter(Number.isInteger))],
    narrative: text(activity?.common_student_action) || text(activity?.output),
    teacher_role: text(activity?.teacher_role),
    minutes: Number(activity?.minutes || 0),
    evidence: text(activity?.evidence),
  }));
}

function projectSequence(sessions) {
  return sessions.map(session => ({
    session_number: Number(session.session_number),
    phase: phaseOf(session),
    purpose: text(session.session_project_goal),
    project_advance: text(session.project_state_after),
    partial_product: text(session.expected_partial_product),
    prepares_next: text(session.next_session_dependency),
  }));
}

function teacherPresentationSessions(sessions) {
  return sessions.map(session => ({
    session_number: Number(session.session_number),
    total_minutes: Number(session.total_minutes || 0),
    phase: phaseOf(session),
    purpose: text(session.session_project_goal),
    project_advance: text(session.project_state_after),
    partial_product: text(session.expected_partial_product),
    prepares_next: text(session.next_session_dependency),
    teacher_narrative: '',
    activity_blocks: activityBlocks(session),
    closure_narrative: '',
  }));
}

function canonicalSessions(sessions) {
  return sessions.map(session => ({
    session_number: Number(session.session_number),
    total_minutes: Number(session.total_minutes || 0),
    purpose: text(session.session_project_goal),
    project_stage: phaseOf(session),
    project_advance: text(session.project_state_after),
    partial_product: text(session.expected_partial_product),
    prepares_next: text(session.next_session_dependency),
    pda_focus: [...arr(session.pda_focus)],
    methodology_operations: [...arr(session.methodology_operations)],
    activities: clone(arr(session.activities)),
  }));
}

export function adaptTeacherProjectionToCanonicalPlan({ sources, teacherPlan, run_id = null, base_run_id = null }) {
  assertSources(sources);
  assertTeacherProjection(teacherPlan);

  const constraints = sources.constraints;
  const curriculum = sources.curriculum;
  const methodology = sources.methodology;
  const projectionProject = teacherPlan.project || {};
  const finalOutcome = projectionProject.final_outcome || {};
  const contributions = clone(arr(projectionProject.grade_contributions));
  const sessions = clone(arr(teacherPlan.sessions));
  const methodologyId = text(methodology.selected_id) || text(projectionProject.methodology?.selected_id);
  const outcomeName = text(finalOutcome.name);
  const outcomePurpose = text(finalOutcome.purpose);

  const plan = {
    canonical_adapter_version: CANONICAL_ADAPTER_VERSION,
    ...(text(run_id) ? { run_id: text(run_id) } : {}),
    ...(text(base_run_id) ? { base_run_id: text(base_run_id) } : {}),
    grades: arr(constraints.grades).map(Number).filter(Number.isInteger),
    context: text(constraints.original_context),
    problem: text(constraints.original_problem),
    selected_pdas: selectedPdas(constraints, curriculum),
    methodology_engine: {
      methodology_primary: {
        id: methodologyId,
        catalog_version: text(methodology.catalog_version),
        selection_source: text(methodology.selection_source),
      },
      integrated_project: {
        title: outcomeName,
        display_title: outcomeName,
        collective_product_or_service: outcomeName,
        unifying_mission: outcomePurpose,
        grade_contributions: contributions,
      },
    },
    project: {
      title: outcomeName,
      final_product: outcomeName,
      mission: outcomePurpose,
      grade_contributions: contributions,
    },
    project_sequence: projectSequence(sessions),
    sessions: canonicalSessions(sessions),
    teacher_presentation: {
      project_title: outcomeName,
      project_final_product: outcomeName,
      project_mission: outcomePurpose,
      sessions: teacherPresentationSessions(sessions),
    },
    resources: [...arr(constraints.available_resources)],
    supports: [...arr(constraints.supports)],
    source_trace: {
      constraints_hash: text(constraints.constraints_hash),
      curriculum_snapshot_hash: text(curriculum.snapshot_hash),
      methodology_decision_id: text(methodology.methodology_decision_id),
      teacher_projection_hash: text(teacherPlan.projection_hash),
      approved_blueprint_hash: text(teacherPlan.source?.approved_blueprint_hash),
      approved_graph_hash: text(teacherPlan.source?.approved_graph_hash),
    },
  };

  return deepFreeze(plan);
}
