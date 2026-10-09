const sameSet=(a,b)=>{
  const aa=[...new Set(a)].sort();
  const bb=[...new Set(b)].sort();
  return aa.length===bb.length&&
    aa.every((x,i)=>x===bb[i]);
};

const selectionMap=blueprint=>{
  const selections=
    blueprint?.ltg_strategy?.selections||[];

  const map=new Map();

  for(const selection of selections){
    if(map.has(selection.project_id)){
      throw Error(
        `PCB-004 DUPLICATE_LTG_SELECTION:${selection.project_id}`
      );
    }

    map.set(
      selection.project_id,
      selection
    );
  }

  return map;
};

export function bindProjectCompositionToBlueprint(
  blueprint,
  composition
){
  if(!composition)return structuredClone(blueprint);

  const bound=structuredClone(blueprint);

  const currentSelections=
    bound?.ltg_strategy?.selections||[];

  const currentByProject=new Map(
    currentSelections.map(
      selection=>[
        selection.project_id,
        selection
      ]
    )
  );

  const selections=[];

  if(composition.base.origin==='LTG_VERIFIED'){
    const projectId=composition.base.project_id;
    const current=currentByProject.get(projectId);

    if(current){
      const basePdaIds=[
        ...new Set(
          composition.grade_coverage
            .filter(x=>x.mode==='BASE_PDA')
            .flatMap(x=>x.pda_ids)
        )
      ];

      selections.push({
        ...current,
        project_id:projectId,
        role:'CORE',
        pda_ids:basePdaIds
      });
    }
  }

  for(const enrichment of composition.enrichments){
    const current=
      currentByProject.get(
        enrichment.project_id
      );

    if(!current)continue;

    selections.push({
      ...current,
      project_id:enrichment.project_id,
      role:'SUPPORT',
      activity_ids:[
        ...enrichment.activity_ids
      ]
    });
  }

  const mode=
    composition.base.origin==='LTG_VERIFIED'
      ? 'CORE'
      : composition.enrichments.length
        ? 'SUPPORT'
        : 'NONE';

  bound.ltg_strategy={
    ...bound.ltg_strategy,
    mode,
    selections
  };

  return bound;
}
export function assertProjectCompositionBinding(
  blueprint,
  composition
){
  if(!composition){
    throw Error(
      'PCB-001 PROJECT_COMPOSITION_REQUIRED'
    );
  }

  if(
    blueprint?.methodology?.selected_id!==
      composition.methodology.selected_id||
    blueprint?.methodology?.catalog_version!==
      composition.methodology.catalog_version
  ){
    throw Error(
      'PCB-002 METHODOLOGY_BINDING_MISMATCH'
    );
  }

  const outcome=
    blueprint?.final_outcome;

  if(
    !outcome||
    outcome.name!==composition.final_outcome.name||
    outcome.purpose!==composition.final_outcome.purpose||
    outcome.description!==composition.final_outcome.description
  ){
    throw Error(
      'PCB-003 FINAL_OUTCOME_BINDING_MISMATCH'
    );
  }

  const byProject=
    selectionMap(blueprint);

  const expectedProjectIds=[];

  if(composition.base.origin==='LTG_VERIFIED'){
    expectedProjectIds.push(
      composition.base.project_id
    );

    const baseSelection=
      byProject.get(
        composition.base.project_id
      );

    if(!baseSelection){
      throw Error(
        'PCB-005 VERIFIED_BASE_SELECTION_REQUIRED'
      );
    }

    if(baseSelection.role!=='CORE'){
      throw Error(
        'PCB-005 VERIFIED_BASE_MUST_BE_CORE'
      );
    }

    const expectedBasePdas=
      composition.grade_coverage
        .filter(x=>x.mode==='BASE_PDA')
        .flatMap(x=>x.pda_ids);

    if(
      !sameSet(
        baseSelection.pda_ids||[],
        expectedBasePdas
      )
    ){
      throw Error(
        'PCB-005 VERIFIED_BASE_PDA_BINDING_MISMATCH'
      );
    }
  }

  for(const enrichment of composition.enrichments){
    expectedProjectIds.push(
      enrichment.project_id
    );

    const selection=
      byProject.get(
        enrichment.project_id
      );

    if(!selection){
      throw Error(
        `PCB-006 ENRICHMENT_SELECTION_REQUIRED:${enrichment.project_id}`
      );
    }

    if(selection.role!=='SUPPORT'){
      throw Error(
        `PCB-006 ENRICHMENT_MUST_BE_SUPPORT:${enrichment.project_id}`
      );
    }

    if(
      !sameSet(
        selection.activity_ids||[],
        enrichment.activity_ids
      )
    ){
      throw Error(
        `PCB-006 ENRICHMENT_ACTIVITY_BINDING_MISMATCH:${enrichment.project_id}`
      );
    }
  }

  if(
    !sameSet(
      [...byProject.keys()],
      expectedProjectIds
    )
  ){
    throw Error(
      'PCB-007 UNAPPROVED_OPERATIONAL_LTG_SELECTION'
    );
  }

  const referenceIds=
    new Set(
      composition.references.map(
        x=>x.project_id
      )
    );

  for(const projectId of byProject.keys()){
    if(referenceIds.has(projectId)){
      throw Error(
        `PCB-008 REFERENCE_CANNOT_BE_OPERATIONAL:${projectId}`
      );
    }
  }

  const mode=
    blueprint?.ltg_strategy?.mode;

  if(composition.base.origin==='LTG_VERIFIED'){
    if(mode!=='CORE'){
      throw Error(
        'PCB-009 VERIFIED_BASE_REQUIRES_CORE_MODE'
      );
    }
  }else if(composition.enrichments.length){
    if(mode!=='SUPPORT'){
      throw Error(
        'PCB-009 AI_BASE_WITH_ENRICHMENT_REQUIRES_SUPPORT_MODE'
      );
    }
  }else if(mode!=='NONE'){
    throw Error(
      'PCB-009 AI_BASE_WITHOUT_LTG_REQUIRES_NONE_MODE'
    );
  }

  return true;
}