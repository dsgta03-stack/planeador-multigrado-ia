export const MAX_CANDIDATE_CHARS=100000;
export function redactSecrets(value,secrets=[]){
 let s=String(value);for(const secret of secrets)if(secret)s=s.split(secret).join('[REDACTED]');return s;
}
// Called only after shadow authentication and a successful Google HTTP response.
// Parse strictly once. Never fix or reconstruct candidate JSON, never log it.
export function parseCandidate(result,{model,latency_ms,max_output_tokens=null,diagnostic=false,secrets=[]}){
 const candidate=result?.candidates?.[0];
 const text=candidate?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('')||'';
 const meta={provider:'google',model,provider_status:200,finish_reason:candidate?.finishReason||null,usage:result?.usageMetadata||null,usageMetadata:result?.usageMetadata||null,latency_ms,max_output_tokens,text_length:text.length,cost:null};
 if(diagnostic&&candidate?.finishReason==='MAX_TOKENS'){let parse_error=null;try{JSON.parse(text)}catch(e){parse_error=redactSecrets(String(e),secrets)}return {http_status:502,body:{...meta,code:'BLUEPRINT_OUTPUT_BLOAT',raw_candidate_text:redactSecrets(text.slice(0,MAX_CANDIDATE_CHARS),secrets),text_truncated:text.length>MAX_CANDIDATE_CHARS,parse_error}};}
 try{return {http_status:200,body:{...meta,output:JSON.parse(text)}}}
 catch(error){
  const message=String(error),position=message.match(/position\s+(\d+)/i);
  return {http_status:502,body:{...meta,code:'PROVIDER_OUTPUT_INVALID_JSON',raw_candidate_text:redactSecrets(text.slice(0,MAX_CANDIDATE_CHARS),secrets),text_length:text.length,text_truncated:text.length>MAX_CANDIDATE_CHARS,parse_error:redactSecrets(message,secrets),parse_error_position:position?Number(position[1]):null}};
 }
}
