import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProjectCandidatePool
} from '../candidate-pool.mjs';

const sources=()=>({
  constraints:{
    constraints_hash:'a'.repeat(64),
    grades:[1,3,6],
    selected_pda_ids:['p1','p3'],
    explicit_ltg_selections:[
      {
        project_id:'support-project',
        pda_ids:['p1'],
        intent:'SUPPORT'
      },
      {
        project_id:'core-project',
        pda_ids:['p3'],
        intent:'CORE'
      }
    ]
  },

  curriculum:{
    snapshot_hash:'b'.repeat(64),
    pdas:[
      {pda_id:'p1',grade:1},
      {pda_id:'p3',grade:3}
    ],
    ltg:[
      {
        project_id:'ordinary-project',
        grade:1,
        book:'Proyectos de Aula',
        scenario:'Aula',
        name:'Proyecto ordinario',
        related_contents:'Contenido',
        purpose:'Propósito ordinario',
        central_product:'Producto ordinario',
        pages:{start:1,end:5},
        verified_pda_links:['p1'],
        verified_activities:[
          {
            activity_id:'ordinary-a1',
            activity_order:1,
            summary:'Actividad',
            page_start:1,
            page_end:2,
            verification_status:'verified'
          }
        ]
      },
      {
        project_id:'support-project',
        grade:1,
        book:'Proyectos de Aula',
        scenario:'Aula',
        name:'Proyecto apoyo',
        related_contents:'Contenido',
        purpose:'Propósito apoyo',
        central_product:'Producto apoyo',
        pages:{start:10,end:15},
        verified_pda_links:['p1'],
        verified_activities:[
          {
            activity_id:'support-a1',
            activity_order:1,
            summary:'Actividad apoyo',
            page_start:10,
            page_end:11,
            verification_status:'verified'
          }
        ]
      },
      {
        project_id:'core-project',
        grade:3,
        book:'Proyectos de Aula',
        scenario:'Aula',
        name:'Proyecto central',
        related_contents:'Contenido',
        purpose:'Investigar el entorno',
        central_product:'Modelo explicativo',
        pages:{start:20,end:30},
        verified_pda_links:['p3'],
        verified_activities:[
          {
            activity_id:'core-a1',
            activity_order:1,
            activity_type:'indagacion',
            title:'Exploramos',
            summary:'Explorar evidencias',
            organization:'Equipos',
            materials:'Cuaderno',
            guiding_questions:'Qué observamos',
            evidence_or_record:'Registro',
            product_contribution:'Aporta al modelo',
            semantic_tags:['indagacion'],
            page_start:20,
            page_end:21,
            verification_status:'verified'
          }
        ]
      },
      {
        project_id:'irrelevant-project',
        grade:3,
        book:'Proyectos de Aula',
        scenario:'Aula',
        name:'Proyecto no relacionado',
        related_contents:'Otro',
        purpose:'Otro propósito',
        central_product:'Otro producto',
        pages:{start:40,end:45},
        verified_pda_links:['other-pda'],
        verified_activities:[]
      }
    ]
  },

  methodology:{
    methodology_decision_id:'m1',
    selected_id:'steam',
    catalog_version:'METHODOLOGY_CATALOG_V1',
    required_operations:[
      'INTRODUCCION_PROBLEMATIZACION',
      'DISENO_Y_DESARROLLO_INDAGACION'
    ]
  }
});

test('explicit CORE is prioritized before SUPPORT and linked candidates',()=>{
  const pool=buildProjectCandidatePool(sources());

  assert.deepEqual(
    pool.candidates.map(x=>x.project_id),
    [
      'core-project',
      'support-project',
      'ordinary-project'
    ]
  );
});

test('unrelated LTG projects are excluded',()=>{
  const pool=buildProjectCandidatePool(sources());

  assert.equal(
    pool.candidates.some(
      x=>x.project_id==='irrelevant-project'
    ),
    false
  );
});

test('rich verified activity metadata survives candidate pool',()=>{
  const pool=buildProjectCandidatePool(sources());

  const core=pool.candidates.find(
    x=>x.project_id==='core-project'
  );

  assert.equal(
    core.verified_activities[0].activity_type,
    'indagacion'
  );

  assert.equal(
    core.verified_activities[0].product_contribution,
    'Aporta al modelo'
  );

  assert.deepEqual(
    core.verified_activities[0].semantic_tags,
    ['indagacion']
  );
});

test('candidate pool does not claim semantic compatibility',()=>{
  const pool=buildProjectCandidatePool(sources());

  const core=pool.candidates.find(
    x=>x.project_id==='core-project'
  );

  assert.equal(core.structurally_eligible_base,true);
  assert.equal(
    Object.hasOwn(core,'methodology_compatible'),
    false
  );
});

test('explicit LTG missing from curriculum fails closed',()=>{
  const s=sources();

  s.constraints.explicit_ltg_selections.push({
    project_id:'missing-project',
    pda_ids:['p1'],
    intent:'OPTIONAL'
  });

  assert.throws(
    ()=>buildProjectCandidatePool(s),
    /PCP-001 EXPLICIT_LTG_MISSING/
  );
});

test('explicit LTG cannot bind an unselected PDA',()=>{
  const s=sources();

  s.constraints.explicit_ltg_selections[0].pda_ids=[
    'not-selected'
  ];

  assert.throws(
    ()=>buildProjectCandidatePool(s),
    /PCP-002 EXPLICIT_LTG_USES_UNSELECTED_PDA/
  );
});

test('candidate pool is deeply frozen',()=>{
  const pool=buildProjectCandidatePool(sources());

  assert.equal(Object.isFrozen(pool),true);
  assert.equal(Object.isFrozen(pool.candidates),true);
  assert.equal(Object.isFrozen(pool.candidates[0]),true);
});