import { GRADE_JSON_SCHEMA } from "./types";
import type { GradePayload } from "./types";
import type { SqlQueryQuestion, SpreadsheetTaskQuestion, ClozeBlank, TableFillInputDef, TrueFalseStatement } from "@/lib/quiz/schemas";
import type { ClozeBlankResult, TableFillInputResult, TrueFalseStatementResult } from "./deterministic-scorer";

/**
 * Prompt A: Objective feedback for deterministic-scored questions.
 * The score is already known; we just want the AI to explain.
 */
export function buildObjectiveFeedbackPrompt(
  payload: GradePayload,
  actualScore: number
): string {
  return `You are an expert exam grader for Polish Matura exams. The student's answer has already been scored deterministically.

QUESTION:
${payload.promptMarkdown}

CORRECT ANSWER: ${payload.correctAnswer}
STUDENT ANSWER: ${payload.userAnswer}
SCORE: ${actualScore}/${payload.maxScore}

Your task:
1. Explain why the answer is correct or incorrect.
2. Identify the concept being tested.
3. Give a minimal hint/tip for next time.

Respond ONLY with valid JSON matching this schema exactly:
${GRADE_JSON_SCHEMA}

Set the "score" to ${actualScore} and "maxScore" to ${payload.maxScore}.
Set "confidence" to 1.0 (deterministic).
Do NOT include any text outside the JSON object.`;
}

/**
 * Prompt B: Rubric-based AI scoring for open-ended questions.
 */
export function buildRubricScoringPrompt(payload: GradePayload): string {
  const parts: string[] = [];

  parts.push(
    `You are an expert CKE (Centralna Komisja Egzaminacyjna) exam grader for Polish Matura exams. Grade the student's answer strictly according to the rubric below.`
  );
  parts.push(`\nQUESTION:\n${payload.promptMarkdown}`);

  if (payload.rubric) {
    parts.push(`\nRUBRIC:\n${payload.rubric}`);
  }

  if (payload.expectedKeyPoints && payload.expectedKeyPoints.length > 0) {
    parts.push(
      `\nEXPECTED KEY POINTS:\n${payload.expectedKeyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
    );
  }

  if (payload.correctAnswer) {
    parts.push(`\nEXPECTED ANSWER: ${payload.correctAnswer}`);
  }

  parts.push(`\nSTUDENT RESPONSE:\n${payload.userAnswer}`);

  if (payload.attachments?.code) {
    parts.push(`\nSTUDENT CODE:\n\`\`\`python\n${payload.attachments.code}\n\`\`\``);
  }
  if (payload.attachments?.stdout) {
    parts.push(`\nPROGRAM OUTPUT:\n${payload.attachments.stdout}`);
  }
  if (payload.attachments?.stderr) {
    parts.push(`\nPROGRAM ERRORS:\n${payload.attachments.stderr}`);
  }
  if (payload.attachments?.testReport) {
    parts.push(
      `\nTEST RESULTS:\n${JSON.stringify(payload.attachments.testReport, null, 2)}`
    );
  }

  parts.push(`\nMAX SCORE: ${payload.maxScore}`);

  parts.push(`\nINSTRUCTIONS:
1. Evaluate the student's answer against EACH rubric criterion.
2. Assign points within allowed ranges per criterion.
3. Write specific, constructive feedback. Quote the student's text when pointing out strengths or errors.
4. Be fair but strict — follow the rubric closely.
5. Write feedback in Polish if the subject is Polish; otherwise use English.

Respond ONLY with valid JSON matching this schema exactly:
${GRADE_JSON_SCHEMA}

Do NOT include any text outside the JSON object. No markdown code fences. Just the raw JSON.`);

  return parts.join("\n");
}

/**
 * Build the system prompt for the grading call.
 */
export function buildSystemPrompt(): string {
  return `You are an expert exam grader certified by CKE (Centralna Komisja Egzaminacyjna) in Poland. You grade exam answers with strict adherence to official rubrics. You always respond with valid JSON only — no explanatory text, no markdown fences, just the JSON object.`;
}

// ── sql_query context ─────────────────────────────────────────────────────────

/**
 * Builds a rubric addendum string for sql_query questions.
 * Inject this into GradePayload.rubric before calling the AI client.
 */
export function buildSqlContextAddendum(question: SqlQueryQuestion): string {
  const parts: string[] = [];

  if (question.schemaMarkdown) {
    parts.push(`DATABASE SCHEMA:\n${question.schemaMarkdown}`);
  }

  if (question.tables && question.tables.length > 0) {
    const tableDesc = question.tables
      .map(
        (t) =>
          `Table "${t.name}": ${t.columns.map((c) => `${c.name} (${c.type})`).join(", ")}` +
          (t.sampleRows && t.sampleRows.length > 0
            ? `\n  Sample rows: ${JSON.stringify(t.sampleRows)}`
            : "")
      )
      .join("\n");
    parts.push(`TABLES:\n${tableDesc}`);
  }

  if (question.seedData) {
    parts.push(`SEED DATA (context for the student):\n${question.seedData}`);
  }

  if (question.expectedResult && question.expectedResult.length > 0) {
    parts.push(`EXPECTED RESULT SET:\n${JSON.stringify(question.expectedResult, null, 2)}`);
  }

  if (question.expectedQueryPatterns && question.expectedQueryPatterns.length > 0) {
    parts.push(
      `REQUIRED QUERY PATTERNS (the student's query must use all of these):\n` +
        question.expectedQueryPatterns.map((p) => `- ${p}`).join("\n")
    );
  }

  const dialect = question.dialect ?? "sql";
  parts.push(`SQL DIALECT: ${dialect.toUpperCase()}`);

  parts.push(
    `GRADING GUIDANCE:
- Check syntax correctness for ${dialect.toUpperCase()}.
- Verify all required patterns are used (if specified).
- Compare the logical result with expectedResult (if provided); minor column-alias differences are acceptable.
- Award partial credit for queries that are structurally correct but have minor errors.
- Give clear, specific feedback in English.`
  );

  return parts.join("\n\n");
}

// ── spreadsheet_task context ──────────────────────────────────────────────────

/**
 * Builds a rubric addendum for spreadsheet_task questions.
 */
export function buildSpreadsheetContextAddendum(
  question: SpreadsheetTaskQuestion
): string {
  const parts: string[] = [];

  parts.push(`SOURCE DATA:\n${question.sourceDataDescription}`);

  if (question.expectedOutputs.length > 0) {
    const outputDesc = question.expectedOutputs
      .map(
        (o) =>
          `[${o.type.toUpperCase()}] "${o.label}" (id: ${o.id}): ${o.description}`
      )
      .join("\n");
    parts.push(`EXPECTED OUTPUTS:\n${outputDesc}`);
  }

  if (question.requiredChart) {
    parts.push(
      `REQUIRED CHART: ${question.requiredChart.type} — ${question.requiredChart.description}`
    );
  }

  parts.push(
    `GRADING GUIDANCE:
- For formula outputs: check correctness of the formula logic, not just the cell reference style.
- For value outputs: accept reasonable rounding (±1 unit unless stated otherwise).
- For chart outputs: check that the student described the correct chart type, data range, and axis labels.
- Award partial credit where partial work is shown.
- Write feedback in Polish.`
  );

  return parts.join("\n\n");
}

// ── cloze_text result context ─────────────────────────────────────────────────

/**
 * Builds a rubric addendum for cloze_text questions.
 * Includes per-blank correctness so the AI can focus feedback on wrong blanks.
 */
// ── table_fill result context ─────────────────────────────────────────────────

/**
 * Builds a rubric addendum for table_fill questions.
 * Includes per-cell correctness so AI focuses feedback on wrong inputs.
 */
export function buildTableFillResultSummary(
  inputs: TableFillInputDef[],
  inputResults: TableFillInputResult[]
): string {
  const lines = inputResults.map((r) => {
    const def = inputs.find((i) => i.id === r.inputId);
    const accepted = def?.acceptedAnswers?.length
      ? ` (also accepted: ${def.acceptedAnswers.join(", ")})`
      : "";
    return `  [${r.inputId}]: student wrote "${r.userAnswer}" — ${
      r.isCorrect ? "CORRECT" : `WRONG (correct: "${r.correctAnswer}"${accepted})`
    } [${r.earnedPoints}/${r.points} pt]`;
  });

  return `PER-CELL SCORING RESULTS (already computed — do NOT change scores):\n${lines.join("\n")}\n\nProvide qualitative feedback: explain why incorrect cells are wrong and give a tip for each. Do not re-score.`;
}

// ── true_false_group result context ──────────────────────────────────────────

/**
 * Builds a rubric addendum for true_false_group questions.
 */
export function buildTrueFalseResultSummary(
  statements: TrueFalseStatement[],
  statementResults: TrueFalseStatementResult[]
): string {
  const lines = statementResults.map((r) => {
    const stmt = statements.find((s) => s.id === r.statementId);
    const text = stmt ? `"${stmt.text.slice(0, 60)}${stmt.text.length > 60 ? "…" : ""}"` : r.statementId;
    return `  [${r.statementId}] ${text}: student chose "${r.userAnswer.toUpperCase()}" — ${
      r.isCorrect ? "CORRECT" : `WRONG (correct: "${r.correctAnswer.toUpperCase()}")`
    } [${r.earnedPoints}/${r.points} pt]`;
  });

  return `PER-STATEMENT SCORING RESULTS (already computed — do NOT change scores):\n${lines.join("\n")}\n\nExplain why each incorrect statement is true/false. Do not re-score.`;
}

// ── cloze_text result context ─────────────────────────────────────────────────

export function buildClozeResultSummary(
  blanks: ClozeBlank[],
  blankResults: ClozeBlankResult[]
): string {
  const lines = blankResults.map((r) => {
    const blank = blanks.find((b) => b.id === r.blankId);
    const accepted = blank?.acceptedAnswers?.length
      ? ` (also accepted: ${blank.acceptedAnswers.join(", ")})`
      : "";
    return `  {{${r.blankId}}}: student wrote "${r.userAnswer}" — ${
      r.isCorrect ? "CORRECT" : `WRONG (correct: "${r.correctAnswer}"${accepted})`
    } [${r.earnedPoints}/${r.points} pt]`;
  });

  return `PER-BLANK SCORING RESULTS (already computed — do NOT change scores):\n${lines.join("\n")}\n\nProvide qualitative feedback: explain why wrong blanks are incorrect and give a tip for each. Do not re-score.`;
}
