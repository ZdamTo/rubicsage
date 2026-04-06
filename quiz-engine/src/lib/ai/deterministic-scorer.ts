/**
 * Deterministic scoring for question types that don't need AI.
 */
import type { ClozeBlank, TableFillInputDef, TrueFalseStatement } from "@/lib/quiz/schemas";

export interface DeterministicResult {
  score: number;
  maxScore: number;
  isCorrect: boolean;
}

/**
 * Score a single-choice question.
 */
export function scoreSingleChoice(
  userAnswer: string,
  correctAnswer: string,
  maxScore: number
): DeterministicResult {
  const isCorrect =
    userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
  return { score: isCorrect ? maxScore : 0, maxScore, isCorrect };
}

/**
 * Score a multi-choice question (exact set match).
 */
export function scoreMultiChoice(
  userAnswers: string[],
  correctAnswers: string[],
  maxScore: number
): DeterministicResult {
  const userSet = new Set(userAnswers.map((a) => a.trim().toLowerCase()));
  const correctSet = new Set(correctAnswers.map((a) => a.trim().toLowerCase()));
  const isCorrect =
    userSet.size === correctSet.size &&
    [...userSet].every((a) => correctSet.has(a));
  return { score: isCorrect ? maxScore : 0, maxScore, isCorrect };
}

/**
 * Score a numeric answer with tolerance.
 */
export function scoreNumeric(
  userAnswer: string,
  correctAnswer: number,
  tolerance: number,
  maxScore: number
): DeterministicResult {
  const parsed = parseFloat(userAnswer.replace(",", ".").trim());
  if (isNaN(parsed)) {
    return { score: 0, maxScore, isCorrect: false };
  }
  const isCorrect = Math.abs(parsed - correctAnswer) <= tolerance;
  return { score: isCorrect ? maxScore : 0, maxScore, isCorrect };
}

/**
 * Score code_python tests from a test report.
 */
export interface TestResult {
  name: string;
  passed: boolean;
  expected?: string;
  actual?: string;
}

export function scoreCodeTests(
  testResults: TestResult[],
  maxScore: number
): DeterministicResult {
  if (testResults.length === 0) return { score: 0, maxScore, isCorrect: false };
  const passed = testResults.filter((t) => t.passed).length;
  const score = Math.round((passed / testResults.length) * maxScore);
  return { score, maxScore, isCorrect: passed === testResults.length };
}

// ── cloze_text scoring ────────────────────────────────────────────────────────

export interface ClozeBlankResult {
  blankId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  points: number;
  earnedPoints: number;
}

/**
 * Score a cloze_text question by checking each blank independently.
 * Supports multiple accepted answers and optional case sensitivity.
 * The raw earned points are scaled to maxScore.
 */
export function scoreClozeText(
  userAnswers: Record<string, string>,
  blanks: ClozeBlank[],
  maxScore: number
): DeterministicResult & { blankResults: ClozeBlankResult[] } {
  let totalPoints = 0;
  let earnedPoints = 0;

  const blankResults: ClozeBlankResult[] = blanks.map((blank) => {
    const points = blank.points ?? 1;
    totalPoints += points;

    const raw = (userAnswers[blank.id] ?? "").trim();
    const caseSensitive = blank.caseSensitive ?? false;

    const normalize = (s: string) => (caseSensitive ? s.trim() : s.trim().toLowerCase());

    const allAccepted = [blank.correctAnswer, ...(blank.acceptedAnswers ?? [])];
    const isCorrect = allAccepted.some((a) => normalize(raw) === normalize(a));

    if (isCorrect) earnedPoints += points;

    return {
      blankId: blank.id,
      userAnswer: raw,
      correctAnswer: blank.correctAnswer,
      isCorrect,
      points,
      earnedPoints: isCorrect ? points : 0,
    };
  });

  // Scale earned/total to maxScore
  const score =
    totalPoints === 0
      ? 0
      : Math.round((earnedPoints / totalPoints) * maxScore * 10) / 10;

  return {
    score: Math.min(score, maxScore),
    maxScore,
    isCorrect: earnedPoints === totalPoints,
    blankResults,
  };
}

// ── table_fill scoring ────────────────────────────────────────────────────────

export interface TableFillInputResult {
  inputId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  points: number;
  earnedPoints: number;
}

/**
 * Score a table_fill question by checking each editable input cell.
 * Supports text and numeric answer types with tolerance.
 */
export function scoreTableFill(
  userAnswers: Record<string, string>,
  inputs: TableFillInputDef[],
  maxScore: number
): DeterministicResult & { inputResults: TableFillInputResult[] } {
  let totalPoints = 0;
  let earnedPoints = 0;

  const inputResults: TableFillInputResult[] = inputs.map((inp) => {
    const points = inp.points ?? 1;
    totalPoints += points;

    const raw = (userAnswers[inp.id] ?? "").trim();
    const caseSensitive = inp.caseSensitive ?? false;
    let isCorrect = false;

    if (inp.answerType === "numeric") {
      const parsed = parseFloat(raw.replace(",", "."));
      const expected = parseFloat(inp.correctAnswer.replace(",", "."));
      const tol = inp.tolerance ?? 0;
      isCorrect = !isNaN(parsed) && Math.abs(parsed - expected) <= tol;
    } else {
      const normalize = (s: string) =>
        caseSensitive ? s.trim() : s.trim().toLowerCase();
      const allAccepted = [inp.correctAnswer, ...(inp.acceptedAnswers ?? [])];
      isCorrect = allAccepted.some((a) => normalize(raw) === normalize(a));
    }

    if (isCorrect) earnedPoints += points;

    return {
      inputId: inp.id,
      userAnswer: raw,
      correctAnswer: inp.correctAnswer,
      isCorrect,
      points,
      earnedPoints: isCorrect ? points : 0,
    };
  });

  const score =
    totalPoints === 0
      ? 0
      : Math.round((earnedPoints / totalPoints) * maxScore * 10) / 10;

  return {
    score: Math.min(score, maxScore),
    maxScore,
    isCorrect: earnedPoints === totalPoints,
    inputResults,
  };
}

// ── true_false_group scoring ──────────────────────────────────────────────────

export interface TrueFalseStatementResult {
  statementId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  points: number;
  earnedPoints: number;
}

/**
 * Score a true_false_group question — one point per correct statement.
 */
export function scoreTrueFalseGroup(
  userAnswers: Record<string, string>,
  statements: TrueFalseStatement[],
  maxScore: number
): DeterministicResult & { statementResults: TrueFalseStatementResult[] } {
  let totalPoints = 0;
  let earnedPoints = 0;

  const statementResults: TrueFalseStatementResult[] = statements.map((stmt) => {
    const points = stmt.points ?? 1;
    totalPoints += points;

    const userVal = (userAnswers[stmt.id] ?? "").trim().toLowerCase();
    const correct = stmt.correctAnswer.toLowerCase();
    const isCorrect = userVal === correct;

    if (isCorrect) earnedPoints += points;

    return {
      statementId: stmt.id,
      userAnswer: userVal,
      correctAnswer: correct,
      isCorrect,
      points,
      earnedPoints: isCorrect ? points : 0,
    };
  });

  const score =
    totalPoints === 0
      ? 0
      : Math.round((earnedPoints / totalPoints) * maxScore * 10) / 10;

  return {
    score: Math.min(score, maxScore),
    maxScore,
    isCorrect: earnedPoints === totalPoints,
    statementResults,
  };
}
