import assert from "node:assert/strict";
import { createMultiplanDocx, docxFilename } from "../lib/v0124/docx-export.mjs";

const sessions=Array.from({length:15},(_,i)=>({session_number:i+1,phase:i<3?"Planeación":i<14?"Acción":"Intervención",purpose:`Propósito de la sesión ${i+1}`,project_advance:`Avance del proyecto en sesión ${i+1}`,partial_product:`Producto parcial ${i+1}`,prepares_next:i===14?"Cierre del proyecto":`Preparar sesión ${i+2}`,teacher_narrative:`Iniciaré la sesión ${i+1} retomando el avance anterior.`,activity_blocks:[{label:"Trabajo multigrado",grades:[1,2,3,4,5,6],narrative:`Actividad diferenciada de la sesión ${i+1}.`}],closure_narrative:`Cerraré la sesión ${i+1} recuperando evidencias.`}));
const plan={grades:[1,2,3,4,5,6],project:{title:"Proyecto de prueba con quince sesiones",final_product:"Producto común de prueba",mission:"Construir un producto común con aportes diferenciados.",grade_contributions:[1,2,3,4,5,6].map(g=>({grade:g,contribution:`Aporte de ${g}.º`,evidence:`Evidencia de ${g}.º`}))},project_sequence:sessions.map(s=>({session_number:s.session_number,phase:s.phase,purpose:s.purpose,project_advance:s.project_advance,partial_product:s.partial_product,prepares_next:s.prepares_next})),teacher_presentation:{project_title:"Proyecto de prueba con quince sesiones",project_final_product:"Producto común de prueba",sessions}};
const buffer=await createMultiplanDocx(plan);
assert.ok(Buffer.isBuffer(buffer),"DOCX export must return a Buffer");
assert.ok(buffer.length>5000,"DOCX buffer should contain a non-trivial document");
assert.equal(buffer.subarray(0,2).toString("ascii"),"PK","DOCX must be a ZIP/OOXML package");
assert.match(docxFilename(plan),/\.docx$/);
console.log(`DOCX_EXPORT_V1_PASS sessions=${sessions.length} bytes=${buffer.length}`);
