import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeLegacyPlanRequest,buildPipelineSourceArtifacts} from '../legacy-request-adapter.mjs';
import {assertContract} from '../../project-blueprint-v1/contracts.mjs';

function legacyBody(){return {
 grados:[1,3],
 pdas:[
  {pda_id:'p1',grade:1,field:'legacy field 1',content:'legacy content 1',pda:'legacy pda text 1'},
  {pda_id:'p3',grade:3,field:'legacy field 3',content:'legacy content 3',pda:'legacy pda text 3'}
 ],
 contexto:'Escuela multigrado en contexto rural.',
 situacion_problema:'Necesitamos mejorar la convivencia y explicar los acuerdos.',
 sesiones:3,
 minutos:90,
 recursos:'papel, lápices, patio techado',
 methodology_selection:'proyectos_comunitarios',
 methodology_recommendation:{recommended_id:'proyectos_comunitarios',reason:'ajuste al contexto'}
};}
function explicitTeacherConstraints(){return {
 students_by_grade:{1:'8',3:6},
 reading_profile:'1.º con lectura inicial; 3.º con lectura funcional.',
 writing_profile:'1.º escritura emergente; 3.º redacta textos breves.',
 autonomy_profile:'Autonomía diferenciada con apoyo entre pares.',
 connectivity:'Sin internet estable durante la clase.',
 available_resources:['papel reutilizado','lápices','patio techado'],
 supports:['modelado docente','apoyo entre pares'],
 teacher_explicit_constraints:['No requerir dispositivos ni participación externa.']
};}
function authoritativePdas(){return [
 {pda_id:'p1',grade:1,field:'De lo humano y lo comunitario',content_official:'Contenido oficial uno',pda_official:'PDA OFICIAL UNO',verification_status:'VERIFIED'},
 {pda_id:'p3',grade:3,field:'De lo humano y lo comunitario',content_official:'Contenido oficial tres',pda_official:'PDA OFICIAL TRES',verification_status:'VERIFIED'}
];}

test('current legacy request fails closed instead of inventing missing TeacherConstraints',()=>{
 const result=analyzeLegacyPlanRequest(legacyBody());
 assert.equal(result.status,'NEEDS_TEACHER_INPUT');
 assert.deepEqual(result.missing_teacher_fields,['students_by_grade','reading_profile','writing_profile','autonomy_profile','connectivity','available_resources','supports','teacher_explicit_constraints']);
 assert.equal(result.normalized.legacy_resource_text,'papel, lápices, patio techado');
 assert.equal(result.normalized.teacher_constraints.available_resources,null);
 assert.throws(()=>buildPipelineSourceArtifacts(result,{curriculum_pdas:authoritativePdas(),ltg:[],corpus_version_or_provenance:'test'}),/NOT_READY_FOR_SOURCE_BUILD/);
});

test('legacy free-text recursos is preserved as evidence but never promoted to authorized resources',()=>{
 const body=legacyBody();body.teacher_constraints={...explicitTeacherConstraints(),available_resources:['cuadernos']};
 const result=analyzeLegacyPlanRequest(body);
 assert.equal(result.status,'READY_FOR_CURRICULUM_RESOLUTION');
 assert.deepEqual(result.normalized.teacher_constraints.available_resources,['cuadernos']);
 assert.equal(result.normalized.legacy_resource_text,'papel, lápices, patio techado');
});

test('complete explicit teacher constraints become source artifacts only after authoritative curriculum resolution',()=>{
 const body=legacyBody();body.teacher_constraints=explicitTeacherConstraints();
 const analysis=analyzeLegacyPlanRequest(body);
 assert.equal(analysis.status,'READY_FOR_CURRICULUM_RESOLUTION');
 assert.deepEqual(analysis.normalized.teacher_constraints.students_by_grade,{'1':8,'3':6});
 const built=buildPipelineSourceArtifacts(analysis,{curriculum_pdas:authoritativePdas(),ltg:[],corpus_version_or_provenance:'curriculum-db:test-v1'});
 assert.equal(built.status,'READY_FOR_PIPELINE');
 assert.equal(assertContract('TeacherConstraintsV1',built.sources.constraints),built.sources.constraints);
 assert.equal(assertContract('CurriculumSnapshotV1',built.sources.curriculum),built.sources.curriculum);
 assert.equal(assertContract('MethodologyDecisionV1',built.sources.methodology),built.sources.methodology);
 assert.equal(built.sources.curriculum.pdas[0].pda_official,'PDA OFICIAL UNO');
 assert.notEqual(built.sources.curriculum.pdas[0].pda_official,body.pdas[0].pda);
 assert.equal(built.sources.methodology.selection_source,'TEACHER_ACCEPTED_RECOMMENDATION');
 assert.match(built.sources.constraints.constraints_hash,/^[a-f0-9]{64}$/);
 assert.match(built.sources.curriculum.snapshot_hash,/^[a-f0-9]{64}$/);
});

test('teacher choice different from recommendation remains authoritative TEACHER selection',()=>{
 const body=legacyBody();body.teacher_constraints=explicitTeacherConstraints();body.methodology_recommendation={recommended_id:'abp'};
 const analysis=analyzeLegacyPlanRequest(body);
 assert.equal(analysis.normalized.methodology.selected_id,'proyectos_comunitarios');
 assert.equal(analysis.normalized.methodology.recommended_id,'abp');
 assert.equal(analysis.normalized.methodology.selection_source,'TEACHER');
});

test('authoritative curriculum grade mismatch is rejected even when legacy hint claims the selected grade',()=>{
 const body=legacyBody();body.teacher_constraints=explicitTeacherConstraints();const analysis=analyzeLegacyPlanRequest(body);
 const rows=authoritativePdas();rows[1]={...rows[1],grade:2};
 assert.throws(()=>buildPipelineSourceArtifacts(analysis,{curriculum_pdas:rows,ltg:[],corpus_version_or_provenance:'db'}),/GRADE_MISMATCH:p3/);
});

test('missing authoritative PDA blocks Pipeline source construction',()=>{
 const body=legacyBody();body.teacher_constraints=explicitTeacherConstraints();const analysis=analyzeLegacyPlanRequest(body);
 assert.throws(()=>buildPipelineSourceArtifacts(analysis,{curriculum_pdas:authoritativePdas().slice(0,1),ltg:[],corpus_version_or_provenance:'db'}),/AUTHORITATIVE_CURRICULUM_MISSING:p3/);
});

test('foreign PDA rows from retrieval are not imported into the immutable snapshot',()=>{
 const body=legacyBody();body.teacher_constraints=explicitTeacherConstraints();const analysis=analyzeLegacyPlanRequest(body);
 const rows=[...authoritativePdas(),{pda_id:'foreign',grade:6,field:'X',content_official:'X',pda_official:'X',verification_status:'VERIFIED'}];
 const built=buildPipelineSourceArtifacts(analysis,{curriculum_pdas:rows,ltg:[],corpus_version_or_provenance:'db'});
 assert.deepEqual(built.sources.curriculum.pdas.map(x=>x.pda_id),['p1','p3']);
});
