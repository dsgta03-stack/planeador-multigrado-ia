import test from 'node:test';
import assert from 'node:assert/strict';
import {sources} from '../fixtures/build.mjs';
import {constructionPlan} from '../construction.mjs';
import {callProvider} from '../provider.mjs';

test('compact GENERATE and REPAIR share final-stage literal coverage rules',async()=>{
 const src=sources(),plan=constructionPlan(src),sent=[],previous=process.env.MULTIPLAN_SHADOW_RUN;
 try{
  process.env.MULTIPLAN_SHADOW_RUN='1';
  for(const task of ['GENERATE','REPAIR'])await callProvider(task,src,{
   endpoint:'https://example.invalid/plan-project-blueprint-v1-shadow',token:'synthetic',authoringCompact:true,constructionPlan:plan,
   ...(task==='REPAIR'?{repair:{instruction:'Repair only invalid coverage'}}:{}),
   fetchImpl:async(url,request)=>{sent.push(JSON.parse(request.body));return {ok:true,status:200,json:async()=>({output:{synthetic:true}})};}
  });
 }finally{if(previous===undefined)delete process.env.MULTIPLAN_SHADOW_RUN;else process.env.MULTIPLAN_SHADOW_RUN=previous;}
 assert.equal(sent.length,2);
 assert.equal(sent[0].prompt.coverage_protocol,sent[1].prompt.coverage_protocol);
 for(const request of sent){
  const protocol=request.prompt.coverage_protocol;
  for(const rule of ['primero la versión final','después construye coverage','coverage.stage_id','coverage_matrix','literal, contigua, carácter por carácter','ESA MISMA etapa','No resumir','no parafrasear','no unir fragmentos separados','puntuación, conectores o espacios','stage.student_operation.includes(action_quote) === true','expected_output, index DEBE ser null','acceptance_criteria, index DEBE ser un entero cero-basado existente','texto referenciado debe existir y no estar vacío','sin volver a recalcular sus filas coverage'])assert.ok(protocol.includes(rule),rule);
 }
 assert.deepEqual(sent[1].prompt.repair,{instruction:'Repair only invalid coverage'});
});
