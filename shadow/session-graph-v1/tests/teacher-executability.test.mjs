import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hash,schemaErrors} from '../../project-blueprint-v1/contracts.mjs';
import {executableSource,ltgFixture,useLtg} from './pedagogical-fixture.mjs';
import {teacherExecutabilityMissing,validateSessionGraphAuthoring,normalizeSessionGraphAuthoring,providerAuthoringShapeSchema,SESSION_GRAPH_AUTHORING_INSTRUCTION} from '../authoring.mjs';
import {compileSessionGraph} from '../session-graph.mjs';
import {sessionGraphGate,sessionSemanticInputHash} from '../gate.mjs';
import {SGS} from '../catalog.mjs';


test('rejects generic task labels even with a complete-looking procedure',()=>{
 for(const text of ['Registro de rutinas','Diseño de plantillas','Trabajo colaborativo','Reflexión colectiva','Modelado de listas','Realizan la actividad curricular específica de su bloque','comparan situaciones']){
  const f=executableSource();const a=f.proposal.sessions[0].activities[0];a.common_student_action=text;a.execution.student_steps=[text];
  assert.throws(()=>validateSessionGraphAuthoring(f.proposal,f),/SGD-017/);
 }
});
test('accepts concrete executable activity and rejects missing, repeated or unauthorized instructions',()=>{
 const f=executableSource();assert.equal(validateSessionGraphAuthoring(f.proposal,f),true);
 const a=f.proposal.sessions[0].activities[0];assert.deepEqual(teacherExecutabilityMissing(a),[]);
 for(const key of ['preparation','instruction','student_steps','grouping','contingency','connection']){const bad=structuredClone(a);delete bad.execution[key];assert.ok(teacherExecutabilityMissing(bad).length);}
 const bad=structuredClone(a);bad.execution.student_steps.push(bad.execution.student_steps[0]);assert.ok(teacherExecutabilityMissing(bad).includes('execution.repeated_steps'));
 bad.execution.resource_use.push({resource:'internet',use:'Consultan acuerdos en la red.'});assert.ok(teacherExecutabilityMissing(bad).includes('execution.unauthorized_resource'));
});
test('compiled gate independently rejects stripped execution despite semantic PASS',()=>{
 const f=executableSource();const {graph}=compileSessionGraph(f.proposal,f,{graph_id:'exec'});const altered=structuredClone(graph);altered.sessions[0].activities[0].execution.instruction='Trabajo colaborativo';
 const input={...f,graph:altered};const review={input_hash:sessionSemanticInputHash(input),findings:Object.keys(SGS).map(rule_id=>({rule_id,status:'PASS',scope:'fixture',observed:'ok',expected:SGS[rule_id]}))};
 const gate=sessionGraphGate(input,review);assert.equal(gate.status,'FAIL');assert.equal(gate.deterministic_findings.find(x=>x.rule_id==='SGD-017').status,'FAIL');
});
test('CORE cannot disappear; verified use carries exact references',()=>{
 for(const role of ['CORE']){const f=ltgFixture(role);assert.throws(()=>validateSessionGraphAuthoring(f.proposal,f),/SGD-013/);useLtg(f);const {graph}=compileSessionGraph(f.proposal,f,{graph_id:role});const ref=graph.sessions[0].activities[0].ltg_use[0].reference;assert.equal(ref.book,'Proyectos de Aula');assert.equal(ref.grade,1);assert.deepEqual(ref.pages,{start:11,end:12});assert.equal(ref.verified_activity.summary,'Comparar acuerdos');}
});
test('SGD-013 mismatch reports session, project, decision and concrete use state',()=>{
 const f=ltgFixture('CORE');
 const session=f.proposal.sessions[0];
 const projectId=f.blueprint.ltg_strategy.selections[0].project_id;
 session.ltg_decisions=[{project_id:projectId,decision:'USE',reason:'Se utilizará el proyecto LTG en esta sesión.'}];
 assert.throws(
  ()=>validateSessionGraphAuthoring(f.proposal,f),
  error=>{
   assert.equal(error.code,'SESSION_GRAPH_AUTHORING_INVALID');
   assert.match(error.message,/SGD-013 LTG decision\/use mismatch/);
   assert.match(error.message,/session=1/);
   assert.match(error.message,new RegExp(`project_id=${projectId}`));
   assert.match(error.message,/decision=USE/);
   assert.match(error.message,/concrete_use=absent/);
   return true;
  }
 );
});
test('pertinent OPTIONAL requires concrete use or explicit session non-use rationale',()=>{
 const f=ltgFixture();assert.equal(validateSessionGraphAuthoring(f.proposal,f),true);delete f.proposal.sessions[1].ltg_decisions;assert.throws(()=>validateSessionGraphAuthoring(f.proposal,f),/SGD-013/);
 const valid=ltgFixture();useLtg(valid);assert.equal(validateSessionGraphAuthoring(valid.proposal,valid),true);valid.proposal.sessions[0].activities[0].ltg_use[0].activity_id='invented';assert.throws(()=>validateSessionGraphAuthoring(valid.proposal,valid),/unverified LTG activity/);
});
test('zero PDA and transversal participation remain explicit and do not borrow another grade PDA',()=>{
 const f=executableSource();f.constraints.selected_pda_ids=[];f.curriculum.pdas=[];f.blueprint.pda_analysis=[];
 for(const s of f.blueprint.session_progression)s.pda_focus=[];
 for(const s of f.proposal.sessions)for(const a of s.activities)for(const g of a.grade_participation)g.pda_mobilization=[];
 const h=hash(f.blueprint);f.approval={...f.approval,blueprint_hash:h,evaluated_blueprint_hash:h,approved_blueprint_hash:h};
 const {graph}=compileSessionGraph(f.proposal,f,{graph_id:'zero'});assert.deepEqual(graph.traceability.pda,{});assert.deepEqual(graph.sessions[0].activities[0].grade_participation.map(g=>g.grade),[1,3]);
 f.proposal.sessions[0].activities[0].grade_participation[1].pda_mobilization=[{pda_id:'p1',status:'WORKED'}];assert.throws(()=>validateSessionGraphAuthoring(f.proposal,f),/outside session\/grade/);
});

test('brief concrete instructions pass without a word-count quota; repeated generic padding does not',()=>{
 const f=executableSource(),a=f.proposal.sessions[0].activities[0];
 a.execution.preparation='Divide el papel en tres columnas.';a.execution.instruction='Pide registrar un olvido en su columna.';a.execution.student_steps=['Identifican un olvido y registran su momento.'];a.execution.contingency='Modela un caso si no recuerdan uno.';a.execution.connection='Conservan el registro para decidir el acuerdo.';
 assert.deepEqual(teacherExecutabilityMissing(a),[]);
 a.execution.student_steps=['Trabajo colaborativo','Trabajo colaborativo'];assert.ok(teacherExecutabilityMissing(a).length);
});
test('authoring transport requires execution and keeps nullable LTG IDs typed without asking for invented references',()=>{
 const f=ltgFixture(),schema=providerAuthoringShapeSchema(f),activity=schema.properties.sessions.items.properties.activities.items;
 assert.ok(activity.required.includes('execution'));assert.ok(activity.required.includes('ltg_use'));
 assert.deepEqual(activity.properties.ltg_use.items.properties.activity_id.type,['string','null']);
 assert.ok(!activity.properties.ltg_use.items.properties.reference);
 assert.match(SESSION_GRAPH_AUTHORING_INSTRUCTION,/teacher_role|preparation/);
});

test('concrete instructions accept unrestricted verbs without accepting generic task labels',()=>{
 const actions=[
  'Miden la distancia entre los dos extremos de la hoja.',
  'Calculan la diferencia entre las dos cantidades del registro.',
  'Recortan el contorno de las figuras trazadas en el papel.',
  'Representan con gestos el acuerdo elegido por su pareja.',
  'Experimentan con dos dobleces del papel para comprobar cuál se sostiene.',
  'Entrevistan a su pareja sobre el momento en que olvidó un material.',
  'Consultan a su pareja qué acuerdo le permitió recordar el material.'
 ];
 for(const text of actions){
  const f=executableSource(),a=f.proposal.sessions[0].activities[0];
  a.common_student_action=text;a.teacher_role=text;
  for(const key of ['preparation','instruction','contingency','connection'])a.execution[key]=text;
  a.execution.student_steps=[text];a.execution.resource_use.forEach(row=>row.use=text);
  a.grade_participation.forEach(g=>g.student_action=text);
  assert.deepEqual(teacherExecutabilityMissing(a),[],text);
  assert.equal(validateSessionGraphAuthoring(f.proposal,f),true,text);
 }
});
test('normalizer removes supports that are not authorized by teacher constraints',()=>{
 const f=executableSource();
 const activity=f.proposal.sessions[0].activities[0];
 const authorized=[...(activity.supports||[])];
 activity.supports=[...authorized,'apoyo inventado por proveedor'];
 const normalized=normalizeSessionGraphAuthoring(f.proposal,f);
 assert.deepEqual(normalized.sessions[0].activities[0].supports,authorized);
 assert.equal(normalized.sessions[0].activities[0].supports.includes('apoyo inventado por proveedor'),false);
});

test('SGD-013 SUPPORT missing decision reports session, project and concrete use state',()=>{
 const f=ltgFixture('SUPPORT');
 useLtg(f);
 const session=f.proposal.sessions[0];
 const projectId=f.blueprint.ltg_strategy.selections[0].project_id;
 session.ltg_decisions=[];
 assert.throws(
  ()=>validateSessionGraphAuthoring(f.proposal,f),
  error=>{
   assert.equal(error.code,'SESSION_GRAPH_AUTHORING_INVALID');
   assert.match(error.message,/SGD-013 SUPPORT requires explicit session LTG decision/);
   assert.match(error.message,/session=1/);
   assert.match(error.message,new RegExp(`project_id=${projectId}`));
   assert.match(error.message,/concrete_use=present/);
   return true;
  }
 );
});
test('SUPPORT can strengthen one session without forced use in other sessions sharing its PDA',()=>{
 const f=ltgFixture('SUPPORT');useLtg(f);
 assert.ok(f.blueprint.session_progression.every(s=>s.pda_focus.includes('p1')));
 const unused=f.proposal.sessions[1];unused.ltg_decisions=[];
 for(const a of unused.activities){a.ltg_use=[];a.ltg_activity_ids=[];}
 assert.equal(validateSessionGraphAuthoring(f.proposal,f),true);
 const {graph}=compileSessionGraph(f.proposal,f,{graph_id:'support-one-session'});
 assert.equal(graph.sessions[0].activities[0].ltg_use.length,1);
 assert.ok(graph.sessions[1].activities.every(a=>a.ltg_use.length===0));
 assert.deepEqual(graph.sessions[1].ltg_decisions,[]);
});
test('null LTG activity cannot bypass specific Blueprint activity selections',()=>{
 const f=ltgFixture();useLtg(f);
 const a=f.proposal.sessions[0].activities[0];a.ltg_use[0].activity_id=null;a.ltg_activity_ids=[];
 assert.throws(()=>validateSessionGraphAuthoring(f.proposal,f),/selected LTG activity required/);
});
test('null LTG activity is allowed for project-only selection and references remain curricular',()=>{
 const f=ltgFixture();f.blueprint.ltg_strategy.selections[0].activity_ids=[];
 const h=hash(f.blueprint);f.approval={...f.approval,blueprint_hash:h,evaluated_blueprint_hash:h,approved_blueprint_hash:h};
 useLtg(f);
 for(const s of f.proposal.sessions)for(const a of s.activities)for(const use of a.ltg_use){use.activity_id=null;a.ltg_activity_ids=[];}
 assert.equal(validateSessionGraphAuthoring(f.proposal,f),true);
 const {graph}=compileSessionGraph(f.proposal,f,{graph_id:'project-only-ltg'});
 const ref=graph.sessions[0].activities[0].ltg_use[0].reference;
 assert.deepEqual(ref,{book:'Proyectos de Aula',project:'Acuerdos del aula',grade:1,pages:{start:10,end:13},verified_activity:null});
 const altered=structuredClone(graph);altered.sessions[0].activities[0].ltg_use[0].reference.pages.start=99;
 const input={...f,graph:altered};const review={input_hash:sessionSemanticInputHash(input),findings:Object.keys(SGS).map(rule_id=>({rule_id,status:'PASS',scope:'fixture',observed:'ok',expected:SGS[rule_id]}))};
 assert.equal(sessionGraphGate(input,review).status,'FAIL');
});

test('historical V1 contract stays compatible while new authoring and current gates stay strict',()=>{
 const schema=JSON.parse(readFileSync(new URL('../schemas/SessionGraphV1.json',import.meta.url),'utf8'));
 // Expand references and union types for the repository's restricted interpreter.
 const expand=node=>{
  if(Array.isArray(node))return node.map(expand);
  if(!node||typeof node!=='object')return node;
  if(node.$ref)return expand(node.$ref.slice(2).split('/').reduce((v,k)=>v[k],schema));
  if(Array.isArray(node.type))return {anyOf:node.type.map(type=>expand({...node,type}))};
  return Object.fromEntries(Object.entries(node).filter(([k])=>k!=='$defs').map(([k,v])=>[k,expand(v)]));
 };
 const f=executableSource(),{graph}=compileSessionGraph(f.proposal,f,{graph_id:'historical-v1'});
 const historical=structuredClone(graph);
 for(const session of historical.sessions){delete session.ltg_decisions;for(const a of session.activities){delete a.execution;delete a.ltg_use;}}
 assert.equal(historical.schema_version,'SESSION_GRAPH_V1');
 assert.deepEqual(schemaErrors(historical,expand(schema)),[]);
 const malformed=structuredClone(graph);malformed.sessions[0].activities[0].execution={};
 assert.ok(schemaErrors(malformed,expand(schema)).length,'optional extensions are validated when present');
 delete f.proposal.sessions[0].activities[0].execution;
 assert.throws(()=>validateSessionGraphAuthoring(f.proposal,f),/SGD-017/);
 assert.throws(()=>compileSessionGraph(f.proposal,f,{graph_id:'new-missing-execution'}),/SGD-017/);
 const stripped=structuredClone(graph);delete stripped.sessions[0].activities[0].execution;
 const input={...f,graph:stripped};const review={input_hash:sessionSemanticInputHash(input),findings:Object.keys(SGS).map(rule_id=>({rule_id,status:'PASS',scope:'fixture',observed:'ok',expected:SGS[rule_id]}))};
 assert.equal(sessionGraphGate(input,review).deterministic_findings.find(x=>x.rule_id==='SGD-017').status,'FAIL');
 for(const field of ['ltg_use','ltg_decisions']){
  const source=ltgFixture();useLtg(source);
  if(field==='ltg_use')delete source.proposal.sessions[0].activities[0][field];else delete source.proposal.sessions[0][field];
  assert.throws(()=>validateSessionGraphAuthoring(source.proposal,source),/required|SGD-013/);
 }
});
test('CORE is used once where pertinent without repetition across sessions sharing its PDA',()=>{
 const f=ltgFixture('CORE');useLtg(f);
 assert.ok(f.blueprint.session_progression.every(s=>s.pda_focus.includes('p1')));
 f.proposal.sessions[1].ltg_decisions=[];
 for(const a of f.proposal.sessions[1].activities){a.ltg_use=[];a.ltg_activity_ids=[];}
 assert.equal(validateSessionGraphAuthoring(f.proposal,f),true);
 const {graph}=compileSessionGraph(f.proposal,f,{graph_id:'core-once'});
 const input={...f,graph};const review={input_hash:sessionSemanticInputHash(input),findings:Object.keys(SGS).map(rule_id=>({rule_id,status:'PASS',scope:'fixture',observed:'ok',expected:SGS[rule_id]}))};
 assert.equal(sessionGraphGate(input,review).status,'PASS');
 assert.equal(graph.sessions[0].activities[0].ltg_use.length,1);
 assert.ok(graph.sessions[1].activities.every(a=>a.ltg_use.length===0));
 const falselyDeclared=structuredClone(f.proposal);falselyDeclared.sessions[1].ltg_decisions=[{project_id:'ltg1',decision:'USE',reason:'Comparar los acuerdos verificados con los casos del aula.'}];
 assert.throws(()=>validateSessionGraphAuthoring(falselyDeclared,f),/LTG decision\/use mismatch/);
 for(const session of f.proposal.sessions){session.ltg_decisions=[];for(const a of session.activities){a.ltg_use=[];a.ltg_activity_ids=[];}}
 assert.throws(()=>validateSessionGraphAuthoring(f.proposal,f),/CORE disappeared/);
});

test('rejects bare assistance instead of student development and attention-only titles',()=>{
 const claims=['orientar','apoyar','supervisar','Orientaré a los alumnos de 3.º en el uso de técnicas de apunte para organizar su información.','Supervisaré el diseño de carteles de orden.','Apoyaré a los alumnos de 1.º y 2.º.'];
 for(const text of claims){const f=executableSource();f.proposal.sessions[0].activities[0].common_student_action=text;assert.throws(()=>validateSessionGraphAuthoring(f.proposal,f),/SGD-017/,text);}
 for(const title of ['Apoyo a 3.º','Tutoría 4, 5, 6','Supervisión 4, 5, 6','Apoyo técnico 4, 5, 6']){const f=executableSource();f.proposal.sessions[0].activities[0].title=title;assert.throws(()=>validateSessionGraphAuthoring(f.proposal,f),/title.teacher_attention_only/,title);}
 const f=executableSource();f.proposal.sessions[0].activities[0].title='Representamos las situaciones que queremos cambiar';
 f.proposal.sessions[0].activities[0].common_student_action='Orientaré al grupo con una pregunta sobre sus registros. En parejas, representan una situación del aula mediante un dibujo y contrastan qué acuerdo ayudaría a resolverla. Conservan el dibujo para decidir juntos el acuerdo.';
 assert.equal(validateSessionGraphAuthoring(f.proposal,f),true,'teacher first-person narrative is allowed when developed');
 f.proposal.sessions[0].activities[0].teacher_role='Orientaré a los alumnos de 3.º en el uso de técnicas de apunte para organizar su información.';
 assert.equal(validateSessionGraphAuthoring(f.proposal,f),true,'a concise teacher role does not replace or invalidate an already developed student procedure');
});
test('semantic review keeps depth, simultaneous work and coherence fail-closed without a length quota',async()=>{
 const {buildSessionGraphReviewRequest,SESSION_GRAPH_REVIEW_INSTRUCTION}=await import('../reviewer.mjs');
 const f=executableSource(),{graph}=compileSessionGraph(f.proposal,f,{graph_id:'depth-review'}),input={...f,graph};
 const request=buildSessionGraphReviewRequest(input);
 assert.match(SESSION_GRAPH_REVIEW_INSTRUCTION,/common_student_action.*desarrollo didáctico/);
 assert.match(SESSION_GRAPH_REVIEW_INSTRUCTION,/simultáneamente los otros grados/);
 assert.match(SESSION_GRAPH_REVIEW_INSTRUCTION,/propósito de sesión, desarrollo, producto parcial, evidencia e insumo siguiente/);
 for(const rule_id of ['SGS-006','SGS-011']){
  const review={input_hash:request.input_hash,findings:Object.keys(SGS).map(id=>({rule_id:id,status:id===rule_id?'FAIL':'PASS',scope:'session_1_activity_1',observed:'Orientaré sin describir desarrollo del alumnado',expected:SGS[id]}))};
  assert.equal(sessionGraphGate(input,review).status,'FAIL');
 }
});
