import test from 'node:test';
import assert from 'node:assert/strict';

import {
  makeProjectComposition,
  validateProjectComposition
} from '../composition.mjs';

const sources=()=>({
  constraints:{
    constraints_hash:'a'.repeat(64),
    grades:[1,3,6],
    selected_pda_ids:['p1','p3']
  },
  curriculum:{
    snapshot_hash:'b'.repeat(64),
    pdas:[
      {pda_id:'p1',grade:1},
      {pda_id:'p3',grade:3}
    ],
    ltg:[
      {
        project_id:'ltg-base',
        grade:3,
        book:'Proyectos de Aula',
        scenario:'Aula',
        name:'Proyecto base',
        purpose:'Investigar una situación del entorno.',
        central_product:'Modelo explicativo.',
        pages:{start:10,end:20},
        verified_pda_links:['p3'],
        verified_activities:[
          {
            activity_id:'base-a1',
            activity_order:1,
            summary:'Explorar',
            page_start:10,
            page_end:11,
            verification_status:'verified'
          }
        ]
      },
      {
        project_id:'ltg-enrich',
        grade:1,
        book:'Proyectos de Aula',
        scenario:'Aula',
        name:'Proyecto complementario',
        purpose:'Observar y registrar.',
        central_product:'Registro.',
        pages:{start:30,end:35},
        verified_pda_links:['p1'],
        verified_activities:[
          {
            activity_id:'enrich-a1',
            activity_order:1,
            summary:'Observar',
            page_start:30,
            page_end:31,
            verification_status:'verified'
          }
        ]
      }
    ]
  },
  methodology:{
    methodology_decision_id:'m1',
    selected_id:'steam',
    catalog_version:'METHODOLOGY_CATALOG_V1',
    required_operations:[
      'INTRODUCCION_PROBLEMATIZACION'
    ]
  }
});

const validInput=()=>({
  methodology:{
    selected_id:'steam',
    catalog_version:'METHODOLOGY_CATALOG_V1'
  },
  base:{
    origin:'LTG_VERIFIED',
    project_id:'ltg-base',
    name:'Proyecto base',
    purpose:'Investigar una situación del entorno.',
    central_product:'Modelo explicativo.',
    compatibility:'DIRECT',
    reason:'El propósito de indagación es compatible con la metodología.'
  },
  enrichments:[
    {
      project_id:'ltg-enrich',
      activity_ids:['enrich-a1'],
      contribution:'Aporta una observación inicial verificable.',
      reason:'Enriquece el proyecto base sin crear un segundo producto.'
    }
  ],
  references:[],
  grade_coverage:[
    {
      grade:1,
      mode:'ENRICHMENT_PDA',
      pda_ids:['p1']
    },
    {
      grade:3,
      mode:'BASE_PDA',
      pda_ids:['p3']
    },
    {
      grade:6,
      mode:'TRANSVERSAL_PROJECT',
      pda_ids:[]
    }
  ],
  final_outcome:{
    name:'Modelo explicativo compartido',
    purpose:'Explicar lo investigado mediante evidencias del grupo.',
    description:'Un único resultado común construido por los grados participantes.'
  },
  cohesion:{
    one_project_reason:'Todas las aportaciones alimentan el mismo modelo explicativo.',
    enrichment_boundary:'El proyecto complementario aporta sólo una actividad; no conserva su producto independiente.'
  },
  rejected_options:[],
  ai_original_required:false
});

test('verified BASE plus controlled enrichment passes',()=>{
  const s=sources();
  const composition=makeProjectComposition(validInput(),s);

  assert.equal(composition.base.project_id,'ltg-base');
  assert.equal(
    composition.enrichments[0].activity_ids[0],
    'enrich-a1'
  );
  assert.equal(Object.isFrozen(composition),true);
});

test('every active grade must be represented',()=>{
  const s=sources();
  const input=validInput();

  input.grade_coverage=
    input.grade_coverage.filter(x=>x.grade!==6);

  assert.throws(
    ()=>makeProjectComposition(input,s),
    /PCD-003 ACTIVE_GRADE_COVERAGE_REQUIRED/
  );
});

test('transversal grade cannot borrow another grade PDA',()=>{
  const s=sources();
  const input=validInput();

  const row=input.grade_coverage.find(x=>x.grade===6);
  row.pda_ids=['p3'];

  assert.throws(
    ()=>makeProjectComposition(input,s),
    /PCD-004/
  );
});

test('unverified enrichment activity fails closed',()=>{
  const s=sources();
  const input=validInput();

  input.enrichments[0].activity_ids=['invented'];

  assert.throws(
    ()=>makeProjectComposition(input,s),
    /PCD-007 ENRICHMENT_ACTIVITY_NOT_VERIFIED/
  );
});

test('AI original BASE requires explicit necessity',()=>{
  const s=sources();
  const input=validInput();

  input.base={
    origin:'AI_ORIGINAL',
    project_id:null,
    name:'Proyecto original',
    purpose:'Resolver la necesidad contextual.',
    central_product:'Producto común.',
    compatibility:'DIRECT',
    reason:'No existe un proyecto LTG adecuado.'
  };

  input.enrichments=[];
  input.ai_original_required=true;

  const composition=makeProjectComposition(input,s);

  assert.equal(
    validateProjectComposition(composition,s),
    composition
  );
});