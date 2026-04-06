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
  "sql_query",
  "spreadsheet_task",
  "cloze_text",
  "table_fill",
  "true_false_group",
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

// ── sql_query ────────────────────────────────────────────────────────────────

const SqlTable = z.object({
  name: z.string(),
  columns: z.array(z.object({ name: z.string(), type: z.string() })),
  sampleRows: z.array(z.record(z.unknown())).optional(),
});

export const SqlQueryQuestion = QuestionBase.extend({
  type: z.literal("sql_query"),
  /** Markdown block describing the DB schema (shown to student). */
  schemaMarkdown: z.string().optional(),
  /** Structured table definitions (alternative / supplement to schemaMarkdown). */
  tables: z.array(SqlTable).optional(),
  /** Example correct result set — shown in grading prompt. */
  expectedResult: z.array(z.record(z.unknown())).optional(),
  /** Keywords or sub-expressions the query must contain (e.g. "JOIN", "GROUP BY"). */
  expectedQueryPatterns: z.array(z.string()).optional(),
  dialect: z.enum(["sql", "mysql", "postgresql", "sqlite"]).default("sql"),
  /** INSERT / CREATE statements shown to student as context. */
  seedData: z.string().optional(),
  rubric: z.string().optional(),
});
export type SqlQueryQuestion = z.infer<typeof SqlQueryQuestion>;

// ── spreadsheet_task ──────────────────────────────────────────────────────────

const ExpectedOutputType = z.enum(["formula", "value", "range", "chart", "summary"]);

const ExpectedOutput = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  type: ExpectedOutputType,
});
export type ExpectedOutput = z.infer<typeof ExpectedOutput>;

export const SpreadsheetTaskQuestion = QuestionBase.extend({
  type: z.literal("spreadsheet_task"),
  /** Markdown table or description of the source data given to the student. */
  sourceDataDescription: z.string(),
  /** Each output the student must produce (formula, value, chart, etc.). */
  expectedOutputs: z.array(ExpectedOutput),
  /** Optional chart requirement. */
  requiredChart: z
    .object({ type: z.string(), description: z.string() })
    .optional(),
  rubric: z.string().optional(),
});
export type SpreadsheetTaskQuestion = z.infer<typeof SpreadsheetTaskQuestion>;

// ── cloze_text ────────────────────────────────────────────────────────────────

export const ClozeBlank = z.object({
  id: z.string(),
  correctAnswer: z.string(),
  /** Alternative accepted answers (case handling applied). */
  acceptedAnswers: z.array(z.string()).optional(),
  /** Default: false — comparison is case-insensitive by default. */
  caseSensitive: z.boolean().default(false),
  /** Points awarded for this blank. Default: 1. */
  points: z.number().default(1),
});
export type ClozeBlank = z.infer<typeof ClozeBlank>;

export const ClozeTextQuestion = QuestionBase.extend({
  type: z.literal("cloze_text"),
  /** Text with {{blankId}} placeholders, e.g. "SELECT {{col}} FROM {{tbl}}". */
  template: z.string(),
  blanks: z.array(ClozeBlank),
});
export type ClozeTextQuestion = z.infer<typeof ClozeTextQuestion>;

// ── table_fill ────────────────────────────────────────────────────────────────

export const TableFillCell = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("static"), value: z.string() }),
  z.object({ kind: z.literal("input"), inputId: z.string() }),
]);
export type TableFillCell = z.infer<typeof TableFillCell>;

export const TableFillColumn = z.object({
  id: z.string(),
  label: z.string(),
  width: z.string().optional(),
});
export type TableFillColumn = z.infer<typeof TableFillColumn>;

export const TableFillRow = z.object({
  id: z.string(),
  /** Maps column id → cell definition. */
  cells: z.record(TableFillCell),
});
export type TableFillRow = z.infer<typeof TableFillRow>;

export const TableFillInputDef = z.object({
  id: z.string(),
  answerType: z.enum(["text", "numeric"]).default("text"),
  correctAnswer: z.string(),
  acceptedAnswers: z.array(z.string()).optional(),
  /** Numeric tolerance (only used when answerType = "numeric"). */
  tolerance: z.number().optional(),
  caseSensitive: z.boolean().default(false),
  points: z.number().default(1),
  placeholder: z.string().optional(),
});
export type TableFillInputDef = z.infer<typeof TableFillInputDef>;

export const TableFillQuestion = QuestionBase.extend({
  type: z.literal("table_fill"),
  columns: z.array(TableFillColumn),
  rows: z.array(TableFillRow),
  inputs: z.array(TableFillInputDef),
});
export type TableFillQuestion = z.infer<typeof TableFillQuestion>;

// ── true_false_group ──────────────────────────────────────────────────────────

export const TrueFalseStatement = z.object({
  id: z.string(),
  text: z.string(),
  /** "true" | "false" — the correct P/F verdict. */
  correctAnswer: z.enum(["true", "false"]),
  points: z.number().default(1),
});
export type TrueFalseStatement = z.infer<typeof TrueFalseStatement>;

export const TrueFalseGroupQuestion = QuestionBase.extend({
  type: z.literal("true_false_group"),
  /** Labels shown on radio buttons. Defaults: { true: "P", false: "F" }. */
  labels: z
    .object({ true: z.string(), false: z.string() })
    .default({ true: "P", false: "F" }),
  statements: z.array(TrueFalseStatement),
});
export type TrueFalseGroupQuestion = z.infer<typeof TrueFalseGroupQuestion>;

// ── Union ───────────────────────────────────────────────────────────────────

export const Question = z.discriminatedUnion("type", [
  SingleChoiceQuestion,
  MultiChoiceQuestion,
  ShortTextQuestion,
  NumericQuestion,
  MathOpenQuestion,
  PolishEssayQuestion,
  CodePythonQuestion,
  SqlQueryQuestion,
  SpreadsheetTaskQuestion,
  ClozeTextQuestion,
  TableFillQuestion,
  TrueFalseGroupQuestion,
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
