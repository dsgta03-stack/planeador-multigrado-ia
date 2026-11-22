import {hash,deepFreeze} from './contracts.mjs';

export function buildBlueprintEvidenceTrace({blueprint,semantic,sources,composition,authorTelemetry,run_id=null,timestamp=new Date().toISOString()}){
 const evaluated_blueprint_hash=hash(blueprint),semantic_audit_hash=semantic?.audit?hash(semantic.audit):null;
 const calls=[{...authorTelemetry,provider_task:blueprint.revision===1?'BLUEPRINT_GENERATE':'BLUEPRINT_REPAIR'},...(semantic?.telemetry?.calls||[semantic?.telemetry].filter(Boolean)).map(c=>({...c,provider_task:'SEMANTIC_REVIEW'}))];
 const correlations=calls.flatMap(c=>(c.attempts?.length?c.attempts:[{request_id:null}]).map(a=>({run_id,run_authority:run_id?'run_id':'blueprint_id',blueprint_id:blueprint.blueprint_id,composition_id:composition?.composition_id??null,blueprint_revision:blueprint.revision,review_focus:c.review_focus??null,provider_task:c.review_focus==='PDA'?'PDA_REVIEW':c.provider_task,request_id:a.request_id??null,input_hash:c.input_hash??null,output_hash:Object.hasOwn(a,'output_hash')?a.output_hash:c.output_hash??null,evaluated_blueprint_hash,semantic_audit_hash,timestamp:a.started_at??timestamp})));
 const stages=new Map(blueprint.project_stages.map(s=>[s.stage_id,s]));
 const pda_evidence_index=(semantic?.audit?.pda_checks||[]).map(c=>({pda_id:c.pda_id,grade:c.grade,stage_ids:[...c.stage_ids],student_operation_hashes:c.stage_ids.map(id=>({stage_id:id,hash:stages.has(id)?hash(stages.get(id).student_operation):null})),operation_quote:c.operation_quote,quote_valid:typeof c.operation_quote==='string'&&c.operation_quote.trim().length>0&&c.stage_ids.some(id=>stages.get(id)?.student_operation.includes(c.operation_quote)),reviewer_status:{bps004:c.bps004,bps005:c.bps005},evidence_reason_hash:hash(c.evidence_reason)}));
 return deepFreeze({trace_version:'BLUEPRINT_EVIDENCE_TRACE_V1',run_id,run_authority:run_id?'run_id':'blueprint_id',blueprint_id:blueprint.blueprint_id,composition_id:composition?.composition_id??null,blueprint_revision:blueprint.revision,evaluated_blueprint_hash,semantic_audit_hash,timestamp,correlations,pda_evidence_index,blueprint:structuredClone(blueprint),semantic_audit:semantic?.audit?structuredClone(semantic.audit):null,reviewer_result:semantic?structuredClone(semantic.findings):null,official_pdas:structuredClone(sources.curriculum.pdas.filter(p=>sources.constraints.selected_pda_ids.includes(p.pda_id)))});
}

export function assertBlueprintEvidenceTrace(trace){
 if(hash(trace.blueprint)!==trace.evaluated_blueprint_hash||trace.blueprint.blueprint_id!==trace.blueprint_id||trace.blueprint.revision!==trace.blueprint_revision||(trace.semantic_audit?hash(trace.semantic_audit):null)!==trace.semantic_audit_hash)throw Error('BLUEPRINT_EVIDENCE_TRACE_HASH_MISMATCH');
 return trace;
}

export function publicBlueprintEvidenceTrace(trace,persistence_status='PERSISTED'){
 return {run_id:trace.run_id,run_authority:trace.run_authority,blueprint_id:trace.blueprint_id,composition_id:trace.composition_id,revision:trace.blueprint_revision,evaluated_blueprint_hash:trace.evaluated_blueprint_hash,semantic_audit_hash:trace.semantic_audit_hash,persistence_status,provider_request_ids:trace.correlations.map(c=>({task:c.provider_task,review_focus:c.review_focus,request_id:c.request_id})),pda_evidence_summary:trace.pda_evidence_index.map(p=>({pda_id:p.pda_id,quote_valid:p.quote_valid,reviewer_status:p.reviewer_status}))};
}

export function createBlueprintEvidenceTransport({endpoint,token,identity='multiplan-blueprint-shadow-test-v1',fetchImpl=fetch}){
 const call=async body=>{
  const r=await fetchImpl(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`,'x-shadow-identity':identity},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error('BLUEPRINT_EVIDENCE_TRACE_STORAGE_FAILED');return r.json();
 };
 return {async write(trace){assertBlueprintEvidenceTrace(trace);await call({task:'BLUEPRINT_TRACE_WRITE',trace});},async recover({composition_id,run_id,blueprint_id}){const result=await call({task:'BLUEPRINT_TRACE_READ',composition_id,run_id,blueprint_id});return result.traces.map(t=>deepFreeze(assertBlueprintEvidenceTrace(t)));}};
}
