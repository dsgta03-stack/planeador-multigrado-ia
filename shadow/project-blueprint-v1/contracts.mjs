import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {CATALOG,CATALOG_VERSION} from './catalog.mjs';
export function canonical(x){
 if(x===null||typeof x!=='object'){if(x===undefined||typeof x==='number'&&!Number.isFinite(x))throw Error('NON_JSON_VALUE');return JSON.stringify(x)}
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
}
export const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
export function deepFreeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(deepFreeze);Object.freeze(x)}return x}
export const schemaFor=name=>JSON.parse(readFileSync(new URL(`./schemas/${name}.json`,import.meta.url),'utf8'));
// Restricted JSON Schema interpreter: schemas in this directory use only these keywords.
export function schemaErrors(value,schema,path='$'){
 const e=[],fail=m=>e.push(`${path}: ${m}`);
 if(schema.anyOf){if(!schema.anyOf.some(s=>schemaErrors(value,s,path).length===0))fail('anyOf');return e}
 if(schema.const!==undefined&&value!==schema.const)fail('const');
 if(schema.enum&&!schema.enum.includes(value))fail('enum');
 const t=schema.type;
 if(t==='null'){if(value!==null)fail('null');return e}
 if(t==='object'){
  if(!value||typeof value!=='object'||Array.isArray(value)){fail('object');return e}
  for(const k of schema.required||[])if(!(k in value))fail(`required ${k}`);
  for(const [k,v]of Object.entries(value)){
   if(schema.properties?.[k])e.push(...schemaErrors(v,schema.properties[k],`${path}.${k}`));
   else if(schema.additionalProperties===false)fail(`unknown ${k}`);
   else if(schema.additionalProperties&&typeof schema.additionalProperties==='object')e.push(...schemaErrors(v,schema.additionalProperties,`${path}.${k}`));
  }
 }
 if(t==='array'){
  if(!Array.isArray(value)){fail('array');return e}
  if(schema.minItems!==undefined&&value.length<schema.minItems)fail('minItems');
  if(schema.uniqueItems&&new Set(value.map(canonical)).size!==value.length)fail('uniqueItems');
  value.forEach((x,i)=>e.push(...schemaErrors(x,schema.items,`${path}[${i}]`)));
 }
 if(t==='string'){
  if(typeof value!=='string'){fail('string');return e}
  if(schema.minLength&&value.trim().length<schema.minLength)fail('minLength');
  if(schema.pattern&&!new RegExp(schema.pattern).test(value))fail('pattern');
 }
 if(t==='integer'||t==='number'){
  if(typeof value!=='number'||!Number.isFinite(value)||(t==='integer'&&!Number.isInteger(value))){fail(t);return e}
  if(schema.minimum!==undefined&&value<schema.minimum)fail('minimum');if(schema.maximum!==undefined&&value>schema.maximum)fail('maximum');
 }
 if(t==='boolean'&&typeof value!=='boolean')fail('boolean');
 return e;
}
export function assertContract(name,x){const e=schemaErrors(x,schemaFor(name));if(e.length)throw Error(`${name}: ${e.join('; ')}`);return x}
function bodyWithout(value,keys){return Object.fromEntries(Object.entries(value).filter(([k])=>!keys.includes(k)))}
export const constraintsHash=x=>hash(bodyWithout(x,['constraints_id','constraints_hash','created_at']));
export const snapshotHash=x=>hash(bodyWithout(x,['snapshot_id','snapshot_hash','created_at']));
export function makeConstraints(input){
 const x={...structuredClone(input),schema_version:'TEACHER_CONSTRAINTS_V1',constraints_id:randomUUID(),created_at:new Date().toISOString()};x.constraints_hash=constraintsHash(x);
 assertContract('TeacherConstraintsV1',x);return deepFreeze(x);
}
export function makeSnapshot(input){
 const x={...structuredClone(input),schema_version:'CURRICULUM_SNAPSHOT_V1',snapshot_id:randomUUID(),created_at:new Date().toISOString()};x.snapshot_hash=snapshotHash(x);
 assertContract('CurriculumSnapshotV1',x);return deepFreeze(x);
}
export function makeDecision({recommended_id=null,selected_id,selection_source}){
 if(!CATALOG[selected_id])throw Error('UNKNOWN_METHODOLOGY_NO_FALLBACK');
 const x={schema_version:'METHODOLOGY_DECISION_V1',methodology_decision_id:randomUUID(),recommended_id,selected_id,selection_source,catalog_version:CATALOG_VERSION,required_operations:[...CATALOG[selected_id]]};
 assertContract('MethodologyDecisionV1',x);if(selection_source==='TEACHER_ACCEPTED_RECOMMENDATION'&&recommended_id!==selected_id)throw Error('RECOMMENDATION_NOT_ACCEPTED');return deepFreeze(x);
}
export const sourceBinding=({constraints,curriculum,methodology})=>({constraints_hash:constraints.constraints_hash,curriculum_snapshot_hash:curriculum.snapshot_hash,methodology_decision_id:methodology.methodology_decision_id,methodology_decision_hash:hash(methodology)});
