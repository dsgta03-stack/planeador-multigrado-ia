import test from 'node:test';
import assert from 'node:assert/strict';
import {ltgFixture,useLtg} from '../../session-graph-v1/tests/pedagogical-fixture.mjs';
import {normalizeSessionGraphAuthoring,ltgExecutionErrors} from '../../session-graph-v1/authoring.mjs';
import {ltgSessionEligibility,assertCoreLtgEligibility,ltgEligibilityDiagnostics} from '../ltg-session-eligibility.mjs';
import {repairTargetsFromContext,createSessionGraphDrivers} from '../session-provider.mjs';
function setup(role='CORE'){
 const f=ltgFixture(role);useLtg(f);const s=f.proposal.sessions[1],b=f.blueprint.session_progression[1];
 f.proposal.sessions=[2,3,4].map(session_number=>({...structuredClone(s),session_number}));
 f.blueprint.session_progression=[2,3,4].map(session_number=>({...structuredClone(b),session_number,pda_focus:session_number===4?['p1']:['p3']}));
 return f;
}
const ctx=f=>({sources:{constraints:f.constraints,curriculum:f.curriculum,methodology:f.methodology},blueprint:f.blueprint,approval:f.approval,previous_proposal:f.proposal,compile_error:{code:'SESSION_GRAPH_AUTHORING_INVALID',message:'SESSION_GRAPH_AUTHORING_CONTRACT: SGD-013 LTG decision/use mismatch session=2 project_id=ltg1 decision=USE concrete_use=absent'}});
test('CORE only eligible in session 4; matrix is immutable and target shares exact references',()=>{
 const f=setup(),before=structuredClone(f),m=ltgSessionEligibility(f);assert.deepEqual(m.map(r=>[r.session,r.eligible]),[[2,false],[3,false],[4,true]]);assert.deepEqual(f,before);
 for(const r of m){const c=ctx(f);c.compile_error.message=c.compile_error.message.replace('session=2',`session=${r.session}`);const t=repairTargetsFromContext({...c,ltg_session_eligibility:m})[0];assert.deepEqual(t.compatible_pda_ids,r.compatible_pda_ids);assert.equal(t.authorized_use_possible,r.eligible);}
 for(const s of f.proposal.sessions)if(s.session_number!==4){s.ltg_decisions[0].decision='NOT_RECOMMENDED';s.ltg_decisions[0].reason='La sesion desarrolla otro PDA sin vinculo verificado.';s.activities[0].ltg_use=[];s.activities[0].ltg_activity_ids=[];}
 const n=normalizeSessionGraphAuthoring(f.proposal,f);assert.deepEqual(ltgExecutionErrors(n.sessions,f),[]);assert.deepEqual(n.sessions.map(s=>s.ltg_decisions[0].decision),['NOT_RECOMMENDED','NOT_RECOMMENDED','USE']);
});
test('CORE ineligible local USE and global disappearance remain fail closed',()=>{
 const f=setup(),m=ltgSessionEligibility(f),n=normalizeSessionGraphAuthoring(f.proposal,f);assert.ok(ltgExecutionErrors(n.sessions,f).some(e=>e.includes('session=2')));
 const d=ltgEligibilityDiagnostics(f.proposal,f,m);assert.deepEqual(d.core_projects,[{project_id:'ltg1',eligible_sessions:[4]}]);assert.equal(d.local_decisions.length,2);
 for(const s of f.proposal.sessions){s.ltg_decisions[0].decision='NOT_RECOMMENDED';s.activities[0].ltg_use=[];s.activities[0].ltg_activity_ids=[];}assert.ok(ltgExecutionErrors(normalizeSessionGraphAuthoring(f.proposal,f).sessions,f).includes('SGD-013 CORE disappeared'));
});
for(const mode of ['focus','link','grade','activity','participation'])test('eligibility rejects '+mode,()=>{
 const f=setup();if(mode==='focus')f.blueprint.session_progression[2].pda_focus=['p3'];if(mode==='link')f.curriculum.ltg[0].verified_pda_links=[];if(mode==='grade')f.curriculum.pdas[0].grade=3;if(mode==='activity')f.curriculum.ltg[0].verified_activities[0].verification_status='unverified';if(mode==='participation')f.constraints.grades=[3];
 const m=ltgSessionEligibility(f);assert.equal(m.some(r=>r.eligible),false);assert.throws(()=>assertCoreLtgEligibility(f,m),e=>e.code==='CORE_LTG_NO_ELIGIBLE_SESSION'&&e.ltg_eligibility_diagnostics.core_projects[0].eligible_sessions.length===0);
});
test('null activity permitted only without specific activity selection',()=>{
 const f=setup();f.blueprint.ltg_strategy.selections[0].activity_ids=[];const r=ltgSessionEligibility(f)[2];assert.equal(r.eligible,true);assert.equal(r.null_activity_allowed,true);assert.deepEqual(r.authorized_activity_ids,[]);
 f.blueprint.ltg_strategy.selections[0].activity_ids=['unknown'];const invalid=ltgSessionEligibility(f)[2];assert.equal(invalid.eligible,false);assert.equal(invalid.null_activity_allowed,false);assert.deepEqual(invalid.authorized_activity_ids,[]);
});
for(const role of ['SUPPORT','OPTIONAL'])test(role+' preserves existing decisions and policy',()=>{
 const f=setup(role);const before=structuredClone(f);ltgSessionEligibility(f);assert.deepEqual(f,before);const n=normalizeSessionGraphAuthoring(f.proposal,f);assert.equal(n.sessions[0].ltg_decisions[0].decision,role==='SUPPORT'?'NOT_RECOMMENDED':'USE');
});
test('GENERATE and REPAIR share matrix; no eligible CORE blocks before any provider call',async()=>{
 const f=setup();let calls=0,sent;let output=f.proposal;
 const drivers=createSessionGraphDrivers({endpoint:'https://example.invalid/plan-project-blueprint-v1-shadow',token:'x'.repeat(64),durableEvidence:false,fetchImpl:async(_u,init)=>{calls++;sent=JSON.parse(init.body);return new Response(JSON.stringify({output}));}});
 const author=await drivers.sessionAuthor(ctx(f)),matrix=sent.prompt.ltg_session_eligibility;assert.equal(author.ltg_eligibility_diagnostics.local_decisions.length,2);assert.match(sent.prompt.ltg_session_eligibility_instruction,/NO declares USE/);
 output={status:'PROPOSAL',proposal:f.proposal};await assert.rejects(drivers.sessionRepair(ctx(f)),/SGD-013/);assert.deepEqual(sent.prompt.ltg_session_eligibility,matrix);assert.equal(sent.prompt.repair_targets[0].authorized_use_possible,false);
 f.blueprint.session_progression.forEach(s=>s.pda_focus=['p3']);const priorCalls=calls;
 await assert.rejects(drivers.sessionAuthor(ctx(f)),e=>e.code==='CORE_LTG_NO_ELIGIBLE_SESSION');await assert.rejects(drivers.sessionRepair(ctx(f)),e=>e.code==='CORE_LTG_NO_ELIGIBLE_SESSION');assert.equal(calls,priorCalls);
});
