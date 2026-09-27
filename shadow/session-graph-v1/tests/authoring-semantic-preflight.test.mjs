import test from 'node:test';
import assert from 'node:assert/strict';
import {workedSemanticMissing,methodologySemanticMissing} from '../authoring.mjs';

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
