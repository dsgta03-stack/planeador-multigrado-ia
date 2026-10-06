export const RESULT_GUARD = String.raw`
<style id="mp-result-guard-style">
#mpPlanToast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:99997;background:#0b2d4f;color:#fff;padding:11px 15px;border-radius:12px;box-shadow:0 12px 34px rgba(0,0,0,.22);font:700 13px Inter,system-ui,sans-serif;display:none;max-width:min(620px,calc(100vw - 28px));text-align:center}
#mpViewPlan{position:fixed;left:18px;bottom:18px;z-index:99996;border:0;border-radius:12px;padding:11px 15px;background:#1674e8;color:#fff;font:800 13px Inter,system-ui,sans-serif;box-shadow:0 10px 24px rgba(22,116,232,.26);cursor:pointer;display:none}
#mpPlanProgress{height:4px;background:#dcecff;border-radius:999px;overflow:hidden;margin:8px 0 0;display:none}#mpPlanProgress>span{display:block;height:100%;width:35%;background:#1674e8;border-radius:999px;animation:mpSlide 1.1s ease-in-out infinite alternate}@keyframes mpSlide{from{transform:translateX(-25%)}to{transform:translateX(215%)}}
</style>
<script id="mp-result-guard-script">
(()=>{
  const boot=()=>{
    const plan=document.getElementById('plan');
    if(!plan)return;
    const toast=document.createElement('div');toast.id='mpPlanToast';document.body.appendChild(toast);
    const view=document.createElement('button');view.id='mpViewPlan';view.type='button';view.textContent='Ver planeación';document.body.appendChild(view);
    const progress=document.createElement('div');progress.id='mpPlanProgress';progress.innerHTML='<span></span>';
    const heading=plan.querySelector('h2');if(heading)heading.insertAdjacentElement('afterend',progress);else plan.prepend(progress);

    const toastMsg=(msg,ms=0)=>{toast.textContent=msg;toast.style.display='block';if(ms)setTimeout(()=>{if(toast.textContent===msg)toast.style.display='none'},ms)};
    const reveal=(scroll=false)=>{
      plan.classList.remove('hidden');
      plan.style.display='block';
      view.style.display='block';
      if(scroll)setTimeout(()=>plan.scrollIntoView({behavior:'smooth',block:'start'}),80);
    };
    view.onclick=()=>{reveal(true)};

    const bindButton=id=>{
      const b=document.getElementById(id);if(!b)return;
      b.addEventListener('click',()=>{
        reveal(true);
        progress.style.display='block';
        toastMsg('Construyendo la planeación… puedes permanecer en esta sección mientras termina.');
      });
    };
    bindButton('continue');bindButton('rebuild');

    const nativeFetch=window.fetch.bind(window);
    window.fetch=async function(input,init){
      const url=typeof input==='string'?input:(input?.url||'');
      const isPlan=url.includes('/api/gemini-plan');
      if(isPlan){reveal(false);progress.style.display='block';toastMsg('Generando con V6.5 Beta.10…');}
      try{
        const response=await nativeFetch(input,init);
        if(isPlan){
          progress.style.display='none';
          reveal(false);
          if(response.ok){toastMsg('Planeación generada. Pulsa “Ver planeación” para revisar el resultado.',7000);setTimeout(()=>plan.scrollIntoView({behavior:'smooth',block:'start'}),120);}
          else toastMsg('La generación terminó con un error del servidor. La versión base permanece visible.',7000);
        }
        return response;
      }catch(error){
        if(isPlan){progress.style.display='none';reveal(false);toastMsg('No se pudo completar la generación. La versión base permanece visible.',7000);}
        throw error;
      }
    };

    const observer=new MutationObserver(()=>{
      const visible=!plan.classList.contains('hidden')&&getComputedStyle(plan).display!=='none';
      if(visible)view.style.display='block';
    });
    observer.observe(plan,{attributes:true,attributeFilter:['class','style'],subtree:false});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
</script>`;
