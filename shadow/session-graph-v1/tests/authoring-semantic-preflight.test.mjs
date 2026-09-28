import test from 'node:test';
import assert from 'node:assert/strict';
import {workedSemanticMissing,methodologySemanticMissing,complementaryConsumerMissing} from '../authoring.mjs';

test('WORKED explain+propose rejects purpose-only proposal language',()=>{
 const official='Explica situaciones cotidianas y propone acuerdos para mejorar la convivencia.';
 const missing=workedSemanticMissing(official,'Explica situaciones cotidianas con la intención de proponer acuerdos que generen una mejor convivencia.');
 assert.ok(missing.includes('PROPONE_LOCAL_ACTION'));
 assert.equal(workedSemanticMissing(official,'Explica una situación cotidiana y propone el acuerdo concreto de escuchar turnos.').includes('PROPONE_LOCAL_ACTION'),false);
});

test('WORKED indagacion requires the source clause to target the official PDA object',()=>{
 const official='Indaga acerca de ideas, conocimientos, prácticas culturales, formas de organización y acuerdos familiares, escolares y comunitarios, y comparte su importancia en la socialización.';
 const adjacent='Consulta fuentes sobre la recepción de los visitantes, compara datos, registra notas y comparte la importancia de los acuerdos escolares.';
 assert.ok(workedSemanticMissing(official,adjacent).includes('INDAGA_OFFICIAL_SCOPE'));
 const local='Consulta a familias sobre sus formas de organización y acuerdos escolares; compara respuestas; registra un cuadro y comparte con el grupo su importancia en la socialización.';
 assert.equal(workedSemanticMissing(official,local).includes('INDAGA_OFFICIAL_SCOPE'),false);
});

test('RECONOCIMIENTO requires observable recognition or review of findings or adjustments',()=>{
 assert.deepEqual(methodologySemanticMissing('RECONOCIMIENTO','Organizan piezas y preparan la ruta.'),['RECONOCIMIENTO_LOCAL_ACTION']);
 assert.deepEqual(methodologySemanticMissing('RECONOCIMIENTO','Comparan el resultado, identifican dificultades y reconocen ajustes necesarios.'),[]);
});
test('RECONOCIMIENTO accepts observable review of quality and improvement details',()=>{
 const repaired='El alumnado revisa el conjunto de piezas producidas, verifica su calidad y concreta el orden. Revisa sus dibujos y piezas creadas. Reconoce detalles de mejora en los textos y organiza la secuencia de exhibición.';
 assert.deepEqual(methodologySemanticMissing('RECONOCIMIENTO',repaired),[]);
 assert.deepEqual(methodologySemanticMissing('RECONOCIMIENTO','Revisa las piezas y concreta el orden para el museo.'),['RECONOCIMIENTO_LOCAL_ACTION']);
});
test('COMPLEMENTARY requires a later same-session consumer',()=>{
 const valid=[
  {activity_key:'a1',contribution_mode:'COMPLEMENTARY',input_refs:[]},
  {activity_key:'a2',contribution_mode:'DIRECT',input_refs:['a1']}
 ];
 assert.equal(complementaryConsumerMissing(valid,0),false);

 const orphan=[
  {activity_key:'a1',contribution_mode:'DIRECT',input_refs:[]},
  {activity_key:'a2',contribution_mode:'COMPLEMENTARY',input_refs:['a1']}
 ];
 assert.equal(complementaryConsumerMissing(orphan,1),true);

 const directTerminal=[
  {activity_key:'a1',contribution_mode:'DIRECT',input_refs:[]}
 ];
 assert.equal(complementaryConsumerMissing(directTerminal,0),false);
});