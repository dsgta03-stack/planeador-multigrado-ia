import http from "node:http";

const PORT=Number(process.env.PORT||3000);
const UPSTREAM="https://planeador-multigrado-ia-v084b-production.up.railway.app/";
const GEMINI_URL="https://dvcrwzxznuqongutnifn.supabase.co/functions/v1/evaluate-pda-gemini-lab";

function json(res,status,body){res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});res.end(JSON.stringify(body));}

async function page(){
  const r=await fetch(UPSTREAM,{headers:{"cache-control":"no-cache"}});
  let html=await r.text();
  html=html.replaceAll("Demo V0.8.4b · pertinencia absoluta experimental","Demo V0.8.4c · análisis semántico con Gemini");
  html=html.replace("La problemática es la puerta principal. El porcentaje expresa pertinencia absoluta estimada, no posición relativa. Los PDA sin vinculación suficiente quedan fuera de la vista principal, pero puedes revisar opciones relacionadas. La selección final sigue siendo del docente.","Gemini analiza semánticamente la problemática y el contexto sobre candidatos oficiales de Supabase. El porcentaje es una estimación de pertinencia pedagógica y la selección final sigue siendo del docente.");
  const extra=`<script>
  const drawListGeminiBase=drawList;
  drawList=function(){
    drawListGeminiBase();
    const all=state.data?.candidatesByGrade?.[state.active]||[];
    document.querySelectorAll('#list article.candidate').forEach(card=>{
      const id=card.querySelector('.id')?.textContent?.trim();
      const row=all.find(r=>r.pda_id===id);
      if(!row?.gemini_justification)return;
      const box=document.createElement('div');
      box.className='notice'; box.style.marginTop='10px';
      box.innerHTML='<b>Por qué Gemini lo valora así:</b> '+esc(row.gemini_justification)+(row.relation_problem?'<br><span class="muted"><b>Relación con la problemática:</b> '+esc(row.relation_problem)+'</span>':'')+(row.relation_context?'<br><span class="muted"><b>Uso del contexto:</b> '+esc(row.relation_context)+'</span>':'');
      card.appendChild(box);
    });
  };
  </script>`;
  return html.replace('</body>',extra+'</body>');
}

const server=http.createServer(async(req,res)=>{
  if(req.method==='GET'&&req.url==='/'){
    try{const html=await page();res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});res.end(html);}catch(e){res.writeHead(502);res.end(String(e));}return;
  }
  if(req.method==='GET'&&req.url==='/health'){json(res,200,{ok:true,version:'0.8.4c',retrieval:'GEMINI-PDA-LAB-V2',model:'gemini-3.5-flash-lite'});return;}
  if(req.method==='POST'&&req.url==='/api/retrieve'){
    let raw='';req.on('data',c=>{raw+=c;if(raw.length>25000)req.destroy();});
    req.on('end',async()=>{try{const body=JSON.parse(raw||'{}');const r=await fetch(GEMINI_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({grados:body.grados,contexto:body.contexto,situacion_problema:body.situacion_problema,intereses:body.intereses||[],sesiones:body.sesiones||5,minutos:body.minutos||90})});const data=await r.json();json(res,r.status,data);}catch(e){json(res,500,{code:'GEMINI_PROXY_ERROR',message:String(e)});}});return;
  }
  json(res,404,{code:'NOT_FOUND'});
});
server.listen(PORT,'0.0.0.0',()=>console.log(`V0.8.4c Gemini lab listening on ${PORT}`));