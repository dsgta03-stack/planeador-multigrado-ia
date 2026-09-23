import assert from "node:assert/strict";

function sessionTime(session) {
  const opening = Number(session?.opening_minutes || 0);
  const closure = Number(session?.closure_minutes || 0);
  const moments = (Array.isArray(session?.work_moments) ? session.work_moments : [])
    .reduce((sum, moment) => sum + Number(moment?.minutes || 0), 0);
  return { opening, moments, closure, sum: opening + moments + closure, total: Number(session?.total_minutes || 0) };
}

function checkTimeIntegrity(plan) {
  const sessions = Array.isArray(plan?.sessions) ? plan.sessions : [];
  return sessions.map((session, index) => {
    const calc = sessionTime(session);
    return {
      session_number: Number(session?.session_number || index + 1),
      ...calc,
      pass: calc.sum === calc.total,
    };
  });
}

function checkSessionCount(plan, expected) {
  const sessions = Array.isArray(plan?.sessions) ? plan.sessions : [];
  const sequence = Array.isArray(plan?.project_sequence) ? plan.project_sequence : [];
  const teacher = Array.isArray(plan?.teacher_presentation?.sessions) ? plan.teacher_presentation.sessions : [];
  return {
    plan: sessions.length,
    sequence: sequence.length,
    teacher: teacher.length,
    pass: sessions.length === expected && sequence.length === expected && teacher.length === expected,
  };
}

function checkProjectStructure(plan) {
  const project = plan?.project || {};
  const productModel = plan?.product_model || {};
  const contributions = Array.isArray(project?.grade_contributions) ? project.grade_contributions : [];
  const grades = contributions.map(row => Number(row?.grade)).filter(Number.isInteger);
  const uniqueGrades = new Set(grades);
  const sequence = Array.isArray(plan?.project_sequence) ? plan.project_sequence : [];
  const finalProduct = String(project?.final_product || "").trim();
  return {
    final_product: finalProduct,
    contribution_count: contributions.length,
    unique_grade_count: uniqueGrades.size,
    sequence_count: sequence.length,
    pass: Boolean(finalProduct)
      && productModel?.type === "ONE_COMMON_PRODUCT_WITH_DIFFERENTIATED_GRADE_CONTRIBUTIONS"
      && contributions.length > 0
      && uniqueGrades.size === contributions.length
      && contributions.every(row => String(row?.contribution || "").trim() && String(row?.evidence || "").trim())
      && sequence.length > 0
      && sequence.every(row => String(row?.project_advance || "").trim() && String(row?.partial_product || "").trim()),
  };
}

function makeSession(number, total = 90) {
  return {
    session_number: number,
    total_minutes: total,
    opening_minutes: 10,
    work_moments: [
      { moment: 1, minutes: 30, direct_teacher_grades: [1, 2], other_blocks: [{ grades: [3, 4, 5, 6] }] },
      { moment: 2, minutes: 40, direct_teacher_grades: [3, 4], other_blocks: [{ grades: [1, 2, 5, 6] }] },
    ],
    closure_minutes: 10,
  };
}

const goodSessions = Array.from({ length: 15 }, (_, index) => makeSession(index + 1));
const projectSequence = goodSessions.map(session => ({
  session_number: session.session_number,
  phase: session.session_number <= 4 ? "Planeación" : session.session_number <= 12 ? "Acción" : "Intervención",
  project_advance: `Avance verificable de la sesión ${session.session_number}`,
  partial_product: `Producto parcial ${session.session_number}`,
  prepares_next: session.session_number === 15 ? "Cierre del proyecto" : `Preparar sesión ${session.session_number + 1}`,
}));
const gradeContributions = [1, 2, 3, 4, 5, 6].map(grade => ({
  grade,
  contribution: `Aporte diferenciado de ${grade}.º al producto común`,
  evidence: `Evidencia observable de ${grade}.º`,
}));
const goodPlan = {
  sessions: goodSessions,
  project_sequence: projectSequence,
  teacher_presentation: { sessions: projectSequence.map(row => ({ ...row })) },
  project: {
    title: "Proyecto común de prueba",
    final_product: "Exposición comunitaria común",
    grade_contributions: gradeContributions,
  },
  product_model: {
    type: "ONE_COMMON_PRODUCT_WITH_DIFFERENTIATED_GRADE_CONTRIBUTIONS",
    final_product: "Exposición comunitaria común",
    grade_contributions: gradeContributions,
  },
};

// RTE-013 — exactitud temporal por sesión.
const timeGood = checkTimeIntegrity(goodPlan);
assert.equal(timeGood.length, 15);
assert.ok(timeGood.every(row => row.pass), "RTE-013: todas las sesiones válidas deben cuadrar exactamente");
assert.ok(timeGood.every(row => row.sum === 90 && row.total === 90));

const badTimePlan = structuredClone(goodPlan);
badTimePlan.sessions[6].work_moments[1].minutes = 35;
const timeBad = checkTimeIntegrity(badTimePlan);
assert.equal(timeBad[6].pass, false, "RTE-013: un desfase temporal debe detectarse, no maquillarse");
assert.equal(timeBad[6].sum, 85);
assert.equal(timeBad[6].total, 90);

// RTE-012 (parte determinista) — 15 sesiones no deben truncarse entre representaciones.
const countGood = checkSessionCount(goodPlan, 15);
assert.equal(countGood.pass, true);
assert.deepEqual(countGood, { plan: 15, sequence: 15, teacher: 15, pass: true });
const truncated = structuredClone(goodPlan);
truncated.teacher_presentation.sessions.pop();
assert.equal(checkSessionCount(truncated, 15).pass, false, "RTE-012: truncar una representación debe fallar");

// RTE-020 — estructura determinista de un producto común con aportes diferenciados.
const projectGood = checkProjectStructure(goodPlan);
assert.equal(projectGood.pass, true);
assert.equal(projectGood.final_product, "Exposición comunitaria común");
assert.equal(projectGood.contribution_count, 6);
assert.equal(projectGood.unique_grade_count, 6);
assert.equal(projectGood.sequence_count, 15);

const parallelProjects = structuredClone(goodPlan);
parallelProjects.project.final_product = "";
parallelProjects.product_model.type = "PARALLEL_GRADE_PROJECTS";
assert.equal(checkProjectStructure(parallelProjects).pass, false, "RTE-020: seis proyectos paralelos no satisfacen el modelo común");

const missingEvidence = structuredClone(goodPlan);
missingEvidence.project.grade_contributions[4].evidence = "";
assert.equal(checkProjectStructure(missingEvidence).pass, false, "RTE-020: cada aporte debe conservar evidencia observable");

console.log(JSON.stringify({
  ok: true,
  suite: "ROUTE-DETERMINISTIC-INVARIANTS-V1",
  assertions: 18,
  scenarios: ["RTE-012-STRUCTURAL", "RTE-013", "RTE-020-STRUCTURAL"],
  sessions_checked: 15,
}));
