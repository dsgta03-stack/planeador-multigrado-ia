import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProjectCompositionRequest,
  createProjectCompositionProvider
} from '../provider.mjs';

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
        project_id:'base-project',
        pda_ids:['p3'],
        intent:'CORE'
      }
    ],
    requested_sessions:5,
    minutes_per_session:50,
    original_problem:
      'El grupo necesita comprender una situación de su entorno.',
    original_context:
      'Escuela primaria multigrado.',
    students_by_grade:{
      '1':2,
      '3':2,
      '6':1
    },
    reading_profile:'Heterogéneo',
    writing_profile:'Heterogéneo',
    autonomy_profile:'En desarrollo',
    connectivity:'Limitada',
    available_resources:[
      'cuaderno',
      'papel'
    ],
    supports:[],
    teacher_explicit_constraints:[]
  },

  curriculum:{
    snapshot_hash:'b'.repeat(64),

    pdas:[
      {
        pda_id:'p1',
        grade:1,
        field:'Saberes y Pensamiento Científico',
        content_official:'Contenido 1',
        pda_official:'Observa y registra.',
        verification_status:'verified'
      },
      {
        pda_id:'p3',
        grade:3,
        field:'Saberes y Pensamiento Científico',
        content_official:'Contenido 3',
        pda_official:'Indaga y explica.',
        verification_status:'verified'
      }
    ],

    ltg:[
      {
        project_id:'base-project',
        grade:3,
        book:'Proyectos de Aula',
        scenario:'Aula',
        name:'Proyecto verificado',
        related_contents:'Contenido relacionado',
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
            activity_type:'indagacion',
            title:'Exploramos',
            summary:'Observar evidencias',
            organization:'Equipos',
            guiding_questions:'Qué observamos',
            evidence_or_record:'Registro',
            product_contribution:'Aporta al modelo',
            semantic_tags:[
              'indagacion'
            ],
            page_start:10,
            page_end:11,
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
        related_contents:'Contenido relacionado',
        purpose:'Observar el entorno',
        central_product:'Registro gráfico',
        pages:{
          start:30,
          end:35
        },
        verified_pda_links:['p1'],
        verified_activities:[
          {
            activity_id:'support-a1',
            activity_order:1,
            activity_type:'observacion',
            title:'Observamos',
            summary:'Registrar observaciones',
            organization:'Parejas',
            guiding_questions:'Qué vemos',
            evidence_or_record:'Registro gráfico',
            product_contribution:'Aporta observaciones',
            semantic_tags:[
              'observacion'
            ],
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
      'INTRODUCCION_PROBLEMATIZACION',
      'DISENO_Y_DESARROLLO_INDAGACION'
    ]
  }
});

const proposal=()=>({
  proposal_version:
    'PROJECT_COMPOSITION_PROPOSAL_V1',

  base:{
    origin:'LTG_VERIFIED',
    project_id:'base-project',
    original_project:null,
    compatibility:'DIRECT',
    reason:
      'El proyecto permite una indagación coherente con el PDA y la metodología.'
  },

  enrichments:[
    {
      project_id:'support-project',
      activity_ids:[
        'support-a1'
      ],
      contribution:
        'Aporta observaciones iniciales al mismo proceso de indagación.',
      reason:
        'La actividad fortalece el proyecto base sin conservar un producto independiente.'
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
      'Un único producto elaborado con las evidencias reunidas por los grados.'
  },

  cohesion:{
    one_project_reason:
      'Todos los grados contribuyen a una misma explicación.',
    enrichment_boundary:
      'La actividad complementaria aporta evidencia, no un segundo proyecto.'
  },

  rejected_options:[]
});

test('request exposes methodology, PDA, context and verified candidates',()=>{
  const s=sources();
  const pool=buildProjectCandidatePool(s);

  const request=
    buildProjectCompositionRequest(
      s,
      pool
    );

  assert.equal(
    request.prompt.methodology.selected_id,
    'steam'
  );

  assert.equal(
    request.prompt.selected_pdas.length,
    2
  );

  assert.equal(
    request.prompt.candidates[0].project_id,
    'base-project'
  );

  assert.equal(
    request.prompt.candidates[0]
      .verified_activities[0]
      .product_contribution,
    'Aporta al modelo'
  );

  assert.equal(
    request.prompt.context.original_problem,
    s.constraints.original_problem
  );
});

test('composition request does not contain teacher session authoring contract',()=>{
  const s=sources();
  const pool=buildProjectCandidatePool(s);

  const request=
    buildProjectCompositionRequest(
      s,
      pool
    );

  const text=JSON.stringify(
    request.prompt
  );

  assert.equal(
    text.includes('teacher_role'),
    false
  );

  assert.equal(
    text.includes('student_steps'),
    false
  );

  assert.equal(
    text.includes('common_student_action'),
    false
  );
});

test('provider compiles verified proposal into canonical composition',async()=>{
  const s=sources();
  const pool=buildProjectCandidatePool(s);

  let seenRequest=null;

  const provider=
    createProjectCompositionProvider({
      invoke:async request=>{
        seenRequest=request;

        return {
          output:proposal(),
          request_id:'composition-test-1',
          model:'stub-model'
        };
      }
    });

  const result=
    await provider(
      s,
      pool
    );

  assert.equal(
    seenRequest.task,
    'PROJECT_COMPOSITION'
  );

  assert.equal(
    result.composition.base.name,
    'Proyecto verificado'
  );

  assert.equal(
    result.composition.base.central_product,
    'Modelo explicativo'
  );

  assert.equal(
    result.composition.enrichments[0]
      .activity_ids[0],
    'support-a1'
  );

  assert.equal(
    result.provider.request_id,
    'composition-test-1'
  );
});

test('provider cannot smuggle invented LTG project id',async()=>{
  const s=sources();
  const pool=buildProjectCandidatePool(s);

  const bad=proposal();

  bad.base.project_id=
    'invented-project';

  const provider=
    createProjectCompositionProvider({
      invoke:async()=>({
        output:bad
      })
    });

  await assert.rejects(
    ()=>provider(
      s,
      pool
    ),
    /PROJECT_COMPOSITION_PROPOSAL_SCHEMA|PCP-105/
  );
});

test('provider output does not mutate sources or candidate pool',async()=>{
  const s=sources();
  const pool=buildProjectCandidatePool(s);

  const beforeSources=
    JSON.stringify(s);

  const beforePool=
    JSON.stringify(pool);

  const provider=
    createProjectCompositionProvider({
      invoke:async()=>({
        output:proposal()
      })
    });

  await provider(
    s,
    pool
  );

  assert.equal(
    JSON.stringify(s),
    beforeSources
  );

  assert.equal(
    JSON.stringify(pool),
    beforePool
  );
});