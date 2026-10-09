import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {assertExplicitLtgComposition} from './explicit-ltg-decisions.mjs';
import {
  deepFreeze,
  hash,
  schemaErrors,
  sourceBinding
} from '../project-blueprint-v1/contracts.mjs';

export const PROJECT_COMPOSITION_VERSION='PROJECT_COMPOSITION_V1';

const SCHEMA=JSON.parse(
  readFileSync(
    new URL('./schemas/ProjectCompositionV1.json',import.meta.url),
    'utf8'
  )
);

const sameSet=(a,b)=>{
  const aa=[...new Set(a)].sort((x,y)=>x-y);
  const bb=[...new Set(b)].sort((x,y)=>x-y);
  return aa.length===bb.length&&aa.every((x,i)=>x===bb[i]);
};

export function compositionSourceBinding(sources){
  return sourceBinding(sources);
}

export function validateProjectComposition(composition,sources){
  const errors=schemaErrors(composition,SCHEMA);

  if(errors.length){
    throw Error(`PROJECT_COMPOSITION_SCHEMA: ${errors.join('; ')}`);
  }

  const {constraints,curriculum,methodology}=sources;
  const expectedSource=compositionSourceBinding(sources);

  if(JSON.stringify(composition.source)!==JSON.stringify(expectedSource)){
    throw Error('PCD-001 SOURCE_BINDING_MISMATCH');
  }

  if(
    composition.methodology.selected_id!==methodology.selected_id||
    composition.methodology.catalog_version!==methodology.catalog_version
  ){
    throw Error('PCD-002 METHODOLOGY_BINDING_MISMATCH');
  }

  const activeGrades=[...(constraints.grades||[])].sort((a,b)=>a-b);
  const coverageGrades=composition.grade_coverage
    .map(x=>x.grade)
    .sort((a,b)=>a-b);

  if(!sameSet(activeGrades,coverageGrades)){
    throw Error('PCD-003 ACTIVE_GRADE_COVERAGE_REQUIRED');
  }

  if(
    new Set(composition.grade_coverage.map(x=>x.grade)).size!==
    composition.grade_coverage.length
  ){
    throw Error('PCD-003 DUPLICATE_GRADE_COVERAGE');
  }

  const selectedPdas=new Set(constraints.selected_pda_ids||[]);
  const pdaById=new Map(
    (curriculum.pdas||[]).map(x=>[x.pda_id,x])
  );
  const projectById=new Map(
    (curriculum.ltg||[]).map(x=>[x.project_id,x])
  );

  for(const row of composition.grade_coverage){
    for(const pdaId of row.pda_ids){
      if(!selectedPdas.has(pdaId)){
        throw Error(`PCD-004 UNSELECTED_PDA:${pdaId}`);
      }

      const pda=pdaById.get(pdaId);

      if(!pda||pda.grade!==row.grade){
        throw Error(`PCD-004 PDA_GRADE_MISMATCH:${pdaId}`);
      }
    }

    if(
      row.mode==='TRANSVERSAL_PROJECT'&&
      row.pda_ids.length
    ){
      throw Error(
        `PCD-004 TRANSVERSAL_MUST_NOT_BORROW_PDA:${row.grade}`
      );
    }
  }

  const coveredPdas=
    composition.grade_coverage
      .flatMap(row=>row.pda_ids);

  if(
    new Set(coveredPdas).size!==
    coveredPdas.length
  ){
    throw Error(
      'PCD-004 DUPLICATE_SELECTED_PDA_COVERAGE'
    );
  }

  if(
    !sameSet(
      [...selectedPdas],
      coveredPdas
    )
  ){
    throw Error(
      'PCD-004 SELECTED_PDA_MUST_BE_DEVELOPED'
    );
  }

  for(const row of composition.grade_coverage){
    const expectedForGrade=
      [...selectedPdas]
        .filter(
          pdaId=>
            pdaById.get(pdaId)?.grade===
            row.grade
        );


    if(
      row.mode!=='TRANSVERSAL_PROJECT'&&
      !sameSet(
        row.pda_ids,
        expectedForGrade
      )
    ){
      throw Error(
        `PCD-004 GRADE_SELECTED_PDA_COVERAGE_MISMATCH:${row.grade}`
      );
    }
  }

  if(composition.base.origin==='LTG_VERIFIED'){
    if(!composition.base.project_id){
      throw Error('PCD-005 VERIFIED_BASE_REQUIRES_PROJECT_ID');
    }

    const base=projectById.get(composition.base.project_id);

    if(!base){
      throw Error('PCD-005 VERIFIED_BASE_NOT_IN_CURRICULUM');
    }

    if(
      composition.base.name!==base.name||
      composition.base.purpose!==base.purpose||
      composition.base.central_product!==base.central_product
    ){
      throw Error('PCD-005 VERIFIED_BASE_METADATA_MISMATCH');
    }

    if(composition.ai_original_required){
      throw Error(
        'PCD-005 VERIFIED_BASE_CANNOT_REQUIRE_AI_ORIGINAL'
      );
    }
  }

  if(composition.base.origin==='AI_ORIGINAL'){
    if(composition.base.project_id!==null){
      throw Error('PCD-006 AI_BASE_PROJECT_ID_MUST_BE_NULL');
    }

    if(!composition.ai_original_required){
      throw Error(
        'PCD-006 AI_BASE_REQUIRES_EXPLICIT_NECESSITY'
      );
    }
  }

  const enrichmentIds=new Set();

  for(const enrichment of composition.enrichments){
    if(enrichmentIds.has(enrichment.project_id)){
      throw Error(
        `PCD-007 DUPLICATE_ENRICHMENT:${enrichment.project_id}`
      );
    }

    enrichmentIds.add(enrichment.project_id);

    if(enrichment.project_id===composition.base.project_id){
      throw Error('PCD-007 BASE_CANNOT_BE_ENRICHMENT');
    }

    const project=projectById.get(enrichment.project_id);

    if(!project){
      throw Error(
        `PCD-007 ENRICHMENT_PROJECT_NOT_VERIFIED:${enrichment.project_id}`
      );
    }

    for(const activityId of enrichment.activity_ids){
      const activity=(project.verified_activities||[]).find(
        x=>
          x.activity_id===activityId&&
          x.verification_status==='verified'
      );

      if(!activity){
        throw Error(
          `PCD-007 ENRICHMENT_ACTIVITY_NOT_VERIFIED:${activityId}`
        );
      }
    }
  }

  const referenceIds=new Set();

  for(const reference of composition.references){
    if(referenceIds.has(reference.project_id)){
      throw Error(
        `PCD-008 DUPLICATE_REFERENCE:${reference.project_id}`
      );
    }

    referenceIds.add(reference.project_id);

    if(reference.project_id===composition.base.project_id){
      throw Error('PCD-008 BASE_CANNOT_BE_REFERENCE');
    }

    if(enrichmentIds.has(reference.project_id)){
      throw Error(
        'PCD-008 ENRICHMENT_CANNOT_ALSO_BE_REFERENCE'
      );
    }

    if(!projectById.has(reference.project_id)){
      throw Error(
        `PCD-008 REFERENCE_PROJECT_NOT_VERIFIED:${reference.project_id}`
      );
    }
  }

  assertExplicitLtgComposition(composition,sources);
  return composition;
}

export function makeProjectComposition(input,sources){
  const composition={
    ...structuredClone(input),
    schema_version:PROJECT_COMPOSITION_VERSION,
    composition_id:input.composition_id||randomUUID(),
    source:compositionSourceBinding(sources)
  };

  validateProjectComposition(composition,sources);

  return deepFreeze(composition);
}

export function projectCompositionHash(composition){
  return hash(composition);
}
