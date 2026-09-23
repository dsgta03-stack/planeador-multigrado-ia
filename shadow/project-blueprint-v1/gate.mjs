import {assertContract,schemaErrors,schemaFor,hash,canonical,constraintsHash,snapshotHash,sourceBinding,deepFreeze} from './contracts.mjs';
import {CATALOG,CATALOG_VERSION,BPS,FUNCTIONAL_PROFILES} from './catalog.mjs';
export const semanticInputHash = input => hash({constraints:input.constraints,curriculum:input.curriculum,methodology:input.methodology,blueprint:input.blueprint});
export function blueprintGate(input,semantic=null){
 const {constraints:c,curriculum:k,methodology:m,blueprint:b}=input;
 const findings=[];
 const add=(rule_id,ok,scope,observed,expected,severity='CRITICAL')=>findings.push({rule_id,severity,status:ok?'PASS':'FAIL',scope,observed:String(observed),expected});
 // Contract errors fail closed; validators never repair, normalize or write inputs.
 for(const [name,value]of [['TeacherConstraintsV1',c],['CurriculumSnapshotV1',k],['MethodologyDecisionV1',m],['ProjectBlueprintV1',b]]){
  const errors=schemaErrors(value,schemaFor(name));add('BPD-SCHEMA',!errors.length,name,errors.join('; ')||'Contrato válido','Contrato completo, tipado y sin campos desconocidos');
 }
 if(findings.some(x=>x.status==='FAIL'))return finish(input,findings,[],false);
 const pdas=new Map(k.pdas.map(x=>[x.pda_id,x])),selected=new Set(c.selected_pda_ids),allowedGrades=new Set(c.grades);
 const analyses=b.pda_analysis,contrib=b.grade_contributions,stages=b.project_stages,sessions=b.session_progression;
 const eq=(a,z)=>canonical(a)===canonical(z),sameSet=(a,z)=>eq([...a].sort(),[...z].sort());
 const ids=[...analyses.map(x=>x.pda_id),...contrib.flatMap(x=>x.pda_ids),...sessions.flatMap(x=>x.pda_focus),...b.ltg_strategy.selections.flatMap(x=>x.pda_ids)];
 add('BPD-001',new Set(k.pdas.map(x=>x.pda_id)).size===k.pdas.length&&ids.every(id=>selected.has(id)&&pdas.has(id))&&sameSet(analyses.map(x=>x.pda_id),c.selected_pda_ids)&&new Set(analyses.map(x=>x.pda_id)).size===analyses.length,'pda_analysis',ids.join(','),'Una fila por PDA seleccionado; sólo IDs autorizados existentes, sin duplicados');
 add('BPD-002',analyses.every(x=>pdas.get(x.pda_id)?.grade===x.grade&&allowedGrades.has(x.grade)&&pdas.get(x.pda_id)?.pda_official===x.official_text&&['Verificado','verified'].includes(pdas.get(x.pda_id)?.verification_status))&&contrib.every(x=>x.pda_ids.every(id=>pdas.get(id)?.grade===x.grade)),'pda_analysis/grade_contributions','Correspondencia de grados y texto oficial','Grado y texto exactos del corpus verificado');
 add('BPD-003',c.grades.every(g=>contrib.some(x=>x.grade===g))&&contrib.every(x=>allowedGrades.has(x.grade))&&new Set(contrib.map(x=>x.contribution_id)).size===contrib.length&&c.selected_pda_ids.every(id=>contrib.some(x=>x.pda_ids.includes(id))),'grade_contributions',contrib.map(x=>x.grade).join(','),'Todos los grados y PDA con aportación autorizada; IDs de aportación únicos');
 add('BPD-004',contrib.every(x=>x.curriculum_mode==='TRANSVERSAL_PROJECT'?x.pda_ids.length===0&&!k.pdas.some(p=>selected.has(p.pda_id)&&p.grade===x.grade):x.pda_ids.length>0),'grade_contributions','Modos curriculares revisados','Transversal sin PDA atribuido; grados con selección mantienen aporte curricular');
 add('BPD-005',!!b.final_outcome.outcome_id&&contrib.every(x=>x.integration_destination===b.final_outcome.outcome_id),'final_outcome','Un objeto final y destinos','Exactamente un resultado final y todas las aportaciones dirigidas a él');
 const stageMap=new Map(stages.map(x=>[x.stage_id,x])),artifacts=new Map(stages.map(x=>[x.output_artifact_id,x]));
 const outcome=b.final_outcome.outcome_id,external=new Set(['input_context','input_curriculum']);
 add('BPD-006',stages.every(x=>x.required_inputs.length&&x.student_operation.trim()&&x.expected_output.trim()&&x.acceptance_criteria.length)&&new Set(stages.map(x=>x.order)).size===stages.length,'project_stages','Entradas/operación/salida','Cada etapa tiene cadena explícita y orden único');
 add('BPD-007',stages.every(s=>s.consumed_by.length&&s.consumed_by.every(dest=>dest===outcome||stageMap.has(dest)&&stageMap.get(dest).order>s.order&&stageMap.get(dest).required_inputs.includes(s.output_artifact_id)))&&stages.every(s=>s.required_inputs.filter(id=>artifacts.has(id)).every(id=>artifacts.get(id).consumed_by.includes(s.stage_id))),'project_stages.consumed_by','Destinos y enlaces recíprocos','Todo parcial tiene consumidor posterior real o integración al resultado');
 add('BPD-008',new Set(stages.map(x=>x.stage_id)).size===stages.length&&stages.every(s=>s.consumed_by.every(d=>d===outcome||stageMap.has(d)))&&b.final_outcome.functional_requirements.every(r=>r.stage_ids.every(id=>stageMap.has(id)))&&sessions.every(s=>s.next_session_dependency===null||sessions.some(n=>n.session_number===s.next_session_dependency&&n.session_number>s.session_number)),'dependencies','Etapas/sesiones referidas','Dependencias existentes, posteriores y sin ciclos');
 const last=sessions.at(-1);
 add('BPD-009',last?.terminal===true,'session_progression.last.terminal',last?.terminal,'true');
 add('BPD-010',last?.next_session_dependency===null,'session_progression.last.next_session_dependency',last?.next_session_dependency,'null');
 add('BPD-011',sessions.every((s,i)=>i===sessions.length-1||!s.terminal&&s.next_session_dependency===sessions[i+1].session_number),'session_progression','Terminalidad y encadenamiento','Sólo última terminal; cada sesión intermedia enlaza la siguiente');
 add('BPD-012',sessions.length===c.requested_sessions,'session_progression.length',sessions.length,String(c.requested_sessions));
 add('BPD-013',sessions.every((s,i)=>s.session_number===i+1)&&stages.every((s,i)=>s.order===i+1),'numbering','Orden de sesiones y etapas','Numeración continua desde 1');
 add('BPD-014',artifacts.size===stages.length&&!artifacts.has(outcome)&&stages.every(s=>!external.has(s.output_artifact_id)),'output_artifact_id','Unicidad de artefactos','IDs únicos distintos de inputs externos y resultado');
 const produced=new Map();for(const s of sessions)for(const id of s.expected_output_artifact_ids){if(!produced.has(id))produced.set(id,[]);produced.get(id).push(s.session_number)}
 add('BPD-015',stages.every(s=>s.required_inputs.every(id=>external.has(id)||artifacts.has(id)&&artifacts.get(id).order<s.order))&&sessions.every(s=>s.input_artifact_ids.every(id=>external.has(id)||produced.has(id)&&produced.get(id).length===1&&produced.get(id)[0]<s.session_number)&&s.expected_output_artifact_ids.every(id=>artifacts.has(id)))&&stages.every(s=>produced.get(s.output_artifact_id)?.length===1),'artifact_inputs','Procedencia y producción única','Inputs anteriores; cada artefacto de etapa producido una vez en la progresión');
 add('BPD-016',!!CATALOG[b.methodology.selected_id]&&b.methodology.catalog_version===CATALOG_VERSION&&m.catalog_version===CATALOG_VERSION&&eq(m.required_operations,CATALOG[m.selected_id]),'methodology','Catálogo y operaciones','Una decisión del catálogo versionado, sin alteraciones');
 add('BPD-017',b.methodology.selected_id===m.selected_id&&eq(b.methodology.required_operations,m.required_operations)&&(m.selection_source!=='TEACHER_ACCEPTED_RECOMMENDATION'||m.recommended_id===m.selected_id),'methodology.selected_id',b.methodology.selected_id,m.selected_id);
 add('BPD-018',b.final_outcome.required_resources.every(r=>c.available_resources.includes(r.resource)||r.alternative!==null&&c.available_resources.includes(r.alternative)&&!!r.alternative_rationale),'final_outcome.required_resources','Recursos/alternativas','Recursos autorizados o alternativa autorizada justificada; equivalencia se revisa semánticamente');
 const ops=CATALOG[m.selected_id]||[];
 add('BPD-019',ops.every(op=>stages.some(s=>s.methodology_operations.includes(op))&&sessions.some(s=>s.methodology_operations.includes(op)))&&[...stages,...sessions].every(s=>s.methodology_operations.every(op=>ops.includes(op)))&&stages.every(s=>s.methodology_operations.every(op=>sessions.find(row=>row.expected_output_artifact_ids.includes(s.output_artifact_id))?.methodology_operations.includes(op))),'methodology_operations','Cobertura en etapas/progresión','Operaciones completas y vinculadas al artefacto de etapa, sin reparto por índice');
 add('BPD-020',c.constraints_hash===constraintsHash(c)&&k.snapshot_hash===snapshotHash(k)&&eq(b.source,sourceBinding(input))&&b.problem_frame.original_problem===c.original_problem,'source','Hashes y problemática','Fuentes íntegramente vinculadas; problemática original exacta');
 // Supplemental objective constraints do not replace BPS semantic judgements.
 const max=c.requested_sessions*c.minutes_per_session;
 add('BPD-TIME',b.feasibility.requested_sessions===c.requested_sessions&&b.feasibility.minutes_per_session===c.minutes_per_session&&b.feasibility.total_available_minutes===max&&stages.reduce((n,s)=>n+s.estimated_minutes,0)<=max&&sessions.every(row=>stages.filter(s=>row.expected_output_artifact_ids.includes(s.output_artifact_id)).reduce((n,s)=>n+s.estimated_minutes,0)<=c.minutes_per_session),'feasibility','Estimaciones por etapa/sesión','Estimaciones positivas justificadas dentro de cada sesión; BPS-010 juzga realismo');
 const ltg=new Map(k.ltg.map(x=>[x.project_id,x]));
 add('BPD-LTG',b.ltg_strategy.selections.every(x=>ltg.has(x.project_id)&&x.pda_ids.every(id=>selected.has(id)&&ltg.get(x.project_id).verified_pda_links.includes(id)&&pdas.get(id)?.grade===ltg.get(x.project_id).grade)&&x.activity_ids.every(id=>ltg.get(x.project_id).verified_activities.some(a=>a.activity_id===id&&a.verification_status==='verified')))&&c.explicit_ltg_selections.every(x=>b.ltg_strategy.selections.some(y=>y.project_id===x.project_id&&y.role===x.intent&&x.pda_ids.every(id=>y.pda_ids.includes(id))))&&(b.ltg_strategy.mode==='NONE'?b.ltg_strategy.selections.length===0:b.ltg_strategy.selections.length>0),'ltg_strategy','LTG y decisiones explícitas','Trazabilidad verificada y respeto a selección explícita');
 const weak=analyses.some(x=>['WEAK','INCOMPATIBLE'].includes(x.integration_strength));
 const sem=[];
 if(!semantic||semantic.input_hash!==semanticInputHash(input)||!Array.isArray(semantic.findings)){
  for(const rule_id of Object.keys(BPS))sem.push({rule_id,severity:'CRITICAL',status:'NOT_EVALUABLE',scope:'blueprint',observed:'Revisión semántica ausente o ligada a otro input',expected:BPS[rule_id]});
 }else{
  for(const rule_id of Object.keys(BPS)){
   const rows=semantic.findings.filter(x=>x.rule_id===rule_id);
   if(rows.length!==1||schemaErrors(rows[0],schemaFor('BlueprintGateV1').properties.semantic_findings.items).length)sem.push({rule_id,severity:'CRITICAL',status:'NOT_EVALUABLE',scope:'blueprint',observed:'Regla ausente, duplicada o inválida',expected:BPS[rule_id]});
   else sem.push({...rows[0],severity:'CRITICAL'});
  }
 }
 return finish(input,findings,sem,weak);
}
function finish(input,det,sem,weak){
 const failed=det.some(x=>x.status==='FAIL')||sem.some(x=>x.status==='FAIL');
 const incomplete=!sem.length||sem.some(x=>x.status==='NOT_EVALUABLE');
 const status=failed?'FAIL':weak?'NEEDS_TEACHER_DECISION':incomplete?'NOT_EVALUABLE':'PASS';
 return deepFreeze({gate_version:'BLUEPRINT_GATE_V1',status,critical_count:[...det,...sem].filter(x=>x.severity==='CRITICAL'&&x.status==='FAIL').length,warning_count:[...det,...sem].filter(x=>x.severity==='WARNING'&&x.status==='FAIL').length,deterministic_findings:det,semantic_findings:sem,evaluated_blueprint_hash:hash(input.blueprint),source_hash:hash({constraints:input.constraints,curriculum:input.curriculum,methodology:input.methodology})});
}
// Structural semantic checks: necessary conditions only. Missing data is failure;
// their success never substitutes a model/manual full-text review.
export function functionalDiagnostics(b){
 const rows=[];const profiles=new Set(b.final_outcome.functional_profiles);
 if(FUNCTIONAL_PROFILES[b.final_outcome.type])profiles.add(b.final_outcome.type);
 for(const profile of profiles){
  if(!FUNCTIONAL_PROFILES[profile]){rows.push({profile,missing:['UNKNOWN_PROFILE']});continue}
  const actual=new Set(b.final_outcome.functional_requirements.map(r=>r.requirement_id));
  const missing=FUNCTIONAL_PROFILES[profile].filter(x=>!actual.has(x));if(missing.length)rows.push({profile,missing});
 }
 return rows;
}
