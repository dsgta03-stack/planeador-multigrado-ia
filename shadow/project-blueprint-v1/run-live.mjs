import {readFileSync,writeFileSync,existsSync,renameSync} from 'node:fs';
import {generateShadow,reviewBlueprint} from './shadow.mjs';
import {blueprintGate} from './gate.mjs';
import {sources} from './fixtures/build.mjs';
const options=JSON.parse(readFileSync(process.env.MULTIPLAN_SHADOW_AUTH_FILE||'/tmp/multiplan-blueprint-shadow-auth.json'));
const mode=process.argv[2];
function save(name,result){const path=new URL(`./evidence/${name}.json`,import.meta.url);if(existsSync(path))renameSync(path,new URL(`./evidence/${name}-attempt-${Date.now()}.json`,import.meta.url));writeFileSync(path,JSON.stringify(result,null,2));}
if(mode==='generate'){
 const src=sources({method:process.argv[3]||'proyectos_comunitarios'});const result=await generateShadow(src,options);
 save('generated-blueprint',{sources:src,...result});console.log(JSON.stringify({status:result.status,repairs:result.repair_count,errors:result.errors,failures:[...result.gate?.deterministic_findings||[],...result.gate?.semantic_findings||[]].filter(x=>x.status!=='PASS')}));
}else{
 const ids=process.argv.slice(2);
 for(const id of ids){
  const f=JSON.parse(readFileSync(new URL(`./fixtures/${id}.json`,import.meta.url)));const start=Date.now();
  try{const semantic=await reviewBlueprint(f.input,options);const gate=blueprintGate(f.input,semantic);
   const df=gate.deterministic_findings.filter(x=>x.status==='FAIL').map(x=>x.rule_id),sf=gate.semantic_findings.filter(x=>x.status==='FAIL').map(x=>x.rule_id);
   const expected=f.expected;const match=(!expected.deterministic||expected.deterministic.every(x=>df.includes(x)))&&(!expected.semantic||expected.semantic.every(x=>sf.includes(x)))&&(!expected.pass||gate.status==='PASS')&&(!expected.functional_pass||gate.semantic_findings.some(x=>x.rule_id==='BPS-003'&&x.status==='PASS'))&&(!expected.teacher_decision||gate.status==='NEEDS_TEACHER_DECISION');
   const result={id,expected,actual:gate.status,match,deterministic_failures:df,semantic_failures:sf,warnings:gate.warning_count,repair_count:0,generation_latency_ms:null,semantic_review_latency_ms:Date.now()-start,semantic,gate};
   save(id,result);console.log(JSON.stringify({id,actual:gate.status,match,df,sf}));
  }catch(e){const result={id,error:String(e),telemetry:e.telemetry||null,match:false};save(id,result);console.log(JSON.stringify(result))}
 }
}
