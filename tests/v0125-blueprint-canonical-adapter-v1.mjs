import test from 'node:test';
import assert from 'node:assert/strict';
import { teacherProjectionHash } from '../shadow/pipeline-v1/projection.mjs';
import { adaptTeacherProjectionToCanonicalPlan, CANONICAL_ADAPTER_VERSION, canonicalPlanHash } from '../lib/v0125/blueprint-canonical-adapter.mjs';

function fixture() {
  const sources = {
    constraints: {
      grades: [1, 3],
      selected_pda_ids: ['p1'],
      requested_sessions: 2,
      minutes_per_session: 90,
      original_problem: 'El grupo necesita comprender sus acuerdos escolares.',
      original_context: 'Escuela multigrado sin internet.',
      available_resources: ['papel', 'lápices'],
      supports: ['modelado docente'],
      constraints_hash: 'a'.repeat(64),
    },
    curriculum: {
      pdas: [
        { pda_id: 'p1', grade: 1, field: 'De lo Humano y lo Comunitario', pda_official: 'Explica situaciones y propone acuerdos.' },
        { pda_id: 'p3', grade: 3, field: 'De lo Humano y lo Comunitario', pda_official: 'Indaga prácticas y acuerdos de su comunidad.' },
      ],
      snapshot_hash: 'b'.repeat(64),
    },
    methodology: {
      selected_id: 'proyectos_comunitarios',
      selection_source: 'TEACHER',
      catalog_version: 'METHODOLOGY_CATALOG_V1',
      methodology_decision_id: 'm1',
    },
  };

  const body = {
    projection_version: 'TEACHER_PLAN_PROJECTION_V1',
    status: 'READY_FOR_TEACHER',
    source: {
      blueprint_id: 'bp1',
      blueprint_revision: 1,
      approved_blueprint_hash: 'c'.repeat(64),
      graph_id: 'sg1',
      graph_revision: 1,
      approved_graph_hash: 'd'.repeat(64),
    },
    project: {
      problem_frame: { original_problem: sources.constraints.original_problem },
      guiding_question: { question: '¿Cómo podemos explicar y mejorar nuestros acuerdos?' },
      methodology: { selected_id: 'proyectos_comunitarios' },
      final_outcome: {
        name: 'Museo de acuerdos escolares',
        purpose: 'Explicar y poner en práctica acuerdos escolares.',
      },
      pda_analysis: [],
      grade_contributions: [
        { grade: 1, contribution: 'Explicaciones ilustradas', evidence: 'Tarjetas' },
        { grade: 3, contribution: 'Registro de indagación', evidence: 'Fichas' },
      ],
      project_stages: [],
      ltg_strategy: { mode: 'NONE', selections: [] },
    },
    sessions: [
      {
        session_number: 1,
        methodology_operations: ['IDENTIFICACION', 'RECUPERACION'],
        session_project_goal: 'Reconocer el problema y recuperar saberes.',
        project_state_after: 'Acuerdos y preguntas identificados.',
        expected_partial_product: 'Mapa inicial de acuerdos.',
        next_session_dependency: 'Usar el mapa para organizar explicaciones.',
        pda_focus: ['p1'],
        total_minutes: 90,
        activities: [
          {
            title: 'Identificamos acuerdos',
            contribution_mode: 'DIRECT',
            common_student_action: 'Reconocen situaciones y explican acuerdos.',
            grade_participation: [
              { grade: 1, student_action: 'Explica una situación.' },
              { grade: 3, student_action: 'Registra una práctica.' },
            ],
            teacher_role: 'Modela preguntas y organiza el intercambio.',
            minutes: 45,
            output: 'Mapa inicial',
            evidence: 'Registro del mapa',
          },
          {
            title: 'Organizamos hallazgos',
            contribution_mode: 'DIRECT',
            common_student_action: 'Organizan lo recuperado para el producto común.',
            grade_participation: [{ grade: 1 }, { grade: 3 }],
            teacher_role: 'Acompaña la organización.',
            minutes: 45,
            output: 'Acuerdos organizados',
            evidence: 'Tabla de acuerdos',
          },
        ],
      },
      {
        session_number: 2,
        methodology_operations: ['INTEGRACION', 'DIFUSION'],
        session_project_goal: 'Integrar y compartir el producto común.',
        project_state_after: 'Museo listo para compartirse.',
        expected_partial_product: 'Museo de acuerdos escolares.',
        next_session_dependency: '',
        pda_focus: ['p1'],
        total_minutes: 90,
        activities: [
          {
            title: 'Integramos el museo',
            contribution_mode: 'DIRECT',
            common_student_action: 'Integran sus aportes en un solo producto.',
            grade_participation: [{ grade: 1 }, { grade: 3 }],
            teacher_role: 'Coordina la integración.',
            minutes: 90,
            output: 'Museo integrado',
            evidence: 'Producto común',
          },
        ],
      },
    ],
    traceability: {},
  };
  const teacherPlan = { ...body, projection_hash: teacherProjectionHash(body) };
  return { sources, teacherPlan };
}

test('adapts approved teacher projection to the canonical v0125 compatibility shape without inventing PDA', () => {
  const { sources, teacherPlan } = fixture();
  const plan = adaptTeacherProjectionToCanonicalPlan({
    sources,
    teacherPlan,
    run_id: '11111111-1111-4111-8111-111111111111',
  });

  assert.equal(plan.canonical_adapter_version, CANONICAL_ADAPTER_VERSION);
  assert.deepEqual(plan.grades, [1, 3]);
  assert.equal(plan.context, sources.constraints.original_context);
  assert.equal(plan.problem, sources.constraints.original_problem);
  assert.deepEqual(plan.selected_pdas.map(x => x.pda_id), ['p1']);
  assert.equal(plan.selected_pdas[0].pda_official, 'Explica situaciones y propone acuerdos.');
  assert.equal(plan.methodology_engine.methodology_primary.id, 'proyectos_comunitarios');
  assert.equal(plan.methodology_engine.methodology_primary.selection_source, 'TEACHER');
  assert.equal(plan.project.final_product, 'Museo de acuerdos escolares');
  assert.equal(plan.project.grade_contributions.length, 2);
  assert.equal(plan.sessions.length, 2);
  assert.deepEqual(plan.sessions.map(x => x.total_minutes), [90, 90]);
  assert.equal(plan.teacher_presentation.sessions.length, 2);
  assert.equal(plan.teacher_presentation.sessions[0].activity_blocks.length, 2);
  assert.deepEqual(plan.teacher_presentation.sessions[0].activity_blocks[0].grades, [1, 3]);
  assert.deepEqual(plan.resources, ['papel', 'lápices']);
  assert.equal(plan.source_trace.teacher_projection_hash, teacherPlan.projection_hash);
  assert.equal(typeof canonicalPlanHash(plan), 'string');
  assert.equal(canonicalPlanHash(plan).length, 64);
  assert.ok(Object.isFrozen(plan));
});

test('zero PDA remains zero PDA and never borrows curriculum from another grade', () => {
  const { sources, teacherPlan } = fixture();
  sources.constraints.selected_pda_ids = [];
  const plan = adaptTeacherProjectionToCanonicalPlan({ sources, teacherPlan });
  assert.deepEqual(plan.selected_pdas, []);
  assert.deepEqual(plan.grades, [1, 3]);
});

test('adapter is deterministic for identical sources and projection', () => {
  const { sources, teacherPlan } = fixture();
  const a = adaptTeacherProjectionToCanonicalPlan({ sources, teacherPlan });
  const b = adaptTeacherProjectionToCanonicalPlan({ sources: structuredClone(sources), teacherPlan: structuredClone(teacherPlan) });
  assert.deepEqual(a, b);
  assert.equal(canonicalPlanHash(a), canonicalPlanHash(b));
});
