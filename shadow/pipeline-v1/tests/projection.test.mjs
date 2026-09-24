import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../../project-blueprint-v1/contracts.mjs';
import {projectTeacherPlan,teacherProjectionHash,assertTeacherProjection} from '../projection.mjs';

function fixture(){
 const blueprint={blueprint_id:'bp1',revision:2,problem_frame:{original_problem:'x'},guiding_question:{question:'q'},methodology:{selected_id:'proyectos_comunitarios'},final_outcome:{outcome_id:'out1'},pda_analysis:[],grade_contributions:[],project_stages:[],ltg_strategy:{mode:'NONE',selections:[]}};
 const bh=hash(blueprint);
 const blueprintApproval={status:'APPROVED',blueprint_hash:bh,approved_blueprint_hash:bh};
 const graph={graph_id:'g1',revision:1,source_blueprint:{approved_blueprint_hash:bh},sessions:[{session_number:1,stage_ids:[],project_state_before:'a',session_project_goal:'b',required_learning:[],pda_focus:[],methodology_operations:[],input_artifact_ids:[],expected_output_artifact_ids:[],expected_partial_product:'p',blueprint_acceptance_criteria:[],project_state_after:'c',terminal:true,next_session_dependency:null,activities:[]}],traceability:{pda:{},methodology:{},artifacts:{},functional_requirements:{}}};
 const gh=hash(graph);
 const graphApproval={status:'APPROVED',graph_hash:gh,approved_graph_hash:gh,approved_blueprint_hash:bh};
 return {blueprint,blueprintApproval,graph,graphApproval};
}

test('projection hash binds exact approved teacher artifact',()=>{
 const f=fixture();const p=projectTeacherPlan(f);
 assert.equal(p.projection_hash,teacherProjectionHash(p));
 assert.equal(assertTeacherProjection(p),true);
 assert.equal(Object.isFrozen(p),true);
 assert.equal(Object.isFrozen(p.sessions),true);
});

test('tampered projection is rejected without reinterpreting it',()=>{
 const f=fixture();const p=projectTeacherPlan(f);const tampered=structuredClone(p);tampered.project.guiding_question.question='otra';
 assert.throws(()=>assertTeacherProjection(tampered),/TEACHER_PROJECTION_TAMPERED/);
});

test('cross-artifact hash mismatch blocks projection',()=>{
 const f=fixture();f.graph.source_blueprint.approved_blueprint_hash='0'.repeat(64);
 // Rebind graph approval to altered graph so failure is specifically the Blueprint↔SessionGraph boundary.
 const gh=hash(f.graph);f.graphApproval={...f.graphApproval,graph_hash:gh,approved_graph_hash:gh};
 assert.throws(()=>projectTeacherPlan(f),/CROSS_ARTIFACT_BINDING_MISMATCH/);
});
