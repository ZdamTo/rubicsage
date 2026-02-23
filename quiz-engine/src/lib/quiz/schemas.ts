import { z } from "zod";

// ── Question Types ──────────────────────────────────────────────────────────

export const QuestionType = z.enum([
  "single_choice",
  "multi_choice",
  "short_text",
  "numeric",
  "math_open_with_work",
  "polish_essay",
  "code_python",
]);
export type QuestionType = z.infer<typeof QuestionType>;

const GradingMode = z.enum(["deterministic", "ai", "hybrid"]);

const QuestionBase = z.object({
  id: z.string(),
  type: QuestionType,
  promptMarkdown: z.string(),
  maxScore: z.number(),
  grading: z.object({ mode: GradingMode }),
  metadata: z
    .object({
      tags: z.array(z.string()).optional(),
      source: z.string().optional(),
    })
    .optional(),
});

// ── Per-Type Schemas ────────────────────────────────────────────────────────

export const SingleChoiceQuestion = QuestionBase.extend({
  type: z.literal("single_choice"),
  choices: z.array(z.object({ id: z.string(), text: z.string() })),
  correctAnswer: z.string(),
});

export const MultiChoiceQuestion = QuestionBase.extend({
  type: z.literal("multi_choice"),
  choices: z.array(z.object({ id: z.string(), text: z.string() })),
  correctAnswers: z.array(z.string()),
});

export const ShortTextQuestion = QuestionBase.extend({
  type: z.literal("short_text"),
  expectedKeyPoints: z.array(z.string()).optional(),
  rubric: z.string().optional(),
});

export const NumericQuestion = QuestionBase.extend({
  type: z.literal("numeric"),
  correctAnswer: z.number(),
  tolerance: z.number().default(0),
});

export const MathOpenQuestion = QuestionBase.extend({
  type: z.literal("math_open_with_work"),
  correctAnswer: z.string(),
  rubric: z.string(),
});

export const PolishEssayQuestion = QuestionBase.extend({
  type: z.literal("polish_essay"),
  minWords: z.number().default(300),
  rubricFile: z.string(), // path to rubric markdown
  rubric: z.string().optional(), // inline rubric text
});

export const CodePythonTest = z.object({
  name: z.string(),
  stdin: z.string(),
  expectedStdout: z.string(),
});

export const CodePythonQuestion = QuestionBase.extend({
  type: z.literal("code_python"),
  starterCode: z.string().default(""),
  tests: z.array(CodePythonTest),
  hiddenTests: z.array(CodePythonTest).optional(),
});

// ── Union ───────────────────────────────────────────────────────────────────

export const Question = z.discriminatedUnion("type", [
  SingleChoiceQuestion,
  MultiChoiceQuestion,
  ShortTextQuestion,
  NumericQuestion,
  MathOpenQuestion,
  PolishEssayQuestion,
  CodePythonQuestion,
]);
export type Question = z.infer<typeof Question>;

// ── Quiz ────────────────────────────────────────────────────────────────────

export const Quiz = z.object({
  id: z.string(),
  title: z.string(),
  subject: z.string(),
  subjectSlug: z.string(),
  version: z.string().default("1.0"),
  questions: z.array(Question),
});
export type Quiz = z.infer<typeof Quiz>;

// ── Grading API ─────────────────────────────────────────────────────────────

export const AISettings = z.object({
  provider: z.enum(["openai", "gemini", "anthropic"]),
  model: z.string(),
  reasoningLevel: z.string().optional(),
  allowWeb: z.boolean().default(false),
});
export type AISettings = z.infer<typeof AISettings>;

export const GradeRequest = z.object({
  quizId: z.string(),
  questionId: z.string(),
  question: z.any(), // validated separately per type
  userAnswer: z.any(),
  attachments: z
    .object({
      imageBase64: z.string().optional(),
      code: z.string().optional(),
      stdout: z.string().optional(),
      stderr: z.string().optional(),
      testReport: z.any().optional(),
    })
    .optional(),
  aiSettings: AISettings,
});
export type GradeRequest = z.infer<typeof GradeRequest>;

export const RubricBreakdownItem = z.object({
  criterion: z.string(),
  points: z.number(),
  maxPoints: z.number(),
  rationale: z.string(),
});

export const GradeResult = z.object({
  score: z.number(),
  maxScore: z.number(),
  rubricBreakdown: z.array(RubricBreakdownItem).optional(),
  feedback: z.object({
    summary: z.string(),
    strengths: z.array(z.string()),
    issues: z.array(z.string()),
    nextSteps: z.array(z.string()),
  }),
  confidence: z.number().min(0).max(1),
  modelUsed: z.string(),
});
export type GradeResult = z.infer<typeof GradeResult>;
