// One shared queue for all review focuses and retries in this shadow runner.
export function createRequestLimiter({intervalMs=8000,now=Date.now,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 let tail=Promise.resolve(),lastStart=-Infinity;
 return function limited(operation){
  const result=tail.then(async()=>{
   const delay=lastStart+intervalMs-now();
   if(delay>0)await wait(delay);
   lastStart=now();
   return operation(lastStart);
  });
  tail=result.catch(()=>{});
  return result;
 };
}
export const limitShadowRequest=createRequestLimiter();
