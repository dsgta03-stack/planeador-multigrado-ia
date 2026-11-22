import test from 'node:test';
import assert from 'node:assert/strict';
import {executableSource,ltgFixture,useLtg} from './pedagogical-fixture.mjs';
import {validateSessionGraphAuthoring,normalizeSessionGraphAuthoring,ltgExecutionErrors,complementaryConsumerMissing,teacherExecutabilityMissing} from '../authoring.mjs';
import {repairTargetsFromContext,createSessionGraphDrivers} from '../../pipeline-v1/session-provider.mjs';
const activity=f=>f.proposal.sessions[0].activities[0];
const oversized=()=>{
 const f=executableSource();
 for(let i=0;i<21;i++)f.blueprint.final_outcome.functional_requirements.push({requirement_id:`req_${i}`,stage_ids:['planning']});
 activity(f).functional_requirement_ids=Array.from({length:21},(_,i)=>`req_${i}`);
 return f;
};
for(const count of [20,21])test(`${count} functional IDs retain strict cardinality`,()=>{
 const f=oversized();activity(f).functional_requirement_ids.length=count;
 if(count===20)assert.equal(validateSessionGraphAuthoring(f.proposal,f),true);
 else assert.throws(()=>validateSessionGraphAuthoring(f.proposal,f),/functional_requirement_ids: maxItems/);
});
test('duplicate IDs exceeding 20 reject; normalization never truncates arrays or activities',()=>{
 const f=oversized();activity(f).functional_requirement_ids=Array(21).fill('req_0');
 const before=structuredClone(f),n=normalizeSessionGraphAuthoring(f.proposal,f);
 assert.equal(n.sessions[0].activities[0].functional_requirement_ids.length,21);
 assert.equal(n.sessions[0].activities.length,f.proposal.sessions[0].activities.length);
 assert.throws(()=>validateSessionGraphAuthoring(n,f),/maxItems/);assert.deepEqual(f,before);
});
test('maxItems target has scope, maximum and safe observed count; compound targets stay independent',()=>{
 const f=oversized();let error;try{validateSessionGraphAuthoring(f.proposal,f)}catch(e){error=e;}
 const ctx={compile_error:{code:error.code,message:error.message+'; SGD-013 LTG decision/use mismatch session=1 project_id=p decision=USE concrete_use=absent'},previous_proposal:f.proposal};
 const targets=repairTargetsFromContext(ctx),t=targets[0];
 assert.equal(t.maximum,20);assert.equal(t.observed_count,21);assert.equal(t.field,'functional_requirement_ids');
 assert.equal(t.scope,'$.sessions[0].activities[0].functional_requirement_ids');
 assert.match(t.required,/pertinencia semántica/);assert.match(t.required,/no trunques mecánicamente/);
 assert.ok(targets.some(x=>x.rule_id==='SGD-013'));
 delete ctx.previous_proposal;assert.ok(!('observed_count' in repairTargetsFromContext(ctx)[0]));
});
test('valid USE remains valid; unnormalized USE without use still rejects',()=>{
 const f=ltgFixture('SUPPORT');useLtg(f);
 assert.deepEqual(ltgExecutionErrors(f.proposal.sessions,f),[]);
 activity(f).ltg_use=[];activity(f).ltg_activity_ids=[];
 assert.ok(ltgExecutionErrors(f.proposal.sessions,f).some(x=>x.includes('decision/use mismatch')));
});
test('invalid SUPPORT use removed: decision records absence without inventing use, idempotently',()=>{
 const f=ltgFixture('SUPPORT');useLtg(f);activity(f).ltg_use[0].activity_id='invalid';
 const before=structuredClone(f),n=normalizeSessionGraphAuthoring(f.proposal,f);
 assert.deepEqual(n.sessions[0].activities[0].ltg_use,[]);
 assert.equal(n.sessions[0].ltg_decisions[0].decision,'NOT_RECOMMENDED');
 assert.deepEqual(ltgExecutionErrors(n.sessions,f),[]);
 assert.deepEqual(normalizeSessionGraphAuthoring(n,f),n);assert.deepEqual(f,before);
});
test('SUPPORT availability never creates USE; CORE and OPTIONAL remain fail-closed',()=>{
 const support=ltgFixture('SUPPORT'),n=normalizeSessionGraphAuthoring(support.proposal,support);
 assert.ok(n.sessions.every(s=>s.activities.every(a=>!a.ltg_use.length)));
 for(const role of ['CORE','OPTIONAL']){
  const f=ltgFixture(role);useLtg(f);for(const s of f.proposal.sessions)for(const a of s.activities)a.ltg_use=[];
  const normalized=normalizeSessionGraphAuthoring(f.proposal,f);
  assert.ok(ltgExecutionErrors(normalized.sessions,f).some(x=>x.includes('decision/use mismatch')));
  if(role==='CORE')assert.ok(ltgExecutionErrors(normalized.sessions,f).includes('SGD-013 CORE disappeared'));
 }
});
for(const dependency of ['later','none','earlier','other-session'])test(`COMPLEMENTARY dependency ${dependency}`,()=>{
 const f=executableSource(),s=f.proposal.sessions[0],key=s.activities[0].activity_key;
 if(dependency!=='later')s.activities[1].input_refs=[];
 if(dependency==='earlier'){s.activities.reverse();s.activities[0].input_refs=[key];}
 if(dependency==='other-session')f.proposal.sessions[1].activities[0].input_refs=[key];
 const n=normalizeSessionGraphAuthoring(f.proposal,f),index=n.sessions[0].activities.findIndex(a=>a.activity_key===key);
 assert.equal(complementaryConsumerMissing(n.sessions[0].activities,index),dependency!=='later');
 if(dependency!=='later')assert.throws(()=>validateSessionGraphAuthoring(n,f),/SGD-010/);
});
test('invalid input_ref removed: orphan is checked again against final normalized proposal',()=>{
 const f=executableSource();f.proposal.sessions[0].activities[1].input_refs=['foreign_key'];
 const n=normalizeSessionGraphAuthoring(f.proposal,f);
 assert.deepEqual(n.sessions[0].activities[1].input_refs,[]);
 assert.throws(()=>validateSessionGraphAuthoring(n,f),/SGD-010/);
});
for(const grouping of ['En parejas','En equipos','Juntos'])test(`grouping ${grouping}`,()=>{
 const f=executableSource();activity(f).execution.grouping=grouping;
 assert.equal(teacherExecutabilityMissing(activity(f)).includes('execution.grouping'),grouping==='Juntos');
 if(grouping==='Juntos')assert.throws(()=>validateSessionGraphAuthoring(f.proposal,f),/SGD-017/);
});
test('GENERATE/REPAIR share audit; complete repair resolves maxItems, orphan and stale SUPPORT without LTG fabrication',async()=>{
 const f=ltgFixture('SUPPORT');useLtg(f);
 activity(f).functional_requirement_ids=Array(21).fill('pieces');
 f.proposal.sessions[0].activities[1].input_refs=[];activity(f).ltg_use[0].activity_id='invalid';
 const good=structuredClone(f.proposal);good.sessions[0].activities[0].functional_requirement_ids=['pieces'];
 good.sessions[0].activities[1].input_refs=[activity(f).activity_key];
 const ctx={sources:{constraints:f.constraints,curriculum:f.curriculum,methodology:f.methodology},blueprint:f.blueprint,approval:f.approval},sent=[];
 const drivers=createSessionGraphDrivers({endpoint:'https://example.invalid/plan-project-blueprint-v1-shadow',token:'x'.repeat(64),durableEvidence:false,fetchImpl:async(url,request)=>{
  const b=JSON.parse(request.body);sent.push(b);
  const proposal=structuredClone(b.task==='GENERATE'?f.proposal:good);
  for(const session of proposal.sessions)for(const item of [...session.ltg_decisions,...session.activities.flatMap(a=>a.ltg_use||[])]){
   item.row_id=b.prompt.ltg_decision_authority.provider_rows.find(r=>r.session===session.session_number&&r.project_id===item.project_id).row_id;
   delete item.project_id;
  }
  return new Response(JSON.stringify({output:b.task==='GENERATE'?proposal:{status:'PROPOSAL',reason:'Synthetic repair',proposal},finish_reason:'STOP'}));
 }});
 const generated=await drivers.sessionAuthor(ctx);let e;try{validateSessionGraphAuthoring(generated.proposal,f)}catch(error){e=error;}
 const repaired=await drivers.sessionRepair({...ctx,previous_proposal:generated.proposal,compile_error:{code:e.code,message:e.message}});
 assert.equal(validateSessionGraphAuthoring(repaired.proposal,f),true);
 assert.deepEqual(repaired.proposal.sessions[0].activities[0].ltg_use,[]);
 assert.equal(repaired.proposal.sessions[0].ltg_decisions[0].decision,'NOT_RECOMMENDED');
 for(const b of sent){const audit=b.prompt.preflight_checklist.final_authoring_audit;assert.match(audit,/máximo 20/);assert.match(audit,/TODAS/);assert.match(audit,/grouping/);assert.match(audit,/MISMA sesión/);}
 assert.ok(sent[1].prompt.repair_targets.some(t=>t.maximum===20&&t.observed_count===21));
});
