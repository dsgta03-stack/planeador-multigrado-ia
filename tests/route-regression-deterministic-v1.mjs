import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const suites = [
  { file: "route-regression-matrix-v1.mjs", covers: ["MATRIX-SCHEMA"] },
  { file: "route-deterministic-invariants-v1.mjs", covers: ["RTE-012-STRUCTURAL", "RTE-013", "RTE-020-STRUCTURAL"] },
  { file: "history-fidelity-v1.mjs", covers: ["RTE-015"] },
  { file: "review-cache-fidelity-v1.mjs", covers: ["RTE-016", "RTE-017"] },
  { file: "docx-export-v1.mjs", covers: ["RTE-018"] },
  { file: "review-stale-ui-v1.mjs", covers: ["RTE-019-STATIC"] },
  { file: "project-coherence-v1.mjs", covers: ["RTE-020-STRUCTURAL"] },
  { file: "full-cycle-fidelity-v1.mjs", covers: ["RTE-015", "RTE-016", "RTE-017", "RTE-018"] },
];

const results = [];
for (const suite of suites) {
  const run = spawnSync(process.execPath, [join(here, suite.file)], {
    encoding: "utf8",
    env: { ...process.env, MULTIPLAN_ROUTE_REGRESSION: "deterministic-v1" },
  });
  results.push({
    file: suite.file,
    status: run.status,
    covers: suite.covers,
    stdout: String(run.stdout || "").trim().slice(-1000),
    stderr: String(run.stderr || "").trim().slice(-1000),
  });
  assert.equal(run.status, 0, `${suite.file} falló:\n${run.stderr || run.stdout}`);
}

const covered = new Set(results.flatMap(result => result.covers));
for (const required of ["RTE-012-STRUCTURAL", "RTE-013", "RTE-015", "RTE-016", "RTE-017", "RTE-018", "RTE-019-STATIC", "RTE-020-STRUCTURAL"]) {
  assert.ok(covered.has(required), `Falta cobertura determinista declarada para ${required}`);
}

console.log(JSON.stringify({
  ok: true,
  suite: "ROUTE-REGRESSION-DETERMINISTIC-V1",
  child_suites: results.length,
  covered: [...covered].sort(),
  results: results.map(({ file, status, covers }) => ({ file, status, covers })),
}, null, 2));
