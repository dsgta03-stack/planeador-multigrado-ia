import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../../project-blueprint-v1/contracts.mjs';
import {compileSessionGraph,validateCompiledSessionGraph} from '../session-graph.mjs';
import {makeItinerancySemanticAdversarial} from '../adversarial.mjs';

function fixture(){
 const constraints={constraints_hash:'a'.repeat(64),grades:[1],minutes_per_session:60,available_resources:['papel','patio'],supports:['modelado']};
 const curriculum={snapshot_hash:'b'.repeat(64),pdas:[{pda_id:'p1',grade:1}]};
 const methodology={methodology_decision_id:'m1',selected_id:'proyectos_comunitarios',catalog_version:'METHODOLOGY_CATALOG_V1',required_operations:['DIFUSION']};
 const blueprint={
  schema_version:'PROJECT_BLUEPRINT_V1',blueprint_id:'bp-adv',revision:1,status:'DRAFT',
  source:{constraints_hash:constraints.constraints_hash,curriculum_snapshot_hash:curriculum.snapshot_hash,methodology_decision_id:'m1'},
  methodology:{selected_id:'proyectos_comunitarios',catalog_version:'METHODOLOGY_CATALOG_V1',required_operations:['DIFUSION']},
  pda_analysis:[{pda_id:'p1'}],grade_contributions:[],
  final_outcome:{functional_requirements:[{requirement_id:'movement',stage_ids:['intervention']},{requirement_id:'relocation_or_reinstallation',stage_ids:['intervention']}]},
  project_stages:[{stage_id:'intervention',output_artifact_id:'artifact_intervention'}],
  session_progression:[{session_number:1,project_state_before:'museo en aula',session_project_goal:'trasladar y reinstalar',required_learning:['circulacion'],pda_focus:['p1'],methodology_operations:['DIFUSION'],input_artifact_ids:['artifact_production'],expected_output_artifact_ids:['artifact_intervention'],expected_partial_product:'museo reinstalado',acceptance_criteria:['traslado real'],project_state_after:'museo reinstalado en patio',terminal:true,next_session_dependency:null}],
  ltg_strategy:{mode:'NONE',selections:[]}
 };
 const h=hash(blueprint);
 const approval={approval_version:'PROJECT_BLUEPRINT_APPROVAL_V1',status:'APPROVED',gate_version:'BLUEPRINT_GATE_V1',blueprint_hash:h,evaluated_blueprint_hash:h,approved_blueprint_hash:h};
 const proposal={authoring_version:'SESSION_GRAPH_AUTHORING_V1',sessions:[{session_number:1,activities:[{
  activity_key:'move',title:'Trasladamos y reinstalamos',contribution_mode:'DIRECT',contribution_rationale:'ejecuta la itinerancia',common_student_action:'El alumnado desmonta, traslada y reinstala físicamente el museo en el patio.',
  grade_participation:[{grade:1,student_action:'Traslada su pieza y explica el acuerdo en el segundo espacio.',differentiation:'modelado breve',pda_mobilization:[{pda_id:'p1',status:'DEVELOPING'}],evidence:'pieza reinstalada y explicación'}],
  teacher_role:'supervisa seguridad',resources:['papel','patio'],supports:['modelado'],minutes:45,input_refs:['artifact_production'],output:'museo reinstalado en patio',contributes_to_artifact_ids:['artifact_intervention'],methodology_operations:['DIFUSION'],functional_requirement_ids:['movement','relocation_or_reinstallation'],ltg_activity_ids:[],evidence:'registro de traslado y reinstalación',assessment_criteria:['las piezas cambian físicamente de espacio y quedan reinstaladas']
 }]}]};
 return {constraints,curriculum,methodology,blueprint,approval,proposal};
}

test('semantic itinerancy adversarial remains structurally compilable',()=>{
 const f=fixture();
 const original=compileSessionGraph(f.proposal,f,{graph_id:'adv-original'}).graph;
 assert.equal(validateCompiledSessionGraph(original,f),true);
 const brokenProposal=makeItinerancySemanticAdversarial(f.proposal);
 const broken=compileSessionGraph(brokenProposal,f,{graph_id:'adv-broken'}).graph;
 assert.equal(validateCompiledSessionGraph(broken,f),true);
 const a=broken.sessions[0].activities[0];
 assert.deepEqual(a.functional_requirement_ids,['movement','relocation_or_reinstallation']);
 assert.match(a.common_student_action,/no desmonta, no traslada y no reinstala/);
 assert.match(a.evidence,/no existe evidencia de movimiento/);
});
