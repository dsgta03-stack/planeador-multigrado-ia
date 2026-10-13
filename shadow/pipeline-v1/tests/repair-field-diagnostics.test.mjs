import test from 'node:test';
import assert from 'node:assert/strict';
import {executableSource} from '../../session-graph-v1/tests/pedagogical-fixture.mjs';
import {normalizeSessionGraphAuthoring} from '../../session-graph-v1/authoring.mjs';
import {repairTargetsFromContext,repairFieldDiagnostics,validateRepairTargets,createSessionGraphDrivers} from '../session-provider.mjs';

function fixture(){
 const f=executableSource(),a=f.proposal.sessions[0].activities[0],g=a.grade_participation.find(g=>g.grade===1);
 f.curriculum.pdas.find(p=>p.pda_id==='p1').pda_official='Propone acuerdos para cuidar los materiales del aula.';
 g.pda_mobilization=[{pda_id:'p1',status:'WORKED'}];g.student_action='Presenta los acuerdos del aula.';a.execution.grouping='Juntos';
 const compile_error={code:'SESSION_GRAPH_AUTHORING_INVALID',message:`SESSION_GRAPH_AUTHORING_CONTRACT: $.sessions[0].${a.activity_key}: SGD-017 teacher executability missing execution.grouping; $.sessions[1].${a.activity_key}.grade_1: WORKED p1 missing PROPONE_LOCAL_ACTION`};
 const ctx={sources:{constraints:f.constraints,curriculum:f.curriculum,methodology:f.methodology},blueprint:f.blueprint,approval:f.approval,previous_proposal:f.proposal,compile_error};
 return {f,a,g,ctx,targets:repairTargetsFromContext(ctx)};
}
test('grouping and PROPONE metadata identify unchanged defects without publishing text',()=>{
 const {f,targets}=fixture(),before=structuredClone(f),n=normalizeSessionGraphAuthoring(f.proposal,f);
 const d=repairFieldDiagnostics(f.proposal,f.proposal,n,f,targets);
 assert.equal(d[0].field,'execution.grouping');assert.equal(d[0].session,1);assert.equal(d[0].rejection_reason,'execution.grouping');
 assert.deepEqual(d[0].before,d[0].provider_after);assert.deepEqual(d[0].provider_after,d[0].after);
 assert.equal(d[1].rejection_reason,'PROPONE_LOCAL_ACTION');assert.equal(d[1].grade,1);assert.equal(d[1].pda_id,'p1');
 assert.ok(!JSON.stringify(d).includes('Presenta los acuerdos'));assert.ok(!JSON.stringify(d).includes('Juntos'));
 assert.throws(()=>validateRepairTargets(n,f,targets),/PROPONE_LOCAL_ACTION/);assert.deepEqual(f,before);
});
test('own-row authentic proposal and concrete grouping survive normalization and satisfy targets',()=>{
 const {f,a,g,targets}=fixture(),previous=structuredClone(f.proposal);
 a.execution.grouping='En parejas';g.student_action='Proponen un acuerdo: cada pareja devuelve los materiales al estante al terminar.';
 const n=normalizeSessionGraphAuthoring(f.proposal,f),d=repairFieldDiagnostics(previous,f.proposal,n,f,targets);
 assert.equal(validateRepairTargets(n,f,targets),true);
 for(const row of d){assert.equal(row.rejection_reason,null);assert.deepEqual(row.provider_after,row.after);assert.notDeepEqual(row.before,row.after);}
});
test('provider rejection exposes before/raw/normalized metadata for both targets',async()=>{
 const {f,ctx}=fixture();let sent;
 const driver=createSessionGraphDrivers({endpoint:'https://example.invalid/plan-project-blueprint-v1-shadow',token:'x'.repeat(64),durableEvidence:false,fetchImpl:async(_u,r)=>{sent=JSON.parse(r.body);return new Response(JSON.stringify({output:{status:'PROPOSAL',proposal:f.proposal}}));}});
 await assert.rejects(driver.sessionRepair(ctx),e=>{
  assert.equal(e.repair_local_validation.rejected_at,'validateRepairTargets');assert.equal(e.repair_field_diagnostics.length,2);
  assert.equal(e.repair_field_diagnostics[1].rejection_reason,'PROPONE_LOCAL_ACTION');return true;
 });
 assert.equal(sent.prompt.repair_targets[0].field,'execution.grouping');
 assert.deepEqual(sent.prompt.repair_targets[1].missing_requirements,['PROPONE_LOCAL_ACTION']);
});
