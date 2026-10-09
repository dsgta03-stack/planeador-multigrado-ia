import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compileProjectCompositionProposal
} from '../proposal.mjs';

import {
  buildProjectCandidatePool
} from '../candidate-pool.mjs';

const sources=()=>({
  constraints:{
    constraints_hash:'a'.repeat(64),
    grades:[1,3,6],
    selected_pda_ids:['p1','p3'],
    explicit_ltg_selections:[]
  },

  curriculum:{
    snapshot_hash:'b'.repeat(64),
    pdas:[
      {
        pda_id:'p1',
        grade:1
      },
      {
        pda_id:'p3',
        grade:3
      }
    ],

    ltg:[
      {
        project_id:'base-project',
        grade:3,
        book:'Proyectos de Aula',
        scenario:'Aula',
        name:'Proyecto verificado',
        related_contents:'Contenido',
        purpose:'Investigar el entorno',
        central_product:'Modelo explicativo',
        pages:{
          start:10,
          end:20
        },
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
        project_id:'enrichment-project',
        grade:1,
        book:'Proyectos de Aula',
        scenario:'Aula',
        name:'Proyecto de apoyo',
        related_contents:'Contenido',
        purpose:'Observar el entorno',
        central_product:'Registro gráfico',
        pages:{
          start:30,
          end:35
        },
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

const verifiedProposal=()=>({
  proposal_version:
    'PROJECT_COMPOSITION_PROPOSAL_V1',

  base:{
    origin:'LTG_VERIFIED',
    project_id:'base-project',
    original_project:null,
    compatibility:'DIRECT',
    reason:
      'La indagación central es compatible con la metodología.'
  },

  enrichments:[
    {
      project_id:'enrichment-project',
      activity_ids:['enrich-a1'],
      contribution:
        'Aporta observación inicial.',
      reason:
        'Fortalece la indagación sin conservar un producto paralelo.'
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
    purpose:
      'Comunicar lo investigado por el grupo.',
    description:
      'Un solo producto común construido con evidencias.'
  },

  cohesion:{
    one_project_reason:
      'Todas las aportaciones alimentan el mismo resultado.',
    enrichment_boundary:
      'El proyecto de apoyo aporta sólo una actividad.'
  },

  rejected_options:[]
});

test('verified LTG metadata is copied canonically',()=>{
  const s=sources();
  const pool=buildProjectCandidatePool(s);
  const proposal=verifiedProposal();

  const composition=
    compileProjectCompositionProposal(
      proposal,
      s,
      pool
    );

  assert.equal(
    composition.base.name,
    'Proyecto verificado'
  );

  assert.equal(
    composition.base.purpose,
    'Investigar el entorno'
  );

  assert.equal(
    composition.base.central_product,
    'Modelo explicativo'
  );

  assert.equal(
    composition.ai_original_required,
    false
  );
});

test('verified BASE cannot rewrite LTG metadata',()=>{
  const s=sources();
  const pool=buildProjectCandidatePool(s);
  const proposal=verifiedProposal();

  proposal.base.original_project={
    name:'Nombre inventado',
    purpose:'Propósito inventado',
    central_product:'Producto inventado'
  };

  assert.throws(
    ()=>compileProjectCompositionProposal(
      proposal,
      s,
      pool
    ),
    /PCP-101/
  );
});

test('enrichment activity must exist in verified project',()=>{
  const s=sources();
  const pool=buildProjectCandidatePool(s);
  const proposal=verifiedProposal();

  proposal.enrichments[0].activity_ids=[
    'invented-activity'
  ];

  assert.throws(
    ()=>compileProjectCompositionProposal(
      proposal,
      s,
      pool
    ),
    /PCP-104/
  );
});

test('AI original requires rejection of every structurally eligible verified BASE',()=>{
  const s=sources();
  const pool=buildProjectCandidatePool(s);
  const proposal=verifiedProposal();

  proposal.base={
    origin:'AI_ORIGINAL',
    project_id:null,
    original_project:{
      name:'Proyecto original',
      purpose:'Resolver una necesidad local',
      central_product:'Producto común'
    },
    compatibility:'DIRECT',
    reason:
      'Los proyectos verificados no son adecuados.'
  };

  proposal.enrichments=[];
  proposal.rejected_options=[];

  assert.throws(
    ()=>compileProjectCompositionProposal(
      proposal,
      s,
      pool
    ),
    /PCP-103/
  );
});

test('AI original can compile only after all structurally eligible LTG are explicitly rejected',()=>{
  const s=sources();
  const pool=buildProjectCandidatePool(s);
  const proposal=verifiedProposal();

  proposal.base={
    origin:'AI_ORIGINAL',
    project_id:null,
    original_project:{
      name:'Proyecto original',
      purpose:'Resolver una necesidad local',
      central_product:'Producto común'
    },
    compatibility:'DIRECT',
    reason:
      'Los proyectos verificados son incompatibles con el propósito integrado.'
  };

  proposal.enrichments=[];

  proposal.rejected_options=[
    {
      project_id:'base-project',
      reason:
        'No permite integrar adecuadamente el proyecto común.'
    },
    {
      project_id:'enrichment-project',
      reason:
        'Su producto central no puede funcionar como base.'
    }
  ];

  const composition=
    compileProjectCompositionProposal(
      proposal,
      s,
      pool
    );

  assert.equal(
    composition.base.origin,
    'AI_ORIGINAL'
  );

  assert.equal(
    composition.ai_original_required,
    true
  );
});

test('proposal cannot omit an active grade',()=>{
  const s=sources();
  const pool=buildProjectCandidatePool(s);
  const proposal=verifiedProposal();

  proposal.grade_coverage=
    proposal.grade_coverage.filter(
      x=>x.grade!==6
    );

  assert.throws(
    ()=>compileProjectCompositionProposal(
      proposal,
      s,
      pool
    ),
    /PROJECT_COMPOSITION_PROPOSAL_SCHEMA/
  );
});