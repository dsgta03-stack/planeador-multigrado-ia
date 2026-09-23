import {schemaFor,sourceBinding} from './contracts.mjs';
// Request-side constraints only. The versioned domain contract and gate are unchanged.
export function generationSchema(input){
 const schema=schemaFor('ProjectBlueprintV1'),p=schema.properties;
 p.status={type:'string',enum:['DRAFT']};p.gate_result={type:'null'};
 p.problem_frame.properties.original_problem={type:'string',enum:[input.constraints.original_problem]};
 for(const [k,v] of Object.entries(sourceBinding(input)))p.source.properties[k]={type:'string',enum:[v]};
 p.final_outcome.properties.outcome_id={type:'string',enum:['outcome_01']};
 p.grade_contributions.items.properties.integration_destination={type:'string',enum:['outcome_01']};
 const resources=input.constraints.available_resources;
 p.final_outcome.properties.required_resources.items.properties.resource={type:'string',enum:resources};
 p.final_outcome.properties.required_resources.items.properties.alternative={anyOf:[{type:'null'},{type:'string',enum:resources}]};
 p.methodology.properties.selected_id={type:'string',enum:[input.methodology.selected_id]};
 const ops=input.methodology.required_operations;
 p.methodology.properties.required_operations={type:'array',items:{type:'string',enum:ops},minItems:ops.length,maxItems:ops.length};
 for(const name of ['project_stages','session_progression'])p[name].items.properties.methodology_operations.items={type:'string',enum:ops};
 p.session_progression.minItems=input.constraints.requested_sessions;p.session_progression.maxItems=input.constraints.requested_sessions;
 const transform=x=>{
  if(Array.isArray(x))return x.map(transform);
  if(!x||typeof x!=='object')return x;
  const y={};for(const [k,v]of Object.entries(x)){
   if(['$schema','minLength','pattern','uniqueItems'].includes(k))continue;
   if(k==='const'){y.enum=[v];continue}y[k]=transform(v);
  }return y;
 };
 return transform(schema);
}
