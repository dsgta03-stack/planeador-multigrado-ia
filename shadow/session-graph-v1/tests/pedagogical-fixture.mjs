import {hash} from '../../project-blueprint-v1/contracts.mjs';
import {sessionFixture} from './session-fixture.mjs';
export function executableSource(){
 const f=sessionFixture();
 f.proposal.sessions[0].activities[0].execution={
  preparation:'El docente divide el papel en inicio, durante las clases y salida para registrar situaciones del aula.',
  instruction:'Pide recordar una situación en la que olvidaron materiales o acuerdos y señalar en qué momento ocurrió.',
  student_steps:['Identifican un caso real de olvido de materiales y describen qué ocurrió.','Comparan dos situaciones y registran la diferencia en el momento correspondiente.'],
  grouping:'En parejas de primero y tercero; cada integrante explica su caso antes del registro común.',
  guidance:['El docente modela el caso de llegar sin material y pregunta: ¿qué acuerdo habría ayudado a evitarlo?'],
  resource_use:[{resource:'papel',use:'Usan las tres columnas del papel para ubicar los casos y comparar los acuerdos.'}],
  contingency:'Si no recuerdan un caso, el docente pide observar los materiales presentes y narra un caso del aula para compararlo.',
  connection:'Conservan los hallazgos registrados para decidir el plan en la siguiente actividad.'
 };
 f.constraints.selected_pda_ids=['p1','p3'];
 f.blueprint.problem_frame={original_problem:'Olvidos de materiales y acuerdos del aula.'};f.blueprint.guiding_question={question:'¿Qué acuerdos ayudan a organizar el aula?'};f.blueprint.final_outcome.name='Museo de acuerdos';f.blueprint.final_outcome.purpose='Explicar acuerdos del aula.';f.blueprint.final_outcome.description='Museo con producciones del grupo sobre sus acuerdos.';f.blueprint.final_outcome.audience_or_beneficiary='El grupo';f.blueprint.final_outcome.use_or_destination='Revisar acuerdos del aula.';
 const bound=hash(f.blueprint);f.approval={...f.approval,blueprint_hash:bound,evaluated_blueprint_hash:bound,approved_blueprint_hash:bound};
 return f;
}
export function ltgFixture(role='OPTIONAL'){
 const f=executableSource();
 f.curriculum.ltg=[{project_id:'ltg1',grade:1,book:'Proyectos de Aula',name:'Acuerdos del aula',pages:{start:10,end:13},verified_pda_links:['p1'],verified_activities:[{activity_id:'ltg-a1',activity_order:1,summary:'Comparar acuerdos',page_start:11,page_end:12,verification_status:'verified'}]}];
 f.blueprint.ltg_strategy={mode:role,selections:[{project_id:'ltg1',role,pda_ids:['p1'],activity_ids:['ltg-a1'],reason:'Compara acuerdos del aula.'}]};
 for(const s of f.proposal.sessions)s.ltg_decisions=[{project_id:'ltg1',decision:'NOT_RECOMMENDED',reason:'El registro propio de situaciones aporta los casos del grupo; no se recomienda sustituirlos por casos del libro en esta sesión.'}];
 const h=hash(f.blueprint);f.approval={...f.approval,blueprint_hash:h,evaluated_blueprint_hash:h,approved_blueprint_hash:h};
 return f;
}
export function useLtg(f){for(const s of f.proposal.sessions){s.ltg_decisions[0].decision='USE';s.ltg_decisions[0].reason='Comparar los acuerdos del libro con los casos registrados.';const a=s.activities[0];a.ltg_activity_ids=['ltg-a1'];a.ltg_use=[{project_id:'ltg1',activity_id:'ltg-a1',student_action:'Leen los acuerdos del libro y comparan un caso con la situación registrada por el grupo.',moment:'Después de registrar el caso del aula.',purpose:'Contrastar acuerdos para explicar una situación y decidir el acuerdo del proyecto.'}];}}

