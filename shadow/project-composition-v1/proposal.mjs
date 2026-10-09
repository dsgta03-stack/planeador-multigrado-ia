import {
  schemaErrors
} from '../project-blueprint-v1/contracts.mjs';

import {
  makeProjectComposition
} from './composition.mjs';

export const PROJECT_COMPOSITION_PROPOSAL_VERSION=
  'PROJECT_COMPOSITION_PROPOSAL_V1';

const candidateIds=pool=>
  pool.candidates.map(x=>x.project_id);

const projectIdSchema=pool=>{
  const ids=candidateIds(pool);

  return ids.length
    ? {type:'string',enum:ids}
    : {type:'string',enum:['__NO_VERIFIED_PROJECT_AVAILABLE__']};
};

const nullableProjectIdSchema=pool=>{
  const ids=candidateIds(pool);

  if(!ids.length){
    return {type:'null'};
  }

  return {
    anyOf:[
      {type:'string',enum:ids},
      {type:'null'}
    ]
  };
};

const activityIdsForProject=(pool,projectId)=>{
  const project=pool.candidates.find(
    x=>x.project_id===projectId
  );

  return new Set(
    (project?.verified_activities||[])
      .map(x=>x.activity_id)
  );
};

export function projectCompositionProposalSchema(sources,pool){
  const grades=[...(sources.constraints.grades||[])];
  const selectedPdas=[
    ...(sources.constraints.selected_pda_ids||[])
  ];

  return {
    type:'object',
    properties:{
      proposal_version:{
        type:'string',
        enum:[PROJECT_COMPOSITION_PROPOSAL_VERSION]
      },

      base:{
        type:'object',
        properties:{
          origin:{
            type:'string',
            enum:[
              'LTG_VERIFIED',
              'AI_ORIGINAL'
            ]
          },

          project_id:nullableProjectIdSchema(pool),

          original_project:{
            anyOf:[
              {
                type:'object',
                properties:{
                  name:{
                    type:'string',
                    minLength:1
                  },
                  purpose:{
                    type:'string',
                    minLength:1
                  },
                  central_product:{
                    type:'string',
                    minLength:1
                  }
                },
                required:[
                  'name',
                  'purpose',
                  'central_product'
                ],
                additionalProperties:false
              },
              {
                type:'null'
              }
            ]
          },

          compatibility:{
            type:'string',
            enum:[
              'DIRECT',
              'ADAPTABLE'
            ]
          },

          reason:{
            type:'string',
            minLength:1
          }
        },
        required:[
          'origin',
          'project_id',
          'original_project',
          'compatibility',
          'reason'
        ],
        additionalProperties:false
      },

      enrichments:{
        type:'array',
        items:{
          type:'object',
          properties:{
            project_id:projectIdSchema(pool),

            activity_ids:{
              type:'array',
              items:{
                type:'string',
                minLength:1
              },
              minItems:1
            },

            contribution:{
              type:'string',
              minLength:1
            },

            reason:{
              type:'string',
              minLength:1
            }
          },
          required:[
            'project_id',
            'activity_ids',
            'contribution',
            'reason'
          ],
          additionalProperties:false
        },
        minItems:0
      },

      references:{
        type:'array',
        items:{
          type:'object',
          properties:{
            project_id:projectIdSchema(pool),

            reason:{
              type:'string',
              minLength:1
            }
          },
          required:[
            'project_id',
            'reason'
          ],
          additionalProperties:false
        },
        minItems:0
      },

      grade_coverage:{
        type:'array',
        items:{
          type:'object',
          properties:{
            grade:{
              type:'integer',
              enum:grades
            },

            mode:{
              type:'string',
              enum:[
                'BASE_PDA',
                'ENRICHMENT_PDA',
                'TRANSVERSAL_PROJECT'
              ]
            },

            pda_ids:{
              type:'array',
              items:selectedPdas.length
                ? {
                    type:'string',
                    enum:selectedPdas
                  }
                : {
                    type:'string',
                    enum:['__NO_SELECTED_PDA__']
                  },
              minItems:0
            }
          },
          required:[
            'grade',
            'mode',
            'pda_ids'
          ],
          additionalProperties:false
        },
        minItems:grades.length,
        maxItems:grades.length
      },

      final_outcome:{
        type:'object',
        properties:{
          name:{
            type:'string',
            minLength:1
          },
          purpose:{
            type:'string',
            minLength:1
          },
          description:{
            type:'string',
            minLength:1
          }
        },
        required:[
          'name',
          'purpose',
          'description'
        ],
        additionalProperties:false
      },

      cohesion:{
        type:'object',
        properties:{
          one_project_reason:{
            type:'string',
            minLength:1
          },
          enrichment_boundary:{
            type:'string',
            minLength:1
          }
        },
        required:[
          'one_project_reason',
          'enrichment_boundary'
        ],
        additionalProperties:false
      },

      rejected_options:{
        type:'array',
        items:{
          type:'object',
          properties:{
            project_id:projectIdSchema(pool),

            reason:{
              type:'string',
              minLength:1
            }
          },
          required:[
            'project_id',
            'reason'
          ],
          additionalProperties:false
        },
        minItems:0
      }
    },

    required:[
      'proposal_version',
      'base',
      'enrichments',
      'references',
      'grade_coverage',
      'final_outcome',
      'cohesion',
      'rejected_options'
    ],

    additionalProperties:false
  };
}

function assertProposalSemantics(proposal,pool){
  const candidateById=new Map(
    pool.candidates.map(x=>[x.project_id,x])
  );

  if(proposal.base.origin==='LTG_VERIFIED'){
    if(!proposal.base.project_id){
      throw Error(
        'PCP-101 VERIFIED_BASE_REQUIRES_PROJECT'
      );
    }

    if(proposal.base.original_project!==null){
      throw Error(
        'PCP-101 VERIFIED_BASE_CANNOT_REWRITE_METADATA'
      );
    }
  }

  if(proposal.base.origin==='AI_ORIGINAL'){
    if(proposal.base.project_id!==null){
      throw Error(
        'PCP-102 AI_BASE_PROJECT_ID_MUST_BE_NULL'
      );
    }

    if(!proposal.base.original_project){
      throw Error(
        'PCP-102 AI_BASE_REQUIRES_ORIGINAL_PROJECT'
      );
    }

    const structurallyEligible=
      pool.candidates.filter(
        x=>x.structurally_eligible_base
      );

    const rejected=new Set(
      proposal.rejected_options.map(
        x=>x.project_id
      )
    );

    for(const candidate of structurallyEligible){
      if(!rejected.has(candidate.project_id)){
        throw Error(
          `PCP-103 AI_BASE_REQUIRES_REJECTION_OF_ELIGIBLE_LTG:${candidate.project_id}`
        );
      }
    }
  }

  for(const row of proposal.grade_coverage){
    if(
      new Set(row.pda_ids).size!==
      row.pda_ids.length
    ){
      throw Error(
        `PCP-106 DUPLICATE_GRADE_PDA:${row.grade}`
      );
    }
  }

  for(const enrichment of proposal.enrichments){
    if(
      new Set(enrichment.activity_ids).size!==
      enrichment.activity_ids.length
    ){
      throw Error(
        `PCP-104 DUPLICATE_ACTIVITY_ID:${enrichment.project_id}`
      );
    }

    const project=candidateById.get(
      enrichment.project_id
    );

    if(!project){
      throw Error(
        `PCP-104 UNKNOWN_ENRICHMENT:${enrichment.project_id}`
      );
    }

    const allowed=activityIdsForProject(
      pool,
      enrichment.project_id
    );

    for(const activityId of enrichment.activity_ids){
      if(!allowed.has(activityId)){
        throw Error(
          `PCP-104 UNKNOWN_ACTIVITY:${activityId}`
        );
      }
    }
  }
}

export function compileProjectCompositionProposal(
  proposal,
  sources,
  pool
){
  const schema=
    projectCompositionProposalSchema(
      sources,
      pool
    );

  const errors=schemaErrors(
    proposal,
    schema
  );

  if(errors.length){
    throw Error(
      `PROJECT_COMPOSITION_PROPOSAL_SCHEMA: ${errors.join('; ')}`
    );
  }

  assertProposalSemantics(
    proposal,
    pool
  );

  const candidateById=new Map(
    pool.candidates.map(x=>[x.project_id,x])
  );

  let base;

  if(proposal.base.origin==='LTG_VERIFIED'){
    const canonical=candidateById.get(
      proposal.base.project_id
    );

    if(!canonical){
      throw Error(
        'PCP-105 VERIFIED_BASE_NOT_IN_POOL'
      );
    }

    base={
      origin:'LTG_VERIFIED',
      project_id:canonical.project_id,
      name:canonical.name,
      purpose:canonical.purpose,
      central_product:canonical.central_product,
      compatibility:proposal.base.compatibility,
      reason:proposal.base.reason
    };
  }else{
    base={
      origin:'AI_ORIGINAL',
      project_id:null,
      name:proposal.base.original_project.name,
      purpose:proposal.base.original_project.purpose,
      central_product:
        proposal.base.original_project.central_product,
      compatibility:proposal.base.compatibility,
      reason:proposal.base.reason
    };
  }

  return makeProjectComposition(
    {
      methodology:{
        selected_id:sources.methodology.selected_id,
        catalog_version:
          sources.methodology.catalog_version
      },

      base,

      enrichments:
        structuredClone(
          proposal.enrichments
        ),

      references:
        structuredClone(
          proposal.references
        ),

      grade_coverage:
        structuredClone(
          proposal.grade_coverage
        ),

      final_outcome:
        structuredClone(
          proposal.final_outcome
        ),

      cohesion:
        structuredClone(
          proposal.cohesion
        ),

      rejected_options:
        structuredClone(
          proposal.rejected_options
        ),

      ai_original_required:
        proposal.base.origin==='AI_ORIGINAL'
    },
    sources
  );
}