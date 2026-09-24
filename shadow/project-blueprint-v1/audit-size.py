"""Read-only lexical size audit. Never repair, reconstruct, or accept partial JSON."""
import json,pathlib,re,collections,hashlib
ROOT=pathlib.Path(__file__).resolve().parent
source=ROOT/'evidence/construction-positive-1790208014571.json'
r=json.loads(source.read_text());d=r['telemetry'][0]['attempts'][0]['provider_diagnostics'];raw=d['raw_candidate_text'];nodes=[];i=0
class End(Exception):pass
def ws():
 global i
 while i<len(raw) and raw[i].isspace():i+=1
def string():
 global i
 start=i;i+=1
 while i<len(raw):
  c=raw[i];i+=1
  if c=='\\':i+=1
  elif c=='"':return start,i,True
 return start,len(raw),False
def value(path):
 global i
 ws();start=i
 if i>=len(raw):raise End()
 c=raw[i];kind='primitive';complete=True;val=None
 try:
  if c=='"':
   kind='string';a,b,complete=string();val=json.loads(raw[a:b]) if complete else raw[a+1:b]
  elif c in '{[':
   kind='object' if c=='{' else 'array';closing='}' if c=='{' else ']';i+=1;ws();index=0
   if i<len(raw) and raw[i]==closing:i+=1
   else:
    while True:
     ws()
     if i>=len(raw):raise End()
     if c=='{':
      if raw[i]!='"':raise End()
      a,b,ok=string()
      if not ok:raise End()
      key=json.loads(raw[a:b]);ws()
      if i>=len(raw) or raw[i]!=':':raise End()
      i+=1;value(path+'.'+key)
     else:value(path+'['+str(index)+']');index+=1
     ws()
     if i>=len(raw):raise End()
     if raw[i]==closing:i+=1;break
     if raw[i]!=',':raise End()
     i+=1
  else:
   while i<len(raw) and raw[i] not in ',}]':i+=1
   try:val=json.loads(raw[start:i])
   except Exception:complete=False
 except End:complete=False;i=len(raw)
 n={'path':path,'type':kind,'characters':i-start,'complete_in_retained_prefix':complete}
 if kind=='string':
  n['preview']=val[:160];n['whitespace_characters']=sum(ch.isspace() for ch in val);n['longest_whitespace_run']=max([len(x) for x in re.findall(r'\s+',val)] or [0]);n['_value']=val
 nodes.append(n)
 if not complete:raise End()
try:value('$')
except End:pass
strings=[n for n in nodes if n['type']=='string'];bytext=collections.defaultdict(list)
for n in strings:
 if n['complete_in_retained_prefix']:bytext[n['_value']].append(n['path'])
duplicates=[{'characters_per_value':len(k),'occurrences':len(v),'paths':v,'preview':k[:120]} for k,v in bytext.items() if len(v)>1 and len(k)>2]
normalized=collections.defaultdict(list)
for n in strings:
 if n['complete_in_retained_prefix']:normalized[' '.join(n['_value'].casefold().split())].append(n['path'])
near=[{'normalized_characters':len(k),'paths':v,'preview':k[:120]} for k,v in normalized.items() if len(v)>1 and len(k)>20]
def ownership(path):
 field=re.sub(r'\[\d+\]','',path).split('.')[-1]
 if path.startswith('$.source') or path.startswith('$.methodology') or field in ['schema_version','blueprint_id','revision','status','gate_result','session_number','input_artifact_ids','expected_output_artifact_ids','integration_destination','output_artifact_id','consumed_by','required_inputs','order','methodology_operations','total_available_minutes','minutes_per_session','requested_sessions','next_session_dependency','terminal']:return 'COMPILER_OWNED'
 if field in ['official_text','pda_id','pda_ids','grade','original_problem']:return 'REFERENCE_ONLY'
 if '.construction_evidence' in path and field.endswith('_quote'):return 'REDUNDANT'
 return 'MODEL_OWNED'
internal_repeats=[]
for n in strings:
 words=re.findall(r'\w+',n['_value'].casefold())
 if len(words)>200:
  grams=collections.Counter(' '.join(words[i:i+12]) for i in range(len(words)-11))
  internal_repeats.append({'path':n['path'],'word_count_observed':len(words),'top_repeated_12_word_sequences':[{'text':t,'occurrences':count} for t,count in grams.most_common(8) if count>1]})
for n in nodes:n['ownership']=ownership(n['path']);n.pop('_value',None)
pdas=r['sources']['curriculum']['pdas'];ops=r['sources']['methodology']['required_operations']
out={'source_file':source.name,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'source_status':r['status'],'provider_text_length':d['text_length'],'retained_characters':len(raw),'text_truncated':d['text_truncated'],'measurement':'Observed prefix only. Incomplete node lengths are lower bounds. Containers overlap their children; do not sum all nodes. No partial Blueprint reconstructed.','top_leaf_fields':sorted([n for n in nodes if n['type'] not in ['object','array']],key=lambda n:n['characters'],reverse=True)[:20],'top_arrays':sorted([n for n in nodes if n['type']=='array'],key=lambda n:n['characters'],reverse=True)[:15],'all_paths':sorted(nodes,key=lambda n:n['path']),'within_field_repeats':internal_repeats,'identical_texts':sorted(duplicates,key=lambda n:n['characters_per_value']*n['occurrences'],reverse=True),'normalized_repeats':near,'official_text_occurrences':[{'pda_id':p['pda_id'],'official_text':raw.count(p['pda_official']),'id_occurrences':raw.count(p['pda_id'])} for p in pdas],'methodology_operation_occurrences':{op:raw.count(op) for op in ops},'scope_limit':'Artifact metadata, criteria/evidence, state_before/state_after and all other fields are measured only if present in retained prefix. Unseen tails are unknown, not zero.'}
(ROOT/'evidence/blueprint-size-audit.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
md='# Auditoría de tamaño del Blueprint\n\n'+out['measurement']+'\n\nFuente: '+source.name+f". Texto total reportado: {d['text_length']}; prefijo disponible: {len(raw)} caracteres.\n\n| Ruta | Caracteres observados | Completo | Clase |\n|---|---:|---|---|\n"
for n in out['top_leaf_fields']:md+=f"| {n['path']} | {n['characters']} | {n['complete_in_retained_prefix']} | {n['ownership']} |\n"
md+='\nArrays (tamaños inclusivos; no sumar con sus hijos):\n\n'
for n in out['top_arrays']:md+=f"- {n['path']}: {n['characters']} caracteres.\n"
md+='\nRepetición exacta/normalizada, presencia de texto oficial/PDA/operaciones, metadatos de artefactos y todas las rutas observadas están en blueprint-size-audit.json. Campos no presentes en el prefijo no pueden medirse. Los estados antes/después expresan progresión conceptual y no se eliminarán automáticamente aunque sus nombres sean similares.\n'
md+='\nRepetición dentro de campos (secuencias superpuestas; no sumar):\n\n'+json.dumps(internal_repeats,ensure_ascii=False,indent=2)+'\n'
(ROOT/'evidence/blueprint-size-audit.md').write_text(md)
print(json.dumps({'top':out['top_leaf_fields'][:5],'arrays':out['top_arrays'][:3]},ensure_ascii=False))
