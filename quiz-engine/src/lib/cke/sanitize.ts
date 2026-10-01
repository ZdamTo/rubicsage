import type { CkeExamContent, CkeQuestion } from "./types";
import { emptyAnswer } from "./answers";
import { gradesDeterministically } from "./deterministic";

/**
 * What the browser is allowed to see of an exam.
 *
 * The prototype shipped the whole JSON — CKE key (`correct_answers`), model
 * answers (`exemplary_answers`) and rubric — to every student, and graded in
 * the browser. Here grading runs on the server, so the client copy keeps only
 * what is needed to draw and answer the sheet: no key, no exemplars, no rubric.
 * For the wypracowanie a small display-only extract of the thresholds is kept,
 * so the scorecard tooltips match the paper's own level (PP and PR differ).
 */

type CountRange = { min: number; max: number | null; points: number };

export interface EssayScorecardInfo {
  poziom: string;
  minimumWords: number;
  matrix4a: Array<{ points: number; codes: string[] }>;
  rules3b: CountRange[];
  thresholds4b: { standard: CountRange[]; sld: CountRange[] };
  thresholds4c: { standard: CountRange[]; sld: CountRange[] };
}

export type ClientQuestion = Omit<CkeQuestion, "scoring" | "exam_requirements"> & {
  scoring: { max_points: number };
  /** true = graded instantly against the CKE key (no AI call). */
  deterministic: boolean;
  scorecard?: EssayScorecardInfo;
};

export interface ClientExam {
  id: string;
  name: string;
  parts: CkeExamContent["parts"];
  questions: ClientQuestion[];
}

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});

function ranges(list: unknown): CountRange[] {
  return ((list as Rec[]) || [])
    .map((e) => {
      const ec = rec(e.error_count);
      return { min: Number(ec.min ?? 0), max: ec.max == null ? null : Number(ec.max), points: Number(e.points ?? 0) };
    })
    .filter((r) => Number.isFinite(r.min) && Number.isFinite(r.points));
}

function scorecardInfo(q: CkeQuestion): EssayScorecardInfo {
  const criteria = rec(rec(q.scoring?.scoring_criteria).criteria);
  const byPoints = new Map<number, string[]>();
  for (const cell of (rec(criteria["4a"]).matrix as Rec[]) || []) {
    const p = Number(cell.points ?? 0);
    byPoints.set(p, [...(byPoints.get(p) || []), String(cell.classification ?? "")]);
  }
  const th = (id: string) => {
    const t = rec(rec(criteria[id]).thresholds);
    return { standard: ranges(t.standard), sld: ranges(t.specific_learning_difficulties) };
  };
  return {
    poziom: q.poziom || "PP",
    minimumWords: Number(q.minimum_word_count ?? 0),
    matrix4a: [...byPoints.entries()].sort((a, b) => a[0] - b[0]).map(([points, codes]) => ({ points, codes })),
    rules3b: ranges(rec(criteria["3b"]).rules),
    thresholds4b: th("4b"),
    thresholds4c: th("4c"),
  };
}

export function toClientQuestion(q: CkeQuestion): ClientQuestion {
  // Pick fields explicitly (allow-list), so a new secret field added to the
  // pipeline output is never leaked by accident.
  const out: ClientQuestion = {
    id: q.id,
    type: q.type,
    number: String(q.number),
    question: q.question,
    reference_data: q.reference_data,
    options: q.options,
    table: q.table,
    tf_questions: q.tf_questions,
    topics: q.topics,
    minimum_word_count: q.minimum_word_count,
    poziom: q.poziom,
    part_id: q.part_id,
    user_answer: emptyAnswer(q),
    scoring: { max_points: Number(q.scoring?.max_points ?? 0) },
    deterministic: gradesDeterministically(q),
  };
  if (q.type === "P-ESSAY") out.scorecard = scorecardInfo(q);
  // Drop undefined keys so the payload stays small.
  return JSON.parse(JSON.stringify(out));
}

export function toClientExam(content: CkeExamContent): ClientExam {
  return {
    id: content.id,
    name: content.name,
    parts: content.parts,
    questions: content.questions.map(toClientQuestion),
  };
}
