import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

import {
  generateShadow
} from '../../project-blueprint-v1/shadow.mjs';

import {
  semanticInputHash
} from '../../project-blueprint-v1/gate.mjs';

import {
  sourceBinding,
  makeSnapshot
} from '../../project-blueprint-v1/contracts.mjs';

import {makeProjectComposition} from '../composition.mjs';

import {
  BPS
} from '../../project-blueprint-v1/catalog.mjs';

const fixture=id=>
  JSON.parse(
    readFileSync(
      new URL(
        `../../project-blueprint-v1/fixtures/${id}.json`,
        import.meta.url
      )
    )
  );

const semanticPass=input=>({
  input_hash:semanticInputHash(input),
  findings:Object.entries(BPS).map(
    ([rule_id,expected])=>({
      rule_id,
      severity:'CRITICAL',
      status:'PASS',
      scope:'project-composition-integration-test',
      observed:'Injected PASS only for integration plumbing test.',
      expected
    })
  )
});

test('composition to binding to blueprint gate projects verified LTG without losing curricular PDA',async()=>{
  const {blueprint,...sources}=fixture('PB-016-LTG-CORE').input;
  const base=sources.curriculum.ltg[0];
  base.purpose='Propósito verificado de prueba';
  base.central_product='Producto verificado de prueba';
  const support={...structuredClone(base),project_id:'integration-support'};
  sources.curriculum=makeSnapshot({...sources.curriculum,ltg:[base,support]});
  blueprint.source=sourceBinding(sources);
  const composition=makeProjectComposition({
    methodology:{selected_id:sources.methodology.selected_id,
      catalog_version:sources.methodology.catalog_version},
    base:{origin:'LTG_VERIFIED',project_id:base.project_id,name:base.name,
      purpose:base.purpose,central_product:base.central_product,
      compatibility:'DIRECT',reason:'Base de prueba'},
    enrichments:[{project_id:support.project_id,
      activity_ids:[support.verified_activities[0].activity_id],
      reason:'Apoyo de prueba',contribution:'Evidencia para el producto común'}],
    references:[],
    grade_coverage:sources.constraints.grades.map(grade=>({
      grade,mode:'BASE_PDA',
      pda_ids:sources.curriculum.pdas.filter(p=>p.grade===grade).map(p=>p.pda_id)
    })),
    final_outcome:{name:blueprint.final_outcome.name,
      purpose:blueprint.final_outcome.purpose,description:blueprint.final_outcome.description},
    cohesion:{one_project_reason:'Un proyecto común',enrichment_boundary:'Apoyo al proyecto'},
    rejected_options:[],ai_original_required:false
  },sources);
  blueprint.ltg_strategy.selections[0].activity_ids.push('not-verified');
  blueprint.ltg_strategy.selections.push({project_id:support.project_id,
    role:'SUPPORT',pda_ids:[...sources.constraints.selected_pda_ids],
    activity_ids:['not-approved'],reason:'Apoyo de prueba'});
  const before=structuredClone({sources,composition,blueprint});
  const result=await generateShadow(sources,{projectComposition:composition},async(task,input)=>({
    output:task==='REVIEW'?semanticPass(input):structuredClone(blueprint),telemetry:{task}
  }));
  assert.equal(result.status,'APPROVED');
  assert.equal(result.revisions.length,1);
  assert.deepEqual(result.gate.deterministic_findings.filter(x=>x.status!=='PASS'),[]);
  for(const selection of result.blueprint.ltg_strategy.selections){
    assert.deepEqual(selection.pda_ids,base.verified_pda_links);
    assert.deepEqual(selection.activity_ids,[base.verified_activities[0].activity_id]);
  }
  for(const field of ['pda_analysis','grade_contributions','session_progression']){
    assert.deepEqual(result.blueprint[field],blueprint[field]);
  }
  const unlinked=sources.constraints.selected_pda_ids.find(id=>!base.verified_pda_links.includes(id));
  assert.ok(unlinked);
  assert.ok(result.blueprint.pda_analysis.some(p=>p.pda_id===unlinked));
  assert.ok(result.blueprint.grade_contributions.some(g=>g.pda_ids.includes(unlinked)));
  assert.ok(composition.grade_coverage.some(g=>g.pda_ids.includes(unlinked)));
  assert.deepEqual({sources,composition,blueprint},before);
});

function sourceAndComposition(){
  const original=fixture('PB-010').input;
  const {
    blueprint,
    ...sources
  }=original;

  const selectedByGrade=new Map();

  for(const pdaId of sources.constraints.selected_pda_ids){
    const pda=sources.curriculum.pdas.find(
      x=>x.pda_id===pdaId
    );

    if(!pda)continue;

    if(!selectedByGrade.has(pda.grade)){
      selectedByGrade.set(
        pda.grade,
        []
      );
    }

    selectedByGrade.get(
      pda.grade
    ).push(
      pdaId
    );
  }

  const grade_coverage=
    sources.constraints.grades.map(
      grade=>{
        const pda_ids=
          selectedByGrade.get(grade)||[];

        return {
          grade,
          mode:pda_ids.length
            ? 'BASE_PDA'
            : 'TRANSVERSAL_PROJECT',
          pda_ids
        };
      }
    );

  const composition={
    schema_version:'PROJECT_COMPOSITION_V1',

    composition_id:
      'integration-composition-1',

    source:
      sourceBinding(sources),

    methodology:{
      selected_id:
        sources.methodology.selected_id,

      catalog_version:
        sources.methodology.catalog_version
    },

    base:{
      origin:'AI_ORIGINAL',
      project_id:null,
      name:blueprint.final_outcome.name,
      purpose:blueprint.final_outcome.purpose,
      central_product:blueprint.final_outcome.name,
      compatibility:'DIRECT',
      reason:
        'Fixture de integración sin LTG operacional.'
    },

    enrichments:[],
    references:[],

    grade_coverage,

    final_outcome:{
      name:blueprint.final_outcome.name,
      purpose:blueprint.final_outcome.purpose,
      description:
        blueprint.final_outcome.description
    },

    cohesion:{
      one_project_reason:
        'Un solo proyecto común.',
      enrichment_boundary:
        'No hay enriquecimientos LTG operacionales.'
    },

    rejected_options:[],

    ai_original_required:true
  };

  return {
    sources,
    blueprint,
    composition
  };
}

test(
  'PROJECT_COMPOSITION binding rejects drift, spends one repair, then allows matching Blueprint',
  async()=>{
    const {
      sources,
      blueprint,
      composition
    }=sourceAndComposition();

    const calls=[];
    const seenOptions=[];

    const provider=
      async(
        task,
        input,
        options={}
      )=>{
        calls.push(task);

        if(task!=='REVIEW'){
          seenOptions.push(
            structuredClone(
              options.projectComposition
            )
          );
        }

        if(task==='GENERATE'){
          const drift=
            structuredClone(
              blueprint
            );

          drift.final_outcome.name=
            'Museo inventado por el generador';

          return {
            output:drift,
            telemetry:{
              task
            }
          };
        }

        if(task==='REPAIR'){
          return {
            output:
              structuredClone(
                blueprint
              ),
            telemetry:{
              task
            }
          };
        }

        return {
          output:
            semanticPass(
              input
            ),
          telemetry:{
            task
          }
        };
      };

    const result=
      await generateShadow(
        sources,
        {
          projectComposition:
            composition
        },
        provider
      );

    assert.equal(
      result.revisions.length,
      2
    );

    assert.equal(
      result.repair_count,
      1
    );

    assert.equal(
      result.revisions[0]
        .gate
        .deterministic_findings
        .some(
          x=>
            x.rule_id==='PCB-BINDING'&&
            x.status==='FAIL'
        ),
      true
    );

    assert.equal(
      result.revisions[0]
        .semantic,
      null
    );

    assert.equal(
      result.revisions[1]
        .blueprint
        .final_outcome
        .name,
      composition.final_outcome.name
    );

    assert.equal(
      result.status,
      'APPROVED'
    );

    assert.deepEqual(
      calls,
      [
        'GENERATE',
        'REPAIR',
        'REVIEW'
      ]
    );

    assert.equal(
      seenOptions.length,
      2
    );

    assert.deepEqual(
      seenOptions[0],
      composition
    );

    assert.deepEqual(
      seenOptions[1],
      composition
    );
  }
);

test(
  'PROJECT_COMPOSITION source binding is checked before provider execution',
  async()=>{
    const {
      sources,
      composition
    }=sourceAndComposition();

    composition.source=
      {
        ...composition.source,
        constraints_hash:
          'f'.repeat(64)
      };

    let called=false;

    await assert.rejects(
      ()=>generateShadow(
        sources,
        {
          projectComposition:
            composition
        },
        async()=>{
          called=true;
          throw Error(
            'provider should not run'
          );
        }
      ),
      /PROJECT_COMPOSITION_SOURCE_MISMATCH:constraints_hash/
    );

    assert.equal(
      called,
      false
    );
  }
);
