import test from 'node:test';
import assert from 'node:assert/strict';
import {ltgFixture,useLtg} from '../../session-graph-v1/tests/pedagogical-fixture.mjs';
import {providerAuthoringShapeSchema,normalizeSessionGraphAuthoring,ltgExecutionErrors} from '../../session-graph-v1/authoring.mjs';
import {ltgSessionEligibility,ltgDecisionAuthority,assembleLtgDecisions,providerLtgRowSchema} from '../ltg-session-eligibility.mjs';
import {createSessionGraphDrivers} from '../session-provider.mjs';

function fixture(){
 const f=ltgFixture('CORE');useLtg(f);
 const s=f.proposal.sessions[0],b=f.blueprint.session_progression[0];
 f.proposal.sessions=[1,2,3,4,5].map(session_number=>({...structuredClone(s),session_number}));
 f.blueprint.session_progression=[1,2,3,4,5].map(session_number=>({...structuredClone(b),session_number,pda_focus:[1,4].includes(session_number)?['p1']:['p3']}));
 const matrix=ltgSessionEligibility(f),authority=ltgDecisionAuthority(matrix),raw=structuredClone(f.proposal);
 for(const session of raw.sessions){
  const row=authority.provider_rows.find(r=>r.session===session.session_number);
  if(row){session.ltg_decisions[0].row_id=row.row_id;delete session.ltg_decisions[0].project_id;session.ltg_decisions[0].decision=session.session_number===4?'USE':'NOT_RECOMMENDED';}
  else session.ltg_decisions=[];
  for(const a of session.activities){
   if(session.session_number!==4){a.ltg_use=[];a.ltg_activity_ids=[];}
   else for(const use of a.ltg_use){use.row_id=row.row_id;delete use.project_id;}
  }
 }
 return {f,matrix,authority,raw};
}
test('opaque rows are deterministic, selected and eligible only; engine resolves valid USE and local NOT_RECOMMENDED',()=>{
 const {f,matrix,authority,raw}=fixture(),before=structuredClone(raw);
 assert.deepEqual(authority,ltgDecisionAuthority(matrix));assert.deepEqual(authority.provider_rows.map(r=>r.session),[1,4]);
 assert.ok(authority.provider_rows.every(r=>r.project_id==='ltg1'&&r.role==='CORE'&&!r.row_id.includes('ltg1')));
 const out=assembleLtgDecisions(raw,matrix);assert.deepEqual(raw,before);
 assert.deepEqual(out.sessions.map(s=>s.ltg_decisions[0].decision),['NOT_RECOMMENDED','NOT_RECOMMENDED','NOT_RECOMMENDED','USE','NOT_RECOMMENDED']);
 assert.equal(out.sessions[3].activities[0].ltg_use[0].project_id,'ltg1');assert.ok(!JSON.stringify(out).includes('row_id'));
 assert.deepEqual(ltgExecutionErrors(normalizeSessionGraphAuthoring(out,f).sessions,f),[]);
 out.sessions[3].activities[0].ltg_use=[];out.sessions[3].activities[0].ltg_activity_ids=[];out.sessions[3].ltg_decisions[0].decision='NOT_RECOMMENDED';
 assert.ok(ltgExecutionErrors(out.sessions,f).includes('SGD-013 CORE disappeared'));
});
for(const mode of ['unknown','other-session','project-in-decision','project-in-use','foreign-project','fixed-row'])test('reject before normalization: '+mode,()=>{
 const {matrix,authority,raw}=fixture();
 if(mode==='unknown')raw.sessions[3].ltg_decisions[0].row_id='does-not-exist';
 if(mode==='other-session')raw.sessions[3].activities[0].ltg_use[0].row_id=authority.provider_rows[0].row_id;
 if(mode==='project-in-decision')raw.sessions[3].ltg_decisions[0].project_id='ltg1';
 if(mode==='project-in-use')raw.sessions[3].activities[0].ltg_use[0].project_id='ltg1';
 if(mode==='foreign-project')raw.sessions[3].ltg_decisions[0].project_id='not-selected';
 if(mode==='fixed-row')raw.sessions[1].ltg_decisions=[{row_id:authority.provider_rows[0].row_id,decision:'USE',reason:'Attempt'}];
 assert.throws(()=>assembleLtgDecisions(raw,matrix),/SESSION_PROVIDER_LTG_AUTHORITY/);
});
test('transport schema removes project_id from both decisions and uses without changing persisted schema',()=>{
 const {f}=fixture(),original=providerAuthoringShapeSchema(f),before=structuredClone(original),sent=providerLtgRowSchema(original),session=sent.properties.sessions.items;
 for(const item of [session.properties.ltg_decisions.items,session.properties.activities.items.properties.ltg_use.items]){
  assert.ok(!('project_id' in item.properties));assert.ok(!item.required.includes('project_id'));assert.ok(item.required.includes('row_id'));assert.equal(item.additionalProperties,false);
 }
 assert.deepEqual(original,before);
});
test('GENERATE and REPAIR actually send row-only schemas and resolve provider rows',async()=>{
 const {f,matrix,raw}=fixture(),ctx={sources:{constraints:f.constraints,curriculum:f.curriculum,methodology:f.methodology},blueprint:f.blueprint,approval:f.approval,previous_proposal:f.proposal};let sent,output=raw;
 const drivers=createSessionGraphDrivers({endpoint:'https://example.invalid/plan-project-blueprint-v1-shadow',token:'x'.repeat(64),durableEvidence:false,fetchImpl:async(_u,r)=>{sent=JSON.parse(r.body);return new Response(JSON.stringify({output}));}});
 const result=await drivers.sessionAuthor(ctx);assert.equal(result.proposal.sessions[3].ltg_decisions[0].project_id,'ltg1');
 assert.deepEqual(sent.prompt.ltg_decision_authority.provider_rows,ltgDecisionAuthority(matrix).provider_rows);
 assert.ok(!('project_id' in sent.response_schema.properties.sessions.items.properties.ltg_decisions.items.properties));
 // Boundary rejection precedes normalization and any unrelated full-graph checks.
 ctx.compile_error={code:'SESSION_GRAPH_AUTHORING_INVALID',message:'SESSION_GRAPH_AUTHORING_CONTRACT: SGD-013 LTG decision/use mismatch session=4 project_id=ltg1 decision=USE concrete_use=absent'};
 output={status:'PROPOSAL',proposal:structuredClone(raw)};output.proposal.sessions[3].ltg_decisions[0].row_id='unknown';
 await assert.rejects(drivers.sessionRepair(ctx),/UNKNOWN_OR_NONLOCAL_ROW_ID/);
 assert.ok(!('project_id' in sent.response_schema.properties.proposal.properties.sessions.items.properties.activities.items.properties.ltg_use.items.properties));
});
