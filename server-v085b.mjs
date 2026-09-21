import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT || 3000);
const CHILD_PORT = Number(process.env.MULTIPLAN_CHILD_PORT || 3101);
const CHILD_ORIGIN = `http://127.0.0.1:${CHILD_PORT}`;

const SUPABASE_URL = "https://dvcrwzxznuqongutnifn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_a2rcBHsCpg2Nr1KE1I_o1A_j2lXRDoA";
const MODEL_ROUTES = new Map([
  ["/api/retrieve", `${SUPABASE_URL}/functions/v1/evaluate-pda-gemini-lab`],
  ["/api/gemini-plan", `${SUPABASE_URL}/functions/v1/plan-support-gemini-lab`],
  ["/api/material", `${SUPABASE_URL}/functions/v1/generate-teaching-material-lab`],
]);

const child = spawn(process.execPath, ["server-v084c.mjs"], {
  env: { ...process.env, PORT: String(CHILD_PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});

let shuttingDown = false;
child.on("exit", (code, signal) => {
  console.error(`[v085] child v084c exited code=${code} signal=${signal}`);
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

function readBody(req, maxBytes = 120000) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > maxBytes) { reject(new Error("PAYLOAD_TOO_LARGE")); req.destroy(); }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function authToken(req) {
  const header = String(req.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function authInjection() {
  const config = JSON.stringify({ url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY });
  const authHtml = `<style>
    #mpAuthOverlay{position:fixed;inset:0;background:rgba(20,28,23,.72);backdrop-filter:blur(5px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px}
    #mpAuthCard{width:min(440px,100%);background:#fff;border-radius:18px;padding:24px;box-shadow:0 20px 65px rgba(0,0,0,.24);font-family:Arial,sans-serif;color:#172019}
    #mpAuthCard h2{margin:0 0 7px;font-size:26px} #mpAuthCard p{color:#667169;line-height:1.45}
    #mpAuthCard label{display:block;font-size:13px;font-weight:700;margin:12px 0 5px}
    #mpAuthCard input{width:100%;box-sizing:border-box;border:1px solid #cfd8cf;border-radius:10px;padding:11px;font:inherit}
    #mpAuthActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}
    #mpAuthActions button,#mpUserBadge button{border:0;border-radius:10px;padding:10px 13px;font-weight:700;cursor:pointer}
    #mpLogin{background:#1d6a45;color:#fff} #mpSignup{background:#edf7f1;color:#154e34;border:1px solid #b9d3c2!important}
    #mpAuthMessage{margin-top:11px;font-size:13px;line-height:1.4}.mpAuthError{color:#9b2525}.mpAuthOk{color:#28613f}
    #mpUserBadge{position:fixed;right:14px;bottom:14px;z-index:99998;background:#fff;border:1px solid #d8e0d8;border-radius:14px;padding:9px 11px;box-shadow:0 6px 20px rgba(0,0,0,.12);font:12px Arial,sans-serif;display:none;align-items:center;gap:8px;max-width:min(430px,calc(100vw - 28px))}
    #mpUserEmail{overflow:hidden;text-overflow:ellipsis;white-space:nowrap} #mpLogout{background:#f1f3f1;color:#39443d;padding:7px 9px!important}
  </style>
  <div id="mpAuthOverlay"><div id="mpAuthCard">
    <h2>Entrar a Multiplan</h2>
    <p>Tu sesión protege las generaciones con IA y permite asociar cada planeación a tu cuenta.</p>
    <label>Correo electrónico</label><input id="mpEmail" type="email" autocomplete="email" placeholder="tu@correo.com">
    <label>Contraseña</label><input id="mpPassword" type="password" autocomplete="current-password" minlength="6" placeholder="Mínimo 6 caracteres">
    <div id="mpAuthActions"><button id="mpLogin">Iniciar sesión</button><button id="mpSignup">Crear cuenta</button></div>
    <div id="mpAuthMessage"></div>
  </div></div>
  <div id="mpUserBadge"><span id="mpUserEmail"></span><button id="mpLogout">Salir</button></div>`;
  const authHtmlJson = JSON.stringify(authHtml);
  return String.raw`
<script>
(() => {
  const AUTH = ${config};
  const AUTH_HTML = ${authHtmlJson};
  const STORAGE_KEY = 'multiplan.auth.v1';
  const nativeFetch = window.fetch.bind(window);
  let session = null;
  let refreshPromise = null;

  function parseJwtExp(token){
    try{
      const part=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      const data=JSON.parse(decodeURIComponent(Array.from(atob(part)).map(c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join('')));
      return Number(data.exp||0);
    }catch{return 0;}
  }
  function saveSession(next){
    session=next&&next.access_token?{access_token:next.access_token,refresh_token:next.refresh_token||session?.refresh_token||'',expires_at:Number(next.expires_at||parseJwtExp(next.access_token)||0),user:next.user||session?.user||null}:null;
    if(session)localStorage.setItem(STORAGE_KEY,JSON.stringify(session)); else localStorage.removeItem(STORAGE_KEY);
    renderAuthState();
  }
  async function authApi(path,{method='GET',body,token}={}){
    const headers={'apikey':AUTH.key};
    if(body!==undefined)headers['content-type']='application/json';
    if(token)headers['authorization']='Bearer '+token;
    const r=await nativeFetch(AUTH.url+'/auth/v1'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
    let data={}; try{data=await r.json();}catch{}
    if(!r.ok){const err=new Error(data.msg||data.message||data.error_description||data.error||('AUTH_'+r.status));err.status=r.status;throw err;}
    return data;
  }
  async function refreshSession(){
    if(refreshPromise)return refreshPromise;
    if(!session?.refresh_token){saveSession(null);return null;}
    refreshPromise=(async()=>{try{const data=await authApi('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});saveSession(data);return session;}catch{saveSession(null);return null;}finally{refreshPromise=null;}})();
    return refreshPromise;
  }
  async function ensureSession(){
    if(!session)return null;
    const exp=session.expires_at||parseJwtExp(session.access_token);
    if(exp&&exp<=Math.floor(Date.now()/1000)+90)await refreshSession();
    return session;
  }
  async function validateSession(){
    if(!session?.access_token)return null;
    try{const user=await authApi('/user',{token:session.access_token});session.user=user;saveSession(session);return session;}
    catch(e){if(e.status===401)return refreshSession();return session;}
  }
  function consumeAuthHash(){
    const p=new URLSearchParams(location.hash.replace(/^#/,''));
    const access=p.get('access_token');
    if(access){saveSession({access_token:access,refresh_token:p.get('refresh_token')||'',expires_at:Math.floor(Date.now()/1000)+Number(p.get('expires_in')||3600),user:null});history.replaceState(null,'',location.pathname+location.search);return true;}
    const err=p.get('error_description');if(err){history.replaceState(null,'',location.pathname+location.search);setAuthMessage(err,true);}return false;
  }
  function injectAuthUI(){
    if(document.getElementById('multiplanAuthRoot'))return;
    const root=document.createElement('div');root.id='multiplanAuthRoot';root.innerHTML=AUTH_HTML;document.body.appendChild(root);
    document.getElementById('mpLogin').onclick=login;document.getElementById('mpSignup').onclick=signup;document.getElementById('mpLogout').onclick=logout;
    document.getElementById('mpPassword').addEventListener('keydown',e=>{if(e.key==='Enter')login();});
  }
  function setAuthMessage(message,isError=false){const el=document.getElementById('mpAuthMessage');if(!el)return;el.className=isError?'mpAuthError':'mpAuthOk';el.textContent=message||'';}
  function renderAuthState(){
    const overlay=document.getElementById('mpAuthOverlay'),badge=document.getElementById('mpUserBadge'),email=document.getElementById('mpUserEmail');
    if(!overlay||!badge)return;
    if(session?.access_token){overlay.style.display='none';badge.style.display='flex';email.textContent=session.user?.email||'Sesión activa';}
    else{overlay.style.display='flex';badge.style.display='none';}
  }
  async function login(){
    const email=document.getElementById('mpEmail').value.trim(),password=document.getElementById('mpPassword').value;
    if(!email||password.length<6){setAuthMessage('Escribe un correo válido y una contraseña de al menos 6 caracteres.',true);return;}
    setAuthMessage('Iniciando sesión…');
    try{const data=await authApi('/token?grant_type=password',{method:'POST',body:{email,password}});saveSession(data);await validateSession();setAuthMessage('');}catch(e){setAuthMessage(String(e.message||e),true);}
  }
  async function signup(){
    const email=document.getElementById('mpEmail').value.trim(),password=document.getElementById('mpPassword').value;
    if(!email||password.length<6){setAuthMessage('Escribe un correo válido y una contraseña de al menos 6 caracteres.',true);return;}
    setAuthMessage('Creando cuenta…');
    try{const redirect=encodeURIComponent(location.origin+'/');const data=await authApi('/signup?redirect_to='+redirect,{method:'POST',body:{email,password}});if(data.access_token){saveSession(data);await validateSession();setAuthMessage('');}else setAuthMessage('Cuenta creada. Revisa tu correo para confirmar el acceso y después vuelve a Multiplan.');}catch(e){setAuthMessage(String(e.message||e),true);}
  }
  async function logout(){try{if(session?.access_token)await authApi('/logout',{method:'POST',token:session.access_token});}catch{}saveSession(null);setAuthMessage('Sesión cerrada.');}

  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:(input?.url||'');
    if(url.startsWith('/api/')){
      await ensureSession();
      if(!session?.access_token){renderAuthState();throw new Error('Inicia sesión para continuar.');}
      const headers=new Headers(init.headers||{});headers.set('authorization','Bearer '+session.access_token);
      return nativeFetch(input,{...init,headers});
    }
    return nativeFetch(input,init);
  };
  window.MultiplanAuth={getSession:()=>session,refresh:refreshSession,logout};
  injectAuthUI();
  try{session=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');}catch{session=null;}
  consumeAuthHash();renderAuthState();if(session)validateSession();
})();
</script>`;
}

async function proxyModel(req, res, upstream) {
  const token = authToken(req);
  if (!token) return json(res, 401, { code: "AUTH_REQUIRED" });
  try {
    const raw = await readBody(req);
    const r = await fetch(upstream, { method: "POST", headers: { "content-type": "application/json", "authorization": `Bearer ${token}` }, body: raw || "{}" });
    const text = await r.text();
    res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(text);
  } catch (error) {
    const code = String(error?.message || error) === "PAYLOAD_TOO_LARGE" ? 413 : 502;
    json(res, code, { code: "UPSTREAM_PROXY_ERROR", message: String(error) });
  }
}

async function proxyChild(req, res) {
  try {
    const init = { method: req.method, headers: {} };
    if (req.headers["content-type"]) init.headers["content-type"] = req.headers["content-type"];
    if (req.method !== "GET" && req.method !== "HEAD") init.body = await readBody(req, 150000);
    const r = await fetch(CHILD_ORIGIN + req.url, init);
    const type = r.headers.get("content-type") || "application/octet-stream";
    if (req.method === "GET" && req.url === "/" && type.includes("text/html")) {
      let html = await r.text();
      html = html.replaceAll("Demo V0.8.4c · planeación multigrado contextual", "Multiplan · motor V6.2 trazable");
      html = html.replace("</body>", authInjection() + "</body>");
      res.writeHead(r.status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });res.end(html);return;
    }
    const data = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, { "content-type": type, "cache-control": r.headers.get("cache-control") || "no-store" });res.end(data);
  } catch (error) { json(res, 502, { code: "V084C_UPSTREAM_ERROR", message: String(error) }); }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    try {
      const r = await fetch(CHILD_ORIGIN + "/health");const childHealth = await r.json().catch(() => ({}));
      return json(res, r.ok ? 200 : 503, { ok:r.ok,version:"0.8.5",auth:"SUPABASE_AUTH_REQUIRED",retrieval:"GEMINI-PDA-LAB-V2",planSupport:"PLAN-SEQUENCE-MULTIGRADE-V6.2-STRICT-TRACE",materials:"TEACHING-MATERIAL-V2-CONTEXTUAL",child:childHealth });
    } catch (error) { return json(res,503,{ok:false,version:"0.8.5",code:"CHILD_NOT_READY",message:String(error)}); }
  }
  const modelRoute = MODEL_ROUTES.get(req.url || "");
  if (req.method === "POST" && modelRoute) return proxyModel(req, res, modelRoute);
  return proxyChild(req, res);
});

server.listen(PORT, "0.0.0.0", () => console.log(`Multiplan v0.8.5 auth gateway listening on ${PORT}; child v0.8.4c on ${CHILD_PORT}`));
