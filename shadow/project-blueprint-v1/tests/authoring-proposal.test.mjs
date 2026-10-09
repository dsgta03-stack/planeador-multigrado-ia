import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sources,candidate} from '../fixtures/build.mjs';
import {authoringSchema,compileAuthoring} from '../authoring-proposal.mjs';
import {constructionPlan,compileConstruction,validateConstruction} from '../construction.mjs';
import {assertContract,hash,schemaFor} from '../contracts.mjs';
import {blueprintGate} from '../gate.mjs';
const src=sources(),plan=constructionPlan(src);
// Test-only conversion of an explicitly authored synthetic fixture. Never a live PASS.
const ids={frame:'planning',investigate:'production',apply:'intervention',questions:'artifact_planning',shared_explanations:'artifact_production',completion:'artifact_intervention'};
const remap=x=>typeof x==='string'?(ids[x]||x):Array.isArray(x)?x.map(remap):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,remap(v)])):x;
const baseline=remap(candidate(src));
baseline.construction_evidence=plan.coverage_matrix.map(r=>{const s=baseline.project_stages.find(s=>s.stage_id===r.stage_id);return {operation:r.operation,stage_id:r.stage_id,student_operation_quote:s.student_operation,evidence_quote:s.expected_output}});
const expected=compileConstruction(baseline,plan).blueprint;
const schema=authoringSchema(src,plan);
const project=(x,s)=>s.type==='object'?Object.fromEntries(Object.entries(s.properties).filter(([k])=>k in x).map(([k,v])=>[k,project(x[k],v)])):s.type==='array'?x.map(v=>project(v,s.items)):structuredClone(x);
function proposal(){const p=project(baseline,schema);p.coverage=baseline.construction_evidence.map(r=>({operation:r.operation,stage_id:r.stage_id,action_quote:r.student_operation_quote,evidence_ref:{field:'expected_output',index:null}}));return p;}
const build=p=>compileAuthoring(p,src,plan,{blueprint_id:'authored-fixture',revision:1});
const unchanged=['schemas/ProjectBlueprintV1.json','gate.mjs','semantic-evidence.mjs'].map(p=>[p,hash(readFileSync(new URL('../'+p,import.meta.url),'utf8'))]);
const planning=p=>p.coverage.find(r=>r.operation==='PLANIFICACION');
for(const ref of [{field:'expected_output',index:null},{field:'acceptance_criteria',index:0}])test(`PLANIFICACION literal evidence from ${ref.field}`,()=>{
 const p=proposal(),row=planning(p);row.evidence_ref=ref;
 const stage=p.project_stages.find(s=>s.stage_id===row.stage_id),before=hash(p),built=build(p);
 const evidence=built.record.construction.raw_proposal.construction_evidence.find(r=>r.operation==='PLANIFICACION');
 assert.equal(evidence.student_operation_quote,row.action_quote);
 assert.equal(evidence.evidence_quote,ref.field==='expected_output'?stage.expected_output:stage.acceptance_criteria[ref.index]);
 assert.equal(hash(p),before);assert.deepEqual(build(p).blueprint,built.blueprint);
});
for(const [name,mutate,diagnostic] of [
 ['wrong assigned stage',(p,r)=>r.stage_id=p.project_stages.find(s=>s.stage_id!==r.stage_id).stage_id,'COVERAGE_STAGE_MISMATCH'],
 ['paraphrased action',(p,r)=>r.action_quote='El grupo prepara un plan de trabajo.','ACTION_QUOTE_NOT_LITERAL'],
 ['changed punctuation',(p,r)=>r.action_quote+='!','ACTION_QUOTE_NOT_LITERAL'],
 ['changed spaces',(p,r)=>r.action_quote=r.action_quote.replace(' ','  '),'ACTION_QUOTE_NOT_LITERAL'],
 ['expected_output index zero',(p,r)=>r.evidence_ref.index=0,'EVIDENCE_REF_INDEX_INVALID'],
 ['criterion outside range',(p,r)=>r.evidence_ref={field:'acceptance_criteria',index:999},'EVIDENCE_REF_INDEX_INVALID'],
 ['empty referenced text',(p,r)=>p.project_stages.find(s=>s.stage_id===r.stage_id).expected_output='   ','EVIDENCE_REF_EMPTY'],
 ['stale quote after stage rewrite',(p,r)=>p.project_stages.find(s=>s.stage_id===r.stage_id).student_operation='Nueva redacción de la etapa.','ACTION_QUOTE_NOT_LITERAL'],
 ['empty action',(p,r)=>r.action_quote='','ACTION_QUOTE_NOT_LITERAL'],
 ['duplicate operation',(p,r)=>p.coverage[p.coverage.findIndex(x=>x.operation!==r.operation)]=structuredClone(r),'COVERAGE_OPERATION_COUNT_INVALID']
])test(`PLANIFICACION rejects ${name} without rewriting proposal`,()=>{
 const p=proposal();mutate(p,planning(p));const before=hash(p);
 assert.throws(()=>build(p),e=>e.code==='CONSTRUCTION_REJECTED'&&e.rule==='BPD-019'&&e.message.includes(`${diagnostic}:PLANIFICACION`));
 assert.equal(hash(p),before);
});
for(const ref of [null,{}, {field:'invented',index:null},{field:'acceptance_criteria',index:-1}])test(`malformed evidence_ref remains fail-closed: ${JSON.stringify(ref)}`,()=>{
 const p=proposal();planning(p).evidence_ref=ref;const before=hash(p);
 assert.throws(()=>build(p),e=>e.code==='AUTHORING_CONTRACT_INVALID');assert.equal(hash(p),before);
});
test('compact proposal compiles to same full domain without inventing or removing pedagogy',()=>{
 const p=proposal(),before=hash(p),built=build(p).blueprint;
 assert.deepEqual(built,expected);assert.equal(hash(p),before);assertContract('ProjectBlueprintV1',built);
 for(const path of ['problem_frame','guiding_question','pda_analysis','project_stages','session_progression','grade_contributions','final_outcome'])assert.deepEqual(built[path],expected[path]);
});
test('source ownership exact; domain/Gate bytes and deterministic result remain unchanged',()=>{
 const b=build(proposal()).blueprint;
 for(const p of b.pda_analysis){const official=src.curriculum.pdas.find(x=>x.pda_id===p.pda_id);assert.equal(p.official_text,official.pda_official);assert.equal(p.grade,official.grade)}
 assert(validateConstruction(b,plan));
 const g=blueprintGate({...src,blueprint:b});assert.deepEqual(g.deterministic_findings.filter(x=>x.status!=='PASS'),[]);
 assert.equal(g.evaluated_blueprint_hash,hash(b));assert.notEqual(g.status,'PASS','compiler must not approve without semantic evidence');
 for(const [p,h] of unchanged)assert.equal(hash(readFileSync(new URL('../'+p,import.meta.url),'utf8')),h);
});
test('eleven operations, artifact provenance, budget and conceptual states preserved',()=>{
 const b=build(proposal()).blueprint;assert.equal(new Set(b.project_stages.flatMap(s=>s.methodology_operations)).size,11);assert.equal(b.project_stages.length,3);
 assert(b.project_stages.reduce((n,s)=>n+s.estimated_minutes,0)<=270);
 assert.deepEqual(b.session_progression,expected.session_progression);
 const p=proposal();p.project_stages[0].estimated_minutes=91;assert.throws(()=>build(p),/maximum/);
});
test('authoring bloat rejected without truncation, repair, or domain change',()=>{
 const p=proposal();p.grade_contributions[0].support_need='Texto repetido '.repeat(600);const h=hash(p);
 assert.throws(()=>build(p),e=>e.code==='AUTHORING_FIELD_EXCESSIVE_LENGTH'&&/maxLength 1200/.test(e.message));assert.equal(hash(p),h);
 // Limits are provider authoring policy, not a new restriction in the domain.
 const domain=structuredClone(expected);domain.grade_contributions[0].support_need=p.grade_contributions[0].support_need;assertContract('ProjectBlueprintV1',domain);
});
test('references cannot fabricate evidence, operations, or compiler-owned source values',()=>{
 for(const mutate of [p=>p.coverage[0].evidence_ref={field:'acceptance_criteria',index:999},p=>p.coverage[0].action_quote='Invented action',p=>p.coverage.pop(),p=>p.source={constraints_hash:'forged'},p=>p.pda_analysis[0].grade=6]){
  const p=proposal();mutate(p);assert.throws(()=>build(p));
 }
 const p=proposal();p.coverage[0].evidence_ref={field:'acceptance_criteria',index:0};assertContract('ProjectBlueprintV1',build(p).blueprint);
});
test('provider proposal remains compact and excludes deterministic metadata',()=>{
 const p=proposal();for(const k of ['source','methodology','gate_result','schema_version','blueprint_id','revision','status'])assert(!(k in p));
 assert(!('official_text' in p.pda_analysis[0]));assert(!('output_artifact_id' in p.project_stages[0]));
 assert(!('total_available_minutes' in p.feasibility));assert(!('evidence_quote' in p.coverage[0]));
 assert(JSON.stringify(p).length<JSON.stringify(baseline).length);
});
test('all model-owned domain enums are restored in local compact authoring',()=>{
 const d=schemaFor('ProjectBlueprintV1').properties,p=schema.properties;
 assert.deepEqual(p.guiding_question.properties.grade_accessibility.enum,d.guiding_question.properties.grade_accessibility.enum);
 assert.deepEqual(p.final_outcome.properties.type.enum,d.final_outcome.properties.type.enum);
 assert.deepEqual(p.pda_analysis.items.properties.integration_strength.enum,d.pda_analysis.items.properties.integration_strength.enum);
 assert.deepEqual(p.ltg_strategy.properties.mode.enum,d.ltg_strategy.properties.mode.enum);
 assert.deepEqual(p.ltg_strategy.properties.selections.items.properties.role.enum,d.ltg_strategy.properties.selections.items.properties.role.enum);
 for(const key of ['complexity','resource_feasibility','time_feasibility','multigrade_feasibility'])assert.deepEqual(p.feasibility.properties[key].enum,d.feasibility.properties[key].enum);
 const invalid=proposal();invalid.ltg_strategy.mode='none';invalid.feasibility.complexity='Baja';assert.throws(()=>build(invalid),e=>e.code==='AUTHORING_CONTRACT_INVALID');
});

test('BPD-019 compact preflight reports every invalid literal coverage row before repair',()=>{
 const p=proposal(),targets=['CONCRECION','AVANCES'];
 for(const op of targets){
  const row=p.coverage.find(x=>x.operation===op);
  assert.ok(row,`fixture must contain ${op}`);
  row.action_quote=`CITA NO LITERAL ${op}`;
 }
 assert.throws(
  ()=>build(p),
  e=>e.code==='CONSTRUCTION_REJECTED'&&e.rule==='BPD-019'&&targets.every(op=>e.message.includes(op))
 );
});
