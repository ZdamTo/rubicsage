import { GRADE_JSON_SCHEMA } from "./types";
import type { GradePayload } from "./types";

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
