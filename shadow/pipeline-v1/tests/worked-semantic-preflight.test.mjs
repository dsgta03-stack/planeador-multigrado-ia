import test from 'node:test';
import assert from 'node:assert/strict';
import {workedSemanticMissing} from '../../session-graph-v1/authoring.mjs';

const explainPda='Explica situaciones cotidianas que se presentan en la escuela y la casa, con la intención de proponer acuerdos que generen una mejor convivencia.';
const inquirePda='Indaga acerca de ideas, conocimientos, prácticas culturales, formas de organización y acuerdos familiares, escolares y comunitarios, para compartir su importancia en la socialización.';

test('WORKED preflight accepts explicit explain plus propose',()=>{
 const missing=workedSemanticMissing(explainPda,'Explica una situación concreta del recreo y propone el acuerdo de esperar turno para usar el material.');
 assert.deepEqual(missing,[]);
});

test('WORKED preflight rejects nominal indaga/share language without source and trace',()=>{
 const missing=workedSemanticMissing(inquirePda,'Indaga formas de organización comunitaria y define con el grupo un criterio, compartiendo su importancia.');
 assert.ok(missing.includes('INDAGA_SOURCE_OR_OBSERVATION'));
 assert.ok(missing.includes('INDAGA_TRACEABLE_RECORD'));
});

test('WORKED preflight accepts an observable indagation cycle with socialization',()=>{
 const missing=workedSemanticMissing(inquirePda,'Consulta al docente y revisa notas previas sobre dos acuerdos; compara sus razones, registra las coincidencias en una ficha y explica al grupo por qué son importantes para convivir.');
 assert.deepEqual(missing,[]);
});
