import {sessionFixture as fixture} from './session-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from '../../project-blueprint-v1/contracts.mjs';
import {compileSessionGraph,validateCompiledSessionGraph} from '../session-graph.mjs';
import {validateSessionGraphAuthoring} from '../authoring.mjs';
import {sessionGraphGate,approveSessionGraph,sessionSemanticInputHash} from '../gate.mjs';
import {SGS} from '../catalog.mjs';



test('compiles immutable graph and deterministic invariants pass',()=>{const f=fixture();const {graph}=compileSessionGraph(f.proposal,f,{graph_id:'g1'});assert.equal(validateCompiledSessionGraph(graph,{...f,graph}),true);assert.equal(graph.source_blueprint.approved_blueprint_hash,f.approval.approved_blueprint_hash);assert.equal(graph.sessions[0].activities[1].input_refs[0],'activity_output_1_1');assert.deepEqual(graph.traceability.methodology.PLANIFICACION,['session_1_activity_2']);});

test('rejects orphan complementary activity',()=>{const f=fixture();f.proposal.sessions[0].activities[1].input_refs=['input_context'];assert.throws(()=>compileSessionGraph(f.proposal,f,{graph_id:'g1'}),/SGD-010/);});

test('rejects complementary activity that claims expected artifact',()=>{const f=fixture();f.proposal.sessions[0].activities[0].contributes_to_artifact_ids=['artifact_1'];assert.throws(()=>compileSessionGraph(f.proposal,f,{graph_id:'g1'}),/COMPLEMENTARY cannot claim artifact|SGD-010/);});

test('rejects foreign PDA grade',()=>{const f=fixture();f.proposal.sessions[0].activities[0].grade_participation[0].pda_mobilization=[{pda_id:'p3',status:'WORKED'}];assert.throws(()=>compileSessionGraph(f.proposal,f,{graph_id:'g1'}),/PDA p3 outside session\/grade|SGD-007/);});

test('authoring preflight rejects functional requirement outside authorized stage',()=>{const f=fixture();f.proposal.sessions[0].activities[1].functional_requirement_ids=['mounting'];assert.throws(()=>validateSessionGraphAuthoring(f.proposal,f),/functional requirement mounting outside authorized stage/);});

test('compiler rejects functional requirement linked outside authorized stage',()=>{const f=fixture();f.proposal.sessions[0].activities[1].functional_requirement_ids=['mounting'];assert.throws(()=>compileSessionGraph(f.proposal,f,{graph_id:'g1'}),/functional requirement mounting outside authorized stage|SGD-012/);});

test('semantic gate binds exact graph and can approve',()=>{const f=fixture();const {graph}=compileSessionGraph(f.proposal,f,{graph_id:'g1'});const input={...f,graph};const semantic={input_hash:sessionSemanticInputHash(input),findings:Object.keys(SGS).map(rule_id=>({rule_id,status:'PASS',scope:'fixture',observed:'ok',expected:SGS[rule_id]}))};const gate=sessionGraphGate(input,semantic);assert.equal(gate.status,'PASS');const approval=approveSessionGraph(input,gate);assert.equal(approval.approved_graph_hash,hash(graph));});

test('gate refuses semantic review bound to another graph',()=>{const f=fixture();const {graph}=compileSessionGraph(f.proposal,f,{graph_id:'g1'});const gate=sessionGraphGate({...f,graph},{input_hash:'wrong',findings:[]});assert.equal(gate.status,'NOT_EVALUABLE');});
