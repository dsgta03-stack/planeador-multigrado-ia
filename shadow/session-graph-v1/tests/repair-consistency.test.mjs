import test from 'node:test';
import assert from 'node:assert/strict';
import {executableSource,ltgFixture,useLtg} from './pedagogical-fixture.mjs';
import {normalizeSessionGraphAuthoring,ltgExecutionErrors,workedSemanticMissing,validateSessionGraphAuthoring} from '../authoring.mjs';
import {repairTargetsFromContext,validateRepairTargets,createSessionGraphDrivers} from '../../pipeline-v1/session-provider.mjs';
for(const [role,decision,used] of [['SUPPORT','USE',true],['SUPPORT','NOT_RECOMMENDED',true],['SUPPORT','USE',false],['SUPPORT','NOT_RECOMMENDED',false],['CORE','USE',true],['CORE','USE',false]])test(`LTG ${role} ${decision} used=${used}`,()=>{
 const f=ltgFixture(role);useLtg(f);const s=f.proposal.sessions[0];s.ltg_decisions[0].decision=decision;
 if(!used)s.activities[0].ltg_use=[];
 const before=structuredClone(f),n=normalizeSessionGraphAuthoring(f.proposal,f);
 assert.equal(n.sessions[0].ltg_decisions[0].decision,used?'USE':role==='SUPPORT'?'NOT_RECOMMENDED':'USE');
 assert.deepEqual(n.sessions[0].activities[0].ltg_use,s.activities[0].ltg_use);
 assert.deepEqual(normalizeSessionGraphAuthoring(n,f),n);assert.deepEqual(f,before);
 assert.equal(ltgExecutionErrors(n.sessions,f).some(x=>x.includes('decision/use mismatch')),role==='CORE'&&!used);
});
test('filtered invalid SUPPORT use never fabricated; OPTIONAL without use is not reinterpreted',()=>{
 for(const role of ['SUPPORT','OPTIONAL']){
  const f=ltgFixture(role);useLtg(f);f.proposal.sessions[0].activities[0].ltg_use[0].activity_id='invalid';
  const n=normalizeSessionGraphAuthoring(f.proposal,f);assert.deepEqual(n.sessions[0].activities[0].ltg_use,[]);
  assert.equal(n.sessions[0].ltg_decisions[0].decision,role==='SUPPORT'?'NOT_RECOMMENDED':'USE');
 }
});
const missing=['INDAGA_SOURCE_OR_OBSERVATION','INDAGA_PROCESS_OR_CONTRAST','INDAGA_TRACEABLE_RECORD','PROPONE_LOCAL_ACTION'];
const targets=(message,previous_proposal)=>repairTargetsFromContext({compile_error:{code:'SESSION_GRAPH_AUTHORING_INVALID',message:'SESSION_GRAPH_AUTHORING_CONTRACT: '+message},previous_proposal});
const cognitive=()=>{
 const f=executableSource();f.curriculum.pdas.find(p=>p.pda_id==='p1').pda_official='Indaga acuerdos del aula y propone acciones para cuidar materiales.';
 const a=f.proposal.sessions[0].activities[0],g=a.grade_participation.find(g=>g.grade===1);
 g.pda_mobilization=[{pda_id:'p1',status:'WORKED'}];
 const t=targets(`$.sessions[1].${a.activity_key}.grade_1: WORKED p1 missing ${missing.join(',')}`,f.proposal);
 return {f,a,g,t};
};
const fullAction='Observan acuerdos del aula; comparan dos casos; registran las diferencias en una lista; proponen un acuerdo concreto para cuidar materiales.';
test('INDAGA repair communicates official scope and diagnoses local rejection after provider response',async()=>{
 const {f,a,g}=cognitive(),official='Indaga acuerdos del aula y comparte su importancia.';
 f.curriculum.pdas.find(p=>p.pda_id==='p1').pda_official=official;
 g.student_action='Presentan acuerdos del aula.';
 const missing=workedSemanticMissing(official,g.student_action);
 assert.deepEqual(missing,['INDAGA_SOURCE_OR_OBSERVATION','INDAGA_PROCESS_OR_CONTRAST','INDAGA_TRACEABLE_RECORD']);
 const ctx={sources:{constraints:f.constraints,curriculum:f.curriculum,methodology:f.methodology},blueprint:f.blueprint,approval:f.approval,previous_proposal:f.proposal,compile_error:{code:'SESSION_GRAPH_AUTHORING_INVALID',message:'SESSION_GRAPH_AUTHORING_CONTRACT: '+`$.sessions[1].${a.activity_key}.grade_1: WORKED p1 missing ${missing.join(',')}`}};
 const t=repairTargetsFromContext(ctx)[0];
 assert.equal(t.requirement,'indaga_source_must_address_official_pda_scope');assert.equal(t.official_text,official);
 assert.deepEqual(t.missing_requirements,missing);assert.equal(t.status_required,'WORKED');
 assert.deepEqual(repairTargetsFromContext({compile_error:ctx.compile_error})[0].official_text_reference,{collection:'curriculum.pdas',pda_id:'p1',grade:1,field:'pda_official'});
 for(const action of ['Consulta fuentes sobre visitantes; compara datos; registra notas y comparte acuerdos del aula.','Consulta acuerdos del aula; compara casos; registra notas y comparte su importancia.']){
  const repaired=structuredClone(f.proposal);
  for(const s of repaired.sessions)for(const act of s.activities)for(const row of act.grade_participation)if(row.grade===1)row.student_action=action;
  const reasons=workedSemanticMissing(official,action);let sent;
  const driver=createSessionGraphDrivers({endpoint:'https://example.invalid/plan-project-blueprint-v1-shadow',token:'x'.repeat(64),durableEvidence:false,fetchImpl:async(url,request)=>{sent=JSON.parse(request.body);return new Response(JSON.stringify({output:{status:'PROPOSAL',reason:'Synthetic',proposal:repaired}}));}});
  if(reasons.length){
   assert.deepEqual(reasons,['INDAGA_OFFICIAL_SCOPE']);
   assert.throws(()=>validateSessionGraphAuthoring(repaired,f),e=>e.message.includes('INDAGA_OFFICIAL_SCOPE'));
   await assert.rejects(driver.sessionRepair(ctx),e=>{
    assert.deepEqual(e.repair_local_validation,{provider_responded:true,proposal_normalized:true,rejected_at:'validateRepairTargets'});
    assert.deepEqual(e.repair_target_diagnostics,[{target_id:'RT-1',session:1,activity_key:a.activity_key,grade:1,pda_id:'p1',reason:'INDAGA_OFFICIAL_SCOPE'}]);
    assert.ok(!JSON.stringify(e.repair_target_diagnostics).includes(action));return true;
   });
  }else {assert.equal(validateRepairTargets(repaired,f,[t]),true);const r=await driver.sessionRepair(ctx);assert.equal(r.proposal.sessions[0].activities[0].grade_participation[0].pda_mobilization[0].status,'WORKED');}
  assert.equal(sent.prompt.repair_targets[0].official_text,official);
  assert.match(sent.prompt.indaga_repair_scope,/directamente el objeto expresado en pda_official/);
 }
});
test('WORKED target retains every missing dimension and independent PDA targets',()=>{
 const {t}=cognitive();assert.deepEqual(t[0].missing_requirements,missing);assert.equal(t[0].status_required,'WORKED');assert.equal(t[0].session,1);assert.equal(t[0].grade,1);assert.equal(t[0].pda_id,'p1');
 const two=targets(`$.sessions[1].a1.grade_1: WORKED p1 missing ${missing.toReversed().join(',')}; $.sessions[1].a1.grade_3: WORKED p3 missing EXPLICA_LOCAL_ACTION`);
 assert.equal(two.length,2);assert.deepEqual(new Set(two[0].missing_requirements),new Set(missing));assert.equal(two[1].pda_id,'p3');
});
for(const mode of ['full','three','downgrade','other-grade','global','removed'])test(`WORKED repair ${mode}`,()=>{
 const {f,a,g,t}=cognitive();g.student_action=mode==='three'?'Observan acuerdos del aula; comparan casos; registran diferencias.':fullAction;
 if(mode==='downgrade')g.pda_mobilization[0].status='DEVELOPING';
 if(mode==='other-grade'){a.grade_participation.find(g=>g.grade===3).student_action=fullAction;g.student_action='Presentan el cartel.';}
 if(mode==='global'){a.common_student_action=fullAction;g.student_action='Presentan el cartel.';}
 if(mode==='removed')g.pda_mobilization=[];
 const before=structuredClone(f);
 if(mode==='full'){assert.equal(validateRepairTargets(f.proposal,f,t),true);assert.equal(g.pda_mobilization[0].status,'WORKED');}
 else assert.throws(()=>validateRepairTargets(f.proposal,f,t),/SESSION_GRAPH_REPAIR_TARGET/);
 assert.deepEqual(f,before);
});
test('grouping target resolves zero-based scope; each final activity remains blocking',()=>{
 const f=executableSource(),a=f.proposal.sessions[0].activities[0],b=f.proposal.sessions[0].activities[1];
 const ts=targets(`$.sessions[0].${a.activity_key}: SGD-017 teacher executability missing execution.grouping; $.sessions[0].${b.activity_key}: SGD-017 teacher executability missing execution.grouping`,f.proposal);
 assert.equal(ts.length,2);assert.equal(ts[0].session,1);assert.equal(ts[0].activity_key,a.activity_key);assert.equal(ts[0].field,'execution.grouping');assert.equal(ts[0].requirement,'concrete_student_organization');
 a.execution.grouping='En parejas';b.execution.grouping='Juntos';assert.throws(()=>validateRepairTargets(f.proposal,f,ts),/RT-2/);
 b.execution.grouping='En equipos';assert.equal(validateRepairTargets(f.proposal,f,ts),true);
});
test('s3/s4 grouping corrections cannot hide s5',()=>{
 const f=executableSource(),base=structuredClone(f.proposal.sessions[0]);
 f.proposal.sessions=[3,4,5].map(session_number=>({...structuredClone(base),session_number,activities:[{...structuredClone(base.activities[0]),activity_key:`s${session_number}_a2`}]}));
 const ts=targets(f.proposal.sessions.map((s,i)=>`$.sessions[${i}].s${s.session_number}_a2: SGD-017 teacher executability missing execution.grouping`).join('; '),f.proposal);
 f.proposal.sessions[2].activities[0].execution.grouping='Juntos';
 assert.deepEqual(ts.map(t=>t.session),[3,4,5]);assert.throws(()=>validateRepairTargets(f.proposal,f,ts),/RT-3/);
});
test('real repair adapter rejects downgrading target, accepts complete WORKED and grouping repair',async()=>{
 const {f,a,g,t}=cognitive();g.student_action='Presentan el cartel.';
 const messages=`$.sessions[1].${a.activity_key}.grade_1: WORKED p1 missing ${missing.join(',')}; $.sessions[0].${a.activity_key}: SGD-017 teacher executability missing execution.grouping`;
 const ctx={sources:{constraints:f.constraints,curriculum:f.curriculum,methodology:f.methodology},blueprint:f.blueprint,approval:f.approval,previous_proposal:f.proposal,compile_error:{code:'SESSION_GRAPH_AUTHORING_INVALID',message:'SESSION_GRAPH_AUTHORING_CONTRACT: '+messages}};
 for(const downgrade of [true,false]){
  const repaired=structuredClone(f.proposal),grade=repaired.sessions[0].activities[0].grade_participation.find(g=>g.grade===1);
  grade.student_action=fullAction;grade.pda_mobilization[0].status=downgrade?'DEVELOPING':'WORKED';let sent;
  for(const s of repaired.sessions)for(const activity of s.activities)for(const row of activity.grade_participation)if(row.grade===1&&row!==grade)row.student_action=fullAction;
  const driver=createSessionGraphDrivers({endpoint:'https://example.invalid/plan-project-blueprint-v1-shadow',token:'x'.repeat(64),durableEvidence:false,fetchImpl:async(url,request)=>{sent=JSON.parse(request.body);return new Response(JSON.stringify({output:{status:'PROPOSAL',reason:'Synthetic',proposal:repaired}}));}});
  if(downgrade)await assert.rejects(driver.sessionRepair(ctx),/WORKED required/);
  else {const r=await driver.sessionRepair(ctx);assert.equal(r.proposal.sessions[0].activities[0].grade_participation[0].pda_mobilization[0].status,'WORKED');}
  assert.match(sent.prompt.curricular_preservation,/no relacionada con el target/);assert.match(sent.prompt.curricular_preservation,/renombrar y reorganizar/);assert.match(sent.prompt.curricular_preservation,/sin PDA focalizado/);assert.deepEqual(sent.prompt.repair_targets[0].missing_requirements,missing);assert.ok(sent.prompt.worked_repair_audit.includes('prohibido degradar'));
 }
});
