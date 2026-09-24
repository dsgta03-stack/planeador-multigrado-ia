// Google responseJsonSchema documented subset, verified 2026-09-24.
// https://ai.google.dev/api/generate-content#v1beta.GenerationConfig
export const PROVIDER_SCHEMA_VERSION='GEMINI_JSON_SCHEMA_SUBSET_V1';
const allowed=new Set(['$id','$defs','$ref','$anchor','type','format','title','description','enum','items','prefixItems','minItems','maxItems','minimum','maximum','anyOf','oneOf','properties','additionalProperties','required','propertyOrdering']);
function visit(schema,fn,path='$'){
 if(typeof schema==='boolean')return;
 if(!schema||typeof schema!=='object'||Array.isArray(schema))throw Error(`PROVIDER_SCHEMA_INVALID_NODE: ${path}`);
 for(const [keyword,value] of Object.entries(schema)){
  const at=`${path}.${keyword}`;fn(keyword,at,schema);
  if(['properties','$defs'].includes(keyword))for(const [name,child] of Object.entries(value))visit(child,fn,`${at}[${JSON.stringify(name)}]`);
  else if(['anyOf','oneOf','prefixItems'].includes(keyword))value.forEach((child,i)=>visit(child,fn,`${at}[${i}]`));
  else if(['items','additionalProperties'].includes(keyword)&&typeof value==='object')visit(value,fn,at);
 }
}
export function assertProviderSchema(schema){
 visit(schema,(keyword,path)=>{if(!allowed.has(keyword)){const e=Error(`PROVIDER_SCHEMA_UNSUPPORTED_KEYWORD: ${keyword} at ${path}`);Object.assign(e,{code:'PROVIDER_SCHEMA_UNSUPPORTED_KEYWORD',keyword,path});throw e;}});return schema;
}
export function providerResponseSchema(local){
 const schema=structuredClone(local),removed=[];
 // Only these known local-only string constraints are projected away.
 // Unexpected future keywords fail closed instead of silently disappearing.
 visit(schema,(keyword,path,node)=>{if(['maxLength','minLength'].includes(keyword)){removed.push({keyword,path,local_value:node[keyword]});delete node[keyword];}});
 assertProviderSchema(schema);return {schema,removed,version:PROVIDER_SCHEMA_VERSION};
}
