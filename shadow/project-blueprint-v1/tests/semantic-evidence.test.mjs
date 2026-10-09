import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyEvidenceAudit,stageCheckDiagnostics,stageReviewTelemetry} from '../semantic-evidence.mjs';
import {generateShadow,reviewBlueprint} from '../shadow.mjs';
import {BPS} from '../catalog.mjs';
const input=JSON.parse(readFileSync(new URL('../fixtures/PB-010.json',import.meta.url))).input;
const rows=()=>input.blueprint.project_stages.map(s=>({stage_id:s.stage_id,operation_quote:s.student_operation,artifact_id:s.output_artifact_id,criteria_quote:s.acceptance_criteria[0],consumed_by:[...s.consumed_by],outcome_link:'Synthetic local evidence explanation',bps007:'PASS'}));
const finding=(checks,findings=[])=>applyEvidenceAudit(input,{stage_checks:checks,findings}).find(x=>x.rule_id==='BPS-007');
// Preserve the pre-change BPS-007 evaluator, including its short-circuit exceptions.
function previous(checks){
 const results=input.blueprint.project_stages.map(s=>{
  const matches=checks.filter(c=>c.stage_id===s.stage_id);if(matches.length!==1)return 'NOT_EVALUABLE';
  const c=matches[0];if(!['PASS','FAIL','NOT_EVALUABLE'].includes(c.bps007))return 'NOT_EVALUABLE';
  const valid=()=>typeof c.operation_quote==='string'&&c.operation_quote.trim().length>0&&s.student_operation.includes(c.operation_quote)&&c.artifact_id===s.output_artifact_id&&c.criteria_quote.trim().length>0&&s.acceptance_criteria.some(a=>a.includes(c.criteria_quote))&&c.consumed_by.length>0&&c.consumed_by.every(id=>s.consumed_by.includes(id))&&c.outcome_link.trim().length>0;
  return c.bps007==='PASS'&&!valid()?'NOT_EVALUABLE':c.bps007;
 });
 return results.includes('FAIL')?'FAIL':results.includes('NOT_EVALUABLE')||!results.length?'NOT_EVALUABLE':'PASS';
}
for(const [name,mutate,reason] of [
 ['missing',r=>r.shift(),'STAGE_CHECK_MISSING'],
 ['duplicate',r=>r.push(structuredClone(r[0])),'STAGE_CHECK_DUPLICATE'],
 ['invalid status',r=>r[0].bps007='INVALID','BPS007_STATUS_INVALID'],
 ['empty action',r=>r[0].operation_quote=' ','OPERATION_QUOTE_EMPTY'],
 ['nonliteral action',r=>r[0].operation_quote='PARAPHRASE','OPERATION_QUOTE_NOT_LITERAL'],
 ['artifact',r=>r[0].artifact_id='WRONG','ARTIFACT_ID_MISMATCH'],
 ['empty criterion',r=>r[0].criteria_quote=' ','CRITERIA_QUOTE_EMPTY'],
 ['nonliteral criterion',r=>r[0].criteria_quote='PARAPHRASE','CRITERIA_QUOTE_NOT_LITERAL'],
 ['empty consumer',r=>r[0].consumed_by=[],'CONSUMED_BY_EMPTY'],
 ['invalid consumer',r=>r[0].consumed_by=['WRONG'],'CONSUMED_BY_INVALID'],
 ['empty outcome',r=>r[0].outcome_link=' ','OUTCOME_LINK_EMPTY'],
 ['reviewer incomplete',r=>r[0].bps007='NOT_EVALUABLE','REVIEWER_NOT_EVALUABLE'],
 ['reviewer fail',r=>r[0].bps007='FAIL','REVIEWER_FAIL']
])test(`BPS-007 diagnostic: ${name}; status unchanged`,()=>{
 const checks=rows();mutate(checks);const before=structuredClone(checks),f=finding(checks);
 assert.equal(f.status,previous(checks));
 const diagnostic=stageCheckDiagnostics(input,checks)[0];assert.ok(diagnostic.reasons.includes(reason));
 assert.deepEqual(JSON.parse(f.observed).stage_diagnostics[0],diagnostic);
 assert.deepEqual(checks,before);
});
test('valid local stages PASS without GLOBAL finding; explicit FAIL prevails',()=>{
 const checks=rows();assert.equal(finding(checks).status,'PASS');
 assert.equal(finding(checks,[{rule_id:'BPS-007',status:'NOT_EVALUABLE'}]).status,'PASS');
 assert.equal(finding(checks,[{rule_id:'BPS-007',status:'FAIL'}]).status,'FAIL');
 checks[0].bps007='FAIL';checks.pop();assert.equal(finding(checks).status,'FAIL');
});
test('diagnostics preserve malformed-response exception behavior',()=>{
 const checks=rows();delete checks[0].criteria_quote;
 assert.throws(()=>previous(checks),TypeError);assert.throws(()=>finding(checks),TypeError);
});
test('summary has bounded diagnostics and no long pedagogical text',()=>{
 const checks=rows();checks[0].outcome_link='PRIVATE_LONG_TEXT'.repeat(1000);checks[0].artifact_id='WRONG';
 const f=finding(checks),summary=JSON.parse(f.observed);
 assert.equal(summary.not_evaluable_count,1);assert.equal(summary.fail_count,0);
 assert.equal(summary.pass_count,checks.length-1);assert.ok(f.observed.length<1500);
 assert.ok(!f.observed.includes('PRIVATE_LONG_TEXT'));assert.ok(!f.observed.includes(checks[0].operation_quote));
});
test('STAGES telemetry retains parsed count, IDs, output tokens and finish reason only',()=>{
 const t=stageReviewTelemetry({stage_checks:rows()},{finish_reason:'STOP',text_length:123,usage:{candidatesTokenCount:42},candidate_text:'SECRET'});
 assert.deepEqual(t,{finish_reason:'STOP',output_token_count:42,text_length:123,parse_status:'JSON_PARSED',stage_checks_count:rows().length,stage_ids:rows().map(x=>x.stage_id)});
 assert.ok(!JSON.stringify(t).includes('SECRET'));
});
test('review and terminal log expose compact stage diagnostics without candidate text or secrets',async()=>{
 const audit={audit_version:'LOCAL_EVIDENCE_V1',stage_checks:rows(),findings:Object.entries(BPS).map(([rule_id,expected])=>({rule_id,expected,severity:'CRITICAL',status:'PASS',scope:'synthetic',observed:'Synthetic'}))};
 audit.stage_checks[0].criteria_quote='WRONG';
 // Reviewer FAIL rows bypass evidence validation for these unrelated synthetic units.
 audit.pda_checks=input.curriculum.pdas.map(p=>({pda_id:p.pda_id,bps004:'NOT_EVALUABLE',bps005:'NOT_EVALUABLE'}));
 audit.methodology_checks=input.methodology.required_operations.map(operation_id=>({operation_id,bps008:'NOT_EVALUABLE'}));
 const telemetry={finish_reason:'STOP',text_length:123,usage:{candidatesTokenCount:42},candidate_text:'SECRET_CANDIDATE',authorization:'SECRET_BEARER'};
 const semantic=await reviewBlueprint(input,{},async()=>({output:audit,telemetry}));
 assert.equal(semantic.telemetry.stages_review.stage_checks_count,rows().length);
 const {blueprint,...src}=input,logs=[],old=console.error;
 try{
  console.error=(...args)=>logs.push(args.join(' '));
  const result=await generateShadow(src,{},async task=>({output:task==='REVIEW'?audit:blueprint,telemetry}));
  assert.equal(result.gate.status,'NOT_EVALUABLE');assert.equal(result.status,'NEEDS_REPAIR');
 }finally{console.error=old;}
 const log=logs.find(x=>x.startsWith('[BLUEPRINT_BPS007_DIAGNOSTIC]'));
 assert.ok(log);assert.ok(log.includes('CRITERIA_QUOTE_NOT_LITERAL'));assert.ok(log.includes('STOP'));
 assert.ok(log.length<1500);assert.ok(!log.includes('SECRET'));assert.ok(!log.includes(rows()[0].operation_quote));
});
