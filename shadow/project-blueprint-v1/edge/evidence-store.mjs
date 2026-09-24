import {redactSecrets} from './provider-output.mjs';
export const EVIDENCE_BUCKET='multiplan-blueprint-shadow-evidence-v1';
export function evidenceStore({url,serviceKey,secrets=[],fetchImpl=fetch}){
 if(!url||!serviceKey)throw Error('SHADOW_EVIDENCE_STORAGE_UNAVAILABLE');
 const headers={authorization:`Bearer ${serviceKey}`,apikey:serviceKey,'content-type':'application/json'};
 const request=(path,options={})=>fetchImpl(`${url}/storage/v1/${path}`,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(20000)});
 const valid=id=>{if(!/^[a-zA-Z0-9-]{12,100}$/.test(id))throw Error('INVALID_EVIDENCE_ID')};
 return {
  async setup(){let r=await request(`bucket/${EVIDENCE_BUCKET}`);if(!r.ok){r=await request('bucket',{method:'POST',body:JSON.stringify({id:EVIDENCE_BUCKET,name:EVIDENCE_BUCKET,public:false,file_size_limit:8000000,allowed_mime_types:['application/json']})});if(!r.ok)throw Error('SHADOW_EVIDENCE_BUCKET_CREATE_FAILED');r=await request(`bucket/${EVIDENCE_BUCKET}`);}const b=await r.json();if(!r.ok||b.public!==false)throw Error('SHADOW_EVIDENCE_BUCKET_NOT_PRIVATE');return true;},
  async put(id,part,data){valid(id);if(!['request','received','parsed','result'].includes(part))throw Error('INVALID_EVIDENCE_PART');const r=await request(`object/${EVIDENCE_BUCKET}/${id}/${part}.json`,{method:'POST',body:redactSecrets(JSON.stringify(data),[serviceKey,...secrets])});if(!r.ok)throw Error(`EVIDENCE_PERSISTENCE_FAILED:${part}:${r.status}`);},
  async get(id,part='result'){valid(id);if(!['request','received','parsed','result'].includes(part))throw Error('INVALID_EVIDENCE_PART');const r=await request(`object/authenticated/${EVIDENCE_BUCKET}/${id}/${part}.json`);if(!r.ok){if([400,404].includes(r.status))return null;throw Error('EVIDENCE_READ_FAILED');}return r.json();}
 };
}
