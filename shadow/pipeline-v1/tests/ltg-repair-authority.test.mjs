import test from 'node:test';
import assert from 'node:assert/strict';
import {ltgFixture,useLtg} from '../../session-graph-v1/tests/pedagogical-fixture.mjs';
import {ltgSessionEligibility,ltgDecisionAuthority,assembleLtgDecisions} from '../ltg-session-eligibility.mjs';
import {ltgExecutionErrors,normalizeSessionGraphAuthoring} from '../../session-graph-v1/authoring.mjs';
import {createSessionGraphDrivers} from '../session-provider.mjs';
import {preserveLockedLtgRepair,lockedLtgRepair,assertLockedLtgPreserved} from '../ltg-repair-authority.mjs';
const nonLtg={code:'SESSION_GRAPH_AUTHORING_INVALID',message:'SESSION_GRAPH_AUTHORING_CONTRACT: $.sessions[1].a1: methodology RECONOCIMIENTO missing RECONOCIMIENTO_LOCAL_ACTION'};
function transport(proposal,rows){
 const p=structuredClone(proposal);
 for(const s of p.sessions)for(const item of [...s.ltg_decisions,...s.activities.flatMap(a=>a.ltg_use)]){
  item.row_id=rows.find(r=>r.session===s.session_number&&r.project_id===item.project_id).row_id;delete item.project_id;
 }
 return p;
}
function omitLtg(proposal){const p=structuredClone(proposal);for(const s of p.sessions){delete s.ltg_decisions;for(const a of s.activities){delete a.ltg_use;delete a.ltg_activity_ids;}}return p;}
function setup(){
 const f=ltgFixture('CORE');useLtg(f);
 const matrix=ltgSessionEligibility(f),rows=ltgDecisionAuthority(matrix).provider_rows;
 const ctx={sources:{constraints:f.constraints,curriculum:f.curriculum,methodology:f.methodology},blueprint:f.blueprint,approval:f.approval,previous_proposal:f.proposal,compile_error:nonLtg};
 return {f,matrix,rows,ctx};
}
async function call(ctx,proposal){
 let sent;const driver=createSessionGraphDrivers({endpoint:'https://example.invalid/plan-project-blueprint-v1-shadow',token:'x'.repeat(64),durableEvidence:false,fetchImpl:async(_u,r)=>{sent=JSON.parse(r.body);return new Response(JSON.stringify({output:{status:'PROPOSAL',reason:'Synthetic',proposal}}));}});
 const result=await driver.sessionRepair(ctx);return {result,sent};
}
test('non-LTG repair has no LTG transport authority; motor preserves valid uses and decisions',async()=>{
 const {f,ctx}=setup(),before=structuredClone(f),raw=omitLtg(f.proposal);
 const {result,sent}=await call(ctx,raw);
 assert.deepEqual(f,before);assert.deepEqual(result.proposal,f.proposal);
 assert.equal(sent.prompt.ltg_repair_authority.mode,'LOCKED');assert.deepEqual(sent.prompt.ltg_decision_authority.provider_rows,[]);
 const schema=sent.response_schema.properties.proposal.properties.sessions.items;
 assert.ok(!schema.required.includes('ltg_decisions'));assert.ok(!('ltg_decisions' in schema.properties));
 for(const key of ['ltg_use','ltg_activity_ids'])assert.ok(!(key in schema.properties.activities.items.properties));
 assert.equal(schema.additionalProperties,false);assert.equal(schema.properties.activities.items.additionalProperties,false);
 assert.deepEqual(ltgExecutionErrors(result.proposal.sessions,f),[]);
});
for(const field of ['ltg_decisions','ltg_use','ltg_activity_ids'])test(`non-LTG attempted write ${field} rejects explicitly`,async()=>{
 const {f,ctx,rows}=setup(),raw=omitLtg(f.proposal);
 if(field==='ltg_decisions')raw.sessions[0][field]=[{row_id:rows[0].row_id,decision:'USE',reason:'Attempt'}];
 else raw.sessions[0].activities[0][field]=field==='ltg_use'?[{row_id:'unknown'}]:['foreign'];
 await assert.rejects(call(ctx,raw),/SESSION_PROVIDER_LTG_AUTHORITY:.*LTG_FIELDS_LOCKED.*NOT_PROVIDER_OWNED/);
});
test('non-LTG removal/rename of LTG owner is not silently accepted',()=>{
 const {f}=setup(),raw=omitLtg(f.proposal);raw.sessions[0].activities[0].activity_key='renamed';
 assert.throws(()=>preserveLockedLtgRepair(raw,f.proposal),/LOCKED_LTG_ACTIVITY_REMOVED_OR_RENAMED/);
});
test('non-LTG changes cannot cause normalization to discard a locked use',async()=>{
 const {f,ctx}=setup(),raw=omitLtg(f.proposal);raw.sessions[0].activities[0].grade_participation=raw.sessions[0].activities[0].grade_participation.filter(g=>g.grade!==1);
 await assert.rejects(call(ctx,raw),/SESSION_PROVIDER_LTG_AUTHORITY:.*LOCKED_LTG_CHANGED_AFTER_NORMALIZATION/);
});
test('explicit LTG repair keeps same-session row transport and accepts authorized rows',async()=>{
 const {f,ctx,rows}=setup();ctx.compile_error={code:'SESSION_GRAPH_AUTHORING_INVALID',message:'SESSION_GRAPH_AUTHORING_CONTRACT: SGD-013 LTG decision/use mismatch session=2 project_id=ltg1 decision=USE concrete_use=absent'};
 const {result,sent}=await call(ctx,transport(f.proposal,rows));assert.equal(sent.prompt.ltg_repair_authority.mode,'SESSION_ROWS');assert.deepEqual(result.proposal,f.proposal);
});
for(const kind of ['unknown','other-session','direct-project'])test(`LTG row authority stays fail-closed: ${kind}`,async()=>{
 const {f,ctx,rows}=setup();ctx.compile_error={code:'SESSION_GRAPH_AUTHORING_INVALID',message:'SESSION_GRAPH_AUTHORING_CONTRACT: SGD-013 LTG decision/use mismatch session=2 project_id=ltg1 decision=USE concrete_use=absent'};
 const raw=transport(f.proposal,rows),use=raw.sessions[1].activities[0].ltg_use[0];
 if(kind==='unknown')use.row_id='unknown';if(kind==='other-session')use.row_id=rows[0].row_id;if(kind==='direct-project')use.project_id='ltg1';
 await assert.rejects(call(ctx,raw),kind==='direct-project'?/PROJECT_ID_NOT_PROVIDER_OWNED/:/UNKNOWN_OR_NONLOCAL_ROW_ID NOT_PROVIDER_OWNED/);
});
test('session 5 rejects unknown and nonlocal rows even for a non-LTG trigger',async()=>{
 const {f,ctx}=setup(),s=f.proposal.sessions[0],b=f.blueprint.session_progression[0];
 f.proposal.sessions=[1,2,3,4,5].map(session_number=>({...structuredClone(s),session_number}));f.blueprint.session_progression=[1,2,3,4,5].map(session_number=>({...structuredClone(b),session_number}));
 const matrix=ltgSessionEligibility(f),rows=ltgDecisionAuthority(matrix).provider_rows;
 assert.equal(rows.filter(r=>r.session===5).length,1);
 for(const row of ['unknown',rows[0].row_id]){
  const raw=transport(f.proposal,rows);raw.sessions[4].activities[0].ltg_use[0].row_id=row;
  assert.throws(()=>assembleLtgDecisions(raw,matrix),/session=5 UNKNOWN_OR_NONLOCAL_ROW_ID NOT_PROVIDER_OWNED/);
  await assert.rejects(call(ctx,raw),/SESSION_PROVIDER_LTG_AUTHORITY:.*LTG_FIELDS_LOCKED/);
 }
});
test('eligible=false stays motor-owned; nonselected projects never enter provider rows',()=>{
 const {f}=setup();f.blueprint.session_progression[1].pda_focus=['p3'];
 f.curriculum.ltg.push({...structuredClone(f.curriculum.ltg[0]),project_id:'not-selected'});
 const matrix=ltgSessionEligibility(f),authority=ltgDecisionAuthority(matrix);
 assert.equal(authority.provider_rows.some(r=>r.session===2||r.project_id==='not-selected'),false);
 assert.equal(authority.fixed_decisions.find(r=>r.session===2).decision,'NOT_RECOMMENDED');
 const raw=transport(f.proposal,ltgDecisionAuthority(ltgSessionEligibility(setup().f)).provider_rows);raw.sessions[1].ltg_decisions=[];for(const a of raw.sessions[1].activities){a.ltg_use=[];a.ltg_activity_ids=[];}
 const previous=assembleLtgDecisions(raw,matrix),restored=preserveLockedLtgRepair(omitLtg(previous),previous);
 assert.deepEqual(restored,previous);assert.equal(restored.sessions[1].ltg_decisions[0].decision,'NOT_RECOMMENDED');
});
test('CORE and SGD-013 remain authoritative; no auto-pass or auto-flip',()=>{
 const {f,matrix}=setup();assert.equal(lockedLtgRepair([{rule_id:'RECONOCIMIENTO_LOCAL_ACTION'}],matrix),true);assert.equal(lockedLtgRepair([{rule_id:'SGD-013'}],matrix),false);
 for(const s of f.proposal.sessions){s.ltg_decisions[0].decision='NOT_RECOMMENDED';for(const a of s.activities){a.ltg_use=[];a.ltg_activity_ids=[];}}
 const out=preserveLockedLtgRepair(omitLtg(f.proposal),f.proposal);assert.ok(ltgExecutionErrors(out.sessions,f).includes('SGD-013 CORE disappeared'));
 assertLockedLtgPreserved(normalizeSessionGraphAuthoring(out,f),f.proposal);
});
