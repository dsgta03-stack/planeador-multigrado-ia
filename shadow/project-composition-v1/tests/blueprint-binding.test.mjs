import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertProjectCompositionBinding
} from '../blueprint-binding.mjs';

const composition=()=>({
  methodology:{
    selected_id:'steam',
    catalog_version:'METHODOLOGY_CATALOG_V1'
  },

  base:{
    origin:'LTG_VERIFIED',
    project_id:'base-project'
  },

  enrichments:[
    {
      project_id:'support-project',
      activity_ids:[
        'support-a1'
      ]
    }
  ],

  references:[
    {
      project_id:'reference-project',
      reason:'Sólo referencia.'
    }
  ],

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
    purpose:'Comunicar lo investigado.',
    description:
      'Un único producto construido con evidencias.'
  }
});

const blueprint=()=>({
  methodology:{
    selected_id:'steam',
    catalog_version:'METHODOLOGY_CATALOG_V1'
  },

  final_outcome:{
    outcome_id:'outcome_01',
    name:'Modelo explicativo compartido',
    type:'INVESTIGATION',
    description:
      'Un único producto construido con evidencias.',
    purpose:'Comunicar lo investigado.'
  },

  ltg_strategy:{
    mode:'CORE',
    selections:[
      {
        project_id:'base-project',
        role:'CORE',
        pda_ids:['p3'],
        activity_ids:[],
        reason:'Proyecto base.'
      },
      {
        project_id:'support-project',
        role:'SUPPORT',
        pda_ids:['p1'],
        activity_ids:[
          'support-a1'
        ],
        reason:'Aporta observación.'
      }
    ],
    reason:'Composición vinculada.'
  }
});

test('Blueprint matching composition passes',()=>{
  assert.equal(
    assertProjectCompositionBinding(
      blueprint(),
      composition()
    ),
    true
  );
});

test('Blueprint cannot replace final outcome with museum',()=>{
  const b=blueprint();

  b.final_outcome={
    ...b.final_outcome,
    name:'Museo escolar',
    type:'MUSEUM',
    description:'Museo con piezas.'
  };

  assert.throws(
    ()=>assertProjectCompositionBinding(
      b,
      composition()
    ),
    /PCB-003/
  );
});

test('verified BASE must remain CORE',()=>{
  const b=blueprint();

  b.ltg_strategy.selections[0].role=
    'SUPPORT';

  assert.throws(
    ()=>assertProjectCompositionBinding(
      b,
      composition()
    ),
    /PCB-005/
  );
});

test('enrichment activities cannot be expanded by Blueprint',()=>{
  const b=blueprint();

  b.ltg_strategy.selections[1]
    .activity_ids.push(
      'invented-or-unapproved'
    );

  assert.throws(
    ()=>assertProjectCompositionBinding(
      b,
      composition()
    ),
    /PCB-006/
  );
});

test('Blueprint cannot operationalize REFERENCE project',()=>{
  const b=blueprint();

  b.ltg_strategy.selections.push({
    project_id:'reference-project',
    role:'OPTIONAL',
    pda_ids:['p1'],
    activity_ids:[],
    reason:'Intento de uso.'
  });

  assert.throws(
    ()=>assertProjectCompositionBinding(
      b,
      composition()
    ),
    /PCB-007|PCB-008/
  );
});

test('AI original with no LTG requires NONE mode',()=>{
  const c=composition();

  c.base={
    origin:'AI_ORIGINAL',
    project_id:null
  };

  c.enrichments=[];
  c.references=[];

  const b=blueprint();

  b.ltg_strategy={
    mode:'NONE',
    selections:[],
    reason:'No se usa LTG operacional.'
  };

  assert.equal(
    assertProjectCompositionBinding(
      b,
      c
    ),
    true
  );
});

test('AI original cannot silently operationalize LTG',()=>{
  const c=composition();

  c.base={
    origin:'AI_ORIGINAL',
    project_id:null
  };

  c.enrichments=[];
  c.references=[];

  const b=blueprint();

  b.ltg_strategy={
    mode:'SUPPORT',
    selections:[
      {
        project_id:'base-project',
        role:'SUPPORT',
        pda_ids:['p3'],
        activity_ids:[],
        reason:'No autorizado.'
      }
    ],
    reason:'No autorizado.'
  };

  assert.throws(
    ()=>assertProjectCompositionBinding(
      b,
      c
    ),
    /PCB-007|PCB-009/
  );
});