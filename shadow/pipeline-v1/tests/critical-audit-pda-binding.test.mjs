import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCriticalClaimsInput} from '../critical-audit.mjs';

test('WORKED critical claim carries exact authoritative pda_official text',()=>{
 const official='Indaga acerca de ideas, conocimientos, prácticas culturales, formas de organización y acuerdos familiares, escolares y comunitarios, para compartir su importancia en la socialización.';
 const curriculum={pdas:[{pda_id:'F4-DHC-3-001',grade:3,pda_official:official}]};
 const blueprint={final_outcome:{functional_requirements:[]}};
 const graph={sessions:[{
  session_number:1,
  stage_ids:['investigate'],
  activities:[{
   activity_id:'session_1_activity_1',title:'Indagamos',
   common_student_action:'Consultan y contrastan acuerdos.',
   grade_participation:[{grade:3,student_action:'Consulta, contrasta, registra y comparte la importancia del acuerdo.',evidence:'Registro y explicación.',pda_mobilization:[{pda_id:'F4-DHC-3-001',status:'WORKED'}]}],
   methodology_operations:[],functional_requirement_ids:[],output:'Registro',evidence:'Registro verificable',assessment_criteria:['Incluye fuente, contraste, registro y comunicación.']
  }]
 }]};
 const claims=buildCriticalClaimsInput({blueprint,graph,curriculum});
 assert.equal(claims.worked.length,1);
 assert.equal(claims.worked[0].official_pda,official);
});
