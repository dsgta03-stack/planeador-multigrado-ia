import {deepFreeze,hash} from '../project-blueprint-v1/contracts.mjs';
import {SESSION_GRAPH_GATE_VERSION,SGD,SGS} from './catalog.mjs';
import {validateCompiledSessionGraph,approvedBlueprintHash,deriveTraceability} from './session-graph.mjs';

export const sessionSemanticInputHash=input=>hash({blueprint:input.blueprint,graph:input.graph,constraints:input.constraints,curriculum:input.curriculum,methodology:input.methodology});

export function sessionGraphGate(input,semantic=null){
 const det=[];const add=(rule_id,ok,scope,observed,expected)=>det.push({rule_id,severity:'CRITICAL',status:ok?'PASS':'FAIL',scope,observed:String(observed),expected});
 let structuralError=null;try{validateCompiledSessionGraph(input.graph,input)}catch(e){structuralError=e}
 for(const rule_id of Object.keys(SGD))add(rule_id,!structuralError,rule_id,structuralError?`${structuralError.rule||'ERROR'} ${structuralError.message}`:'Validated by compiled graph invariants',SGD[rule_id]);
 if(!structuralError){
  const h=approvedBlueprintHash(input.blueprint);replace(det,'SGD-001',input.graph.source_blueprint.blueprint_hash===h&&input.approval.approved_blueprint_hash===h,'source_blueprint','Exact approved Blueprint hash');
  replace(det,'SGD-016',hash(input.graph.traceability)===hash(deriveTraceability(input.graph.sessions,input.blueprint)),'traceability','Compiler-derived traceability only');
 }
 const sem=[];
 if(!semantic||semantic.input_hash!==sessionSemanticInputHash(input)||!Array.isArray(semantic.findings)){
  for(const rule_id of Object.keys(SGS))sem.push({rule_id,severity:'CRITICAL',status:'NOT_EVALUABLE',scope:'session_graph',observed:'Revisión semántica ausente o ligada a otro input',expected:SGS[rule_id]});
 }else{
  for(const rule_id of Object.keys(SGS)){
   const rows=semantic.findings.filter(x=>x.rule_id===rule_id);
   if(rows.length!==1||!['PASS','FAIL'].includes(rows[0].status)||typeof rows[0].scope!=='string'||typeof rows[0].observed!=='string'||typeof rows[0].expected!=='string')sem.push({rule_id,severity:'CRITICAL',status:'NOT_EVALUABLE',scope:'session_graph',observed:'Regla ausente, duplicada o inválida',expected:SGS[rule_id]});
   else sem.push({...rows[0],severity:'CRITICAL'});
  }
 }
 const failed=det.some(x=>x.status==='FAIL')||sem.some(x=>x.status==='FAIL');
 const incomplete=sem.some(x=>x.status==='NOT_EVALUABLE');
 const status=failed?'FAIL':incomplete?'NOT_EVALUABLE':'PASS';
 return deepFreeze({gate_version:SESSION_GRAPH_GATE_VERSION,status,critical_count:[...det,...sem].filter(x=>x.severity==='CRITICAL'&&x.status==='FAIL').length,deterministic_findings:det,semantic_findings:sem,evaluated_graph_hash:hash(input.graph),approved_blueprint_hash:input.approval.approved_blueprint_hash});
}
function replace(rows,id,ok,observed,expected){const i=rows.findIndex(x=>x.rule_id===id);rows[i]={rule_id:id,severity:'CRITICAL',status:ok?'PASS':'FAIL',scope:id,observed:String(observed),expected};}

export function approveSessionGraph(input,gate){
 if(!gate||gate.gate_version!==SESSION_GRAPH_GATE_VERSION||gate.status!=='PASS'||gate.evaluated_graph_hash!==hash(input.graph))throw Error('SESSION_GRAPH_NOT_APPROVABLE');
 return deepFreeze({approval_version:'SESSION_GRAPH_APPROVAL_V1',status:'APPROVED',gate_version:gate.gate_version,graph_hash:gate.evaluated_graph_hash,approved_graph_hash:gate.evaluated_graph_hash,approved_blueprint_hash:gate.approved_blueprint_hash});
}
