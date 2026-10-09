// Gemini structured-output schema compatibility, verified 2026-09-24.
// Local authoring validation remains authoritative; provider schemas are decoder contracts only.
export const PROVIDER_SCHEMA_VERSION='GEMINI_JSON_SCHEMA_SUBSET_V2';
const allowed=new Set(['$id','$defs','$ref','$anchor','type','format','title','description','enum','items','prefixItems','minItems','maxItems','minimum','maximum','anyOf','oneOf','properties','additionalProperties','required','propertyOrdering']);
const localOnly=new Set(['maxLength','minLength']);
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
 // Strict projection used by existing review paths: remove only known local-only string limits.
 visit(schema,(keyword,path,node)=>{if(localOnly.has(keyword)){removed.push({keyword,path,local_value:node[keyword]});delete node[keyword];}});
 assertProviderSchema(schema);return {schema,removed,version:PROVIDER_SCHEMA_VERSION,profile:'STRICT'};
}
export function providerAuthoringShapeSchema(local){
 // Gemini 3.5 Flash-Lite rejects the full compact-authoring constraint graph with HTTP 400,
 // while the same field graph with decoder-shape constraints is accepted. Keep the strict
 // local schema unchanged and project only JSON shape to the provider decoder.
 visit(local,(keyword,path)=>{if(!allowed.has(keyword)&&!localOnly.has(keyword)){const e=Error(`PROVIDER_SCHEMA_UNSUPPORTED_KEYWORD: ${keyword} at ${path}`);Object.assign(e,{code:'PROVIDER_SCHEMA_UNSUPPORTED_KEYWORD',keyword,path});throw e;}});
 const removed=[];
 const project=(node,path='$')=>{
  if(typeof node==='boolean')return node;
  if(node.anyOf){
   const simple=node.anyOf.every(x=>x&&typeof x==='object'&&!Array.isArray(x)&&typeof x.type==='string'&&Object.keys(x).every(k=>k==='type'||k==='enum'||['minimum','maximum','maxLength','minLength'].includes(k)));
   if(simple){removed.push({keyword:'anyOf',path,local_value:structuredClone(node.anyOf),replacement:'nullable_type_array'});return {type:node.anyOf.map(x=>x.type)};}
  }
  const out={};
  if(node.type!==undefined)out.type=structuredClone(node.type);
  if(node.properties){out.properties=Object.fromEntries(Object.entries(node.properties).map(([k,v])=>[k,project(v,`${path}.properties[${JSON.stringify(k)}]`)]));if(node.required)out.required=[...node.required];}
  if(node.items)out.items=project(node.items,`${path}.items`);
  for(const key of ['enum','minItems','maxItems','minimum','maximum','additionalProperties','maxLength','minLength','format','title','description','propertyOrdering'])if(node[key]!==undefined)removed.push({keyword:key,path:`${path}.${key}`,local_value:structuredClone(node[key])});
  return out;
 };
 const schema=project(local);assertProviderSchema(schema);
 return {schema,removed,version:PROVIDER_SCHEMA_VERSION,profile:'AUTHORING_SHAPE_V1'};
}
