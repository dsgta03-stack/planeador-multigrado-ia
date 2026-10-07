import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import JSZip from 'jszip';
import {executableSource,ltgFixture,useLtg} from '../shadow/session-graph-v1/tests/pedagogical-fixture.mjs';
import {compileSessionGraph} from '../shadow/session-graph-v1/session-graph.mjs';
import {sessionGraphGate,sessionSemanticInputHash,approveSessionGraph} from '../shadow/session-graph-v1/gate.mjs';
import {SGS} from '../shadow/session-graph-v1/catalog.mjs';
import {projectTeacherPlan,assertTeacherProjection} from '../shadow/pipeline-v1/projection.mjs';
import {adaptTeacherProjectionToCanonicalPlan,canonicalPlanHash} from '../lib/v0125/blueprint-canonical-adapter.mjs';
import {assertCanonicalPlanBinding} from '../lib/v0125/canonical-plan-services.mjs';
import {renderTeacherActivity,renderTeacherSessions,TEACHER_PRESENTATION_UI} from '../lib/consolidation-r1/ui/teacher-presentation-ui.mjs';
import {toTeacherPlanView} from '../shadow/presentation-v1/teacher-plan-view.mjs';
import {HISTORY_UI} from '../lib/consolidation-r1/ui/history-ui.mjs';
import {createMultiplanDocx} from '../lib/v0124/docx-export.mjs';

function approved(f=executableSource()){
 const {graph}=compileSessionGraph(f.proposal,f,{graph_id:'teacher-executable'});
 const input={...f,graph};
 // Local review double: no provider. Real runtime keeps its semantic/critical reviews.
 const review={input_hash:sessionSemanticInputHash(input),findings:Object.keys(SGS).map(rule_id=>({rule_id,status:'PASS',scope:'fixture',observed:'ok',expected:SGS[rule_id]}))};
 const gate=sessionGraphGate(input,review);assert.equal(gate.status,'PASS');
 const graphApproval=approveSessionGraph(input,gate);
 const projection=projectTeacherPlan({blueprint:f.blueprint,blueprintApproval:f.approval,graph,graphApproval});
 const sources={constraints:f.constraints,curriculum:f.curriculum,methodology:f.methodology};
 const plan=adaptTeacherProjectionToCanonicalPlan({sources,teacherPlan:projection});
 return {graph,projection,plan};
}

test('approved execution survives graph → projection → canonical plan and presentation without text changes',()=>{
 const {graph,projection,plan}=approved();
 for(const [i,s] of graph.sessions.entries())for(const [j,a] of s.activities.entries()){
  const p=projection.sessions[i].activities[j],c=plan.sessions[i].activities[j],b=plan.teacher_presentation.sessions[i].activity_blocks[j];
  for(const key of ['execution','grade_participation','teacher_role','resources','supports','evidence','assessment_criteria','ltg_use','input_refs','output_ref']){
   assert.deepEqual(p[key],a[key],`projection ${key}`);assert.deepEqual(c[key],a[key],`canonical ${key}`);assert.deepEqual(b[key],a[key],`presentation ${key}`);
  }
 }
 const view=toTeacherPlanView({pipelineResult:{status:'READY_FOR_TEACHER',teacher_plan:projection}});
 assert.deepEqual(view.sessions[0].activities[0].execution,graph.sessions[0].activities[0].execution);
 assert.deepEqual(view.sessions[0].ltg_decisions,projection.sessions[0].ltg_decisions);
 assert.deepEqual(plan.traceability,graph.traceability);
 assert.deepEqual(plan.sessions.map(s=>s.session_number),graph.sessions.map(s=>s.session_number));
 assert.ok(plan.teacher_presentation.sessions[0].teacher_narrative);
 assert.ok(plan.teacher_presentation.sessions[0].closure_narrative);
 const copy=structuredClone(projection);copy.sessions[0].activities[0].execution.instruction='Alterada';assert.throws(()=>assertTeacherProjection(copy),/TAMPERED/);
 const bad=structuredClone(plan);bad.sessions[0].activities[0].execution.instruction='Alterada';assert.throws(()=>assertCanonicalPlanBinding({plan:bad,canonical_plan_hash:canonicalPlanHash(plan)}),/MISMATCH/);
 assert.equal(canonicalPlanHash(plan),canonicalPlanHash(approved().plan));
});
test('primary UI renders all approved pedagogical fields and escapes student/provider text',()=>{
 const {plan}=approved(),s=plan.teacher_presentation.sessions[0],b=s.activity_blocks[0];const html=renderTeacherSessions(plan.teacher_presentation);
 for(const key of ['preparation','instruction','grouping','contingency','connection'])assert.ok(html.includes(b.execution[key]),key);
 for(const step of b.execution.student_steps)assert.ok(html.includes(step));
 for(const label of ['Propósito','Desarrollo','Acción docente','Diferenciación','Materiales y uso','Apoyos autorizados','Si no avanza','Producto','Evidencia','Criterios','Cierre/conexión'])assert.ok(html.includes(label),label);
 for(const g of b.grade_participation)assert.ok(html.includes(g.student_action));
 const dangerous=structuredClone(b);dangerous.execution.instruction='<img src=x onerror=alert(1)>';const safe=renderTeacherActivity(dangerous);assert.ok(safe.includes('&lt;img'));assert.ok(!safe.includes('<img'));
 assert.ok(TEACHER_PRESENTATION_UI.includes('Ver detalle técnico y trazabilidad original'));
 assert.ok(HISTORY_UI.includes('window.mpRenderTeacherPlan(data)'));
 // Compile and execute the same serialized renderer used by the browser.
 const script=TEACHER_PRESENTATION_UI.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
 const nodes={plan:{},sessionsPlan:{innerHTML:'Previous plan'},mpPlanMethodHeader:{querySelector(){return null},scrollIntoView(){}},mpTechnicalTrace:{innerHTML:'Old trace'}};
 const browser={document:{readyState:'loading',addEventListener(){},getElementById(id){return nodes[id]||null}},window:{},setTimeout(fn){fn();}};vm.runInNewContext(script,browser);assert.equal(typeof browser.window.mpRenderTeacherPlan,'function');
 browser.window.mpRenderTeacherPlan(plan);assert.equal(nodes.sessionsPlan.innerHTML,html);assert.ok(nodes.mpTechnicalTrace.innerHTML.includes('traceability'));
 browser.window.mpRenderTeacherPlan(plan);assert.equal(nodes.sessionsPlan.innerHTML,html);assert.ok(!nodes.mpTechnicalTrace.innerHTML.includes('Old trace'));
});
test('CORE exact verified reference and OPTIONAL explicit non-use remain visible and hash-bound',()=>{
 const core=ltgFixture('CORE');useLtg(core);const {graph,projection,plan}=approved(core);
 assert.deepEqual(plan.project.ltg_strategy,core.blueprint.ltg_strategy);
 assert.deepEqual(projection.sessions[0].activities[0].ltg_use,graph.sessions[0].activities[0].ltg_use);
 const html=renderTeacherSessions(plan.teacher_presentation);
 for(const value of ['Proyectos de Aula','Acuerdos del aula','11–12','Comparar acuerdos','Uso LTG','Momento','Aporte al PDA/proyecto'])assert.ok(html.includes(value),value);
 const optional=approved(ltgFixture());assert.deepEqual(optional.plan.sessions[0].ltg_decisions,optional.graph.sessions[0].ltg_decisions);
 assert.ok(renderTeacherSessions(optional.plan.teacher_presentation).includes('NOT_RECOMMENDED'));
 assert.ok(optional.plan.teacher_presentation.sessions[0].activity_blocks[0].narrative.includes('Si no avanza:'));
});
test('existing DOCX exporter includes approved procedure, differentiation, support, evidence and LTG',async()=>{
 const f=ltgFixture('CORE');useLtg(f);const {plan}=approved(f);const buffer=await createMultiplanDocx(plan);const zip=await JSZip.loadAsync(buffer);const xml=await zip.file('word/document.xml').async('string');
 for(const value of ['Preparación:','Consigna:','Organización:','Acción docente:','Diferenciación:','Si no avanza:','Criterio:','Proyectos de Aula','11–12','Cierre/conexión:'])assert.ok(xml.includes(value),value);
});

test('DOCX preserves OPTIONAL non-use rationale without synthesizing an LTG use',async()=>{
 const {plan}=approved(ltgFixture());const zip=await JSZip.loadAsync(await createMultiplanDocx(plan));const xml=await zip.file('word/document.xml').async('string');
 assert.ok(xml.includes('NOT_RECOMMENDED'));assert.ok(xml.includes(plan.sessions[0].ltg_decisions[0].reason));
 assert.deepEqual(plan.sessions[0].activities[0].ltg_use,[]);
});

test('fluent student development and simultaneous grade work survive to UI and DOCX without invention',async()=>{
 const f=executableSource(),a=f.proposal.sessions[0].activities[0];
 a.title='Reconstruimos situaciones para decidir nuestros acuerdos';
 a.common_student_action='En parejas por grado, recuperan una situación del aula que dificultó escucharse y la representan en el papel. Los alumnos de 1.º dibujan qué ocurrió y lo explican a su compañero; los de 3.º consultan los registros previos, contrastan dos situaciones y escriben qué acuerdo ayudó en cada caso. Mientras el docente acompaña la explicación oral de 1.º, las parejas de 3.º continúan la comparación y marcan la duda que quieren consultar. Después muestran sus hallazgos al grupo y distinguen qué necesitan resolver para decidir el acuerdo en la actividad siguiente.';
 a.teacher_role='Con 1.º, el docente pide explicar qué pasó antes y después del desacuerdo; al reunirse el grupo, retoma las dudas marcadas por 3.º y contrasta sus registros.';
 a.execution.grouping='Parejas del mismo grado: 1.º recibe atención directa para la explicación oral, mientras 3.º compara sus registros con su pareja y marca dudas para la puesta en común.';
 a.execution.student_steps=['Recuperan una situación del aula y la representan según su grado.','Contrastan con su pareja qué ocurrió y qué acuerdo ayudó.','Muestran sus hallazgos y señalan qué necesitan resolver.'];
 a.execution.connection='Los hallazgos registrados serán el insumo para decidir el acuerdo en la actividad siguiente.';
 const {graph,projection,plan}=approved(f),b=plan.teacher_presentation.sessions[0].activity_blocks[0];
 for(const item of [graph.sessions[0].activities[0],projection.sessions[0].activities[0],plan.sessions[0].activities[0],b]){
  assert.equal(item.common_student_action,a.common_student_action);
  assert.deepEqual(item.grade_participation,a.grade_participation);
  assert.deepEqual(item.input_refs,['input_context']);assert.deepEqual(item.contributes_to_artifact_ids,[]);
 }
 assert.equal(b.development,a.common_student_action);
 const html=renderTeacherActivity(b);
 assert.ok(html.indexOf(a.common_student_action)<html.indexOf('<details'),'student narrative remains primary');
 assert.ok(html.includes(a.execution.grouping));
 assert.ok(html.includes('Preparación, acompañamiento y recursos'));
 const presentation=structuredClone(plan.teacher_presentation);
 const last=presentation.sessions[0].activity_blocks.at(-1).execution.connection;
 presentation.sessions[0].closure_narrative=last;
 const sessionHtml=renderTeacherSessions({sessions:[presentation.sessions[0]]});
 assert.equal(sessionHtml.split(last).length-1,1,'identical closure appears only once');
 const zip=await JSZip.loadAsync(await createMultiplanDocx(plan));const xml=await zip.file('word/document.xml').async('string');
 assert.ok(xml.includes(a.common_student_action));assert.ok(xml.includes(a.execution.grouping));
 assert.deepEqual(plan.selected_pdas,f.curriculum.pdas);assert.deepEqual(plan.resources,f.constraints.available_resources);
 assert.deepEqual(plan.project.ltg_strategy,f.blueprint.ltg_strategy);
 assert.deepEqual(plan.sessions.map(s=>s.pda_focus),f.blueprint.session_progression.map(s=>s.pda_focus));
});
