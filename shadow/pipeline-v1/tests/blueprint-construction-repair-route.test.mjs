import test from 'node:test';
import assert from 'node:assert/strict';
import {sources,candidate} from '../../project-blueprint-v1/fixtures/build.mjs';
import {authoringSchema} from '../../project-blueprint-v1/authoring-proposal.mjs';
import {constructionPlan} from '../../project-blueprint-v1/construction.mjs';
import {generateShadow} from '../../project-blueprint-v1/shadow.mjs';

const src=sources(),plan=constructionPlan(src);
const ids={frame:'planning',investigate:'production',apply:'intervention',questions:'artifact_planning',shared_explanations:'artifact_production',completion:'artifact_intervention'};
const remap=x=>typeof x==='string'?(ids[x]||x):Array.isArray(x)?x.map(remap):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,remap(v)])):x;
const baseline=remap(candidate(src));
baseline.construction_evidence=plan.coverage_matrix.map(r=>{const s=baseline.project_stages.find(s=>s.stage_id===r.stage_id);return {operation:r.operation,stage_id:r.stage_id,student_operation_quote:s.student_operation,evidence_quote:s.expected_output}});
const schema=authoringSchema(src,plan);
const project=(x,s)=>s.type==='object'?Object.fromEntries(Object.entries(s.properties).filter(([k])=>k in x).map(([k,v])=>[k,project(x[k],v)])):s.type==='array'?x.map(v=>project(v,s.items)):structuredClone(x);
function validProposal(){const p=project(baseline,schema);p.coverage=baseline.construction_evidence.map(r=>({operation:r.operation,stage_id:r.stage_id,action_quote:r.student_operation_quote,evidence_ref:{field:'expected_output',index:null}}));return p;}
function invalidBpd019(){const p=validProposal(),row=p.coverage.find(x=>x.operation==='INTEGRACION')||p.coverage[0];row.action_quote='CITA NO LITERAL';return p;}

test('ProjectBlueprint construction rejection spends its single repair before giving up',async()=>{
 const bad=invalidBpd019(),good=validProposal(),tasks=[];
 const result=await generateShadow(src,{constructionPlan:plan,authoringCompact:true},async(task,input,options)=>{
  tasks.push(task);
  if(task==='GENERATE')return {output:bad,telemetry:{task}};
  if(task==='REPAIR'){
   assert.equal(options.repair?.triggering_rules?.[0]?.rule_id,'BPD-019');
   assert.deepEqual(options.repair?.previous_authoring_proposal,bad);
   return {output:good,telemetry:{task}};
  }
  const e=Error('stop after repaired construction');e.code='PROVIDER_UNAVAILABLE';throw e;
 });
 assert.deepEqual(tasks.slice(0,3),['GENERATE','REPAIR','REVIEW']);
 assert.equal(result.construction_attempts.length,2);
 assert.equal(result.construction_attempts[0].status,'CONSTRUCTION_REJECTED');
 assert.equal(result.construction_attempts[0].rule,'BPD-019');
 assert.equal(result.construction_attempts[1].status,'CONSTRUCTED');
 assert.equal(result.repair_count,1);
 assert.equal(result.status,'PROVIDER_UNAVAILABLE');
});

test('ProjectBlueprint construction repair is bounded to one attempt',async()=>{
 const bad=invalidBpd019(),tasks=[];
 const result=await generateShadow(src,{constructionPlan:plan,authoringCompact:true},async task=>{
  tasks.push(task);
  if(task==='GENERATE'||task==='REPAIR')return {output:bad,telemetry:{task}};
  throw Error('review must not run');
 });
 assert.deepEqual(tasks,['GENERATE','REPAIR']);
 assert.equal(result.construction_attempts.length,2);
 assert(result.construction_attempts.every(x=>x.status==='CONSTRUCTION_REJECTED'&&x.rule==='BPD-019'));
 assert.equal(result.repair_count,1);
 assert.equal(result.status,'CONSTRUCTION_REJECTED');
 assert.equal(result.errors.length,1);
 assert.equal(result.errors[0].revision,2);
 assert.equal(result.errors[0].task,'CONSTRUCT');
});
