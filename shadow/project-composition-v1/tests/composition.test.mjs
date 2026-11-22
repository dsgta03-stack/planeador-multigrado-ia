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
test('every selected PDA must remain in composition coverage',()=>{
  const s=sources();
  const input=validInput();

  const row=
    input.grade_coverage.find(
      x=>x.grade===1
    );

  row.pda_ids=[];

  assert.throws(
    ()=>makeProjectComposition(input,s),
    /PCD-004 SELECTED_PDA_MUST_BE_DEVELOPED/
  );
});

test('selected PDA grade cannot become transversal',()=>{
  const s=sources();
  const input=validInput();

  const row=
    input.grade_coverage.find(
      x=>x.grade===1
    );

  row.mode='TRANSVERSAL_PROJECT';

  assert.throws(
    ()=>makeProjectComposition(input,s),
    /PCD-004 TRANSVERSAL_MUST_NOT_BORROW_PDA:1/
  );
});

test('selected PDA cannot appear in more than one coverage row',()=>{
  const s=sources();
  const input=validInput();

  const row6=
    input.grade_coverage.find(
      x=>x.grade===6
    );

  row6.mode='ENRICHMENT_PDA';
  row6.pda_ids=['p1'];

  assert.throws(
    ()=>makeProjectComposition(input,s),
    /PCD-004/
  );
});

test('real CORE and SUPPORT decisions are retained by compatible composition',()=>{
  const s=sources(),input=validInput();
  s.constraints.explicit_ltg_selections=[
    {project_id:'ltg-base',pda_ids:['p3'],intent:'CORE'},
    {project_id:'ltg-enrich',pda_ids:['p1'],intent:'SUPPORT'}
  ];
  const before=structuredClone(s);
  const composition=makeProjectComposition(input,s);
  assert.equal(validateProjectComposition(composition,s),composition);
  assert.deepEqual(s,before);
});

for(const [project_id,intent] of [
  ['ltg-base','SUPPORT'],['ltg-enrich','CORE'],['ltg-enrich','OPTIONAL']
]){
  test(`composition rejects replacing explicit ${intent} on ${project_id}`,()=>{
    const s=sources();
    s.constraints.explicit_ltg_selections=[{project_id,pda_ids:[project_id==='ltg-base'?'p3':'p1'],intent}];
    assert.throws(()=>makeProjectComposition(validInput(),s),/PCD-009 EXPLICIT_LTG_INTENT_MISMATCH/);
  });
}

test('explicit project cannot be omitted or reduced to REFERENCE',()=>{
  for(const reference of [false,true]){
    const s=sources(),input=validInput();
    s.constraints.explicit_ltg_selections=[{project_id:'ltg-enrich',pda_ids:['p1'],intent:'SUPPORT'}];
    input.enrichments=[];
    if(reference)input.references=[{project_id:'ltg-enrich',reason:'Referencia'}];
    assert.throws(()=>makeProjectComposition(input,s),/PCD-009 EXPLICIT_LTG_OPERATIONAL_PROJECT_REQUIRED/);
  }
});

test('explicit PDA must be selected, linked and of the official LTG grade',()=>{
  for(const kind of ['unselected','unlinked','wrong-grade']){
    const s=sources();
    if(kind==='unselected')s.curriculum.ltg[1].verified_pda_links.push('outside');
    if(kind==='unlinked')s.curriculum.ltg[1].verified_pda_links=[];
    if(kind==='wrong-grade')s.curriculum.ltg[1].grade=3;
    s.constraints.explicit_ltg_selections=[{project_id:'ltg-enrich',pda_ids:[kind==='unselected'?'outside':'p1'],intent:'SUPPORT'}];
    assert.throws(()=>makeProjectComposition(validInput(),s),/PCD-009 EXPLICIT_LTG_PDA_NOT_VERIFIED/);
  }
});

test('explicit BASE PDA must belong to BASE_PDA curricular coverage',()=>{
  const s=sources(),input=validInput();
  s.constraints.explicit_ltg_selections=[{project_id:'ltg-base',pda_ids:['p3'],intent:'CORE'}];
  input.grade_coverage[1].mode='ENRICHMENT_PDA';
  assert.throws(()=>makeProjectComposition(input,s),/PCD-009 EXPLICIT_LTG_BASE_PDA_COVERAGE_MISMATCH/);
});
