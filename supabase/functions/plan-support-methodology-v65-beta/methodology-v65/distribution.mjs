function weightedExtras(phases, extras){
  const out=phases.map(p=>[p]);
  if(extras<=0)return out;
  const weights=phases.map(p=>Math.max(1,Number(p.expansionWeight)||1));
  for(let k=0;k<extras;k++){
    let best=0, ratio=-Infinity;
    for(let i=0;i<out.length;i++){
      const r=weights[i]/out[i].length;
      if(r>ratio){ratio=r;best=i}
    }
    out[best].push(phases[best]);
  }
  return out;
}

export function distributePhases(methodology, sessionCount){
  const phases=methodology.phases||[];
  const n=Math.max(1,Number(sessionCount)||1);
  if(!phases.length)return [];
  if(n>=phases.length){
    const groups=weightedExtras(phases,n-phases.length);
    const result=[];
    for(const group of groups) for(let i=0;i<group.length;i++) result.push([group[0]]);
    return result;
  }
  const result=[];
  for(let s=0;s<n;s++){
    const start=Math.floor(s*phases.length/n);
    const end=Math.floor((s+1)*phases.length/n);
    result.push(phases.slice(start,Math.max(start+1,end)));
  }
  return result;
}
