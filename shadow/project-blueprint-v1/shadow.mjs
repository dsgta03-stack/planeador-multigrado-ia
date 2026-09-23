import {randomUUID} from 'node:crypto';
import {assertContract,hash,deepFreeze,sourceBinding} from './contracts.mjs';
import {blueprintGate,semanticInputHash,functionalDiagnostics} from './gate.mjs';
import {callProvider} from './provider.mjs';
export function structuralDiff(a,b,path='$'){
 if(JSON.stringify(a)===JSON.stringify(b))return [];
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b))return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>structuralDiff(a[k],b[k],`${path}.${k}`));
 return [{changed_field:path,previous_value:a??null,new_value:b??null}];
}
export async function reviewBlueprint(input,options={},provider=callProvider){
 const r=await provider('REVIEW',input,options);
 return {input_hash:semanticInputHash(input),findings:r.output.findings,telemetry:r.telemetry};
}
export function assertApproved(envelope){
 if(envelope.status!=='APPROVED'||envelope.gate.status!=='PASS'||hash(envelope.blueprint)!==envelope.approved_blueprint_hash||envelope.gate.evaluated_blueprint_hash!==envelope.approved_blueprint_hash)throw Error('APPROVED_BLUEPRINT_TAMPERED_OR_NOT_APPROVED');return true;
}
export async function generateShadow(sources,options={},provider=callProvider){
 if(Object.keys(sources).sort().join(',')!=='constraints,curriculum,methodology')throw Error('ONLY_SOURCE_ARTIFACTS_ALLOWED_NO_LEGACY_PLAN');
 for(const [name,key] of [['TeacherConstraintsV1','constraints'],['CurriculumSnapshotV1','curriculum'],['MethodologyDecisionV1','methodology']])assertContract(name,sources[key]);
 const frozen=deepFreeze(structuredClone(sources)),revisions=[],telemetry=[];const id=randomUUID();
 for(let revision=1;revision<=2;revision++){
  const previous=revisions.at(-1);
  const repair=previous?{previous_blueprint:previous.blueprint,triggering_rules:[...previous.gate.deterministic_findings,...previous.gate.semantic_findings].filter(x=>x.status!=='PASS'),instruction:'Repara sólo el Blueprint. Conserva decisiones docentes, texto oficial, método y fuentes. No añadas frases para aparentar PASS.'}:null;
  const r=await provider(revision===1?'GENERATE':'REPAIR',frozen,{...options,repair});telemetry.push({...r.telemetry,repair_count:revision-1});
  const raw=structuredClone(r.output);
  // Envelope IDs are assigned by the orchestrator, never pedagogy or source fields.
  const b={...raw,blueprint_id:id,revision,status:'DRAFT',gate_result:null};
  const input={...frozen,blueprint:b};let gate=blueprintGate(input),semantic=null;
  // Full gate is rerun after semantic review. Invalid schema is never sent for review.
  if(!gate.deterministic_findings.some(x=>x.rule_id==='BPD-SCHEMA'&&x.status==='FAIL')){
   try{semantic=await reviewBlueprint(input,options,provider);telemetry.push({...semantic.telemetry,repair_count:revision-1})}catch(e){telemetry.push({task:'REVIEW',error:String(e),repair_count:revision-1})}
   gate=blueprintGate(input,semantic);
  }
  const status=gate.status==='PASS'?'APPROVED':b.pda_analysis?.some(x=>['WEAK','INCOMPATIBLE'].includes(x.integration_strength))?'NEEDS_TEACHER_DECISION':revision===1?'NEEDS_REPAIR':gate.status==='NOT_EVALUABLE'?'NEEDS_REPAIR':'REJECTED';
  revisions.push({revision,label:revision===1?(status==='APPROVED'?'PASS':'FAIL'):(status==='APPROVED'?'REPAIRED':'REPAIR_FAILED'),status,blueprint:b,gate,semantic,functional_diagnostics:b.final_outcome&&b.project_stages?functionalDiagnostics(b):[],diff:previous?structuralDiff(previous.blueprint,b):[],triggering_rules:repair?.triggering_rules.map(x=>x.rule_id)||[]});
  if(['APPROVED','NEEDS_TEACHER_DECISION'].includes(status))break;
 }
 const final=revisions.at(-1);
 // Keep the evaluated DRAFT bytes immutable. Approval is an external envelope;
 // do not mutate the candidate to set gate_result/status after hashing/reviewing.
 return deepFreeze({mode:'SHADOW',status:final.status,blueprint:final.blueprint,gate:final.gate,approved_blueprint_hash:final.status==='APPROVED'?hash(final.blueprint):null,revisions,telemetry,repair_count:revisions.length-1});
}
