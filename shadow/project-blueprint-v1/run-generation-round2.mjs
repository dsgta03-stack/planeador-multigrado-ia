import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {sources} from './fixtures/build.mjs';
import {makeConstraints} from './contracts.mjs';
import {generateShadow} from './shadow.mjs';
import {blueprintGate} from './gate.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
// Generation starts only after the entire current suite has matching, complete reviews.
for(const file of readdirSync(new URL('./fixtures/',import.meta.url)).filter(x=>/^PB-.*\.json$/.test(x))){
 const fixture=read('./fixtures/'+file),e=read('./evidence/'+file),g=blueprintGate(fixture.input,e.semantic);
 if(!e.match||e.error||g.semantic_findings.length!==12||g.semantic_findings.some(x=>x.status==='NOT_EVALUABLE'))throw Error('FIXTURE_SUITE_NOT_READY:'+file);
}
const options=JSON.parse(readFileSync(process.env.MULTIPLAN_SHADOW_AUTH_FILE));
const mode=process.argv[2]||'positive';
let src=sources({method:'proyectos_comunitarios'});
if(mode==='adversarial'){
 src={...src,constraints:makeConstraints({...src.constraints,requested_sessions:1,minutes_per_session:1,teacher_explicit_constraints:[...src.constraints.teacher_explicit_constraints,'Debe consultarse al docente y al grupo por separado, contrastar dos testimonios, construir piezas explicadas, presentarlas en aula y patio y registrar las preguntas recibidas dentro del único minuto disponible. No se permite trabajo antes o después ni alargar el tiempo.']})};
}
const result=await generateShadow(src,options);
const file=`./evidence/round2-generated-${mode}-${Date.now()}.json`;
writeFileSync(new URL(file,import.meta.url),JSON.stringify({case:mode,sources:src,...result},null,2));
console.log(JSON.stringify({file,status:result.status,repair_count:result.repair_count,errors:result.errors,failures:[...result.gate?.deterministic_findings||[],...result.gate?.semantic_findings||[]].filter(x=>x.status!=='PASS').map(x=>({rule:x.rule_id,status:x.status,observed:x.observed}))}));
