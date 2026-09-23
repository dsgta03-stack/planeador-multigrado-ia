import {readFileSync,writeFileSync} from 'node:fs';
import {sources,candidate} from './build.mjs';
import {makeConstraints,sourceBinding} from '../contracts.mjs';
function longCase(id,count){
 let src=sources({method:'abp'}),b=candidate(src);
 src.constraints=makeConstraints({...src.constraints,requested_sessions:count,minutes_per_session:30});b.source=sourceBinding(src);
 const authored=[
 ['listen','Escuchar situaciones que necesitan explicación','Compartir una situación escolar concreta y recoger preguntas','PRESENTEMOS'],
 ['recall','Recuperar experiencias propias','Contrastar recuerdos de acuerdos conocidos sin atribuirles causas todavía','RECOLECTEMOS'],
 ['question','Precisar el problema','Formular una pregunta común acerca de la utilidad de dos acuerdos','FORMULEMOS_PROBLEMA'],
 ['criteria','Organizar la consulta','Definir fuentes escolares accesibles y registro con apoyo visual','ORGANICEMOS_EXPERIENCIA'],
 ['consult','Indagar significados','Consultar al docente y al grupo y registrar versiones de los acuerdos','VIVAMOS_EXPERIENCIA'],
 ['compare','Contrastar las versiones','Comparar las razones obtenidas y reconocer diferencias','VIVAMOS_EXPERIENCIA'],
 ['explain','Fundamentar acuerdos','Construir explicaciones de la relación entre acuerdo, situación y convivencia','VIVAMOS_EXPERIENCIA'],
 ['draft','Construir la propuesta común','Combinar dibujos explicados y registros de consulta en una propuesta de dos acuerdos','VIVAMOS_EXPERIENCIA'],
 ['trial','Probar la propuesta','Aplicar los acuerdos con compañeros del mismo grupo y registrar dificultades','VIVAMOS_EXPERIENCIA'],
 ['revise','Revisar con evidencia','Ajustar la propuesta según los registros de uso y las dudas recibidas','RESULTADOS_ANALISIS'],
 ['share','Comunicar las razones','Explicar a compañeros nuevos la propuesta y contrastar comprensión','RESULTADOS_ANALISIS'],
 ['evaluate','Cerrar y valorar','Conservar propuesta y registro de resultados y explicar qué aprendimos sin anunciar otra sesión','RESULTADOS_ANALISIS'],
 ];
 const five=[
 ['frame','Definir problema con saberes previos','Compartir situaciones, recuperar recuerdos y formular la pregunta común','PRESENTEMOS','RECOLECTEMOS','FORMULEMOS_PROBLEMA'],
 ['organize','Organizar la indagación escolar','Elegir consulta al docente y recuerdos del grupo como fuentes; acordar registros visuales','ORGANICEMOS_EXPERIENCIA'],
 ['inquire','Construir explicaciones compartidas','Consultar, registrar y comparar razones de los acuerdos; combinar dibujos explicados y registros','VIVAMOS_EXPERIENCIA'],
 ['trial','Probar acuerdos fundamentados','Aplicar la propuesta en el grupo y registrar dificultades para revisarla','VIVAMOS_EXPERIENCIA'],
 ['close','Valorar y comunicar','Revisar la propuesta con evidencia, compartirla con compañeros nuevos y conservar el resultado final','RESULTADOS_ANALISIS'],
 ];
 const selected=count===5?five:authored;
 b.project_stages=selected.map(([stage_id,purpose,student_operation,...methodology_operations],i)=>({stage_id,order:i+1,purpose,required_inputs:i?['artifact_'+selected[i-1][0]]:['input_context','input_curriculum'],student_operation,methodology_operations,expected_output:'Registro observable de '+purpose.toLowerCase(),output_artifact_id:'artifact_'+stage_id,consumed_by:i===selected.length-1?['outcome_01']:[selected[i+1][0]],acceptance_criteria:['El registro muestra '+student_operation.toLowerCase()],estimated_minutes:20,estimate_rationale:'Dos acuerdos conocidos; apoyo visual, consulta breve y pocos materiales'}));
 b.session_progression=b.project_stages.map((s,i)=>({session_number:i+1,project_state_before:i?b.project_stages[i-1].expected_output:'Problema contextual disponible',session_project_goal:s.purpose,required_learning:['Indagar y explicar sentido de acuerdos'],methodology_operations:s.methodology_operations,pda_focus:src.constraints.selected_pda_ids,input_artifact_ids:s.required_inputs,expected_output_artifact_ids:[s.output_artifact_id],expected_partial_product:s.expected_output,acceptance_criteria:s.acceptance_criteria,project_state_after:s.expected_output,next_session_dependency:i===count-1?null:i+2,terminal:i===count-1}));
 b.final_outcome.functional_requirements[0].stage_ids=count===5?['inquire','trial','close']:['explain','trial','evaluate'];
 b.feasibility={...b.feasibility,requested_sessions:count,minutes_per_session:30,total_available_minutes:count*30};
 return {fixture_version:'BLUEPRINT_FIXTURES_V1',id,description:'Secuencia arquitectónica escrita por propósito, sin repartir fases por índice',expected:{pass:true},input:{...src,blueprint:b}};
}
for(const f of [longCase('PB-021-CINCO-SESIONES',5),longCase('PB-022-MAS-SESIONES-QUE-OPERACIONES',12)])writeFileSync(new URL(`./${f.id}.json`,import.meta.url),JSON.stringify(f,null,2)+'\n');
