import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../../project-blueprint-v1/contracts.mjs';
import {compileSessionGraph,validateCompiledSessionGraph} from '../session-graph.mjs';
import {validateSessionGraphAuthoring} from '../authoring.mjs';
import {sessionGraphGate,approveSessionGraph,sessionSemanticInputHash} from '../gate.mjs';
import {SGS} from '../catalog.mjs';

function fixture(){
 const constraints={constraints_hash:'a'.repeat(64),grades:[1,3],minutes_per_session:90,available_resources:['papel','lapiz'],supports:['modelado','pares']};
 const curriculum={snapshot_hash:'b'.repeat(64),pdas:[{pda_id:'p1',grade:1},{pda_id:'p3',grade:3}]};
 const methodology={methodology_decision_id:'m1',selected_id:'proyectos_comunitarios',catalog_version:'METHODOLOGY_CATALOG_V1',required_operations:['IDENTIFICACION','PLANIFICACION','INTEGRACION']};
 const blueprint={schema_version:'PROJECT_BLUEPRINT_V1',blueprint_id:'bp1',revision:2,status:'DRAFT',source:{constraints_hash:constraints.constraints_hash,curriculum_snapshot_hash:curriculum.snapshot_hash,methodology_decision_id:'m1'},methodology:{selected_id:methodology.selected_id,catalog_version:methodology.catalog_version,required_operations:[...methodology.required_operations]},pda_analysis:[{pda_id:'p1'},{pda_id:'p3'}],grade_contributions:[],final_outcome:{functional_requirements:[{requirement_id:'pieces',stage_ids:['planning']},{requirement_id:'mounting',stage_ids:['intervention']}]},project_stages:[{stage_id:'planning',output_artifact_id:'artifact_1'},{stage_id:'intervention',output_artifact_id:'artifact_2'}],session_progression:[{session_number:1,project_state_before:'sin plan',session_project_goal:'planear',required_learning:['identificar'],pda_focus:['p1','p3'],methodology_operations:['IDENTIFICACION','PLANIFICACION'],input_artifact_ids:['input_context'],expected_output_artifact_ids:['artifact_1'],expected_partial_product:'plan',acceptance_criteria:['plan listo'],project_state_after:'plan listo',terminal:false,next_session_dependency:2},{session_number:2,project_state_before:'plan listo',session_project_goal:'montar',required_learning:['integrar'],pda_focus:['p1','p3'],methodology_operations:['INTEGRACION'],input_artifact_ids:['artifact_1'],expected_output_artifact_ids:['artifact_2'],expected_partial_product:'museo',acceptance_criteria:['montado'],project_state_after:'museo listo',terminal:true,next_session_dependency:null}],ltg_strategy:{mode:'NONE',selections:[]}};
 const h=hash(blueprint);const approval={approval_version:'PROJECT_BLUEPRINT_APPROVAL_V1',status:'APPROVED',gate_version:'BLUEPRINT_GATE_V1',blueprint_hash:h,evaluated_blueprint_hash:h,approved_blueprint_hash:h};
 const proposal={authoring_version:'SESSION_GRAPH_AUTHORING_V1',sessions:[
  {session_number:1,activities:[
   {activity_key:'a1',title:'Recuperamos',contribution_mode:'COMPLEMENTARY',contribution_rationale:'prepara el plan',common_student_action:'comparan situaciones',grade_participation:[{grade:1,student_action:'explica',differentiation:'dibuja',pda_mobilization:[{pda_id:'p1',status:'DEVELOPING'}],evidence:'dibujo'},{grade:3,student_action:'indaga',differentiation:'registra',pda_mobilization:[{pda_id:'p3',status:'DEVELOPING'}],evidence:'registro'}],teacher_role:'modela',resources:['papel'],supports:['modelado'],minutes:30,input_refs:['input_context'],output:'hallazgos',contributes_to_artifact_ids:[],methodology_operations:['IDENTIFICACION'],functional_requirement_ids:[],ltg_activity_ids:[],evidence:'registro',assessment_criteria:['distingue situaciones']},
   {activity_key:'a2',title:'Planificamos',contribution_mode:'DIRECT',contribution_rationale:'construye el artefacto',common_student_action:'deciden el plan',grade_participation:[{grade:1,student_action:'propone',differentiation:'elige dibujo',pda_mobilization:[{pda_id:'p1',status:'WORKED'}],evidence:'propuesta'},{grade:3,student_action:'organiza',differentiation:'escribe',pda_mobilization:[{pda_id:'p3',status:'WORKED'}],evidence:'plan'}],teacher_role:'facilita',resources:['papel','lapiz'],supports:['pares'],minutes:45,input_refs:['a1'],output:'plan escrito',contributes_to_artifact_ids:['artifact_1'],methodology_operations:['PLANIFICACION'],functional_requirement_ids:['pieces'],ltg_activity_ids:[],evidence:'plan',assessment_criteria:['plan construido']}
  ]},
  {session_number:2,activities:[
   {activity_key:'b1',title:'Montamos',contribution_mode:'DIRECT',contribution_rationale:'culmina el producto',common_student_action:'integran y montan',grade_participation:[{grade:1,student_action:'explica piezas',differentiation:'apoyo visual',pda_mobilization:[{pda_id:'p1',status:'WORKED'}],evidence:'explicacion'},{grade:3,student_action:'organiza montaje',differentiation:'texto breve',pda_mobilization:[{pda_id:'p3',status:'WORKED'}],evidence:'registro'}],teacher_role:'observa',resources:['papel'],supports:['pares'],minutes:60,input_refs:['artifact_1'],output:'museo montado',contributes_to_artifact_ids:['artifact_2'],methodology_operations:['INTEGRACION'],functional_requirement_ids:['mounting'],ltg_activity_ids:[],evidence:'montaje',assessment_criteria:['producto integrado']}
  ]}
 ]};
 return {constraints,curriculum,methodology,blueprint,approval,proposal};
}

test('compiles immutable graph and deterministic invariants pass',()=>{const f=fixture();const {graph}=compileSessionGraph(f.proposal,f,{graph_id:'g1'});assert.equal(validateCompiledSessionGraph(graph,{...f,graph}),true);assert.equal(graph.source_blueprint.approved_blueprint_hash,f.approval.approved_blueprint_hash);assert.equal(graph.sessions[0].activities[1].input_refs[0],'activity_output_1_1');assert.deepEqual(graph.traceability.methodology.PLANIFICACION,['session_1_activity_2']);});

test('rejects orphan complementary activity',()=>{const f=fixture();f.proposal.sessions[0].activities[1].input_refs=['input_context'];assert.throws(()=>compileSessionGraph(f.proposal,f,{graph_id:'g1'}),/SGD-010/);});

test('rejects complementary activity that claims expected artifact',()=>{const f=fixture();f.proposal.sessions[0].activities[0].contributes_to_artifact_ids=['artifact_1'];assert.throws(()=>compileSessionGraph(f.proposal,f,{graph_id:'g1'}),/COMPLEMENTARY cannot claim artifact|SGD-010/);});

test('rejects foreign PDA grade',()=>{const f=fixture();f.proposal.sessions[0].activities[0].grade_participation[0].pda_mobilization=[{pda_id:'p3',status:'WORKED'}];assert.throws(()=>compileSessionGraph(f.proposal,f,{graph_id:'g1'}),/PDA p3 outside session\/grade|SGD-007/);});

test('authoring preflight rejects functional requirement outside authorized stage',()=>{const f=fixture();f.proposal.sessions[0].activities[1].functional_requirement_ids=['mounting'];assert.throws(()=>validateSessionGraphAuthoring(f.proposal,f),/functional requirement mounting outside authorized stage/);});

test('compiler rejects functional requirement linked outside authorized stage',()=>{const f=fixture();f.proposal.sessions[0].activities[1].functional_requirement_ids=['mounting'];assert.throws(()=>compileSessionGraph(f.proposal,f,{graph_id:'g1'}),/functional requirement mounting outside authorized stage|SGD-012/);});

test('semantic gate binds exact graph and can approve',()=>{const f=fixture();const {graph}=compileSessionGraph(f.proposal,f,{graph_id:'g1'});const input={...f,graph};const semantic={input_hash:sessionSemanticInputHash(input),findings:Object.keys(SGS).map(rule_id=>({rule_id,status:'PASS',scope:'fixture',observed:'ok',expected:SGS[rule_id]}))};const gate=sessionGraphGate(input,semantic);assert.equal(gate.status,'PASS');const approval=approveSessionGraph(input,gate);assert.equal(approval.approved_graph_hash,hash(graph));});

test('gate refuses semantic review bound to another graph',()=>{const f=fixture();const {graph}=compileSessionGraph(f.proposal,f,{graph_id:'g1'});const gate=sessionGraphGate({...f,graph},{input_hash:'wrong',findings:[]});assert.equal(gate.status,'NOT_EVALUABLE');});
