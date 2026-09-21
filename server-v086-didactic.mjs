import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_PROJECTACTION_PORT || 3501);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;
const V64_URL = "https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/plan-support-didactic-execution-v2";
const V64_ENABLED = String(process.env.MULTIPLAN_V64_ENABLED || "true").toLowerCase() !== "false";

// V6.3 -> Project Core v1 -> V6.2.1 remain untouched underneath.
const child = spawn(process.execPath, ["server-v086-projectaction.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

let shuttingDown = false;
child.on("exit", (code, signal) => {
  console.error(`[didactic] V6.3 child exited code=${code} signal=${signal}`);
  if (!shuttingDown) setTimeout(() => process.exit(code || 1), 50);
});
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    shuttingDown = true;
    try { child.kill(sig); } catch {}
    process.exit(0);
  });
}

function json(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

function readBody(req, maxBytes = 240000) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > maxBytes) { reject(new Error("PAYLOAD_TOO_LARGE")); req.destroy(); }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

async function call(url, raw, authorization) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization },
    body: raw || "{}",
  });
  return {
    status: r.status,
    contentType: r.headers.get("content-type") || "application/json; charset=utf-8",
    data: Buffer.from(await r.arrayBuffer()),
    engine: r.headers.get("x-multiplan-plan-engine") || "",
  };
}

function send(res, result, engine, extra = {}) {
  res.writeHead(result.status, {
    "content-type": result.contentType,
    "cache-control": "no-store",
    "x-multiplan-plan-engine": engine,
    ...extra,
  });
  res.end(result.data);
}

async function routePlan(req, res) {
  const authorization = String(req.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) return json(res, 401, { code: "AUTH_REQUIRED" });

  let raw;
  try { raw = await readBody(req); }
  catch (error) { return json(res, 413, { code: "PAYLOAD_TOO_LARGE", message: String(error) }); }

  let body;
  try { body = JSON.parse(raw || "{}"); }
  catch { return json(res, 400, { code: "INVALID_JSON" }); }

  const grades = [...new Set((Array.isArray(body?.grados) ? body.grados : []).map(Number).filter(Number.isInteger))];
  const singleGrade = grades.length === 1;

  if (V64_ENABLED && singleGrade) {
    try {
      const v64 = await call(V64_URL, raw, authorization);
      // Authentication/input errors are returned directly. Quality/server failures fall back to V6.3.
      if (v64.status < 500 && v64.status !== 422) {
        return send(res, v64, "V6.4-DIDACTIC-EXECUTION-BETA.2");
      }
      const fallback = await call(CHILD_ORIGIN + "/api/gemini-plan", raw, authorization);
      return send(res, fallback, fallback.engine || "V6.3-PROJECT-ACTION-CONTINUITY-BETA.4", {
        "x-multiplan-fallback": "v6.3-project-action",
        "x-multiplan-v64-status": String(v64.status),
      });
    } catch (error) {
      try {
        const fallback = await call(CHILD_ORIGIN + "/api/gemini-plan", raw, authorization);
        return send(res, fallback, fallback.engine || "V6.3-PROJECT-ACTION-CONTINUITY-BETA.4", {
          "x-multiplan-fallback": "v6.3-project-action-network",
        });
      } catch (fallbackError) {
        return json(res, 502, { code: "V64_AND_FALLBACK_FAILED", message: String(error), fallback: String(fallbackError) });
      }
    }
  }

  try {
    const stable = await call(CHILD_ORIGIN + "/api/gemini-plan", raw, authorization);
    return send(res, stable, stable.engine || "PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE");
  } catch (error) {
    return json(res, 502, { code: "DIDACTIC_CHILD_ERROR", message: String(error) });
  }
}

function renderer() {
  return String.raw`
<script>
(() => {
  const safe = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const gradesText = xs => (Array.isArray(xs) ? xs : []).map(g => g + '.º').join(', ');
  const previous = window.renderSessions;

  function stepHtml(p) {
    return '<div style="margin:10px 0;padding:11px 12px;border-left:3px solid #7aa88c;background:#f8fbf8;border-radius:7px">' +
      '<b>Paso '+safe(p.step)+' · '+safe(p.minutes)+' min</b><br>'+
      '<b>Docente:</b> '+safe(p.teacher_action)+'<br>'+
      '<b>Alumnos:</b> '+safe(p.student_action)+'<br>'+
      '<b>Consigna o pregunta:</b> “'+safe(p.teacher_prompt)+'”<br>'+
      '<b>Resultado esperado:</b> '+safe(p.expected_result)+'<br>'+
      '<b>Antes de avanzar:</b> '+safe(p.check_before_next)+
      '</div>';
  }

  function didacticSessions(data) {
    const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
    if (!sessions.length) return '';
    const isV64 = String(data?.engineVersion || '').startsWith('V6.4') || sessions.some(s => (s.work_moments||[]).some(m => Array.isArray(m.direct_procedure)));
    if (!isV64) return '';
    return '<div class="notice" style="margin-bottom:14px"><b>Desarrollo didáctico paso a paso · V6.4</b><br><span class="muted">La actividad se presenta como guía de ejecución: qué hace el docente, qué hacen los alumnos, qué se produce y cómo se comprueba el avance.</span></div>' +
      sessions.map(s => {
        const moments = (s.work_moments || []).map(m => {
          const refs = (m.direct_ltg_refs || []).map(r => '<div class="muted" style="margin-top:8px"><b>LTG:</b> '+safe(r.project_id)+' · actividades '+safe((r.activity_orders||[]).join(', '))+(r.adaptation?' · '+safe(r.adaptation):'')+'</div>').join('');
          const procedure = (m.direct_procedure || []).map(stepHtml).join('');
          return '<div class="gradeBlock" style="border-left:4px solid #1d6a45;margin-top:12px">'+
            '<b>Momento '+safe(m.moment)+' · '+safe(m.minutes)+' min</b>'+
            (m.direct_activity_title?'<div style="font-size:17px;font-weight:900;margin:6px 0">'+safe(m.direct_activity_title)+'</div>':'')+
            '<div><b>Actividad con el docente · '+safe(gradesText(m.direct_teacher_grades))+'</b></div>'+
            '<div style="margin-top:7px"><b>Qué hará el docente:</b> '+safe(m.direct_teacher_action || '')+'</div>'+
            '<div style="margin-top:7px"><b>Qué harán los alumnos:</b> '+safe(m.direct_student_action || '')+'</div>'+
            (m.direct_learning_action?'<div style="margin-top:7px"><b>Acción de aprendizaje del PDA:</b> '+safe(m.direct_learning_action)+'</div>':'')+
            '<div style="margin-top:12px;font-weight:900">Cómo se desarrolla</div>'+procedure+
            (m.direct_support_if_needed?'<div style="margin-top:9px"><b>Si necesitan apoyo:</b> '+safe(m.direct_support_if_needed)+'</div>':'')+
            (m.direct_transition?'<div style="margin-top:7px"><b>Cómo enlaza con lo siguiente:</b> '+safe(m.direct_transition)+'</div>':'')+
            (m.direct_evidence?'<div style="margin-top:7px"><b>Evidencia:</b> '+safe(m.direct_evidence)+'</div>':'')+
            (m.direct_product_contribution?'<div style="margin-top:7px"><b>Aporte al producto:</b> '+safe(m.direct_product_contribution)+'</div>':'')+
            refs+'</div>';
        }).join('');
        return '<div class="session">'+
          '<strong>Sesión '+safe(s.session_number)+' · '+safe(s.total_minutes)+' min</strong>'+
          (s.purpose?'<br><b>Propósito:</b> '+safe(s.purpose):'')+
          (s.continuity_from_previous?'<div class="muted" style="margin-top:6px"><b>Venimos de:</b> '+safe(s.continuity_from_previous)+'</div>':'')+
          '<div class="gradeBlock" style="margin-top:10px"><b>Apertura · '+safe(s.opening_minutes)+' min</b><br>'+safe(s.common_opening || '')+'</div>'+
          moments+
          '<div class="gradeBlock"><b>Cierre · '+safe(s.closure_minutes)+' min</b><br>'+safe(s.common_closure || '')+'</div>'+
          (s.partial_product?'<div style="margin-top:8px"><b>Producto parcial:</b> '+safe(s.partial_product)+'</div>':'')+
          (s.prepares_next?'<div style="margin-top:6px"><b>Prepara la siguiente sesión:</b> '+safe(s.prepares_next)+'</div>':'')+
          '</div>';
      }).join('');
  }

  window.renderSessions = function(data) {
    const target = document.getElementById('sessionsPlan');
    if (!target) return;
    const rich = didacticSessions(data);
    if (rich) {
      let old = '';
      try {
        if (typeof previous === 'function') {
          previous(data);
          old = target.innerHTML || '';
        }
      } catch (e) { console.error('Previous renderer failed', e); }
      target.innerHTML = rich + (old ? '<details style="margin-top:14px"><summary style="cursor:pointer;font-weight:800">Ver vista resumida</summary><div style="margin-top:10px">'+old+'</div></details>' : '');
      return;
    }
    if (typeof previous === 'function') return previous(data);
  };
  try { renderSessions = window.renderSessions; } catch {}
})();
</script>`;
}

async function proxy(req, res) {
  try {
    const headers = {};
    for (const name of ["content-type", "authorization", "accept", "cookie"]) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    const init = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") init.body = await readBody(req);
    const r = await fetch(CHILD_ORIGIN + req.url, init);
    const type = r.headers.get("content-type") || "application/octet-stream";
    if (req.method === "GET" && req.url === "/" && type.includes("text/html")) {
      let html = await r.text();
      html = html.replaceAll("Multiplan · motor V6.2.1 trazable", "Multiplan · motor V6.4 didáctico · respaldo V6.3/V6.2.1");
      html = html.replace("</body>", renderer() + "</body>");
      res.writeHead(r.status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(html);
      return;
    }
    const data = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, {
      "content-type": type,
      "cache-control": r.headers.get("cache-control") || "no-store",
    });
    res.end(data);
  } catch (error) {
    json(res, 502, { code: "V63_CHILD_PROXY_ERROR", message: String(error) });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    try {
      const r = await fetch(CHILD_ORIGIN + "/health");
      const childHealth = await r.json().catch(() => ({}));
      return json(res, r.ok ? 200 : 503, {
        ok: r.ok,
        version: "0.8.7",
        interfaceChanged: "didactic-session-renderer-only",
        didacticRenderer: "STEP-BY-STEP-V1",
        v64Enabled: V64_ENABLED,
        v64Scope: "single-grade-only",
        singleGradeEngine: V64_ENABLED ? "V6.4-DIDACTIC-EXECUTION-BETA.2" : "V6.3-PROJECT-ACTION-CONTINUITY-BETA.4",
        singleGradeFallback: "V6.3-PROJECT-ACTION-CONTINUITY-BETA.4",
        secondFallback: "V6.2-PROJECT-CORE-PDA-LTG-LINKING-BETA",
        multiGradeEngine: "PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE",
        stableFallback: "PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE",
        childEntryPoint: "server-v086-projectaction.mjs",
        child: childHealth,
      });
    } catch (error) {
      return json(res, 503, { ok: false, version: "0.8.7", code: "V63_CHILD_NOT_READY", message: String(error) });
    }
  }

  if (req.method === "POST" && req.url === "/api/gemini-plan") return routePlan(req, res);
  return proxy(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Multiplan V6.4 didactic router listening on ${PORT}; V6.3 child on ${CHILD_PORT}; v64=${V64_ENABLED}; scope=single-grade-only`);
});
