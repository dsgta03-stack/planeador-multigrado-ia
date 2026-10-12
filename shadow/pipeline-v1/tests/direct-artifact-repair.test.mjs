import test from 'node:test';
import assert from 'node:assert/strict';
import {executableSource} from '../../session-graph-v1/tests/pedagogical-fixture.mjs';
import {normalizeSessionGraphAuthoring,validateSessionGraphAuthoring} from '../../session-graph-v1/authoring.mjs';
import {compileSessionGraph} from '../../session-graph-v1/session-graph.mjs';
import {repairTargetsFromContext,validateRepairTargets,createSessionGraphDrivers} from '../session-provider.mjs';
import {validateDirectRepair,directRepairDiagnostics} from '../session-contribution-repair.mjs';
const setup=()=>{const f=executableSource(),a=f.proposal.sessions[0].activities[1];a.contributes_to_artifact_ids=[];return {f,a,targets:repairTargetsFromContext({blueprint:f.blueprint,previous_proposal:f.proposal,compile_error:{code:'SESSION_GRAPH_AUTHORING_INVALID',message:`SESSION_GRAPH_AUTHORING_CONTRACT: $.sessions[1].${a.activity_key}: DIRECT requires artifact`}})};};
test('DIRECT target uses real session number and only session artifact authority',()=>{
 const {a,targets}=setup(),t=targets[0];
 assert.equal(t.session,1);assert.equal(t.activity_key,a.activity_key);assert.equal(t.contribution_mode,'DIRECT');assert.equal(t.field,'contributes_to_artifact_ids');
 assert.deepEqual(t.current_artifact_ids,[]);assert.deepEqual(t.authorized_artifact_ids,['artifact_1']);assert.match(t.required,/TODAS/);
});
for(const [ids,status,reason] of [[[],'NOT_PROVIDED',null],[['artifact_2'],'ALL_FILTERED','ARTIFACT_NOT_AUTHORIZED_FOR_SESSION'],[['invented'],'ALL_FILTERED','ARTIFACT_NOT_FOUND'],[['artifact_1'],'RETAINED',null]])test('DIRECT normalization and diagnostics '+status+' '+ids,()=>{
 const {f,a,targets}=setup();a.contributes_to_artifact_ids=ids;const before=structuredClone(f.proposal),n=normalizeSessionGraphAuthoring(f.proposal,f),d=directRepairDiagnostics(before,n,f.blueprint).find(d=>d.activity_key===a.activity_key);
 assert.equal(d.status,status);assert.deepEqual(d.artifact_ids_before_normalization,ids);assert.deepEqual(d.artifact_ids_after_normalization,status==='RETAINED'?ids:[]);assert.deepEqual(d.filtered_reasons,reason?[reason]:[]);
 assert.equal(n.sessions[0].activities[1].contribution_mode,'DIRECT');assert.deepEqual(f.proposal,before);
 if(status==='RETAINED'){assert.equal(validateRepairTargets(n,f,targets),true);assert.equal(validateDirectRepair(n,f),true);assert.equal(validateSessionGraphAuthoring(n,f),true);compileSessionGraph(n,f,{graph_id:'direct-test',revision:1});}
 else {assert.throws(()=>validateRepairTargets(n,f,targets),/DIRECT requires artifact/);assert.throws(()=>validateDirectRepair(n,f),/DIRECT requires artifact/);assert.throws(()=>validateSessionGraphAuthoring(n,f),/DIRECT requires artifact/);}
});
test('correcting target cannot hide another DIRECT defect',()=>{
 const {f,a,targets}=setup();a.contributes_to_artifact_ids=['artifact_1'];f.proposal.sessions[1].activities[0].contributes_to_artifact_ids=[];
 assert.equal(validateRepairTargets(f.proposal,f,targets),true);assert.throws(()=>validateDirectRepair(f.proposal,f),/sessions\[2\].b1: DIRECT requires artifact/);
});
test('COMPLEMENTARY behavior is unchanged',()=>{
 const f=executableSource();assert.equal(validateDirectRepair(f.proposal,f),true);assert.equal(validateSessionGraphAuthoring(f.proposal,f),true);
 f.proposal.sessions[0].activities[1].input_refs=[];assert.throws(()=>validateSessionGraphAuthoring(f.proposal,f),/orphan complementary/);
});
test('provider repair audits every final DIRECT and exposes filtering metadata',async()=>{
 const {f,a}=setup();const raw=structuredClone(f.proposal);raw.sessions[0].activities[1].contributes_to_artifact_ids=['artifact_1'];raw.sessions[1].activities[0].contributes_to_artifact_ids=['invented'];let sent;
 const drivers=createSessionGraphDrivers({endpoint:'https://example.supabase.co/functions/v1/plan-project-blueprint-v1-shadow',token:'x'.repeat(64),durableEvidence:false,fetchImpl:async(_u,init)=>{sent=JSON.parse(init.body);return new Response(JSON.stringify({output:{status:'PROPOSAL',proposal:raw}}),{status:200,headers:{'content-type':'application/json'}});}});
 const ctx={sources:{constraints:f.constraints,curriculum:f.curriculum,methodology:f.methodology},blueprint:f.blueprint,approval:f.approval,previous_proposal:f.proposal,compile_error:{code:'SESSION_GRAPH_AUTHORING_INVALID',message:`SESSION_GRAPH_AUTHORING_CONTRACT: $.sessions[1].${a.activity_key}: DIRECT requires artifact`}};
 await assert.rejects(drivers.sessionRepair(ctx),e=>{assert.equal(e.repair_local_validation.provider_responded,true);assert.equal(e.repair_local_validation.proposal_normalized,true);const d=e.direct_repair_diagnostics.find(d=>d.session===2);assert.equal(d.status,'ALL_FILTERED');assert.deepEqual(d.filtered_reasons,['ARTIFACT_NOT_FOUND']);assert.equal(JSON.stringify(d).includes('student_action'),false);return /DIRECT requires artifact/.test(e.message);});
 assert.match(sent.prompt.direct_repair_audit,/TODAS/);
 raw.sessions[1].activities[0].contributes_to_artifact_ids=['artifact_2'];const result=await drivers.sessionRepair(ctx);assert.equal(result.direct_repair_diagnostics.every(d=>d.status==='RETAINED'),true);assert.equal(validateSessionGraphAuthoring(result.proposal,f),true);
});
