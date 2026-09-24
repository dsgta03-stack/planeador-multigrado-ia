import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../../project-blueprint-v1/contracts.mjs';
import {buildCriticalClaimsReviewRequest,criticalClaimsGate,approvePipelineSessionGraph} from '../critical-audit.mjs';

function fixture(){
 const curriculum={pdas:[{pda_id:'p1',grade:1,official_text:'Explica una situación y propone un acuerdo.'}]};
 const blueprint={blueprint_id:'bp',revision:1,final_outcome:{functional_requirements:[{requirement_id:'movement',criterion:'traslada físicamente',evidence:'bitácora',stage_ids:['s1']}]}};
 const bh=hash(blueprint);
 const graph={graph_id:'g',revision:1,source_blueprint:{approved_blueprint_hash:bh},sessions:[{session_number:1,stage_ids:['s1'],activities:[{activity_id:'a1',title:'Actividad',common_student_action:'dialogan sobre un traslado',grade_participation:[{grade:1,student_action:'explica una situación',pda_mobilization:[{pda_id:'p1',status:'WORKED'}],evidence:'oral'}],methodology_operations:['DIFUSION'],functional_requirement_ids:['movement'],output:'lista hipotética',evidence:'lista',assessment_criteria:['describe']}]}]};
 return {input:{blueprint,graph,curriculum,methodology:{},constraints:{}}};
}
const passingAudit=request=>({input_hash:request.input_hash,worked_audits:request.claims.worked.map(x=>({activity_id:x.activity_id,grade:x.grade,pda_id:x.pda_id,status:'PASS',component_checks:[{component:'all',satisfied:true,exact_quote:'explica una situación y propone un acuerdo'}],reason:'ok'})),methodology_link_audits:request.claims.methodology_links.map(x=>({operation:x.operation,activity_id:x.activity_id,status:'PASS',exact_quote:'presenta a audiencia',reason:'ok'})),functional_link_audits:request.claims.functional_links.map(x=>({requirement_id:x.requirement_id,activity_id:x.activity_id,status:'PASS',action_quote:'traslada físicamente',evidence_quote:'bitácora',reason:'ok'}))});

test('critical gate requires exact audit binding and claim coverage',()=>{const f=fixture(),request=buildCriticalClaimsReviewRequest(f.input);assert.equal(criticalClaimsGate(f.input,null).status,'NOT_EVALUABLE');const missing=passingAudit(request);missing.functional_link_audits=[];assert.equal(criticalClaimsGate(f.input,missing).status,'NOT_EVALUABLE');});

test('any false local claim blocks approval even if other claims pass',()=>{const f=fixture(),request=buildCriticalClaimsReviewRequest(f.input),audit=passingAudit(request);audit.worked_audits[0].status='FAIL';audit.worked_audits[0].component_checks[0].satisfied=false;const gate=criticalClaimsGate(f.input,audit);assert.equal(gate.status,'FAIL');assert.equal(gate.critical_count,1);});

test('pipeline session approval binds base approval plus critical PASS',()=>{const f=fixture(),request=buildCriticalClaimsReviewRequest(f.input),gate=criticalClaimsGate(f.input,passingAudit(request)),gh=hash(f.input.graph),bh=hash(f.input.blueprint);const base={status:'APPROVED',gate_version:'SESSION_GRAPH_GATE_V1',graph_hash:gh,approved_graph_hash:gh,approved_blueprint_hash:bh};const approval=approvePipelineSessionGraph(f.input,base,gate);assert.equal(approval.status,'APPROVED');assert.equal(approval.approved_graph_hash,gh);assert.equal(approval.critical_gate_version,'SESSION_CRITICAL_GATE_V1');});

test('critical FAIL cannot be wrapped as an approved pipeline session',()=>{const f=fixture(),request=buildCriticalClaimsReviewRequest(f.input),audit=passingAudit(request);audit.functional_link_audits[0].status='FAIL';const gate=criticalClaimsGate(f.input,audit),gh=hash(f.input.graph),bh=hash(f.input.blueprint),base={status:'APPROVED',gate_version:'SESSION_GRAPH_GATE_V1',graph_hash:gh,approved_graph_hash:gh,approved_blueprint_hash:bh};assert.throws(()=>approvePipelineSessionGraph(f.input,base,gate),/CRITICAL_GATE_NOT_PASS/);});
