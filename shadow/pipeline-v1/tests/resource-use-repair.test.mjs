import test from 'node:test';
import assert from 'node:assert/strict';
import {executableSource} from '../../session-graph-v1/tests/pedagogical-fixture.mjs';
import {validateSessionGraphAuthoring} from '../../session-graph-v1/authoring.mjs';
import {repairTargetsFromContext,validateRepairTargets} from '../session-provider.mjs';
const setup=()=>{
 const f=executableSource(),a=f.proposal.sessions[0].activities[0];a.resources=['papel','lapiz'];a.execution.resource_use=[];
 const targets=()=>repairTargetsFromContext({previous_proposal:f.proposal,compile_error:{code:'SESSION_GRAPH_AUTHORING_INVALID',message:`SESSION_GRAPH_AUTHORING_CONTRACT: $.sessions[0].${a.activity_key}: SGD-017 teacher executability missing execution.missing_resource_use`}});
 return {f,a,targets};
};
for(const covered of [[],['papel'],['Papel'],['papel ']])test('resource target literal correspondence '+JSON.stringify(covered),()=>{
 const {f,a,targets}=setup();a.execution.resource_use=covered.map(resource=>({resource,use:'Usan este material para registrar sus hallazgos.'}));
 const t=targets()[0];assert.equal(t.session,1);assert.equal(t.activity_key,a.activity_key);assert.equal(t.field,'execution.resource_use');
 assert.deepEqual(t.declared_resources,['papel','lapiz']);assert.deepEqual(t.covered_resources,covered);assert.deepEqual(t.missing_resources,['papel','lapiz'].filter(r=>!covered.includes(r)));
 assert.match(t.required,/NO un campo/);assert.throws(()=>validateRepairTargets(f.proposal,f,[t]),e=>e.repair_target_diagnostics[0].field==='execution.resource_use');
});
test('single resource target and exact repair preserve all other activity fields',()=>{
 const {f,a,targets}=setup();a.resources=['papel'];const ts=targets(),before=structuredClone(a);
 assert.deepEqual(ts[0].missing_resources,['papel']);a.execution.resource_use=[{resource:'papel',use:'Usan el papel para registrar los casos y comparar sus acuerdos.'}];
 assert.equal(validateRepairTargets(f.proposal,f,ts),true);assert.equal(validateSessionGraphAuthoring(f.proposal,f),true);
 before.execution.resource_use=a.execution.resource_use;assert.deepEqual(a,before);
});
for(const mode of ['generic','foreign','fake-field','deleted','partial'])test('invalid resource repair '+mode,()=>{
 const {f,a,targets}=setup(),ts=targets();
 a.execution.resource_use=[{resource:'papel',use:'Usan el papel para registrar los casos.'},{resource:'lapiz',use:'Escriben con el lapiz sus conclusiones.'}];
 if(mode==='generic')a.execution.resource_use[0].use='observa';
 if(mode==='foreign')a.execution.resource_use[0].resource='carton';
 if(mode==='fake-field')a.execution.missing_resource_use='Inventado';
 if(mode==='deleted'){a.resources=['papel'];a.execution.resource_use.pop();}
 if(mode==='partial')a.execution.resource_use.pop();
 if(mode!=='fake-field')assert.throws(()=>validateRepairTargets(f.proposal,f,ts),/SESSION_GRAPH_REPAIR_TARGET/);
 if(mode!=='deleted')assert.throws(()=>validateSessionGraphAuthoring(f.proposal,f),/SESSION_GRAPH_AUTHORING_CONTRACT/);
});
