const SUPABASE_URL = "https://dvcrwzxznuqongutnifn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_a2rcBHsCpg2Nr1KE1I_o1A_j2lXRDoA";

function bearer(req) {
  const value = String(req.headers.authorization || "");
  return value.startsWith("Bearer ") ? value : "";
}
function enc(value) { return encodeURIComponent(String(value ?? "")); }
async function rest(path, authorization) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      authorization,
      accept: "application/json",
      "accept-profile": "public",
    },
    signal: AbortSignal.timeout(20_000),
  });
}
async function restJson(path, authorization) {
  const response = await rest(path, authorization);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || data?.code || `REST_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return Array.isArray(data) ? data : [];
}

async function listPdas(req, res, url, json) {
  const authorization = bearer(req);
  if (!authorization) return json(res, 401, { code: "AUTH_REQUIRED" });
  const grade = Number(url.searchParams.get("grade") || 1);
  const field = String(url.searchParams.get("field") || "").trim();
  const search = String(url.searchParams.get("q") || "").trim();
  if (!Number.isInteger(grade) || grade < 1 || grade > 6) return json(res, 400, { code: "INVALID_GRADE" });
  try {
    let path = `pda?select=pda_id,phase,grade,field,content_official,pda_official,source_id,source_page,verification_status&active=eq.true&verification_status=eq.Verificado&grade=eq.${grade}&order=field.asc,content_official.asc,pda_official.asc&limit=500`;
    if (field) path += `&field=eq.${enc(field)}`;
    if (search) {
      const term = search.replace(/[(),]/g, " ").trim();
      path += `&or=(pda_official.ilike.*${enc(term)}*,content_official.ilike.*${enc(term)}*)`;
    }
    const items = await restJson(path, authorization);
    return json(res, 200, { grade, count: items.length, items });
  } catch (error) {
    console.error(JSON.stringify({ event: "pda_catalog_list_error", message: String(error).slice(0, 300) }));
    return json(res, error.status === 401 || error.status === 403 ? error.status : 502, { code: "PDA_CATALOG_READ_FAILED" });
  }
}

async function detailPda(req, res, pdaId, json) {
  const authorization = bearer(req);
  if (!authorization) return json(res, 401, { code: "AUTH_REQUIRED" });
  try {
    const [pdaRows, metaRows, links] = await Promise.all([
      restJson(`pda?select=pda_id,phase,grade,field,content_official,pda_official,source_id,source_page,verification_status,audit_note&pda_id=eq.${enc(pdaId)}&active=eq.true&limit=1`, authorization),
      restJson(`pda_metadata?select=semantic_domains,cognitive_actions,potential_axes,multigrade_potential,review_status,metadata_origin&pda_id=eq.${enc(pdaId)}&limit=1`, authorization),
      restJson(`project_pda?select=project_id,verification_type,note&active=eq.true&pda_id=eq.${enc(pdaId)}&order=project_id.asc`, authorization),
    ]);
    const pda = pdaRows[0];
    if (!pda) return json(res, 404, { code: "PDA_NOT_FOUND" });

    const projects = [];
    for (const link of links.slice(0, 30)) {
      const [projectRows, activities] = await Promise.all([
        restJson(`projects_ltg?select=project_id,phase,grade,book,scenario,name,start_page,end_page,related_contents,purpose,central_product,verification_status&project_id=eq.${enc(link.project_id)}&active=eq.true&limit=1`, authorization),
        restJson(`ltg_project_activities?select=activity_order,page_start,page_end,activity_type,title,activity_summary,evidence_or_record,product_contribution,verification_status&project_id=eq.${enc(link.project_id)}&order=activity_order.asc&limit=100`, authorization),
      ]);
      if (projectRows[0]) projects.push({ ...projectRows[0], link, activities });
    }

    const relatedLinks = [];
    for (const project of projects) {
      relatedLinks.push(...await restJson(`project_pda?select=project_id,pda_id,verification_type&active=eq.true&project_id=eq.${enc(project.project_id)}&limit=500`, authorization));
    }
    const relatedIds = [...new Set(relatedLinks.map(x => x.pda_id).filter(id => id && id !== pdaId))].slice(0, 80);
    let related = [];
    if (relatedIds.length) {
      const filter = `in.(${relatedIds.map(id => `"${String(id).replace(/"/g, "")}"`).join(",")})`;
      const rows = await restJson(`pda?select=pda_id,grade,field,content_official,pda_official&pda_id=${enc(filter)}&active=eq.true&verification_status=eq.Verificado&limit=100`, authorization);
      const shared = new Map();
      for (const link of relatedLinks) {
        if (link.pda_id === pdaId) continue;
        if (!shared.has(link.pda_id)) shared.set(link.pda_id, []);
        shared.get(link.pda_id).push(link.project_id);
      }
      related = rows.map(row => ({ ...row, shared_project_ids: shared.get(row.pda_id) || [] }));
    }
    return json(res, 200, { pda, metadata: metaRows[0] || null, traceability: { projects, related_pdas: related } });
  } catch (error) {
    console.error(JSON.stringify({ event: "pda_catalog_detail_error", pda_id: pdaId, message: String(error).slice(0, 300) }));
    return json(res, error.status === 401 || error.status === 403 ? error.status : 502, { code: "PDA_TRACEABILITY_READ_FAILED" });
  }
}

export async function handlePdaCatalog(req, res, url, json) {
  if (req.method !== "GET") return false;
  if (url.pathname === "/api/pda-catalog") { await listPdas(req, res, url, json); return true; }
  if (url.pathname.startsWith("/api/pda-catalog/")) {
    await detailPda(req, res, decodeURIComponent(url.pathname.slice("/api/pda-catalog/".length)), json);
    return true;
  }
  return false;
}

export const PDA_UI = String.raw`
<style id="mp-pda-catalog-style">
#mpPdaCatalogView{display:none}.mp-pda-head{margin-bottom:18px}.mp-pda-head h2{margin:0 0 6px;font-size:26px;color:#10233c}.mp-pda-head p{margin:0;color:#6f7f92}.mp-pda-tools{background:#fff;border:1px solid #dfe7f1;border-radius:16px;padding:14px;margin-bottom:16px;box-shadow:0 8px 22px rgba(26,58,92,.04)}.mp-pda-grades{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-bottom:12px}.mp-pda-grade{border:1px solid #d9e4ee;background:#f8fbff;border-radius:10px;padding:10px 8px;font-weight:800;color:#29425e;cursor:pointer}.mp-pda-grade.active{background:#1674e8;color:#fff;border-color:#1674e8}.mp-pda-filters{display:grid;grid-template-columns:1fr 260px;gap:10px}.mp-pda-filters input,.mp-pda-filters select{width:100%;box-sizing:border-box;border:1px solid #d9e4ee;border-radius:10px;padding:11px 12px;background:#fff;color:#22364d}.mp-pda-summary{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.mp-pda-pill{background:#eef6ff;border:1px solid #d8e8f8;color:#315c83;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:800}.mp-pda-list{display:grid;gap:12px}.mp-pda-card{background:#fff;border:1px solid #dfe7f1;border-radius:16px;padding:17px 18px;box-shadow:0 7px 20px rgba(26,58,92,.04)}.mp-pda-top{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.mp-pda-card h3{margin:3px 0 8px;font-size:16px;line-height:1.4;color:#10233c}.mp-pda-content{font-size:13px;color:#5f7185;line-height:1.5}.mp-pda-meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.mp-pda-tag{font-size:11px;font-weight:800;border-radius:999px;padding:4px 7px;background:#f1f6fb;border:1px solid #e0e9f2;color:#4d637a}.mp-pda-trace-btn{border:0;border-radius:10px;background:#0f62cc;color:#fff;padding:9px 12px;font-weight:800;cursor:pointer;white-space:nowrap}.mp-pda-detail{display:none;margin-top:14px;padding-top:14px;border-top:1px solid #e8eef5}.mp-pda-detail.open{display:block}.mp-pda-project{border-left:3px solid #14b8a6;background:#f7fbfb;border-radius:8px;padding:10px 12px;margin:8px 0}.mp-pda-state{padding:34px;text-align:center;background:#fff;border:1px solid #dfe7f1;border-radius:16px;color:#6f7f92}.mp-pda-field-title{margin:18px 0 8px;font-size:18px;color:#0f2a4a}.mp-pda-path{font-size:12px;color:#57718b;margin-top:4px}.mp-pda-activity{font-size:12px;color:#53677c;margin:5px 0 0 12px}.mp-pda-related-item{background:#fafcff;border:1px solid #e6edf4;border-radius:9px;padding:9px 10px;font-size:12px;color:#40566d;margin:6px 0}
@media(max-width:760px){.mp-pda-grades{grid-template-columns:repeat(3,1fr)}.mp-pda-filters{grid-template-columns:1fr}.mp-pda-top{display:block}.mp-pda-trace-btn{margin-top:10px;width:100%}}
</style>
<script id="mp-pda-catalog-script">(()=>{
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let grade=1,field='',query='',items=[],timer=null;const fields=['Lenguajes','Saberes y Pensamiento Científico','Ética, Naturaleza y Sociedades','De lo Humano y lo Comunitario'];
function ready(){if(document.getElementById('mpPdaCatalogView'))return;const sidebar=document.getElementById('mpSidebar'),main=document.getElementById('mpMain'),legacy=document.getElementById('mpLegacyMain');if(!sidebar||!main||!legacy)return setTimeout(ready,100);const nav=sidebar.querySelector('.mp-nav');let link=[...nav.querySelectorAll('a')].find(a=>a.textContent.trim().toLowerCase().includes('pda oficiales'));if(!link){link=document.createElement('a');link.innerHTML='<span class="mp-icon">◉</span><span>PDA oficiales</span>';nav.appendChild(link)}link.id='mpPdaCatalogNav';link.href='#pda-oficiales';const view=document.createElement('section');view.id='mpPdaCatalogView';view.innerHTML='<div class="mp-pda-head"><h2>PDA oficiales</h2><p>Consulta los PDA verificados por grado, campo formativo y su trazabilidad con proyectos LTG.</p></div><div class="mp-pda-tools"><div class="mp-pda-grades">'+[1,2,3,4,5,6].map(g=>'<button class="mp-pda-grade" data-grade="'+g+'">'+g+'.º</button>').join('')+'</div><div class="mp-pda-filters"><input id="mpPdaSearch" type="search" placeholder="Buscar en PDA o contenido oficial…"><select id="mpPdaField"><option value="">Todos los campos formativos</option>'+fields.map(f=>'<option>'+esc(f)+'</option>').join('')+'</select></div></div><div id="mpPdaSummary" class="mp-pda-summary"></div><div id="mpPdaContent" class="mp-pda-state">Cargando…</div>';main.insertBefore(view,legacy);link.addEventListener('click',e=>{e.preventDefault();show()});view.querySelectorAll('[data-grade]').forEach(b=>b.addEventListener('click',()=>{grade=Number(b.dataset.grade);load()}));document.getElementById('mpPdaField').addEventListener('change',e=>{field=e.target.value;load()});document.getElementById('mpPdaSearch').addEventListener('input',e=>{query=e.target.value;clearTimeout(timer);timer=setTimeout(load,300)});nav.querySelectorAll('a:not(#mpPdaCatalogNav)').forEach(a=>a.addEventListener('click',()=>document.getElementById('mpPdaCatalogView')?.style.setProperty('display','none')))}
function show(){document.querySelectorAll('.mp-nav a').forEach(a=>a.classList.toggle('active',a.id==='mpPdaCatalogNav'));document.getElementById('mpHero')?.style.setProperty('display','none');document.querySelector('.mp-kpis')?.style.setProperty('display','none');document.getElementById('mpLegacyMain')?.style.setProperty('display','none');document.getElementById('mpHistoryView')?.style.setProperty('display','none');document.getElementById('mpPdaCatalogView')?.style.setProperty('display','block');load()}
function render(){document.querySelectorAll('.mp-pda-grade').forEach(b=>b.classList.toggle('active',Number(b.dataset.grade)===grade));const root=document.getElementById('mpPdaContent'),sum=document.getElementById('mpPdaSummary');const counts={};for(const x of items)counts[x.field]=(counts[x.field]||0)+1;sum.innerHTML='<span class="mp-pda-pill">'+items.length+' PDA</span>'+Object.entries(counts).map(([f,n])=>'<span class="mp-pda-pill">'+esc(f)+': '+n+'</span>').join('');if(!items.length){root.className='mp-pda-state';root.innerHTML='<b>No se encontraron PDA con estos filtros.</b>';return}root.className='mp-pda-list';let html='',last='';for(const item of items){if(item.field!==last){last=item.field;html+='<h3 class="mp-pda-field-title">'+esc(last)+'</h3>'}const key=esc(item.pda_id).replace(/[^a-zA-Z0-9_-]/g,'_');html+='<article class="mp-pda-card"><div class="mp-pda-top"><div><div class="mp-pda-meta"><span class="mp-pda-tag">'+item.grade+'.º</span><span class="mp-pda-tag">Fase '+esc(item.phase)+'</span><span class="mp-pda-tag">'+esc(item.field)+'</span></div><h3>'+esc(item.pda_official)+'</h3><div class="mp-pda-content"><b>Contenido oficial:</b> '+esc(item.content_official)+'</div><div class="mp-pda-path">Fuente: '+esc(item.source_id||'registrada')+(item.source_page?' · pág. '+esc(item.source_page):'')+'</div></div><button class="mp-pda-trace-btn" data-trace="'+esc(item.pda_id)+'">Ver trazabilidad</button></div><div class="mp-pda-detail" id="mpPdaDetail-'+key+'"></div></article>'}root.innerHTML=html;root.querySelectorAll('[data-trace]').forEach(b=>b.addEventListener('click',()=>trace(b)))}
async function load(){const root=document.getElementById('mpPdaContent');root.className='mp-pda-state';root.textContent='Cargando PDA oficiales…';try{const p=new URLSearchParams({grade:String(grade)});if(field)p.set('field',field);if(query.trim())p.set('q',query.trim());const r=await fetch('/api/pda-catalog?'+p,{headers:{accept:'application/json'}}),d=await r.json();if(!r.ok)throw new Error(d.code==='AUTH_REQUIRED'?'Inicia sesión para consultar los PDA.':'No fue posible consultar los PDA.');items=Array.isArray(d.items)?d.items:[];render()}catch(e){root.innerHTML='<b>No fue posible cargar los PDA.</b><div>'+esc(e.message||e)+'</div>'}}
async function trace(btn){const id=btn.dataset.trace,key='mpPdaDetail-'+id.replace(/[^a-zA-Z0-9_-]/g,'_'),box=document.getElementById(key);if(box.dataset.loaded==='1'){box.classList.toggle('open');btn.textContent=box.classList.contains('open')?'Ocultar trazabilidad':'Ver trazabilidad';return}box.className='mp-pda-detail open';box.textContent='Cargando trazabilidad…';btn.disabled=true;try{const r=await fetch('/api/pda-catalog/'+encodeURIComponent(id),{headers:{accept:'application/json'}}),d=await r.json();if(!r.ok)throw new Error('No fue posible consultar la trazabilidad.');const meta=d.metadata||{},projects=d.traceability?.projects||[],related=d.traceability?.related_pdas||[];let h='<h4>Ruta de trazabilidad</h4><div class="mp-pda-path"><b>PDA oficial</b> → contenido oficial → proyecto LTG → páginas → actividades verificadas</div>';if(meta.cognitive_actions?.length)h+='<h4>Acciones cognitivas</h4><div>'+meta.cognitive_actions.map(x=>'<span class="mp-pda-pill">'+esc(x)+'</span>').join(' ')+'</div>';h+='<h4>Proyectos LTG vinculados ('+projects.length+')</h4>'+(projects.length?projects.map(p=>'<div class="mp-pda-project"><b>'+esc(p.name)+'</b><div class="mp-pda-path">'+esc(p.book||'LTG')+' · '+esc(p.scenario||'escenario no registrado')+' · págs. '+esc(p.start_page||'?')+'–'+esc(p.end_page||'?')+'</div>'+(p.purpose?'<div class="mp-pda-content"><b>Propósito:</b> '+esc(p.purpose)+'</div>':'')+(p.central_product?'<div class="mp-pda-content"><b>Producto:</b> '+esc(p.central_product)+'</div>':'')+(p.activities?.length?'<details><summary>'+p.activities.length+' actividades registradas</summary>'+p.activities.map(a=>'<div class="mp-pda-activity">• '+esc(a.title||a.activity_type||'Actividad')+(a.page_start?' · pág. '+esc(a.page_start)+(a.page_end&&a.page_end!==a.page_start?'–'+esc(a.page_end):''):'')+'</div>').join('')+'</details>':'')+'</div>').join(''):'<div class="mp-pda-content">No hay proyectos LTG vinculados registrados.</div>');h+='<h4>PDA relacionados por proyecto compartido ('+related.length+')</h4>'+(related.length?related.map(x=>'<div class="mp-pda-related-item"><b>'+x.grade+'.º · '+esc(x.field)+'</b><div>'+esc(x.pda_official)+'</div><div class="mp-pda-path">Proyecto(s): '+esc((x.shared_project_ids||[]).join(', '))+'</div></div>').join(''):'<div class="mp-pda-content">No se registraron PDA relacionados.</div>');box.innerHTML=h;box.dataset.loaded='1';btn.textContent='Ocultar trazabilidad'}catch(e){box.innerHTML='<b>No se pudo cargar la trazabilidad.</b>';btn.textContent='Reintentar'}finally{btn.disabled=false}}
ready();})();</script>`;
