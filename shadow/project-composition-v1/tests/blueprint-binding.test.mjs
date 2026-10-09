import test from 'node:test';
import assert from 'node:assert/strict';

import {assertProjectCompositionBinding,bindProjectCompositionToBlueprint} from '../blueprint-binding.mjs';

const sources=()=>({
  constraints:{selected_pda_ids:['p1','p3','p3-unlinked','p3-other','p1-wrong-grade']},
  curriculum:{
    pdas:[
      {pda_id:'p1',grade:1},{pda_id:'p3',grade:3},
      {pda_id:'p3-unlinked',grade:3},{pda_id:'p3-other',grade:3},
      {pda_id:'p1-wrong-grade',grade:3},{pda_id:'unselected',grade:1}
    ],
    ltg:[
      {project_id:'base-project',grade:3,verified_pda_links:['p3','p3-other'],
        verified_activities:[
          {activity_id:'base-a1',verification_status:'verified'},
          {activity_id:'base-unverified',verification_status:'pending'}
        ]},
      {project_id:'support-project',grade:1,
        verified_pda_links:['p1','p1-wrong-grade','unselected'],
        verified_activities:[{activity_id:'support-a1',verification_status:'verified'}]}
    ]
  }
});

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
      composition(),
      sources()
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
      composition(),
      sources()
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
      composition(),
      sources()
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
      composition(),
      sources()
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
      composition(),
      sources()
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
      c,
      sources()
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
      c,
      sources()
    ),
    /PCB-007|PCB-009/
  );
});
test('binder removes unapproved operational LTG and restores composition-owned bindings',()=>{
  const c=composition();
  const b=blueprint();

  b.ltg_strategy.selections[0].role='SUPPORT';
  b.ltg_strategy.selections[0].pda_ids=['p1'];

  b.ltg_strategy.selections[1].activity_ids=[
    'invented-or-unapproved'
  ];

  b.ltg_strategy.selections.push({
    project_id:'reference-project',
    role:'OPTIONAL',
    pda_ids:['p1'],
    activity_ids:[],
    reason:'No debe quedar operacional.'
  });

  const bound=
    bindProjectCompositionToBlueprint(
      b,
      c,
      sources()
    );

  assert.deepEqual(
    bound.ltg_strategy.selections.map(
      x=>x.project_id
    ),
    [
      'base-project',
      'support-project'
    ]
  );

  assert.equal(
    bound.ltg_strategy.mode,
    'CORE'
  );

  assert.equal(
    bound.ltg_strategy.selections[0].role,
    'CORE'
  );

  assert.deepEqual(
    bound.ltg_strategy.selections[0].pda_ids,
    ['p3']
  );

  assert.equal(
    bound.ltg_strategy.selections[1].role,
    'SUPPORT'
  );

  assert.deepEqual(
    bound.ltg_strategy.selections[1].activity_ids,
    ['support-a1']
  );

  assert.equal(
    assertProjectCompositionBinding(
      bound,
      c,
      sources()
    ),
    true
  );
});

test('binder never invents a missing composition-approved LTG selection',()=>{
  const c=composition();
  const b=blueprint();

  b.ltg_strategy.selections=
    b.ltg_strategy.selections.filter(
      x=>x.project_id!=='support-project'
    );

  const bound=
    bindProjectCompositionToBlueprint(
      b,
      c,
      sources()
    );

  assert.equal(
    bound.ltg_strategy.selections.some(
      x=>x.project_id==='support-project'
    ),
    false
  );

  assert.throws(
    ()=>assertProjectCompositionBinding(
      bound,
      c,
      sources()
    ),
    /PCB-006/
  );
});

const freeze=value=>{
  if(value&&typeof value==='object'){
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

test('verified projection preserves curricular PDA, filters BASE activities and ENRICHMENT PDA, and is immutable/idempotent',()=>{
  const c=composition(),b=blueprint(),s=sources();
  c.grade_coverage[1].pda_ids.push('p3-unlinked');
  b.pda_analysis=s.constraints.selected_pda_ids.map(pda_id=>({pda_id}));
  b.grade_contributions=structuredClone(c.grade_coverage);
  b.session_progression=[{pda_focus:[...s.constraints.selected_pda_ids]}];
  b.ltg_strategy.selections[0].activity_ids=[
    'base-a1','base-unverified','support-a1','missing'
  ];
  b.ltg_strategy.selections[1].pda_ids=[
    'p1','p3-unlinked','p1-wrong-grade','unselected','missing'
  ];
  const before=structuredClone({b,c,s});
  freeze(b);freeze(c);freeze(s);
  const bound=bindProjectCompositionToBlueprint(b,c,s);
  assert.deepEqual(bound.ltg_strategy.selections[0].pda_ids,['p3']);
  assert.deepEqual(bound.ltg_strategy.selections[0].activity_ids,['base-a1']);
  assert.deepEqual(bound.ltg_strategy.selections[1].pda_ids,['p1']);
  assert.deepEqual(bound.ltg_strategy.selections[1].activity_ids,['support-a1']);
  assert.equal(assertProjectCompositionBinding(bound,c,s),true);
  for(const field of ['pda_analysis','grade_contributions','session_progression']){
    assert.deepEqual(bound[field],b[field]);
  }
  assert.deepEqual({b,c,s},before);
  assert.deepEqual(bindProjectCompositionToBlueprint(bound,c,s),bound);
});

for(const kind of ['BASE','ENRICHMENT']){
  test(`${kind} empty verified PDA projection fails closed in binder and assertion`,()=>{
    const c=composition(),b=blueprint(),s=sources();
    if(kind==='BASE')c.grade_coverage[1].pda_ids=['p3-unlinked'];
    else b.ltg_strategy.selections[1].pda_ids=['p3-unlinked'];
    const before=structuredClone({b,c,s});
    assert.throws(()=>bindProjectCompositionToBlueprint(b,c,s),
      /PCB-010 EMPTY_VERIFIED_LTG_PDA_PROJECTION:/);
    assert.throws(()=>assertProjectCompositionBinding(b,c,s),
      /PCB-010 EMPTY_VERIFIED_LTG_PDA_PROJECTION:/);
    assert.deepEqual({b,c,s},before);
  });
}

test('assertion rejects unprojected PDA and activity attribution',()=>{
  for(const mutate of [
    b=>b.ltg_strategy.selections[0].pda_ids.push('p3-unlinked'),
    b=>b.ltg_strategy.selections[0].pda_ids.push('p3-other'),
    b=>b.ltg_strategy.selections[0].activity_ids.push('base-unverified'),
    b=>b.ltg_strategy.selections[1].pda_ids.push('p3-unlinked')
  ]){
    const b=blueprint();mutate(b);
    assert.throws(()=>assertProjectCompositionBinding(b,composition(),sources()),/PCB-005|PCB-006/);
  }
});

test('operational LTG projection requires sources',()=>{
  assert.throws(()=>bindProjectCompositionToBlueprint(blueprint(),composition()),
    /PCB-010 LTG_PROJECTION_SOURCES_REQUIRED/);
  assert.throws(()=>assertProjectCompositionBinding(blueprint(),composition()),
    /PCB-010 LTG_PROJECTION_SOURCES_REQUIRED/);
});

test('binder includes a valid explicit enrichment PDA omitted by generation, without mutation',()=>{
  const s=sources(),c=composition(),b=blueprint();
  s.constraints.selected_pda_ids.push('p1-second');
  s.curriculum.pdas.push({pda_id:'p1-second',grade:1});
  s.curriculum.ltg[1].verified_pda_links.push('p1-second');
  c.grade_coverage[0].pda_ids.push('p1-second');
  s.constraints.explicit_ltg_selections=[
    {project_id:'base-project',pda_ids:['p3'],intent:'CORE'},
    {project_id:'support-project',pda_ids:['p1-second'],intent:'SUPPORT'}
  ];
  const before=structuredClone({s,c,b});freeze(s);freeze(c);freeze(b);
  assert.throws(()=>assertProjectCompositionBinding(b,c,s),/PCB-011 EXPLICIT_LTG_BINDING_MISMATCH/);
  const bound=bindProjectCompositionToBlueprint(b,c,s);
  assert.deepEqual(bound.ltg_strategy.selections[1].pda_ids,['p1','p1-second']);
  assert.equal(assertProjectCompositionBinding(bound,c,s),true);
  assert.deepEqual(bindProjectCompositionToBlueprint(bound,c,s),bound);
  assert.deepEqual({s,c,b},before);
});

test('binder and assertion reject genuine role conflicts before rewriting teacher decisions',()=>{
  const s=sources(),c=composition(),b=blueprint();
  s.constraints.explicit_ltg_selections=[{project_id:'base-project',pda_ids:['p3'],intent:'SUPPORT'}];
  const before=structuredClone({s,c,b});
  assert.throws(()=>bindProjectCompositionToBlueprint(b,c,s),/PCD-009 EXPLICIT_LTG_INTENT_MISMATCH/);
  assert.throws(()=>assertProjectCompositionBinding(b,c,s),/PCD-009 EXPLICIT_LTG_INTENT_MISMATCH/);
  assert.deepEqual({s,c,b},before);
});

test('binder rejects an unverified explicit PDA instead of filtering the teacher decision away',()=>{
  const s=sources();
  s.constraints.explicit_ltg_selections=[{project_id:'support-project',pda_ids:['p3-unlinked'],intent:'SUPPORT'}];
  assert.throws(()=>bindProjectCompositionToBlueprint(blueprint(),composition(),s),/PCD-009 EXPLICIT_LTG_PDA_NOT_VERIFIED/);
});
