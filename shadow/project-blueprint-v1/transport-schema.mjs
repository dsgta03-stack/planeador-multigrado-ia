import {schemaFor} from './contracts.mjs';
export const TRANSPORT_VERSION='BLUEPRINT_TRANSPORT_V1';
// Provider Transport Contract != ProjectBlueprintV1 Domain Contract.
// Preserve shape; local contract and Gate remain authoritative for all semantics.
export function transportSchema(input){
 const compact=s=>{
  if(s.const!==undefined)return {type:typeof s.const,enum:[s.const]};
  if(s.anyOf)return {anyOf:s.anyOf.map(compact)};
  const r={type:s.type};
  if(s.properties){r.properties=Object.fromEntries(Object.entries(s.properties).map(([k,v])=>[k,compact(v)]));r.required=[...s.required];}
  if(s.items)r.items=compact(s.items);
  return r;
 };
 const domain=schemaFor('ProjectBlueprintV1');
 // Generated candidates never contain their own approval/gate report.
 domain.properties.gate_result={type:'null'};
 const schema=compact(domain);
 schema.properties.status={type:'string',enum:['DRAFT']};
 schema.properties.session_progression.minItems=input.constraints.requested_sessions;
 schema.properties.session_progression.maxItems=input.constraints.requested_sessions;
 return schema;
}
