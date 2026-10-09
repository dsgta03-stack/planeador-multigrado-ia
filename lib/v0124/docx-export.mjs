import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

const C={navy:"0B2D4F",navy2:"123F68",blue:"1674E8",teal:"19B7A4",bg:"F4F7FB",text:"10233C",muted:"6F7F92",line:"DFE7F1",soft:"EAF3FF",soft2:"F8FBFE",white:"FFFFFF"};
const FONT="Inter";
const t=v=>String(v??"").trim();
const arr=v=>Array.isArray(v)?v:[];
const grades=v=>arr(v).map(x=>Number(x)).filter(Boolean).map(x=>`${x}.º`).join(", ");
const run=(text,{bold=false,color=C.text,size=18}={})=>new TextRun({text:t(text),font:FONT,bold,color,size});
const p=(text,opts={})=>new Paragraph({children:[run(text,opts)],spacing:{after:100},keepNext:!!opts.keepNext,alignment:opts.align||AlignmentType.LEFT});
const borders={top:{style:BorderStyle.SINGLE,size:5,color:C.line},bottom:{style:BorderStyle.SINGLE,size:5,color:C.line},left:{style:BorderStyle.SINGLE,size:5,color:C.line},right:{style:BorderStyle.SINGLE,size:5,color:C.line},insideHorizontal:{style:BorderStyle.SINGLE,size:5,color:C.line},insideVertical:{style:BorderStyle.SINGLE,size:5,color:C.line}};
function cell(text,{bold=false,fill=C.white,color=C.text,size=16}={}){return new TableCell({children:[p(text,{bold,color,size})],shading:{type:ShadingType.CLEAR,fill},margins:{top:90,bottom:90,left:110,right:110},verticalAlign:VerticalAlign.CENTER});}
function row(values,options=[]){return new TableRow({cantSplit:true,children:values.map((v,i)=>cell(v,options[i]||{}))});}
function table(rows,{widths}={}){return new Table({rows,width:{size:100,type:WidthType.PERCENTAGE},columnWidths:widths,borders});}
function heading(text,n){return new Paragraph({children:[run(`${n}. ${text}`,{bold:true,color:C.navy,size:27})],spacing:{before:220,after:100},keepNext:true,border:{left:{style:BorderStyle.SINGLE,size:18,color:C.blue,space:8}}});}
function subheading(text){return new Paragraph({children:[run(text,{bold:true,color:C.blue,size:23})],spacing:{before:180,after:80},keepNext:true});}
function headerRow(labels,fill=C.navy2){return new TableRow({tableHeader:true,cantSplit:true,children:labels.map(x=>cell(x,{bold:true,fill,color:C.white,size:15}))});}
function richCell(children,{fill=C.white}={}){
  return new TableCell({
    children:children.length?children:[p("—",{size:16})],
    shading:{type:ShadingType.CLEAR,fill},
    margins:{top:90,bottom:90,left:110,right:110},
    verticalAlign:VerticalAlign.TOP
  });
}
function sectionRow(label,content,{fill=C.white}={}){
  const values=arr(content).map(value=>t(value)).filter(Boolean);
  return new TableRow({
    cantSplit:true,
    children:[
      richCell([p(label,{bold:true,color:C.navy,size:15})],{fill:C.soft2}),
      richCell(values.length?values.map(value=>p(value,{size:16})):[p("—",{size:16})],{fill})
    ]
  });
}
function gradeRow(g){
  const details=[];
  if(t(g?.student_action))details.push(`Acción del alumnado: ${t(g.student_action)}`);
  if(t(g?.differentiation))details.push(`Diferenciación: ${t(g.differentiation)}`);
  if(t(g?.evidence))details.push(`Evidencia: ${t(g.evidence)}`);
  return sectionRow(`${Number(g?.grade)||"—"}.º`,details,{fill:C.soft2});
}
function activityTable(activity){
  const b=activity||{},e=b.execution;
  if(!e){
    return table([
      headerRow(["Organización","Grados","Actividad / intervención"],C.navy2),
      row([b.label||"Actividad",grades(b.grades)||"Todos",b.narrative||"—"])
    ]);
  }

  const rows=[
    headerRow([b.label||"Actividad",grades(b.grades)||"Todos"],C.navy2)
  ];

  if(t(b.common_student_action)||t(b.development))rows.push(sectionRow("Desarrollo:",[t(b.common_student_action)||t(b.development)]));
  if(t(e.preparation))rows.push(sectionRow("Preparación:",[e.preparation]));
  if(t(e.instruction))rows.push(sectionRow("Consigna:",[e.instruction]));
  if(t(e.grouping))rows.push(sectionRow("Organización:",[e.grouping]));

  arr(e.student_steps).forEach((step,index)=>{
    if(t(step))rows.push(sectionRow(`Paso ${index+1}:`,[step]));
  });

  if(t(b.teacher_role))rows.push(sectionRow("Acción docente:",[b.teacher_role]));

  arr(e.guidance).forEach((value,index)=>{
    if(t(value))rows.push(sectionRow(`Pregunta o modelado ${index+1}:`,[value]));
  });

  arr(b.grade_participation).forEach(g=>rows.push(gradeRow(g)));

  arr(e.resource_use).forEach((r,index)=>{
    const resource=t(r?.resource);
    const use=t(r?.use);
    if(resource||use)rows.push(sectionRow(`Material ${index+1}:`,[
      [resource,use].filter(Boolean).join(". ")
    ]));
  });

  arr(b.supports).forEach((support,index)=>{
    if(t(support))rows.push(sectionRow(`Apoyo autorizado ${index+1}:`,[support]));
  });

  if(t(e.contingency))rows.push(sectionRow("Si no avanza:",[e.contingency]));
  if(t(b.output))rows.push(sectionRow("Producto:",[b.output]));
  if(t(b.evidence))rows.push(sectionRow("Evidencia:",[b.evidence]));

  arr(b.assessment_criteria).forEach(criterion=>{
    if(t(criterion))rows.push(sectionRow("Criterio:",[criterion]));
  });

  arr(b.ltg_use).forEach(u=>{
    const ref=u?.reference||{};
    const identity=[
      t(ref.book),
      t(ref.project),
      ref.grade?`${Number(ref.grade)}.º`:"",
      ref?.pages?.start&&ref?.pages?.end?`pp. ${ref.pages.start}–${ref.pages.end}`:""
    ].filter(Boolean).join(" · ");

    const details=[
      identity,
      t(u?.student_action)?`Acción: ${t(u.student_action)}`:"",
      t(u?.moment)?`Momento: ${t(u.moment)}`:"",
      t(u?.purpose)?`Aporte: ${t(u.purpose)}`:""
    ].filter(Boolean);

    rows.push(sectionRow("LTG:",details));
  });

  if(t(e.connection))rows.push(sectionRow("Cierre/conexión:",[e.connection]));

  return table(rows);
}

function projectOf(plan){const integrated=plan?.methodology_engine?.integrated_project||{},project=plan?.project||{},teacher=plan?.teacher_presentation||{};return{title:t(project.title)||t(teacher.project_title)||t(integrated.display_title)||t(integrated.title)||"Proyecto multigrado",finalProduct:t(project.final_product)||t(teacher.project_final_product)||t(integrated.collective_product_or_service)||"Producto común del proyecto",mission:t(project.mission)||t(teacher.project_mission)||t(integrated.unifying_mission)||"",contributions:arr(project.grade_contributions).length?arr(project.grade_contributions):arr(integrated.grade_contributions)};}
function sequenceOf(plan){const seq=arr(plan?.project_sequence);if(seq.length)return seq;return arr(plan?.teacher_presentation?.sessions).map((s,i)=>({session_number:Number(s?.session_number||i+1),phase:t(s?.phase),purpose:t(s?.purpose),project_advance:t(s?.project_advance),partial_product:t(s?.partial_product),prepares_next:t(s?.prepares_next)}));}
function teacherSessions(plan){const tp=arr(plan?.teacher_presentation?.sessions);if(tp.length)return tp;return arr(plan?.sessions).map((s,i)=>({session_number:Number(s?.session_number||i+1),phase:t(s?.project_stage||s?.methodology_phase),purpose:t(s?.purpose),project_advance:t(s?.project_advance),partial_product:t(s?.partial_product),prepares_next:t(s?.prepares_next),teacher_narrative:t(s?.common_opening),closure_narrative:t(s?.common_closure),activity_blocks:arr(s?.work_moments).flatMap(m=>{const out=[];if(t(m?.direct_teacher_action))out.push({label:"Atención directa",grades:arr(m?.direct_teacher_grades),narrative:t(m.direct_teacher_action)});for(const b of arr(m?.other_blocks))if(t(b?.activity))out.push({label:t(b?.block)||"Trabajo autónomo",grades:arr(b?.grades),narrative:t(b.activity)});return out;})}));}
function contextOf(plan){const req=plan?.request||plan?.input||plan?.planning_context||{};return{context:t(plan?.context)||t(req?.context)||t(req?.school_context)||"",problem:t(plan?.problem)||t(req?.problem)||t(req?.priority_problem)||"",method:t(plan?.methodology_engine?.methodology_primary?.label)||t(plan?.methodology_engine?.methodology_primary?.name)||t(plan?.methodology_engine?.methodology_primary?.id)||t(plan?.methodology)||"",grades:arr(plan?.grades).length?arr(plan.grades):arr(req?.grades),resources:arr(plan?.resources).length?arr(plan.resources):arr(req?.resources)};}
function pdaRows(plan){const candidates=[plan?.selected_pdas,plan?.pda_selection,plan?.pda,plan?.pdas];for(const c of candidates){if(Array.isArray(c)&&c.length)return c.map(x=>({grade:x?.grade||x?.grado||"",id:x?.pda_id||x?.id||"",text:x?.pda_official||x?.text||x?.pda||""}));}return[];}

export async function createMultiplanDocx(plan){
  const project=projectOf(plan),sequence=sequenceOf(plan),sessions=teacherSessions(plan),ctx=contextOf(plan),pdas=pdaRows(plan),children=[];
  children.push(new Paragraph({children:[run("PLANEACIÓN MULTIGRADO",{bold:true,color:C.text,size:40})],alignment:AlignmentType.CENTER,spacing:{after:40}}));
  children.push(new Paragraph({children:[run("Documento editable · formato Multiplan",{color:C.muted,size:18})],alignment:AlignmentType.CENTER,spacing:{after:200}}));

  children.push(heading("Datos generales",1));
  children.push(table([
    row(["Grados",grades(ctx.grades)||"—","Sesiones",String(sessions.length||sequence.length||"—")],[{bold:true,fill:C.soft,color:C.navy},{},{bold:true,fill:C.soft,color:C.navy},{}]),
    row(["Metodología",ctx.method||"—","Duración","Editable en Word"],[{bold:true,fill:C.soft,color:C.navy},{},{bold:true,fill:C.soft,color:C.navy},{}]),
  ]));

  children.push(heading("Contexto y proyecto común",2));
  const projectRows=[];
  if(ctx.context)projectRows.push(row(["Contexto",ctx.context],[{bold:true,fill:C.soft,color:C.navy},{}]));
  if(ctx.problem)projectRows.push(row(["Situación prioritaria",ctx.problem],[{bold:true,fill:C.soft,color:C.navy},{}]));
  projectRows.push(row(["Nombre del proyecto",project.title],[{bold:true,fill:"E8F8F5",color:C.navy},{fill:"E8F8F5"}]));
  projectRows.push(row(["Producto final común",project.finalProduct],[{bold:true,fill:"E8F8F5",color:C.navy},{fill:"E8F8F5"}]));
  if(project.mission)projectRows.push(row(["Misión del proyecto",project.mission],[{bold:true,fill:C.soft,color:C.navy},{}]));
  children.push(table(projectRows));

  if(project.contributions.length){
    children.push(heading("Aportes diferenciados al producto común",3));
    const rs=[headerRow(["Grado","Aporte","Evidencia / importancia"])];
    for(const x of project.contributions)rs.push(row([x.grade?`${Number(x.grade)}.º`:"—",t(x.contribution)||"Aporte al proyecto",t(x.evidence)||t(x.why_it_matters)||"—"]));
    children.push(table(rs));
  }

  let section=project.contributions.length?4:3;
  if(pdas.length){
    children.push(heading("PDA seleccionados",section++));
    const rs=[headerRow(["Grado","ID","PDA oficial"],C.navy2)];
    for(const x of pdas)rs.push(row([x.grade?`${Number(x.grade)}.º`:"—",x.id||"—",x.text||"—"]));
    children.push(table(rs));
  }

  if(sequence.length){
    children.push(heading("Ruta del proyecto",section++));
    const rs=[headerRow(["Sesión","Fase","Avance del proyecto","Producto parcial","Continuidad"],C.blue)];
    for(const x of sequence)rs.push(row([String(x.session_number||""),x.phase||"—",x.project_advance||x.purpose||"—",x.partial_product||"—",x.prepares_next||"—"]));
    children.push(table(rs));
  }

  children.push(heading("Desarrollo por sesión",section++));
  for(let i=0;i<sessions.length;i++){
    const s=sessions[i],seq=sequence.find(x=>Number(x.session_number)===Number(s.session_number))||sequence[i]||{};
    children.push(subheading(`Sesión ${s.session_number||i+1}`));
    children.push(table([
      row(["Propósito",s.purpose||seq.purpose||"—"],[{bold:true,fill:C.soft,color:C.navy},{}]),
      row(["Fase metodológica",s.phase||seq.phase||"—"],[{bold:true,fill:C.soft,color:C.navy},{}]),
      row(["Avance del proyecto",s.project_advance||seq.project_advance||"—"],[{bold:true,fill:C.soft,color:C.navy},{}]),
      row(["Producto parcial",s.partial_product||seq.partial_product||"—"],[{bold:true,fill:C.soft,color:C.navy},{}]),
      row(["Prepara la siguiente sesión",s.prepares_next||seq.prepares_next||"—"],[{bold:true,fill:C.soft,color:C.navy},{}]),
    ]));
    if(s.teacher_narrative)children.push(p(s.teacher_narrative,{size:17}));
    const blocks=arr(s.activity_blocks);
    if(blocks.length){
      for(const b of blocks)children.push(activityTable(b));
    }
    if(s.closure_narrative)children.push(p(s.closure_narrative,{size:17}));
  }

  if(ctx.resources.length){children.push(heading("Recursos",section++));children.push(table([row(["Recursos disponibles",ctx.resources.join(" · ")],[{bold:true,fill:C.soft,color:C.navy},{}])]));}
  children.push(heading("Observaciones del docente",section));children.push(table([row([" "]),row([" "]),row([" "])]));

  const header=new Header({children:[table([row(["M","Multiplan","Planeación curricular y multigrado"],[{bold:true,fill:C.teal,color:C.white,size:20},{bold:true,fill:C.navy,color:C.white,size:19},{fill:C.navy,color:"C4D5E4",size:14}])]) ]});
  const footer=new Footer({children:[new Paragraph({children:[run("Multiplan · Planea hoy. Enseña mejor mañana.",{color:C.muted,size:14})],alignment:AlignmentType.CENTER})]});
  const doc=new Document({sections:[{properties:{page:{margin:{top:720,right:720,bottom:720,left:720}}},headers:{default:header},footers:{default:footer},children}]});
  return Packer.toBuffer(doc);
}

export function docxFilename(plan){const raw=projectOf(plan).title||"Planeacion_Multiplan";const safe=raw.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80)||"Planeacion_Multiplan";return `${safe}.docx`;}
