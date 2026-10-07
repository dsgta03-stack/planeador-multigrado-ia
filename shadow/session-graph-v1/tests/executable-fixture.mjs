// Local synthetic classroom instructions. Never imported by runtime code.
export function executableFixture(proposal){
 for(const session of proposal.sessions)for(const a of session.activities){
  a.execution={
   preparation:'El docente coloca el papel disponible frente al grupo y dispone las producciones anteriores para compararlas.',
   instruction:`Pide al grupo realizar ${a.common_student_action} y mostrar el resultado: ${a.output}.`,
   student_steps:[`Comparan las situaciones de convivencia mencionadas en el grupo para ${a.common_student_action}.`,`Registran en el papel el resultado de su decisión: ${a.output}.`],
   grouping:'En parejas de grados distintos, con un turno de explicación por alumno.',
   guidance:['El docente pregunta: ¿qué situación de convivencia permite explicar tu registro y qué acuerdo propones?'],
   resource_use:a.resources.map(resource=>({resource,use:'Usan este recurso para registrar las situaciones y explicar el acuerdo seleccionado.'})),
   contingency:'Si no logran registrar una situación, el docente pide describir oralmente un ejemplo del aula y ofrece el modelado autorizado.',
   connection:`Conservan ${a.output} para compararlo con el resultado siguiente o revisar al cierre el acuerdo logrado.`
  };
  // Expand only synthetic roles/actions; keep curriculum claims, output and IDs.
  if(['modela','facilita','observa'].includes(a.teacher_role))a.teacher_role='El docente modela una situación de convivencia, pide explicar el acuerdo elegido y revisa el registro de cada pareja.';
  if(a.common_student_action==='comparan situaciones')a.common_student_action='Comparan situaciones de convivencia del aula y registran la diferencia entre los acuerdos.';
  for(const g of a.grade_participation){
   if(['explica','indaga','propone','organiza'].includes(g.student_action))g.student_action=g.grade===1?'Explica con un dibujo una situación del aula y propone un acuerdo de escucha.':'Consulta los registros de situaciones del aula, compara los acuerdos y escribe una propuesta.';
   if(['dibuja','registra','escribe'].includes(g.differentiation))g.differentiation=g.grade===1?'Dibujo y explicación oral de una situación del aula.':'Registro escrito y comparación de dos acuerdos del aula.';
  }
  a.ltg_use=[];
 }
 return proposal;
}
