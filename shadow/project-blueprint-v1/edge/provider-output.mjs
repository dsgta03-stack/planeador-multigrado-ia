export const MAX_CANDIDATE_CHARS=100000;
export function redactSecrets(value,secrets=[]){
 let s=String(value);for(const secret of secrets)if(secret)s=s.split(secret).join('[REDACTED]');return s;
}
// Called only after shadow authentication and a successful Google HTTP response.
// Parse strictly once. Never fix or reconstruct candidate JSON, never log it.
export function parseCandidate(result,{model,latency_ms,secrets=[]}){
 const candidate=result?.candidates?.[0];
 const text=candidate?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('')||'';
 const meta={provider:'google',model,provider_status:200,finish_reason:candidate?.finishReason||null,usage:result?.usageMetadata||null,usageMetadata:result?.usageMetadata||null,latency_ms,cost:null};
 try{return {http_status:200,body:{...meta,output:JSON.parse(text)}}}
 catch(error){
  const message=String(error),position=message.match(/position\s+(\d+)/i);
  return {http_status:502,body:{...meta,code:'PROVIDER_OUTPUT_INVALID_JSON',raw_candidate_text:redactSecrets(text.slice(0,MAX_CANDIDATE_CHARS),secrets),text_length:text.length,text_truncated:text.length>MAX_CANDIDATE_CHARS,parse_error:redactSecrets(message,secrets),parse_error_position:position?Number(position[1]):null}};
 }
}
