const BROKEN_OBSERVER = "new MutationObserver(update).observe(document.documentElement,{childList:true,subtree:true});setTimeout(update,300)";
const FIXED_OBSERVER = "const observer=new MutationObserver(()=>{observer.disconnect();try{update()}finally{observer.observe(document.documentElement,{childList:true,subtree:true})}});observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(update,300)";

export function patchMethodologyObserver(html) {
  if (!html.includes(BROKEN_OBSERVER)) {
    console.error(JSON.stringify({ event: "methodology_ui_freeze_patch_missing" }));
    return { html, patched: false };
  }
  return { html: html.replace(BROKEN_OBSERVER, FIXED_OBSERVER), patched: true };
}
