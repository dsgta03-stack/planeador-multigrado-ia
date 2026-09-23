import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const matrix = JSON.parse(
  await readFile(new URL("./route-regression-matrix-v1.json", import.meta.url), "utf8"),
);

assert.equal(matrix.schema_version, "MULTIPLAN-ROUTE-REGRESSION-MATRIX-V1");
assert.equal(matrix.scope, "preview-only");
assert.equal(matrix.production_modified, false);
assert.ok(Array.isArray(matrix.global_invariants));
assert.ok(matrix.global_invariants.length >= 10, "La matriz debe conservar los invariantes globales críticos");
assert.ok(Array.isArray(matrix.scenarios));
assert.ok(matrix.scenarios.length >= 20, "La V1 debe contener al menos los 20 escenarios base");

const ids = matrix.scenarios.map(s => s.id);
assert.equal(new Set(ids).size, ids.length, "No debe haber IDs de escenario duplicados");
for (let i = 1; i <= 20; i++) {
  const id = `RTE-${String(i).padStart(3, "0")}`;
  assert.ok(ids.includes(id), `Falta el escenario obligatorio ${id}`);
}

const requiredCategories = [
  "auth",
  "single-grade",
  "multigrade",
  "zero-pda",
  "mixed-pda",
  "transversal-lock",
  "methodology",
  "engine-routing",
  "session-count",
  "time",
  "fidelity",
  "review",
  "export",
  "workflow-ui",
  "project-coherence",
];
const categories = new Set(matrix.scenarios.map(s => s.category));
for (const category of requiredCategories) {
  assert.ok(categories.has(category), `La matriz no cubre la categoría ${category}`);
}

const requiredAutomationModes = [
  "live",
  "semantic-live",
  "fault-injection",
  "live-stress",
  "deterministic",
  "browser",
  "deterministic+semantic",
];
const automationModes = new Set(matrix.scenarios.map(s => s.automation));
for (const mode of requiredAutomationModes) {
  assert.ok(automationModes.has(mode), `Falta al menos un escenario de tipo ${mode}`);
}

for (const scenario of matrix.scenarios) {
  assert.match(scenario.id, /^RTE-\d{3}$/);
  assert.ok(String(scenario.name || "").trim().length >= 5, `${scenario.id}: name inválido`);
  assert.ok(String(scenario.category || "").trim(), `${scenario.id}: category requerida`);
  assert.ok(String(scenario.input_shape || "").trim(), `${scenario.id}: input_shape requerido`);
  assert.ok(String(scenario.expected_route || "").trim(), `${scenario.id}: expected_route requerido`);
  assert.ok(Array.isArray(scenario.must_preserve) && scenario.must_preserve.length > 0, `${scenario.id}: must_preserve requerido`);
  assert.ok(Array.isArray(scenario.pass_if) && scenario.pass_if.length > 0, `${scenario.id}: pass_if requerido`);
  assert.ok(String(scenario.automation || "").trim(), `${scenario.id}: automation requerido`);
}

const byId = new Map(matrix.scenarios.map(s => [s.id, s]));
assert.equal(byId.get("RTE-001").category, "auth");
assert.equal(byId.get("RTE-004").category, "zero-pda");
assert.equal(byId.get("RTE-006").category, "transversal-lock");
assert.equal(byId.get("RTE-008").category, "engine-routing");
assert.equal(byId.get("RTE-009").automation, "fault-injection");
assert.equal(byId.get("RTE-012").automation, "live-stress");
assert.equal(byId.get("RTE-015").category, "fidelity");
assert.equal(byId.get("RTE-018").category, "export");
assert.equal(byId.get("RTE-020").category, "project-coherence");

console.log(JSON.stringify({
  ok: true,
  schema: matrix.schema_version,
  scenarios: matrix.scenarios.length,
  categories: [...categories].sort(),
  automationModes: [...automationModes].sort(),
}));
