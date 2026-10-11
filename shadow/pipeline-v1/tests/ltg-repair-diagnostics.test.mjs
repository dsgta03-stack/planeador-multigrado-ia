import test from 'node:test';
import assert from 'node:assert/strict';
import {ltgFixture,useLtg} from '../../session-graph-v1/tests/pedagogical-fixture.mjs';
import {normalizeSessionGraphAuthoring,ltgExecutionErrors} from '../../session-graph-v1/authoring.mjs';
import {repairTargetsFromContext,createSessionGraphDrivers} from '../session-provider.mjs';
import {ltgRepairDiagnostics} from '../ltg-repair-diagnostics.mjs';
const context=(f,decision='USE',concrete='absent')=>({sources:{constraints:f.constraints,curriculum:f.curriculum,methodology:f.methodology},blueprint:f.blueprint,approval:f.approval,previous_proposal:f.proposal,compile_error:{code:'SESSION_GRAPH_AUTHORING_INVALID',message:`SESSION_GRAPH_AUTHORING_CONTRACT: SGD-013 LTG decision/use mismatch session=2 project_id=ltg1 decision=${decision} concrete_use=${concrete}`}});
test('structured target resolves authority, NOT_RECOMMENDED mismatch and invalid prior use',()=>{
 const f=ltgFixture('CORE');useLtg(f);f.proposal.sessions[1].activities[0].ltg_use=[];
 const t=repairTargetsFromContext(context(f))[0];
 for(const [key,value] of Object.entries({session:2,project_id:'ltg1',decision:'USE',concrete_use:'absent',role:'CORE',compatible_grade:1,mismatch_kind:'USE_WITHOUT_CONCRETE_USE',authorized_use_possible:true}))assert.equal(t[key],value);
 assert.deepEqual(t.selected_activity_ids,['ltg-a1']);assert.deepEqual(t.verified_activity_ids,['ltg-a1']);assert.deepEqual(t.compatible_pda_ids,['p1']);
 assert.equal(repairTargetsFromContext(context(f,'NOT_RECOMMENDED','present'))[0].mismatch_kind,'CONCRETE_USE_WITH_NOT_RECOMMENDED');
 useLtg(f);f.proposal.sessions[1].activities[0].ltg_use[0].activity_id='foreign';
 assert.equal(repairTargetsFromContext(context(f))[0].mismatch_kind,'USE_WITH_INVALID_CONCRETE_USE');
 f.blueprint.session_progression[1].pda_focus=[];assert.equal(repairTargetsFromContext(context(f))[0].authorized_use_possible,false);
});
for(const [mode,reason] of [['absent',null],['valid',null],['activity','ACTIVITY_NOT_AUTHORIZED'],['null','NULL_ACTIVITY_NOT_ALLOWED'],['grade','GRADE_NOT_PARTICIPATING'],['focus','PDA_LINK_NOT_VERIFIED'],['link','PDA_LINK_NOT_VERIFIED'],['foreign-project','PROJECT_NOT_SELECTED']])test('LTG normalization metadata '+mode,()=>{
 const f=ltgFixture('CORE');useLtg(f);const ctx=context(f),targets=repairTargetsFromContext(ctx),a=f.proposal.sessions[1].activities[0];
 if(mode==='absent')a.ltg_use=[];
 if(mode==='activity')a.ltg_use[0].activity_id='other-project-activity';
 if(mode==='null')a.ltg_use[0].activity_id=null;
 if(mode==='grade')a.grade_participation=a.grade_participation.filter(g=>g.grade!==1);
 if(mode==='focus')f.blueprint.session_progression[1].pda_focus=[];
 if(mode==='link')f.curriculum.ltg[0].verified_pda_links=[];
 if(mode==='foreign-project'){a.ltg_use[0].project_id='foreign';targets[0].project_id='foreign';}
 const before=structuredClone(f),n=normalizeSessionGraphAuthoring(f.proposal,f),d=ltgRepairDiagnostics(f.proposal,n,f,targets)[0];
 assert.equal(d.ltg_use_before_normalization,mode==='absent'?0:1);assert.equal(d.ltg_use_after_normalization,mode==='valid'?1:0);
 assert.deepEqual(d.filtered_reasons,reason?[reason]:[]);assert.deepEqual(f,before);
 assert.ok(!JSON.stringify(d).includes('student_action'));assert.ok(!JSON.stringify(d).includes('purpose'));
 if(mode==='valid')assert.deepEqual(ltgExecutionErrors(n.sessions,f),[]);
 else if(mode!=='foreign-project')assert.ok(ltgExecutionErrors(n.sessions,f).some(e=>e.includes('decision/use mismatch')));
});
test('repair adapter sends target and retains no-created diagnostics on local rejection',async()=>{
 const f=ltgFixture('CORE');useLtg(f);f.proposal.sessions[1].activities[0].ltg_use=[];let sent;
 const driver=createSessionGraphDrivers({endpoint:'https://example.invalid/plan-project-blueprint-v1-shadow',token:'x'.repeat(64),durableEvidence:false,fetchImpl:async(url,request)=>{sent=JSON.parse(request.body);return new Response(JSON.stringify({output:{status:'PROPOSAL',reason:'synthetic',proposal:f.proposal}}));}});
 await assert.rejects(driver.sessionRepair(context(f)),e=>{assert.match(e.message,/SGD-013/);assert.equal(e.ltg_repair_diagnostics[0].normalization_outcome,'NOT_CREATED');return true;});
 assert.equal(sent.prompt.repair_targets[0].role,'CORE');assert.equal(sent.prompt.repair_targets[0].session,2);
});
