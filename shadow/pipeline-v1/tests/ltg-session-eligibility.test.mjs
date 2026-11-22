import test from 'node:test';
import assert from 'node:assert/strict';
import {ltgFixture,useLtg} from '../../session-graph-v1/tests/pedagogical-fixture.mjs';
import {normalizeSessionGraphAuthoring,ltgExecutionErrors} from '../../session-graph-v1/authoring.mjs';
import {ltgSessionEligibility,assertCoreLtgEligibility,ltgEligibilityDiagnostics,LTG_SESSION_ELIGIBILITY_INSTRUCTION,ltgDecisionAuthority,assembleLtgDecisions} from '../ltg-session-eligibility.mjs';
import {repairTargetsFromContext,createSessionGraphDrivers} from '../session-provider.mjs';

function transport(proposal,matrix){
 const copy=structuredClone(proposal),rows=ltgDecisionAuthority(matrix).provider_rows;
 for(const session of copy.sessions)for(const item of [...(session.ltg_decisions||[]),...session.activities.flatMap(a=>a.ltg_use||[])]){
  const row=rows.find(r=>r.session===session.session_number&&r.project_id===item.project_id);
  item.row_id=row?.row_id||'unknown';delete item.project_id;
 }
 return copy;
}
function setup(role='CORE'){
 const f=ltgFixture(role);useLtg(f);const s=f.proposal.sessions[1],b=f.blueprint.session_progression[1];
 f.proposal.sessions=[2,3,4].map(session_number=>({...structuredClone(s),session_number}));
 f.blueprint.session_progression=[2,3,4].map(session_number=>({...structuredClone(b),session_number,pda_focus:session_number===4?['p1']:['p3']}));
 return f;
}
const ctx=f=>({sources:{constraints:f.constraints,curriculum:f.curriculum,methodology:f.methodology},blueprint:f.blueprint,approval:f.approval,previous_proposal:f.proposal,compile_error:{code:'SESSION_GRAPH_AUTHORING_INVALID',message:'SESSION_GRAPH_AUTHORING_CONTRACT: SGD-013 LTG decision/use mismatch session=2 project_id=ltg1 decision=USE concrete_use=absent'}});
test('explicit LTG assembly fixes sessions 2/3/5, leaves eligible decisions authored, and preserves CORE globally',()=>{
 const f=setup(),s=f.proposal.sessions[0],b=f.blueprint.session_progression[0];
 f.proposal.sessions=[1,2,3,4,5].map(session_number=>({...structuredClone(s),session_number}));
 f.blueprint.session_progression=[1,2,3,4,5].map(session_number=>({...structuredClone(b),session_number,pda_focus:[1,4].includes(session_number)?['p1']:['p3']}));
 const matrix=ltgSessionEligibility(f),authority=ltgDecisionAuthority(matrix);
 assert.deepEqual(authority.fixed_decisions.map(d=>d.session),[2,3,5]);
 for(const row of f.proposal.sessions)if(row.session_number!==4){row.ltg_decisions=row.session_number===1?[{project_id:'ltg1',decision:'NOT_RECOMMENDED',reason:'La sesion usa el registro propio del grupo.'}]:[];row.activities.forEach(a=>{a.ltg_use=[];a.ltg_activity_ids=[];});}
 const before=structuredClone(f.proposal),out=assembleLtgDecisions(transport(f.proposal,matrix),matrix);
 assert.deepEqual(f.proposal,before);assert.deepEqual(out.sessions.map(s=>s.ltg_decisions[0].decision),['NOT_RECOMMENDED','NOT_RECOMMENDED','NOT_RECOMMENDED','USE','NOT_RECOMMENDED']);
 assert.deepEqual(ltgExecutionErrors(normalizeSessionGraphAuthoring(out,f).sessions,f),[]);
 const noUse=structuredClone(out);noUse.sessions[3].ltg_decisions[0].decision='NOT_RECOMMENDED';noUse.sessions[3].activities.forEach(a=>{a.ltg_use=[];a.ltg_activity_ids=[];});
 assert.ok(ltgExecutionErrors(noUse.sessions,f).includes('SGD-013 CORE disappeared'));
 for(const [session,project_id,decision] of [[2,'ltg1','USE'],[2,'ltg1','NOT_RECOMMENDED'],[4,'foreign','USE']]){
  const invalid=structuredClone(before);invalid.sessions.find(s=>s.session_number===session).ltg_decisions.push({project_id,decision,reason:'Provider candidate'});
  assert.throws(()=>assembleLtgDecisions(invalid,matrix),/NOT_PROVIDER_OWNED/);
 }
 const invalidUse=structuredClone(before);invalidUse.sessions[1].activities[0].ltg_use=[{project_id:'ltg1',activity_id:'ltg-a1'}];
 assert.throws(()=>assembleLtgDecisions(invalidUse,matrix),/NOT_PROVIDER_OWNED/);
 assert.ok(out.sessions.every(s=>s.ltg_decisions.every(d=>d.project_id==='ltg1')));
});
for(const eligible of [[1],[1,4]])test(`CORE global may use only session ${eligible.at(-1)} with local NOT_RECOMMENDED elsewhere`,()=>{
 const f=setup(),s=f.proposal.sessions[0],b=f.blueprint.session_progression[0];
 f.proposal.sessions=[1,2,3,4,5].map(session_number=>({...structuredClone(s),session_number}));
 f.blueprint.session_progression=[1,2,3,4,5].map(session_number=>({...structuredClone(b),session_number,pda_focus:eligible.includes(session_number)?['p1']:['p3']}));
 const used=eligible.at(-1);
 for(const row of f.proposal.sessions)if(row.session_number!==used){row.ltg_decisions[0].decision='NOT_RECOMMENDED';row.activities[0].ltg_use=[];row.activities[0].ltg_activity_ids=[];}
 assert.deepEqual(ltgSessionEligibility(f).filter(r=>r.eligible).map(r=>r.session),eligible);
 const normalized=normalizeSessionGraphAuthoring(f.proposal,f);assert.deepEqual(ltgExecutionErrors(normalized.sessions,f),[]);
 assert.deepEqual(normalized.sessions.map(s=>s.ltg_decisions[0].decision),[1,2,3,4,5].map(n=>n===used?'USE':'NOT_RECOMMENDED'));
 // Even an eligible session cannot claim USE without an actual use.
 const usedRow=normalized.sessions.find(s=>s.session_number===used);usedRow.activities[0].ltg_use=[];
 assert.ok(ltgExecutionErrors(normalized.sessions,f).some(e=>e.includes('decision/use mismatch')));
});
test('shared GENERATE/REPAIR instruction explicitly requires local NOT_RECOMMENDED',()=>{
 assert.match(LTG_SESSION_ELIGIBILITY_INSTRUCTION,/CORE is a graph-level obligation, not a per-session obligation/);
 assert.match(LTG_SESSION_ELIGIBILITY_INSTRUCTION,/eligible=false => ltg_decision MUST be NOT_RECOMMENDED and no ltg_use may be authored/);
 assert.match(LTG_SESSION_ELIGIBILITY_INSTRUCTION,/Never emit USE solely because role=CORE/);
});
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
 const f=setup();let calls=0,sent;let output=structuredClone(f.proposal);for(const row of output.sessions)if(row.session_number!==4){row.ltg_decisions=[];row.activities.forEach(a=>{a.ltg_use=[];a.ltg_activity_ids=[];});}
 output=transport(output,ltgSessionEligibility(f));
 const drivers=createSessionGraphDrivers({endpoint:'https://example.invalid/plan-project-blueprint-v1-shadow',token:'x'.repeat(64),durableEvidence:false,fetchImpl:async(_u,init)=>{calls++;sent=JSON.parse(init.body);return new Response(JSON.stringify({output}));}});
 const author=await drivers.sessionAuthor(ctx(f)),matrix=sent.prompt.ltg_session_eligibility;assert.equal(author.ltg_eligibility_diagnostics.local_decisions.length,0);assert.match(sent.prompt.ltg_session_eligibility_instruction,/NO declares USE/);
 assert.equal(sent.prompt.ltg_session_eligibility_instruction,LTG_SESSION_ELIGIBILITY_INSTRUCTION);
 assert.deepEqual(Object.keys(matrix[0]),['project_id','role','session','eligible','compatible_grade','compatible_pda_ids','selected_activity_ids','verified_activity_ids','authorized_activity_ids','null_activity_allowed','reasons']);
 output={status:'PROPOSAL',proposal:f.proposal};await assert.rejects(drivers.sessionRepair(ctx(f)),/SESSION_PROVIDER_LTG_AUTHORITY/);assert.deepEqual(sent.prompt.ltg_session_eligibility,matrix);assert.equal(sent.prompt.repair_targets[0].authorized_use_possible,false);
 assert.equal(sent.prompt.ltg_session_eligibility_instruction,LTG_SESSION_ELIGIBILITY_INSTRUCTION);
 f.blueprint.session_progression.forEach(s=>s.pda_focus=['p3']);const priorCalls=calls;
 await assert.rejects(drivers.sessionAuthor(ctx(f)),e=>e.code==='CORE_LTG_NO_ELIGIBLE_SESSION');await assert.rejects(drivers.sessionRepair(ctx(f)),e=>e.code==='CORE_LTG_NO_ELIGIBLE_SESSION');assert.equal(calls,priorCalls);
});
