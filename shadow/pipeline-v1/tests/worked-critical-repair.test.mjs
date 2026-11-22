import test from 'node:test';
import assert from 'node:assert/strict';
import {executableSource} from '../../session-graph-v1/tests/pedagogical-fixture.mjs';
import {workedSemanticMissing} from '../../session-graph-v1/authoring.mjs';
import {buildCriticalClaimsReviewRequest,criticalClaimsGate} from '../critical-audit.mjs';
import {repairTargetsFromContext,validateRepairTargets,createSessionGraphDrivers} from '../session-provider.mjs';
import {validateWorkedCriticalTarget} from '../worked-critical-repair.mjs';
const partial='Describe la piel y explica que permite sentir texturas.';
const addition=' Dibuja una situacion de ruido fuerte y explica a su pareja que puede afectar los oidos. Representa como se aleja del ruido para prevenir el dano y explica como cuida sus oidos.';
function setup(){
 const f=executableSource();f.curriculum.pdas.find(p=>p.pda_id==='p1').pda_official='Reconoce y describe organos y su funcion; explica y representa riesgos, prevencion y cuidado.';
 const a=f.proposal.sessions[0].activities[1];a.grade_participation[0].student_action=partial;
 const graph={sessions:[{session_number:1,stage_ids:[],activities:[{...structuredClone(a),activity_id:'compiled_activity',order:2,methodology_operations:[],functional_requirement_ids:[]}]}]};
 const input={blueprint:f.blueprint,curriculum:f.curriculum,graph},request=buildCriticalClaimsReviewRequest(input);
 const audit={input_hash:request.input_hash,worked_audits:request.claims.worked.map(c=>({activity_id:c.activity_id,grade:c.grade,pda_id:c.pda_id,status:c.pda_id==='p1'?'FAIL':'PASS',component_checks:c.pda_id==='p1'?[{component:'organs_function',satisfied:true,exact_quote:partial},{component:'risks',satisfied:false,exact_quote:''},{component:'representation',satisfied:false,exact_quote:''},{component:'prevention_care',satisfied:false,exact_quote:''}]:[{component:'all',satisfied:true,exact_quote:c.student_action}],reason:'Missing substantive components.'})),methodology_link_audits:[],functional_link_audits:[]};
 const gate=criticalClaimsGate(input,audit),ctx={blueprint:f.blueprint,sources:{curriculum:f.curriculum,constraints:f.constraints,methodology:f.methodology},graph,critical_audit:audit,previous_proposal:f.proposal,approval:f.approval,triggering_rules:gate.findings.filter(x=>x.status!=='PASS')};
 return {f,a,input,request,audit,gate,ctx};
}
test('partial WORKED passes general signals but critical conjunction fails; target retains all missing components',()=>{
 const {f,a,gate,ctx}=setup();assert.deepEqual(workedSemanticMissing(f.curriculum.pdas[0].pda_official,partial),[]);assert.equal(gate.status,'FAIL');
 const t=repairTargetsFromContext(ctx)[0];assert.equal(t.session,1);assert.equal(t.activity_key,a.activity_key);assert.equal(t.grade,1);assert.equal(t.pda_id,'p1');assert.equal(t.claim_key,'compiled_activity|1|p1');assert.equal(t.source,'SESSION_CRITICAL_GATE');assert.equal(t.rule_id,'WORKED');assert.deepEqual(t.missing_components,['risks','representation','prevention_care']);assert.deepEqual(t.satisfied_components,['organs_function']);assert.equal(t.official_pda,f.curriculum.pdas[0].pda_official);
 assert.equal(JSON.stringify(gate.findings).includes(partial),false);
});
for(const mode of ['unchanged','other-activity','other-grade','removed-pda','moved-pda','developing','empty','removed-witness'])test('critical repair rejects '+mode,()=>{
 const {f,a,ctx}=setup(),targets=repairTargetsFromContext(ctx);if(mode==='other-activity')f.proposal.sessions[1].activities[0].grade_participation[0].student_action+=addition;
 if(mode==='other-grade')a.grade_participation[1].student_action+=addition;
 if(mode==='removed-pda')a.grade_participation[0].pda_mobilization=[];
 if(mode==='moved-pda'){a.grade_participation[1].pda_mobilization.push(a.grade_participation[0].pda_mobilization[0]);a.grade_participation[0].pda_mobilization=[];}
 if(mode==='developing')a.grade_participation[0].pda_mobilization[0].status='DEVELOPING';
 if(mode==='empty')a.grade_participation[0].student_action='';
 if(mode==='removed-witness')a.grade_participation[0].student_action=addition;
 assert.throws(()=>validateRepairTargets(f.proposal,f,targets),/SESSION_GRAPH_REPAIR_TARGET/);
 const d=validateWorkedCriticalTarget(f.proposal,f,targets[0]);assert.equal(d.repair_applied_to_expected_claim,false);assert.equal(d.missing_components_count,3);assert.equal(JSON.stringify(d).includes('official_pda'),false);assert.equal(JSON.stringify(d).includes('student_action'),false);
});
test('owned complete action preserves witnesses and advances to literal critical audit',()=>{
 const {f,a,ctx}=setup(),targets=repairTargetsFromContext(ctx);a.grade_participation[0].student_action+=addition;assert.equal(validateRepairTargets(f.proposal,f,targets),true);
 const input={blueprint:f.blueprint,curriculum:f.curriculum,graph:{sessions:[{session_number:1,stage_ids:[],activities:[{...a,activity_id:'compiled_activity',methodology_operations:[],functional_requirement_ids:[]}]}]}};
 const request=buildCriticalClaimsReviewRequest(input),audit=structuredClone(ctx.critical_audit);audit.input_hash=request.input_hash;const row=audit.worked_audits[0];row.status='PASS';row.component_checks=row.component_checks.map(c=>({...c,satisfied:true,exact_quote:c.component==='organs_function'?partial:addition.trim()}));assert.equal(criticalClaimsGate(input,audit).status,'PASS');row.component_checks[1].exact_quote='Paraphrase not in the owned action';assert.equal(criticalClaimsGate(input,audit).status,'NOT_EVALUABLE');
});
for(const location of ['evidence','common','other-activity'])test('external '+location+' cannot complete WORKED',()=>{
 const {input,audit}=setup(),a=input.graph.sessions[0].activities[0];if(location==='evidence')a.grade_participation[0].evidence+=addition;if(location==='common')a.common_student_action+=addition;if(location==='other-activity')input.graph.sessions[0].activities.push({...structuredClone(a),activity_id:'other',grade_participation:[{...a.grade_participation[0],student_action:addition,pda_mobilization:[]}]});
 audit.input_hash=buildCriticalClaimsReviewRequest(input).input_hash;assert.equal(criticalClaimsGate(input,audit).status,'FAIL');audit.worked_audits[0].status='PASS';audit.worked_audits[0].component_checks=audit.worked_audits[0].component_checks.map(c=>({...c,satisfied:true,exact_quote:c.component==='organs_function'?partial:addition.trim()}));assert.equal(criticalClaimsGate(input,audit).status,'NOT_EVALUABLE');
});
test('repair adapter sends owned target and complete GENERATE policy; compact rejection excludes action text',async()=>{
 const {f,ctx}=setup();let sent;const raw=structuredClone(f.proposal);
 const drivers=createSessionGraphDrivers({endpoint:'https://example.supabase.co/functions/v1/plan-project-blueprint-v1-shadow',token:'x'.repeat(64),durableEvidence:false,fetchImpl:async(_u,init)=>{sent=JSON.parse(init.body);return new Response(JSON.stringify({output:{status:'PROPOSAL',proposal:raw}}),{status:200});}});
 await assert.rejects(drivers.sessionRepair(ctx),e=>{assert.equal(e.worked_critical_repair_diagnostics[0].repair_applied_to_expected_claim,false);assert.equal(e.repair_local_validation.rejected_at,'validateRepairTargets');assert.equal(JSON.stringify(e.worked_critical_repair_diagnostics).includes(partial),false);return true;});
 assert.match(sent.prompt.worked_complete_action_policy,/TODOS/);assert.match(sent.prompt.repair_targets[0].required,/solo student_action/);assert.equal(sent.prompt.repair_targets[0].missing_components.length,3);
 raw.sessions[0].activities[1].grade_participation[0].student_action+=addition;
 const repaired=await drivers.sessionRepair(ctx);assert.equal(repaired.worked_critical_repair_diagnostics[0].repair_applied_to_expected_claim,true);
 const expected=structuredClone(f.proposal);expected.sessions[0].activities[1].grade_participation[0].student_action+=addition;assert.deepEqual(repaired.proposal,expected);
});

test('component witnesses preserve validated association and additive instruction',()=>{
 const {ctx}=setup(),t=repairTargetsFromContext(ctx)[0];assert.equal(t.original_student_action,partial);assert.deepEqual(t.satisfied_component_witnesses,[{component:'organs_function',exact_quote:partial}]);assert.match(t.required,/ADITIVA/);assert.match(t.required,/caracter por caracter/);
});
for(const kind of ['replacement','paraphrase','punctuation','additive'])test('literal additive repair '+kind,()=>{
 const {f,a,ctx}=setup(),t=repairTargetsFromContext(ctx)[0];
 a.grade_participation[0].student_action=kind==='additive'?partial+addition:kind==='punctuation'?partial.replace('.',';')+addition:kind==='paraphrase'?'Describe como la piel permite percibir texturas.'+addition:addition;
 const d=validateWorkedCriticalTarget(f.proposal,f,t);
 if(kind==='additive')assert.equal(d.repair_applied_to_expected_claim,true);
 else {assert.equal(d.reason,'SATISFIED_COMPONENT_WITNESS_REMOVED');assert.equal(d.lost_component,'organs_function');assert.equal(JSON.stringify(d).includes(partial),false);assert.equal(JSON.stringify(d).includes('exact_quote'),false);assert.throws(()=>validateRepairTargets(f.proposal,f,[t]),/SATISFIED_COMPONENT_WITNESS_REMOVED/);}
});
for(const kind of ['same','compiled-id','other-activity','other-grade','other-pda','ambiguous','contradictory'])test('SGS-002 grouping '+kind,()=>{
 const {ctx}=setup();const item={rule_id:'SGS-002',status:'FAIL',session:1,activity_key:'a2',grade:1,pda_id:'p1',scope:'owned row',observed:'Also demonstrate risks, representation and prevention.',expected:'Complete owned WORKED action.'};
 if(kind==='compiled-id'){delete item.activity_key;delete item.session;delete item.grade;delete item.pda_id;item.scope='session=1 activity_id=compiled_activity grade=1 pda_id=p1';}
 if(kind==='other-activity')item.activity_key='a1';if(kind==='other-grade')item.grade=3;if(kind==='other-pda')item.pda_id='p3';
 if(kind==='ambiguous'){delete item.pda_id;item.scope='All WORKED rows';}
 if(kind==='contradictory')item.scope='session=2 activity_key=a2 grade=1 pda_id=p1';
 ctx.triggering_rules.unshift(item);const targets=repairTargetsFromContext(ctx),t=targets.find(t=>t.rule_id==='WORKED');
 if(['same','compiled-id'].includes(kind)){assert.equal(targets.length,1);assert.deepEqual(t.related_findings.map(f=>[f.source,f.rule_id]),[['SESSION_CRITICAL_GATE','WORKED'],['SESSION_GATE','SGS-002']]);assert.equal(t.related_findings[1].observed_summary,item.observed);assert.equal(t.related_findings[1].expected_summary,item.expected);assert.deepEqual(t.missing_components,['risks','representation','prevention_care']);}
 else {assert.equal(targets.length,2);assert.equal(t.related_findings.length,1);assert.equal(targets[0].rule_id,'SGS-002');}
});
