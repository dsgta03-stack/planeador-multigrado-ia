import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {constructionPlan,compileConstruction,validateConstruction} from '../construction.mjs';
const historic=JSON.parse(readFileSync(new URL('../evidence/round2-generated-positive-1790193176957.json',import.meta.url)));
const src=historic.sources,plan=constructionPlan(src);
function proposal(){
 const b=structuredClone(historic.revisions[1].blueprint);
 b.project_stages=plan.stages.map((s,i)=>({...b.project_stages[i],stage_id:s.stage_id,estimated_minutes:90,student_operation:s.operations.join(' ; '),expected_output:'Synthetic test artifact',acceptance_criteria:['Synthetic test criterion']}));
 b.construction_evidence=plan.coverage_matrix.map(r=>({operation:r.operation,stage_id:r.stage_id,student_operation_quote:r.operation,evidence_quote:'Synthetic test artifact'}));
 return b;
}
const built=()=>compileConstruction(proposal(),plan).blueprint;
test('official text and owning grade are copied exactly; source never changed',()=>{
 const before=JSON.stringify(src),b=built();for(const p of b.pda_analysis){const official=src.curriculum.pdas.find(x=>x.pda_id===p.pda_id);assert.equal(p.grade,official.grade);assert.equal(p.official_text,official.pda_official)}assert.equal(JSON.stringify(src),before);
 const mutated=built();mutated.pda_analysis[1].official_text='Indagación';assert.throws(()=>validateConstruction(mutated,plan),/BPD-002/);
 mutated.pda_analysis[1].official_text=src.curriculum.pdas[1].pda_official;mutated.pda_analysis[1].grade=1;assert.throws(()=>validateConstruction(mutated,plan),/BPD-002/);
});
test('PDA_SELECTED cannot claim another grade PDA',()=>{const p=proposal();p.grade_contributions[0].pda_ids=[src.curriculum.pdas[1].pda_id];assert.throws(()=>compileConstruction(p,plan),/BPD-002/)});
test('future and same-session session inputs rejected',()=>{for(const id of ['artifact_production','artifact_planning']){const b=built();b.session_progression[0].input_artifact_ids=[id];assert.throws(()=>validateConstruction(b,plan),/BPD-015/)}});
test('duplicate production and output artifact IDs rejected',()=>{const b=built();b.session_progression[1].expected_output_artifact_ids.push('artifact_planning');assert.throws(()=>validateConstruction(b,plan),/BPD-015/);const c=built();c.project_stages[1].output_artifact_id=c.project_stages[0].output_artifact_id;assert.throws(()=>validateConstruction(c,plan),/BPD-015/)});
test('eleven operations fit three purpose-based stages without eleven-stage requirement',()=>{const b=built();assert.equal(plan.coverage_matrix.length,11);assert.equal(b.project_stages.length,3);assert(b.project_stages.every(s=>s.methodology_operations.length>1));assert(validateConstruction(b,plan));const missing=proposal();missing.construction_evidence.pop();assert.throws(()=>compileConstruction(missing,plan),/BPD-019/)});
test('coverage labels without observable literal action/evidence rejected',()=>{const p=proposal();p.construction_evidence[0].student_operation_quote='Invented action';assert.throws(()=>compileConstruction(p,plan),/BPD-019/)});
test('full teacher budget allowed; per-session and total excess rejected without scaling',()=>{const b=built();assert.equal(b.project_stages.reduce((n,s)=>n+s.estimated_minutes,0),270);assert(validateConstruction(b,plan));for(const minutes of [[91,50,50],[125,125,125]]){const p=proposal();minutes.forEach((n,i)=>p.project_stages[i].estimated_minutes=n);assert.throws(()=>compileConstruction(p,plan),/BPD-TIME/);assert.equal(p.project_stages[0].estimated_minutes,minutes[0])}});
test('compiled invariants pass the unchanged deterministic Gate',async()=>{const {blueprintGate}=await import('../gate.mjs');const g=blueprintGate({...src,blueprint:built()});for(const rule of ['BPD-002','BPD-015','BPD-019','BPD-TIME'])assert.equal(g.deterministic_findings.find(f=>f.rule_id===rule)?.status,'PASS',rule)});
