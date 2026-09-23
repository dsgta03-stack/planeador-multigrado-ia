import assert from 'node:assert/strict';
import { applyProjectCoherence } from '../lib/v0124/project-coherence.mjs';

const plan={
  run_id:'11111111-1111-4111-8111-111111111111',
  methodology_engine:{
    methodology_primary:{id:'proyectos_comunitarios',label:'Aprendizaje Basado en Proyectos Comunitarios'},
    integrated_project:{
      title:'Guardianes de nuestra identidad: El legado de los símbolos patrios',
      collective_product_or_service:'Exposición comunitaria de identidad nacional',
      unifying_mission:'Reconocer y valorar los símbolos patrios mediante una exposición comunitaria.',
      grade_contributions:[1,2,3,4,5,6].map(grade=>({grade,contribution:`Aporte de ${grade}.º`,evidence:`Evidencia ${grade}`}))
    },
    sessions:[
      {session_number:1,phase:'Planeación',project_advance:'Definición de roles por grado.',product_relation:'Inicio de bocetos y guiones.',prepares_next:'Organización de materiales.'},
      {session_number:2,phase:'Planeación',project_advance:'Cronograma de actividades.',product_relation:'Asignación de espacios para productos.',prepares_next:'Inicio de elaboración de productos.'},
      {session_number:3,phase:'Acción',project_advance:'Avance del 50% en productos.',product_relation:'Creación de aportes.',prepares_next:'Revisión de avances.'},
      {session_number:4,phase:'Acción',project_advance:'Productos terminados.',product_relation:'Integración final.',prepares_next:'Montaje de la exposición.'},
      {session_number:5,phase:'Intervención',project_advance:'Exposición concluida.',product_relation:'Muestra de todos los productos.',prepares_next:'Reflexión final.'}
    ]
  },
  sessions:[1,2,3,4,5].map(n=>({session_number:n,purpose:`Propósito original ${n}.`,total_minutes:90,common_opening:'Apertura',common_closure:'Cierre',work_moments:[]})),
  teacher_presentation:{sessions:[1,2,3,4,5].map(n=>({session_number:n,phase:'',purpose:`Visible ${n}`,teacher_narrative:'Narrativa',activity_blocks:[],closure_narrative:'Cierre'}))}
};

const {plan:out,status}=applyProjectCoherence(plan);
assert.equal(status,'PASS');
assert.equal(out.project.title,'Guardianes de nuestra identidad: El legado de los símbolos patrios');
assert.equal(out.project.final_product,'Exposición comunitaria de identidad nacional');
assert.equal(out.teacher_presentation.project_title,out.project.title);
assert.equal(out.product_model.type,'ONE_COMMON_PRODUCT_WITH_DIFFERENTIATED_GRADE_CONTRIBUTIONS');
assert.equal(out.project_sequence.length,5);
assert.equal(out.teacher_presentation.sessions.length,5);
for(const s of out.project_sequence){
  assert.ok(s.phase);
  assert.ok(s.project_advance);
  assert.ok(s.partial_product);
  assert.ok(s.prepares_next);
  assert.ok(s.purpose.includes('Exposición comunitaria de identidad nacional'));
}
assert.ok(!out.project_sequence[2].project_advance.includes('50%'),'No debe conservar porcentajes arbitrarios de avance');
assert.equal(out.project_coherence.one_common_product,true);
assert.equal(out.project_coherence.session_progression_explicit,true);
console.log(JSON.stringify({ok:true,tests:12,title:out.project.title,finalProduct:out.project.final_product,sessions:out.project_sequence.length}));
