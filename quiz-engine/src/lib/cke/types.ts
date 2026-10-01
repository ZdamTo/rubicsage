/**
 * Types for CKE exam sheets (arkusze maturalne z języka polskiego).
 *
 * The JSON shape is the one produced by the pdf-json pipeline from the
 * zdamto.io prototype (`exams/<id>/<id>.json`): `{ id, name, questions[] }`
 * where each question carries a `type` of P-TEXT, P-TABLE-TEXT,
 * P-TABLE-MATCH, P-TF, P-CHOICE / P-SINGLE-CHOICE or P-ESSAY.
 *
 * Several booklets (P1 = Arkusz 1, P2 = wypracowanie) are joined into one
 * stored exam (`CkeExamContent`), exactly like the prototype's index.json did.
 */

export type CkeQuestionType =
  | "P-TEXT"
  | "P-TABLE-TEXT"
  | "P-TABLE-MATCH"
  | "P-TF"
  | "P-CHOICE"
  | "P-SINGLE-CHOICE"
  | "P-ESSAY";

export interface CkeFootnote {
  n?: number | string;
  text?: string;
}

export interface CkeReference {
  id?: string;
  type?: "text" | "image" | "sound" | string;
  name?: string;
  author?: string;
  title?: string;
  content?: string;
  path?: string;
  footnotes?: CkeFootnote[];
}

export interface CkeOption {
  id: string;
  label?: string;
  value?: string;
  number?: string;
  content?: string;
}

export type CkeTableCell =
  | string
  | { type?: "static" | "input" | string; content?: string; input_type?: string };

export interface CkeTableRow {
  id: string;
  label?: string;
  cells: Record<string, CkeTableCell>;
  /** Some files list the input column(s) of a row here. Most do not. */
  user_answer?: Record<string, unknown>;
}

export interface CkeTopic {
  id: string;
  number?: string;
  title?: string;
  requirements?: string[];
}

export interface CkeScoring {
  max_points: number;
  // Free-form: { "1": "...", "0": "..." } for short questions, a large
  // structured object for the essay.
  scoring_criteria?: unknown;
  exemplary_answers?: string;
  correct_answers?: string;
}

export interface CkeQuestion {
  id: string;
  type: CkeQuestionType;
  number: string;
  question?: string;
  reference_data?: CkeReference[];
  options?: CkeOption[];
  table?: { rows: CkeTableRow[] };
  tf_questions?: Array<{ id: string; question?: string }>;
  topics?: CkeTopic[];
  minimum_word_count?: number;
  poziom?: string;
  session?: string;
  scoring: CkeScoring;
  exam_requirements?: unknown;
  /** The empty answer skeleton shipped in the source JSON. */
  user_answer?: unknown;
  /** Added on import: which booklet (P1/P2/R0 code) the question came from. */
  part_id?: string;
}

/** One booklet as it comes out of the pipeline. */
export interface CkeBooklet {
  id: string;
  name?: string;
  questions: CkeQuestion[];
}

export type CkeExamKind = "full" | "essay" | "test";

/** What is stored in quiz_versions.content for a cke_exam quiz. */
export interface CkeExamContent {
  format: "cke_exam";
  /** Joined exam code, e.g. MPOP-P0-100-2505. */
  id: string;
  name: string;
  subjectSlug: "polish";
  parts: Array<{ id: string; questions: number }>;
  questions: CkeQuestion[];
}

/* ── Answers ─────────────────────────────────────────────────────────────── */

export interface PTextAnswerField {
  "input-field-id"?: string;
  "input-field-prefix"?: string;
  answer: string;
}

export interface EssayAnswer {
  selected_topic_id: string;
  content: string;
  word_count?: number;
  has_specific_learning_difficulties?: boolean;
}

/* ── Grades ──────────────────────────────────────────────────────────────── */

/** Result of grading one non-essay question (stored in attempt_answers.feedback). */
export interface CkeGradeResult {
  points: number | null;
  max_points: number;
  /** "auto" = compared against the CKE key; "ai" = graded by a model. */
  source: "auto" | "ai";
  correct?: boolean;
  expected?: string;
  given?: string;
  explanation?: string;
  parsed_ok?: boolean;
  model?: string;
  gradedAt: string;
}

export interface EssayEvaluation {
  raw_table_fill: Record<string, Record<string, unknown>>;
  effective_table_fill: Record<string, { counted: boolean; display_state: string; points: number }>;
  totals: { raw_diagnostic_points: number; official_points: number; max_points: number };
  applied_gating_rules: string[];
}

/** Stored for the wypracowanie (attempt_answers.feedback). */
export interface EssayGrading {
  ai_raw_results: Record<string, Record<string, unknown>>;
  failed_criteria: Array<{ id: string; error: string }>;
  evaluation: EssayEvaluation | null;
  model?: string;
  gradedAt: string;
}
