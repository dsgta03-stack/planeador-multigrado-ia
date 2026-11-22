import test from "node:test";
import assert from "node:assert/strict";
import { LEGACY_LAYERS, REQUIRED_GUARANTEES, TARGET_RUNTIME } from "../lib/consolidation-r1/legacy-layer-manifest.mjs";

test("consolidation manifest has unique layer ids/files", () => {
  assert.equal(new Set(LEGACY_LAYERS.map(x => x.id)).size, LEGACY_LAYERS.length);
  assert.equal(new Set(LEGACY_LAYERS.map(x => x.file)).size, LEGACY_LAYERS.length);
});

test("exactly one legacy layer is the visual authority to extract", () => {
  const ui = LEGACY_LAYERS.filter(x => x.capability === "UI_AUTHORITY");
  assert.equal(ui.length, 1);
  assert.equal(ui[0].disposition, "EXTRACT_ASSET");
});

test("critical guarantees are explicitly retained", () => {
  for (const guarantee of [
    "TEACHER_PDA_AUTHORITY","GRADE_LOCK","TRANSVERSAL_LOCK","ZERO_PDA",
    "PROJECT_BLUEPRINT","SESSION_GRAPH","TEACHER_PLAN_PROJECTION","CANONICAL_PLAN_HASH",
    "OWNER_SCOPED_HISTORY","FINAL_SNAPSHOT","PEDAGOGICAL_REVIEW_HASH_BINDING",
    "DOCX_HASH_BINDING","AUTH","VISUAL_PARITY","FAIL_CLOSED_BEFORE_PROVIDER"
  ]) assert.ok(REQUIRED_GUARANTEES.includes(guarantee), guarantee);
});

test("target runtime forbids the wrapper architecture", () => {
  assert.deepEqual(TARGET_RUNTIME, {
    process_count: 1,
    http_server_count: 1,
    ui_authority_count: 1,
    spawn_legacy_servers: false,
    canonical_plan_instances_per_run: 1,
  });
});
