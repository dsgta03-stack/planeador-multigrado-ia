import { BASE_V084_HTML } from "./base-v084.mjs";
import { applyV084bUi } from "./v084b-ui.mjs";
import { applyV084cUi } from "./v084c-ui.mjs";
import { authInjection } from "./auth-ui.mjs";
import { professionalStyle, professionalScript } from "./professional-ui.mjs";
import { RESULT_GUARD } from "./result-guard-ui.mjs";
import { METHODOLOGY_RECOMMENDATION_UI } from "./methodology-recommendation-ui.mjs";
import { TEACHER_PRESENTATION_UI } from "./teacher-presentation-ui.mjs";
import { OFFICIAL_SEQUENCE_UI } from "./official-sequence-ui.mjs";
import { HISTORY_UI } from "./history-ui.mjs";
import { patchMethodologyObserver } from "./methodology-freeze-fix.mjs";
import { WORKFLOW_UI } from "./workflow-ui.mjs";
import { V0124_UI } from "../../v0124/ui.mjs";
import { DOCX_EXPORT_UI } from "../../v0124/docx-export-ui.mjs";

export const CONSOLIDATED_UI_VERSION = "SINGLE_UI_AUTHORITY_R1";

function beforeBody(html, fragment) {
  if (!html.includes("</body>")) throw Error("CONSOLIDATED_UI_BODY_REQUIRED");
  return html.replace("</body>", fragment + "</body>");
}

export function buildConsolidatedUi() {
  let html = BASE_V084_HTML;

  // v0.8.4b + v0.8.4c are replayed from source control instead of fetching
  // another Railway service at runtime.
  html = applyV084bUi(html);
  html = applyV084cUi(html);

  // v0.8.5 auth behavior, formerly a gateway process.
  html = html.replaceAll("Demo V0.8.4c · planeación multigrado contextual", "Multiplan · motor V6.2 trazable");
  html = beforeBody(html, authInjection());

  // v0.11.4 professional dashboard. It is now an asset, not a wrapper that
  // reads another server source file and injects it dynamically.
  if (!html.includes("</head>")) throw Error("CONSOLIDATED_UI_HEAD_REQUIRED");
  html = html.replace("</head>", professionalStyle() + "</head>");
  html = beforeBody(html, professionalScript());

  // Replay only the visible behavior of wrappers above the professional root.
  html = beforeBody(html, RESULT_GUARD);
  html = beforeBody(html, METHODOLOGY_RECOMMENDATION_UI);
  html = beforeBody(html, TEACHER_PRESENTATION_UI);
  html = beforeBody(html, OFFICIAL_SEQUENCE_UI);
  html = beforeBody(html, HISTORY_UI);

  // Preserve the v0.12.2 regression fix while removing the process that existed
  // only to perform this text patch.
  const freeze = patchMethodologyObserver(html);
  if (!freeze.patched) throw Error("CONSOLIDATED_UI_METHODOLOGY_FREEZE_PATCH_MISSING");
  html = freeze.html;

  html = beforeBody(html, WORKFLOW_UI);
  html = beforeBody(html, V0124_UI + DOCX_EXPORT_UI);

  return html;
}

export const CONSOLIDATED_UI_HTML = buildConsolidatedUi();
