import test from 'node:test';
import assert from 'node:assert/strict';
import {repairTargetsFromContext,validateRepairTargets,createSessionGraphDrivers} from '../session-provider.mjs';
import {executableSource} from '../../session-graph-v1/tests/pedagogical-fixture.mjs';
const official='Reflexiona y comparte los problemas y conflictos que se presentan en su comunidad, para proponer alternativas de solución viables.';
const original='Comparte los conflictos identificados en su comunidad y analiza sus causas.';
const complete='Reflexiona sobre el conflicto por el uso de la cancha, comparte las causas identificadas y propone dos alternativas viables: acordar turnos con los vecinos o reservar horarios por equipo usando el calendario disponible.';
function fixture(){
 const proposal={sessions:[{session_number:5,activities:[{activity_key:'s5_act1',grade_participation:[{grade:6,student_action:original,pda_mobilization:[{pda_id:'F5-DHC-6-003',status:'WORKED'}]}]}]}]};
 const source={curriculum:{pdas:[{pda_id:'F5-DHC-6-003',grade:6,pda_official:official}]}};
 const ctx={sources:source,previous_proposal:proposal,compile_error:{code:'SESSION_GRAPH_AUTHORING_INVALID',message:'SESSION_GRAPH_AUTHORING_CONTRACT: $.sessions[5].s5_act1.grade_6: WORKED F5-DHC-6-003 missing PROPONE_LOCAL_ACTION'}};
 return {source,proposal,target:repairTargetsFromContext(ctx)[0]};
}
test('PROPONE target carries exact official text, owned original action and existing satisfied requirements',()=>{
 const {target}=fixture();assert.equal(target.pda_official,official);assert.equal(target.original_student_action,original);
 assert.deepEqual(target.missing_requirements,['PROPONE_LOCAL_ACTION']);assert.deepEqual(target.satisfied_requirements,['SHARE_OR_COMMUNICATE_PURPOSE']);assert.equal(target.status_required,'WORKED');
 assert.match(target.propone_instruction,/alternativas de solucion viables/);assert.match(target.propone_instruction,/NO sustituyen/);
 assert.ok(!('preserved_quotes' in target)); // No literal witness exists in the compile finding; do not invent one.
});
test('changed but insufficient action fails; authentic viable alternatives pass unchanged WORKED authority',()=>{
 const {source,proposal,target}=fixture();proposal.sessions[0].activities[0].grade_participation[0].student_action='Presenta y comparte el analisis de conflictos de su comunidad.';
 assert.throws(()=>validateRepairTargets(proposal,source,[target]),/PROPONE_LOCAL_ACTION/);
 proposal.sessions[0].activities[0].grade_participation[0].student_action=complete;
 assert.equal(validateRepairTargets(proposal,source,[target]),true);
 proposal.sessions[0].activities[0].grade_participation[0].pda_mobilization[0].status='DEVELOPING';
 assert.throws(()=>validateRepairTargets(proposal,source,[target]),/WORKED required/);
});
test('REPAIR transport receives directed target, without relying on evidence or teacher role',async()=>{
 const f=executableSource(),a=f.proposal.sessions[0].activities[0],owner=a.grade_participation.find(g=>g.grade===1);
 f.curriculum.pdas.find(p=>p.pda_id==='p1').pda_official=official;owner.student_action=original;owner.pda_mobilization=[{pda_id:'p1',status:'WORKED'}];
 const repaired=structuredClone(f.proposal);for(const s of repaired.sessions)for(const act of s.activities)for(const g of act.grade_participation)if(g.grade===1)g.student_action=complete;let sent;
 const drivers=createSessionGraphDrivers({endpoint:'https://example.invalid/plan-project-blueprint-v1-shadow',token:'x'.repeat(64),durableEvidence:false,fetchImpl:async(_u,r)=>{sent=JSON.parse(r.body);return new Response(JSON.stringify({output:{status:'PROPOSAL',proposal:repaired}}));}});
 await drivers.sessionRepair({sources:{constraints:f.constraints,curriculum:f.curriculum,methodology:f.methodology},blueprint:f.blueprint,approval:f.approval,previous_proposal:f.proposal,compile_error:{code:'SESSION_GRAPH_AUTHORING_INVALID',message:`SESSION_GRAPH_AUTHORING_CONTRACT: $.sessions[1].${a.activity_key}.grade_1: WORKED p1 missing PROPONE_LOCAL_ACTION`}});
 assert.equal(sent.prompt.repair_targets[0].pda_official,official);assert.equal(sent.prompt.repair_targets[0].original_student_action,original);
});
