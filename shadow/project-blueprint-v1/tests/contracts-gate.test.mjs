import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hash,makeConstraints,makeSnapshot,makeDecision,sourceBinding,deepFreeze,canonical} from '../contracts.mjs';
import {blueprintGate,semanticInputHash} from '../gate.mjs';
import {generateShadow,assertApproved} from '../shadow.mjs';
import {BPS} from '../catalog.mjs';
const fixture=id=>JSON.parse(readFileSync(new URL(`../fixtures/${id}.json`,import.meta.url)));
const seed=()=>fixture('PB-010').input;
// Explicit test double: tests plumbing only; live semantic evidence is separate.
const review=input=>({input_hash:semanticInputHash(input),findings:Object.entries(BPS).map(([rule_id,expected])=>({rule_id,severity:'CRITICAL',status:'PASS',scope:'test-double',observed:'Injected PASS for deterministic isolation, not pedagogical evidence',expected}))});
const failures=x=>blueprintGate(x,review(x)).deterministic_findings.filter(x=>x.status==='FAIL').map(x=>x.rule_id);
for(const [field,value]of Object.entries({grades:[1,2,3],selected_pda_ids:['different'],explicit_ltg_selections:[{project_id:'test',pda_ids:['different'],intent:'CORE'}],requested_sessions:4,minutes_per_session:60,original_problem:'Otro problema',original_context:'Otro contexto',students_by_grade:{1:9,3:5},reading_profile:'Avanzada',writing_profile:'Avanzada',autonomy_profile:'Alta',connectivity:'Con internet',available_resources:['tableta'],supports:['tutor'],teacher_explicit_constraints:['Otra condición']}))test(`hash changes: ${field}`,()=>{const c=seed().constraints;assert.notEqual(makeConstraints({...c,[field]:value}).constraints_hash,c.constraints_hash)});
test('fingerprint stable across metadata and object key ordering',()=>{const c=seed().constraints;assert.equal(makeConstraints(c).constraints_hash,c.constraints_hash);assert.equal(hash({a:1,b:2}),hash({b:2,a:1}))});
test('official text changes snapshot hash',()=>{const k=seed().curriculum;k.pdas[0].pda_official+=' cambiado';assert.notEqual(makeSnapshot(k).snapshot_hash,k.snapshot_hash)});
test('methodology unknown has no ABP fallback',()=>assert.throws(()=>makeDecision({selected_id:'unknown',selection_source:'TEACHER'})));
test('accepted recommendation must equal choice',()=>assert.throws(()=>makeDecision({selected_id:'abp',recommended_id:'steam',selection_source:'TEACHER_ACCEPTED_RECOMMENDATION'})));
const cases={
'BPD-001':b=>b.pda_analysis[0].pda_id='unknown',
'BPD-002':b=>b.pda_analysis[0].grade=6,
'BPD-003':b=>b.grade_contributions=b.grade_contributions.filter(x=>x.grade!==1),
'BPD-004':b=>b.grade_contributions[0].curriculum_mode='TRANSVERSAL_PROJECT',
'BPD-005':b=>b.grade_contributions[0].integration_destination='outcome_02',
'BPD-006':b=>b.project_stages[0].required_inputs=[],
'BPD-007':b=>b.project_stages[1].consumed_by=['frame'],
'BPD-008':b=>b.project_stages[1].consumed_by=['missing'],
'BPD-009':b=>b.session_progression.at(-1).terminal=false,
'BPD-010':b=>b.session_progression.at(-1).next_session_dependency=99,
'BPD-011':b=>b.session_progression[0].terminal=true,
'BPD-012':b=>b.session_progression.pop(),
'BPD-013':b=>b.session_progression[1].session_number=7,
'BPD-014':b=>b.project_stages[1].output_artifact_id=b.project_stages[0].output_artifact_id,
'BPD-015':b=>b.project_stages[0].required_inputs=['completion'],
'BPD-016':b=>b.methodology.catalog_version='WRONG',
'BPD-017':b=>b.methodology.selected_id='steam',
'BPD-018':b=>b.final_outcome.required_resources[0].resource='internet',
'BPD-019':b=>b.project_stages[1].methodology_operations=[],
'BPD-020':b=>b.problem_frame.original_problem='reemplazado',
};
for(const [rule,mutate]of Object.entries(cases))test(`reject ${rule}`,()=>{const input=seed();mutate(input.blueprint);const got=failures(input);assert(got.includes(rule)||['BPD-006','BPD-016'].includes(rule)&&got.includes('BPD-SCHEMA'),got.join(','))});
test('all authored deterministic fixtures',()=>{for(const id of ['PB-001','PB-002','PB-003','PB-004','PB-005','PB-006','PB-007','PB-008','PB-009','PB-010','PB-011-STEAM-PASS','PB-012-SERVICIO-PASS','PB-013-COMUNITARIO-PASS','PB-014-UN-GRADO-UNA-SESION','PB-015-SEIS-GRADOS-DOS-SESIONES','PB-016-LTG-CORE','PB-017-LTG-SUPPORT','PB-018-LTG-OPTIONAL','PB-019-WEAK','PB-020-MUSEO-REAL']){const f=fixture(id),got=failures(f.input);for(const rule of f.expected.deterministic||[])assert(got.includes(rule),id+':'+got);if(!f.expected.deterministic)assert.deepEqual(got,[],id)}});
test('gate does not mutate any input and no semantic means no PASS',()=>{const input=deepFreeze(seed()),before=canonical(input);const r=blueprintGate(input);assert.equal(r.status,'NOT_EVALUABLE');assert.equal(canonical(input),before)});
test('stale semantic review cannot approve changed content',()=>{const input=seed(),s=review(input);input.blueprint.project_stages[0].student_operation='Otra operación';assert.equal(blueprintGate(input,s).status,'NOT_EVALUABLE')});
test('missing/duplicate semantic rule fails closed',()=>{const input=seed(),s=review(input);s.findings.push(s.findings[0]);assert.equal(blueprintGate(input,s).status,'NOT_EVALUABLE')});
test('weak PDA requests teacher without substitutions',()=>{const input=fixture('PB-019-WEAK').input;assert.equal(blueprintGate(input,review(input)).status,'NEEDS_TEACHER_DECISION')});
test('constraints corruption and altered decision ID binding fail',()=>{const input=seed();input.constraints.supports.push('altered');input.methodology.required_operations=[];assert(failures(input).length)});
test('generation rejects legacy sessions as source',async()=>assert.rejects(generateShadow({...seed(),sessions:[]}),/ONLY_SOURCE/));
test('bounded repair preserves revision 1 and reruns gate',async()=>{const src=seed();delete src.blueprint;let calls=[];const provider=async(task,input)=>{calls.push(task);if(task==='REVIEW')return{output:review(input),telemetry:{task}};const b=seed().blueprint;b.source=sourceBinding(src);if(task==='GENERATE')b.session_progression.at(-1).next_session_dependency=99;return{output:b,telemetry:{task}}};const result=await generateShadow(src,{},provider);assert.equal(result.repair_count,1);assert.equal(result.revisions.length,2);assert.equal(result.revisions[0].blueprint.session_progression.at(-1).next_session_dependency,99);assert.equal(result.status,'APPROVED');assert(result.revisions[1].diff.length);assertApproved(result);assert.throws(()=>{result.blueprint.final_outcome.name='late write'});const tampered=structuredClone(result);tampered.blueprint.final_outcome.name='late write';assert.throws(()=>assertApproved(tampered));assert.deepEqual(calls,['GENERATE','REVIEW','REPAIR','REVIEW'])});
