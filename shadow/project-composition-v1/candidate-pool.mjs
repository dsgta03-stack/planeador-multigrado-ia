import {deepFreeze,sourceBinding} from '../project-blueprint-v1/contracts.mjs';

export const PROJECT_CANDIDATE_POOL_VERSION='PROJECT_CANDIDATE_POOL_V1';

const clean=x=>typeof x==='string'?x.trim():'';

const intentPriority=intent=>({
  CORE:0,
  SUPPORT:1,
  OPTIONAL:2
}[intent]??3);

const intersect=(a,b)=>{
  const wanted=new Set(b);
  return [...new Set(a)].filter(x=>wanted.has(x));
};

const verifiedActivities=project=>
  (project.verified_activities||[])
    .filter(x=>x.verification_status==='verified')
    .map(x=>structuredClone(x));

const metadataComplete=project=>
  Boolean(
    clean(project.name)&&
    clean(project.purpose)&&
    clean(project.central_product)
  );

export function buildProjectCandidatePool(sources){
  const {constraints,curriculum,methodology}=sources;

  const activeGrades=new Set(constraints.grades||[]);
  const selectedPdas=[...(constraints.selected_pda_ids||[])];
  const explicitSelections=constraints.explicit_ltg_selections||[];

  const explicitByProject=new Map(
    explicitSelections.map(x=>[x.project_id,x])
  );

  const projectById=new Map(
    (curriculum.ltg||[]).map(x=>[x.project_id,x])
  );

  for(const selection of explicitSelections){
    if(!projectById.has(selection.project_id)){
      throw Error(
        `PCP-001 EXPLICIT_LTG_MISSING:${selection.project_id}`
      );
    }

    for(const pdaId of selection.pda_ids){
      if(!selectedPdas.includes(pdaId)){
        throw Error(
          `PCP-002 EXPLICIT_LTG_USES_UNSELECTED_PDA:${pdaId}`
        );
      }
    }
  }

  const candidates=[];

  for(const project of curriculum.ltg||[]){
    const explicit=explicitByProject.get(project.project_id)||null;

    const selectedLinks=intersect(
      project.verified_pda_links||[],
      selectedPdas
    );

    const gradeActive=activeGrades.has(project.grade);

    if(!explicit&&!selectedLinks.length){
      continue;
    }

    if(!gradeActive&&!explicit){
      continue;
    }

    const activities=verifiedActivities(project);

    candidates.push({
      project_id:project.project_id,
      grade:project.grade,
      book:project.book,
      scenario:project.scenario,
      name:project.name,
      pages:structuredClone(project.pages),

      related_contents:project.related_contents||'',
      purpose:project.purpose||'',
      central_product:project.central_product||'',

      explicit_intent:explicit?.intent||null,
      explicit_pda_ids:explicit
        ? [...explicit.pda_ids]
        : [],

      selected_pda_links:selectedLinks,

      metadata_complete:metadataComplete(project),

      structurally_eligible_base:
        gradeActive&&
        selectedLinks.length>0&&
        metadataComplete(project),

      verified_activity_count:activities.length,
      verified_activities:activities
    });
  }

  candidates.sort((a,b)=>{
    const intent=
      intentPriority(a.explicit_intent)-
      intentPriority(b.explicit_intent);

    if(intent!==0)return intent;

    const complete=
      Number(b.metadata_complete)-
      Number(a.metadata_complete);

    if(complete!==0)return complete;

    const links=
      b.selected_pda_links.length-
      a.selected_pda_links.length;

    if(links!==0)return links;

    const activities=
      b.verified_activity_count-
      a.verified_activity_count;

    if(activities!==0)return activities;

    return a.project_id.localeCompare(b.project_id);
  });

  return deepFreeze({
    pool_version:PROJECT_CANDIDATE_POOL_VERSION,
    source:sourceBinding(sources),
    methodology:{
      selected_id:methodology.selected_id,
      catalog_version:methodology.catalog_version,
      required_operations:[
        ...(methodology.required_operations||[])
      ]
    },
    active_grades:[...(constraints.grades||[])],
    selected_pda_ids:selectedPdas,
    candidates
  });
}