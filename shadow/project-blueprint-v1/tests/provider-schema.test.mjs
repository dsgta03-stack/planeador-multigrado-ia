import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {authoringSchema} from '../authoring-proposal.mjs';import {providerResponseSchema,providerAuthoringShapeSchema,assertProviderSchema} from '../provider-schema.mjs';import {hash} from '../contracts.mjs';import {REVIEW_SCHEMA} from '../semantic-evidence.mjs';
const old=JSON.parse(readFileSync(new URL('../evidence/schema-400-effective-request.json',import.meta.url))),local=authoringSchema(old.request.input,old.request.prompt.construction_plan);
test('historical schema exactly reproduced; only maxLength removed and local limits retained',()=>{
 assert.deepEqual(local,old.request.response_schema);const h=hash(local),{schema,removed}=providerResponseSchema(local);
 assert.equal(hash(local),h);assert.equal(local.properties.grade_contributions.items.properties.support_need.maxLength,1200);assert.equal(local.properties.project_stages.items.properties.student_operation.maxLength,4000);
 assert(removed.length>0);assert(removed.every(x=>x.keyword==='maxLength'));assert(!JSON.stringify(schema).includes('maxLength'));
 // Reinsert removed fields using structural comparison: every other value exact.
 function compare(a,b){for(const [k,v] of Object.entries(a)){if(k==='maxLength'){assert(!(k in b));continue}if(v&&typeof v==='object')compare(v,b[k]);else assert.deepEqual(b[k],v)}assert.deepEqual(Object.keys(b),Object.keys(a).filter(k=>k!=='maxLength'));}compare(local,schema);assertProviderSchema(schema);
});
test('guard reports unsupported keyword and exact path, including nested definitions',()=>{
 for(const schema of [local,{type:'object',properties:{data:{type:'string',pattern:'x'}}},{$defs:{A:{type:'string',maxLength:1}},$ref:'#/$defs/A'}])assert.throws(()=>assertProviderSchema(schema),e=>e.code==='PROVIDER_SCHEMA_UNSUPPORTED_KEYWORD'&&e.path.startsWith('$')&&['maxLength','pattern'].includes(e.keyword));
 assertProviderSchema({type:'object',properties:{maxLength:{type:'string'}},required:['maxLength']});
});
test('unknown constraints fail closed; supported refs, arrays, enums and nullability survive',()=>{
 assert.throws(()=>providerResponseSchema({type:'string',madeUpRule:true}),/madeUpRule/);
 const s={$defs:{value:{type:'string',enum:['A','B']}},type:'object',properties:{rows:{type:'array',items:{$ref:'#/$defs/value'},minItems:1,maxItems:3},nullable:{anyOf:[{type:'integer',minimum:0},{type:'null'}]}},required:['rows','nullable'],additionalProperties:false};assert.deepEqual(providerResponseSchema(s).schema,s);
});
test('review local minLength remains intact; transport projection passes guard',()=>{const h=hash(REVIEW_SCHEMA);assert.throws(()=>assertProviderSchema(REVIEW_SCHEMA),e=>e.keyword==='minLength');const p=providerResponseSchema(REVIEW_SCHEMA);assert(p.removed.every(x=>x.keyword==='minLength'));assertProviderSchema(p.schema);assert.equal(hash(REVIEW_SCHEMA),h);});
test('compact authoring uses decoder shape without weakening local contract',()=>{
 const h=hash(local),p=providerAuthoringShapeSchema(local),serialized=JSON.stringify(p.schema);
 assert.equal(hash(local),h);assert.equal(p.profile,'AUTHORING_SHAPE_V1');assertProviderSchema(p.schema);
 assert.deepEqual(p.schema.required,local.required);assert.deepEqual(Object.keys(p.schema.properties),Object.keys(local.properties));
 assert.equal(p.schema.properties.grade_contributions.items.properties.support_need.type,'string');
 assert.equal(p.schema.properties.final_outcome.properties.required_resources.items.properties.alternative.type.includes('null'),true);
 for(const keyword of ['maxLength','minLength','enum','minItems','maxItems','minimum','maximum','additionalProperties','anyOf'])assert.equal(serialized.includes(`\"${keyword}\"`),false,keyword);
 assert.equal(local.properties.grade_contributions.items.properties.support_need.maxLength,1200);
 assert.equal(local.properties.coverage.minItems,11);
});
