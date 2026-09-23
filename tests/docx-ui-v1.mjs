import assert from 'node:assert/strict';
import { DOCX_EXPORT_UI } from '../lib/v0124/docx-export-ui.mjs';

assert.ok(DOCX_EXPORT_UI.includes('Descargar Word (.docx)'),'Debe incluir el botón Word');
assert.ok(DOCX_EXPORT_UI.includes('PREVIEW v0.12.4 · DOCX V1'),'Debe incluir la marca visible de preview');
const scripts=[...DOCX_EXPORT_UI.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
assert.ok(scripts.length>=1,'Debe incluir JavaScript de navegador');
for(const code of scripts)new Function(code);
console.log(JSON.stringify({ok:true,tests:4,docxUi:'EXPORT-DOCX-V1'}));
