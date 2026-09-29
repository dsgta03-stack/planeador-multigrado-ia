export const PROVIDER_EXECUTION_MODES=Object.freeze(['SHADOW','CERTIFIED_R2']);

/** Explicit authorization only; provider request and pedagogical contracts remain unchanged. */
export function assertProviderExecutionPolicy({env,executionMode='SHADOW'}={}){
 if(executionMode==='SHADOW'){
  if(env?.MULTIPLAN_SHADOW_RUN!=='1'||env?.NODE_ENV==='production')
   throw Error('SHADOW_RUN_NOT_EXPLICIT_OR_PRODUCTION');
  return 'SHADOW';
 }
 if(executionMode==='CERTIFIED_R2'){
  if(env?.MULTIPLAN_CERTIFIED_R2_ENABLED!=='1'||env?.MULTIPLAN_CERTIFIED_R2_PROVIDER_ENABLED!=='1')
   throw Error('CERTIFIED_R2_PROVIDER_NOT_EXPLICIT');
  return 'CERTIFIED_R2';
 }
 throw Error('PROVIDER_EXECUTION_MODE_UNSUPPORTED');
}
