import {
  hash
} from '../project-blueprint-v1/contracts.mjs';

import {
  providerAuthoringShapeSchema,
  assertProviderSchema
} from '../project-blueprint-v1/provider-schema.mjs';

import {
  projectCompositionProposalSchema,
  compileProjectCompositionProposal
} from './proposal.mjs';

export const PROJECT_COMPOSITION_PROVIDER_VERSION=
  'PROJECT_COMPOSITION_PROVIDER_V1';

export const PROJECT_COMPOSITION_PROMPT_VERSION=
  'PROJECT_COMPOSITION_PROMPT_V1';

const cleanActivity=activity=>({
  activity_id:activity.activity_id,
  activity_order:activity.activity_order,
  activity_type:activity.activity_type||'',
  title:activity.title||'',
  summary:activity.summary||'',
  organization:activity.organization||'',
  guiding_questions:activity.guiding_questions||'',
  evidence_or_record:activity.evidence_or_record||'',
  product_contribution:activity.product_contribution||'',
  semantic_tags:[
    ...(activity.semantic_tags||[])
  ],
  page_start:activity.page_start,
  page_end:activity.page_end
});

const cleanCandidate=candidate=>({
  project_id:candidate.project_id,
  grade:candidate.grade,
  book:candidate.book,
  scenario:candidate.scenario,
  name:candidate.name,
  pages:structuredClone(candidate.pages),

  related_contents:candidate.related_contents,
  purpose:candidate.purpose,
  central_product:candidate.central_product,

  explicit_intent:candidate.explicit_intent,
  explicit_pda_ids:[
    ...candidate.explicit_pda_ids
  ],

  selected_pda_links:[
    ...candidate.selected_pda_links
  ],

  metadata_complete:
    candidate.metadata_complete,

  structurally_eligible_base:
    candidate.structurally_eligible_base,

  verified_activities:
    candidate.verified_activities.map(
      cleanActivity
    )
});

const selectedPdaContext=sources=>{
  const wanted=new Set(
    sources.constraints.selected_pda_ids||[]
  );

  return (sources.curriculum.pdas||[])
    .filter(x=>wanted.has(x.pda_id))
    .map(x=>({
      pda_id:x.pda_id,
      grade:x.grade,
      field:x.field,
      content_official:x.content_official,
      pda_official:x.pda_official,
      verification_status:x.verification_status
    }));
};

export function buildProjectCompositionRequest(
  sources,
  pool,
  {
    repair=null
  }={}
){
  const localSchema=
    projectCompositionProposalSchema(
      sources,
      pool
    );

  const projected=
    providerAuthoringShapeSchema(
      localSchema
    );

  assertProviderSchema(
    projected.schema
  );

  const constraints=sources.constraints;

  const system=[
    'Eres un arquitecto pedagógico multigrado.',
    'Tu única tarea es proponer la composición del proyecto ANTES del ProjectBlueprint.',
    'No diseñes sesiones, actividades docentes detalladas, secuencias de clase ni SessionGraph.',
    'No sustituyas la metodología seleccionada.',
    'No inventes proyectos LTG, actividades LTG, PDA ni metadatos oficiales.',
    'Debes construir UN SOLO proyecto común.',
    'Distingue BASE, ENRICHMENT y REFERENCE.',
    'BASE define el propósito central del proyecto.',
    'Si BASE.origin es LTG_VERIFIED, BASE.project_id DEBE ser el project_id de un candidato verificado y BASE.original_project DEBE ser null.',
    'Si BASE.origin es LTG_VERIFIED, no copies, reformules ni reconstruyas name, purpose ni central_product; el sistema recuperará esos metadatos desde el candidato verificado.',
    'Si BASE.origin es AI_ORIGINAL, BASE.project_id DEBE ser null y BASE.original_project DEBE contener name, purpose y central_product.',
    'Nunca uses original_project para enriquecer un LTG verificado; el enriquecimiento se expresa únicamente mediante enrichments, references, grade_coverage, final_outcome y cohesion.',
    'ENRICHMENT sólo aporta actividades verificadas útiles al mismo proyecto; nunca conserva un segundo producto independiente.',
    'REFERENCE reconoce material pertinente que no debe incorporarse operativamente.',
    'Evalúa compatibilidad semántica real con la metodología, PDA, problemática, contexto, grados y producto; no uses coincidencia de palabras como prueba.',
    'Un LTG puede ser adaptable sin copiar literalmente toda su secuencia.',
    'explicit_intent y explicit_pda_ids son decisiones docentes obligatorias, no sugerencias. CORE exige BASE; SUPPORT exige ENRICHMENT. No cambies su rol, no omitas sus PDA verificados ni conviertas esos proyectos en REFERENCE. Una decisión incompatible debe rechazarse, no justificarse para reemplazarla.',
    'AI_ORIGINAL es último recurso.',
    'Si eliges AI_ORIGINAL debes rechazar explícitamente todos los candidatos estructuralmente elegibles como BASE.',
    'No uses el atractivo del producto como criterio suficiente.',
    'No elijas museo, exposición, campaña, prototipo u otro formato por costumbre.',
    'La forma final debe surgir del propósito, metodología y desempeños.',
    'Todos los grados activos deben participar dentro del mismo proyecto.',
    'Un grado sin PDA propio puede participar transversalmente, pero nunca se le presta el PDA de otro grado.',
    'Devuelve exclusivamente JSON conforme al schema de respuesta.'
  ].join('\n');

  const prompt={
    provider_version:
      PROJECT_COMPOSITION_PROVIDER_VERSION,

    prompt_version:
      PROJECT_COMPOSITION_PROMPT_VERSION,

    task:
      'SELECT_PROJECT_COMPOSITION',

    decision_priority:[
      'METHODOLOGY',
      'SELECTED_PDA_AND_ACTIVE_GRADES',
      'PROBLEM_AND_CONTEXT',
      'EXPLICIT_AND_VERIFIED_LTG',
      'CONTROLLED_LTG_ENRICHMENT',
      'AI_ORIGINAL_ONLY_IF_NECESSARY'
    ],

    methodology:{
      selected_id:
        sources.methodology.selected_id,

      catalog_version:
        sources.methodology.catalog_version,

      required_operations:[
        ...(sources.methodology.required_operations||[])
      ]
    },

    context:{
      original_problem:
        constraints.original_problem,

      original_context:
        constraints.original_context,

      active_grades:[
        ...(constraints.grades||[])
      ],

      requested_sessions:
        constraints.requested_sessions,

      minutes_per_session:
        constraints.minutes_per_session,

      students_by_grade:
        structuredClone(
          constraints.students_by_grade||{}
        ),

      reading_profile:
        constraints.reading_profile||'',

      writing_profile:
        constraints.writing_profile||'',

      autonomy_profile:
        constraints.autonomy_profile||'',

      connectivity:
        constraints.connectivity||'',

      available_resources:
        structuredClone(
          constraints.available_resources||[]
        ),

      supports:
        structuredClone(
          constraints.supports||[]
        ),

      teacher_explicit_constraints:
        structuredClone(
          constraints.teacher_explicit_constraints||[]
        )
    },

    selected_pdas:
      selectedPdaContext(sources),

    candidates:
      pool.candidates.map(
        cleanCandidate
      ),

    composition_rules:{
      one_base:true,
      one_common_project:true,
      parallel_projects_forbidden:true,
      verified_ltg_metadata_immutable:true,
      verified_enrichment_activities_only:true,
      cross_grade_pda_borrowing_forbidden:true,
      ai_original_last_resort:true
    },

    response_contract:
      localSchema,

    ...(repair
      ? {
          repair:{
            previous_proposal:
              structuredClone(
                repair.previous_proposal
              ),

            triggering_findings:
              structuredClone(
                repair.triggering_findings||[]
              ),

            instruction:
              'Repara únicamente la decisión de composición. No cambies las fuentes, la metodología, los PDA ni los metadatos LTG.'
          }
        }
      : {})
  };

  return Object.freeze({
    task:'PROJECT_COMPOSITION',
    system,
    prompt,
    response_schema:
      projected.schema,

    local_response_schema:
      localSchema,

    input_hash:hash({
      system,
      prompt,
      response_schema:
        projected.schema
    })
  });
}

const outputFromResult=result=>{
  const output=
    result?.output??
    result?.proposal??
    result?.payload?.output??
    result;

  if(
    !output||
    typeof output!=='object'||
    Array.isArray(output)
  ){
    throw Error(
      'PROJECT_COMPOSITION_PROVIDER_OUTPUT_REQUIRED'
    );
  }

  return output;
};

export function createProjectCompositionProvider({
  invoke
}={}){
  if(typeof invoke!=='function'){
    throw Error(
      'PROJECT_COMPOSITION_INVOKER_REQUIRED'
    );
  }

  return async function runProjectCompositionProvider(
    sources,
    pool,
    options={}
  ){
    const request=
      buildProjectCompositionRequest(
        sources,
        pool,
        options
      );

    const raw=
      await invoke(request);

    const proposal=
      outputFromResult(raw);

    const composition=
      compileProjectCompositionProposal(
        proposal,
        sources,
        pool
      );

    return {
      proposal,
      composition,
      provider:{
        provider_version:
          PROJECT_COMPOSITION_PROVIDER_VERSION,

        prompt_version:
          PROJECT_COMPOSITION_PROMPT_VERSION,

        input_hash:
          request.input_hash,

        request_id:
          raw?.request_id??
          raw?.provider?.request_id??
          null,

        model:
          raw?.model??
          raw?.provider?.model??
          null
      }
    };
  };
}
