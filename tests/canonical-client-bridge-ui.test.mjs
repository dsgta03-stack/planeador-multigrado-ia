import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import {CANONICAL_CLIENT_BRIDGE_UI} from '../lib/consolidation-r1/ui/canonical-client-bridge-ui.mjs';
import {analyzeLegacyPlanRequest,buildPipelineSourceArtifacts} from '../shadow/integration-v1/legacy-request-adapter.mjs';
import {buildProjectCandidatePool} from '../shadow/project-composition-v1/candidate-pool.mjs';
import {makeProjectComposition} from '../shadow/project-composition-v1/composition.mjs';
import {bindProjectCompositionToBlueprint,assertProjectCompositionBinding} from '../shadow/project-composition-v1/blueprint-binding.mjs';
import {sourceBinding} from '../shadow/project-blueprint-v1/contracts.mjs';
import {blueprintGate} from '../shadow/project-blueprint-v1/gate.mjs';

async function bridge(body){
  let sent;
  const selected=Object.fromEntries(body.pdas.map(p=>[p.pda_id,p]));
  const sandbox={state:{selected,students:body.teacher_constraints.students_by_grade},
    document:{getElementById:()=>({value:''}),querySelector:()=>null},
    window:{fetch:async(_url,init)=>{sent=JSON.parse(init.body);return {ok:false};}}};
  const script=CANONICAL_CLIENT_BRIDGE_UI.replace(/^\s*<script[^>]*>/,'').replace(/<\/script>\s*$/,'');
  runInNewContext(script,sandbox);
  await sandbox.window.fetch('/api/gemini-plan',{body:JSON.stringify(body)});
  return sent;
}

function fixture(){
  const {blueprint,...original}=JSON.parse(readFileSync(
    new URL('../shadow/project-blueprint-v1/fixtures/PB-016-LTG-CORE.json',import.meta.url),'utf8')).input;
  const c=original.constraints;
  const body={grados:c.grades,pdas:original.curriculum.pdas,
    metodologia:original.methodology.selected_id,contexto:c.original_context,
    situacion_problema:c.original_problem,sesiones:c.requested_sessions,minutos:c.minutes_per_session,
    lectura:c.reading_profile,escritura:c.writing_profile,autonomia:c.autonomy_profile,
    conectividad:c.connectivity,recursos:c.available_resources.join(';'),apoyos:c.supports.join(';'),
    teacher_explicit_constraints:c.teacher_explicit_constraints,
    teacher_constraints:{students_by_grade:c.students_by_grade},
    ltg:[{project_id:original.curriculum.ltg[0].project_id,pda_id:c.selected_pda_ids[1]}]};
  return {original,blueprint,body};
}

test('legacy LTG without explicit intent stays a candidate and can become BASE/CORE without BPD-LTG',async()=>{
  const {original,blueprint,body}=fixture();
  const before=structuredClone(body),request=await bridge(body);
  assert.deepEqual(body,before);
  assert.deepEqual(request.ltg,body.ltg);
  assert.deepEqual(request.explicit_ltg_selections,[]);
  const project=original.curriculum.ltg[0];
  project.purpose='Propósito de prueba';project.central_product='Producto de prueba';
  const {sources}=buildPipelineSourceArtifacts(analyzeLegacyPlanRequest(request),{
    curriculum_pdas:original.curriculum.pdas,ltg:original.curriculum.ltg,
    corpus_version_or_provenance:'Bridge regression fixture'});
  assert.deepEqual(sources.constraints.explicit_ltg_selections,[]);
  const pool=buildProjectCandidatePool(sources);
  assert.equal(pool.candidates[0].project_id,project.project_id);
  assert.equal(pool.candidates[0].explicit_intent,null);
  const composition=makeProjectComposition({
    methodology:{selected_id:sources.methodology.selected_id,catalog_version:sources.methodology.catalog_version},
    base:{origin:'LTG_VERIFIED',project_id:project.project_id,name:project.name,purpose:project.purpose,
      central_product:project.central_product,compatibility:'DIRECT',reason:'Prueba'},
    enrichments:[],references:[],grade_coverage:sources.constraints.grades.map(grade=>({
      grade,mode:'BASE_PDA',pda_ids:sources.curriculum.pdas.filter(p=>p.grade===grade).map(p=>p.pda_id)})),
    final_outcome:{name:blueprint.final_outcome.name,purpose:blueprint.final_outcome.purpose,
      description:blueprint.final_outcome.description},
    cohesion:{one_project_reason:'Proyecto común',enrichment_boundary:'Sin enriquecimientos'},
    rejected_options:[],ai_original_required:false
  },sources);
  blueprint.source=sourceBinding(sources);
  const bound=bindProjectCompositionToBlueprint(blueprint,composition,sources);
  assert.equal(assertProjectCompositionBinding(bound,composition,sources),true);
  assert.equal(bound.ltg_strategy.selections[0].role,'CORE');
  assert.deepEqual(blueprintGate({...sources,blueprint:bound}).deterministic_findings.filter(f=>f.status==='FAIL'),[]);
  assert.deepEqual(bound.pda_analysis,blueprint.pda_analysis);
  assert.deepEqual(bound.grade_contributions,blueprint.grade_contributions);
});

for(const intent of ['SUPPORT','CORE','OPTIONAL']){
  test(`bridge and adapter preserve real explicit ${intent} unchanged`,async()=>{
    const {body}=fixture();
    body.explicit_ltg_selections=[{project_id:body.ltg[0].project_id,pda_ids:[body.ltg[0].pda_id],intent}];
    const request=await bridge(body);
    assert.deepEqual(request.explicit_ltg_selections,body.explicit_ltg_selections);
    assert.deepEqual(analyzeLegacyPlanRequest(request).normalized.explicit_ltg_selections,body.explicit_ltg_selections);
  });
}

test('malformed explicit decisions are preserved by bridge and rejected by adapter',async()=>{
  const {body}=fixture();body.explicit_ltg_selections=null;
  const request=await bridge(body);
  assert.equal(request.explicit_ltg_selections,null);
  assert.throws(()=>analyzeLegacyPlanRequest(request),/INVALID_EXPLICIT_LTG_SELECTIONS/);
});
