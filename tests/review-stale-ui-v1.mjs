import assert from "node:assert/strict";
import { V0124_UI } from "../lib/v0124/ui.mjs";

assert.ok(V0124_UI.includes("function signature()"), "RTE-019: debe existir firma de insumos/plan");
assert.ok(V0124_UI.includes("function stale()"), "RTE-019: debe existir estado visual de revisión desactualizada");
assert.ok(V0124_UI.includes("function invalidate()"), "RTE-019: debe existir invalidación de revisión");
assert.ok(V0124_UI.includes("signature()!==sig"), "RTE-019: la revisión debe compararse contra la firma vigente");
assert.ok(V0124_UI.includes("s.pedagogicalReview=null;stale()"), "RTE-019: una firma distinta debe borrar la revisión vigente y marcar STALE");
assert.ok(V0124_UI.includes("document.addEventListener('input',invalidate,true)"), "RTE-019: cambios de entrada deben invalidar");
assert.ok(V0124_UI.includes("document.addEventListener('change',invalidate,true)"), "RTE-019: cambios de selección deben invalidar");
assert.ok(V0124_UI.includes("setInterval(()=>{"), "RTE-019: debe existir comprobación de cambios no capturados por eventos");
assert.ok(V0124_UI.includes("invalidate();visible();renderProject()"), "RTE-019: el chequeo periódico debe reevaluar vigencia");
assert.ok(V0124_UI.includes("Revisión desactualizada"), "RTE-019: la UI debe comunicar explícitamente el estado STALE");
assert.ok(V0124_UI.includes("Ejecuta de nuevo la revisión"), "RTE-019: la UI debe pedir una nueva revisión");

const scripts = [...V0124_UI.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
assert.ok(scripts.length >= 1, "RTE-019: V0124_UI debe contener JavaScript ejecutable");
for (const code of scripts) new Function(code);

console.log(JSON.stringify({
  ok: true,
  suite: "REVIEW-STALE-UI-V1",
  assertions: 13,
  scenario: "RTE-019-STATIC",
}));
