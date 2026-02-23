/**
 * Deterministic scoring for question types that don't need AI.
 */

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
