const safe=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{12,100}$/.test(id);
export function blueprintTraceStore(store){
 return {
  async write(trace){
   if(trace?.trace_version!=='BLUEPRINT_EVIDENCE_TRACE_V1'||!safe(trace.blueprint_id)||![1,2].includes(trace.blueprint_revision)||[trace.composition_id,trace.run_id].some(id=>id!==null&&!safe(id)))throw Error('BLUEPRINT_TRACE_ID_INVALID');
   await store.setup();
   const part=`trace-r${trace.blueprint_revision}`;
   // Existing evidenceStore.put is create-only: no overwrite/upsert.
   await store.put(trace.blueprint_id,part,trace);
   for(const id of new Set([trace.composition_id,trace.run_id].filter(id=>id&&id!==trace.blueprint_id)))await store.put(id,`trace-${trace.blueprint_id}-r${trace.blueprint_revision}`,{blueprint_id:trace.blueprint_id,blueprint_revision:trace.blueprint_revision,evaluated_blueprint_hash:trace.evaluated_blueprint_hash});
  },
  async recover({composition_id,run_id,blueprint_id}){
   const ids=[composition_id,run_id,blueprint_id].filter(Boolean);if(ids.length!==1||!safe(ids[0]))throw Error('BLUEPRINT_TRACE_LOOKUP_INVALID');
   const id=ids[0],files=await store.list(id),traces=[];
   for(const file of files){
    if(!/^trace-(?:r[12]|[a-zA-Z0-9-]{12,100}-r[12])\.json$/.test(file.name))continue;
    const record=await store.get(id,file.name.slice(0,-5));
    const trace=record?.trace_version?record:record?await store.get(record.blueprint_id,`trace-r${record.blueprint_revision}`):null;
    if(!trace)throw Error('BLUEPRINT_TRACE_REFERENCE_MISSING');
    if(composition_id&&trace.composition_id!==composition_id||run_id&&trace.run_id!==run_id||blueprint_id&&trace.blueprint_id!==blueprint_id)throw Error('BLUEPRINT_TRACE_REFERENCE_MISMATCH');
    traces.push(trace);
   }
   return traces.sort((a,b)=>a.blueprint_id.localeCompare(b.blueprint_id)||a.blueprint_revision-b.blueprint_revision);
  }
 };
}
