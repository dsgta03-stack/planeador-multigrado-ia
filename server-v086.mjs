import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_V085_PORT || 3201);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;

const child = spawn(process.execPath, ["server-v085b.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

let shuttingDown = false;
child.on("exit", (code, signal) => {
  console.error(`[v086] child v085b exited code=${code} signal=${signal}`);
  if (!shuttingDown) setTimeout(() => process.exit(code || 1), 50);
});
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    shuttingDown = true;
    try { child.kill(sig); } catch {}
    process.exit(0);
  });
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function readBody(req, maxBytes = 160000) {
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

function activityHotfix() {
  return String.raw`
<script>
(() => {
  const safe = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const gradesText = xs => (Array.isArray(xs) ? xs : []).map(g => g + '.º').join(', ');
  const originalRenderSessions = window.renderSessions;

  function detailedActivities(data) {
    const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
    if (!sessions.length) return '<div class="notice warn"><b>No llegaron sesiones del motor.</b> La generación terminó sin una secuencia utilizable.</div>';
    return '<div class="notice" style="margin-bottom:14px"><b>Actividades generadas por V6.2.1</b><br><span class="muted">Vista explícita de atención directa y trabajo autónomo. Esta sección se construye desde la respuesta validada del motor.</span></div>' + sessions.map(s => {
      const moments = (Array.isArray(s.work_moments) ? s.work_moments : []).map(m => {
        const directRefs = (Array.isArray(m.direct_ltg_refs) ? m.direct_ltg_refs : []).map(r => '<div class="muted" style="margin-top:5px"><b>LTG:</b> '+safe(r.project_id)+' · actividades '+safe((r.activity_orders||[]).join(', '))+(r.adaptation?' · '+safe(r.adaptation):'')+'</div>').join('');
        const others = (Array.isArray(m.other_blocks) ? m.other_blocks : []).map(b => {
          const refs = (Array.isArray(b.ltg_refs) ? b.ltg_refs : []).map(r => '<div class="muted" style="margin-top:5px"><b>LTG:</b> '+safe(r.project_id)+' · actividades '+safe((r.activity_orders||[]).join(', '))+(r.adaptation?' · '+safe(r.adaptation):'')+'</div>').join('');
          return '<div class="gradeBlock" style="margin:8px 0 0">'+
            '<b>Actividad autónoma · '+safe(b.block || gradesText(b.grades))+'</b><br>'+
            '<b>Grados:</b> '+safe(gradesText(b.grades))+'<br>'+
            '<b>Actividad:</b> '+safe(b.activity || 'Sin descripción')+'<br>'+
            (b.teacher_tone_guidance?'<b>Consigna/orientación:</b> '+safe(b.teacher_tone_guidance)+'<br>':'')+
            (b.autonomy_support?'<b>Apoyo para trabajar sin el docente:</b> '+safe(b.autonomy_support)+'<br>':'')+
            (b.evidence?'<b>Evidencia:</b> '+safe(b.evidence)+'<br>':'')+
            (b.assessment?'<b>Seguimiento:</b> '+safe(b.assessment):'')+refs+'</div>';
        }).join('');
        return '<div class="gradeBlock" style="border-left:4px solid #1d6a45">'+
          '<b>Momento '+safe(m.moment)+' · '+safe(m.minutes)+' min</b><br>'+
          '<div style="margin-top:7px"><b>Actividad con el docente · '+safe(gradesText(m.direct_teacher_grades))+'</b><br>'+
          safe(m.direct_teacher_action || 'Sin descripción')+directRefs+'</div>'+
          (others?'<div style="margin-top:10px"><b>Mientras el docente atiende ese bloque:</b>'+others+'</div>':'')+
          '</div>';
      }).join('');
      return '<div class="session"><strong>Sesión '+safe(s.session_number)+' · '+safe(s.total_minutes)+' min</strong>'+
        (s.purpose?'<br><b>Propósito:</b> '+safe(s.purpose):'')+
        '<div class="gradeBlock" style="margin-top:10px"><b>Apertura común · '+safe(s.opening_minutes)+' min</b><br>'+safe(s.common_opening || '')+'</div>'+
        moments+
        '<div class="gradeBlock"><b>Cierre común · '+safe(s.closure_minutes)+' min</b><br>'+safe(s.common_closure || '')+'</div></div>';
    }).join('');
  }

  window.renderSessions = function(data) {
    const target = document.getElementById('sessionsPlan');
    let legacy = '';
    try {
      if (typeof originalRenderSessions === 'function') {
        originalRenderSessions(data);
        legacy = target?.innerHTML || '';
      }
    } catch (err) {
      console.error('Legacy session renderer failed', err);
    }
    if (!target) return;
    const explicit = detailedActivities(data);
    target.innerHTML = '<div id="mpExplicitActivities">'+explicit+'</div>' + (legacy ? '<details style="margin-top:14px"><summary style="cursor:pointer;font-weight:800">Ver presentación anterior</summary><div style="margin-top:10px">'+legacy+'</div></details>' : '');
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
      html = html.replaceAll("Multiplan · motor V6.2 trazable", "Multiplan · motor V6.2.1 trazable");
      html = html.replace("</body>", activityHotfix() + "</body>");
      res.writeHead(r.status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(html);
      return;
    }
    const data = Buffer.from(await r.arrayBuffer());
    const outHeaders = { "content-type": type, "cache-control": r.headers.get("cache-control") || "no-store" };
    res.writeHead(r.status, outHeaders);
    res.end(data);
  } catch (error) {
    json(res, 502, { code: "V085_UPSTREAM_ERROR", message: String(error) });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    try {
      const r = await fetch(CHILD_ORIGIN + "/health");
      const childHealth = await r.json().catch(() => ({}));
      return json(res, r.ok ? 200 : 503, {
        ok: r.ok,
        version: "0.8.6",
        auth: "SUPABASE_AUTH_REQUIRED",
        planSupport: "PLAN-SEQUENCE-MULTIGRADE-V6.2.1-STRICT-TRACE",
        activityRenderer: "EXPLICIT-ACTIVITY-V1",
        child: childHealth
      });
    } catch (error) {
      return json(res, 503, { ok: false, version: "0.8.6", code: "CHILD_NOT_READY", message: String(error) });
    }
  }
  return proxy(req, res);
});

server.listen(PORT, "0.0.0.0", () => console.log(`Multiplan v0.8.6 activity-render gateway listening on ${PORT}; child v0.8.5 on ${CHILD_PORT}`));
