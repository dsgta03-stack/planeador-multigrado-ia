import test from "node:test";
import assert from "node:assert/strict";
import { CONSOLIDATED_UI_HTML, CONSOLIDATED_UI_VERSION } from "../lib/consolidation-r1/ui/assembled-ui.mjs";

test("single UI authority builds without a legacy HTTP source", () => {
  assert.equal(CONSOLIDATED_UI_VERSION, "SINGLE_UI_AUTHORITY_R1");
  assert.match(CONSOLIDATED_UI_HTML, /<!doctype html>/i);
  assert.doesNotMatch(CONSOLIDATED_UI_HTML, /planeador-multigrado-ia-v084b-production\.up\.railway\.app/i);
});

test("approved professional shell and consolidated capabilities are present once", () => {
  for (const marker of [
    'id="mp-ui-beta"',
    'id="mp-ui-beta-script"',
    'id="mp-methodology-style"',
    'id="mp-teacher-style"',
    'id="mp-official-seq-style"',
    'id="mp-history-style"',
    'id="mp-workflow-v0123-style"',
    'id="mp-v0124-consolidated-style"'
  ]) {
    assert.equal(CONSOLIDATED_UI_HTML.split(marker).length - 1, 1, marker);
  }
});

test("auth, workflow, history, review and docx controls survive UI collapse", () => {
  for (const token of [
    "multiplan.auth.v1",
    "mpWorkflowV0123",
    "mpHistoryNav",
    "mpPedagogicalReview",
    "mpReviewRun",
    "mpDocxDownload"
  ]) assert.ok(CONSOLIDATED_UI_HTML.includes(token), token);
});

test("methodology observer freeze fix is compiled into the single UI", () => {
  assert.ok(CONSOLIDATED_UI_HTML.includes("const observer=new MutationObserver"));
  assert.ok(!CONSOLIDATED_UI_HTML.includes("new MutationObserver(update).observe(document.documentElement,{childList:true,subtree:true});setTimeout(update,300)"));
});
