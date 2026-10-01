import type { CkeQuestion, EssayAnswer, EssayEvaluation } from "./types";
import { countWords } from "./answers";

/**
 * P-ESSAY — deterministic aggregator: raw AI values -> examiner table.
 *
 * The model reports only raw observations (error counts, a classification
 * letter, a base score). THIS decides the points, using the matrix, the
 * thresholds and the gating rules carried in the exam JSON — never a model's
 * total. Same inputs, same table, every time. Ported 1:1 from the prototype's
 * aggregateEssay() in renderers.js.
 */

export const ESSAY_ALL_CRITERIA = ["1", "2", "3a", "3b", "3c", "4a", "4b", "4c"] as const;

type Range = { min?: number | null; max?: number | null };
type Rec = Record<string, unknown>;

function asRecord(v: unknown): Rec {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {};
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** `{min, max}` where a null/absent max means "and upwards". */
function inCountRange(count: number, range: Range | undefined): boolean {
  if (!range) return false;
  const min = range.min ?? 0;
  const max = range.max;
  return count >= min && (max === null || max === undefined || count <= max);
}

function byCount(list: unknown, count: number): Rec | undefined {
  return ((list as Rec[]) || []).find((e) => inCountRange(count, e.error_count as Range));
}

function resolvePath(path: string, ctx: Rec): unknown {
  return String(path).split(".").reduce<unknown>((o, k) => (o == null ? undefined : (o as Rec)[k]), ctx);
}

function gatingHolds(condition: Rec, ctx: Rec): boolean {
  const actual = resolvePath(String(condition.field ?? ""), ctx);
  switch (condition.operator) {
    case "equals": return actual === condition.value;
    case "not_equals": return actual !== condition.value;
    case "less_than": return Number(actual) < Number(condition.value);
    case "greater_than": return Number(actual) > Number(condition.value);
    default: return false;
  }
}

/** Clamp a count reported by a model: non-negative integer, sane upper bound. */
function count(v: unknown): number {
  return Math.max(0, Math.min(10_000, Math.round(num(v))));
}

export function aggregateEssay(
  question: CkeQuestion,
  answer: EssayAnswer,
  aiResults: Record<string, Rec> = {}
): EssayEvaluation {
  const scoring = asRecord(question?.scoring?.scoring_criteria);
  const criteria = asRecord(scoring.criteria);
  const common = asRecord(scoring.common);
  const sld = answer.has_specific_learning_difficulties === true;
  // Derived from the text, never trusted from a stored number: gating rules
  // zero six criteria below the minimum length.
  const ctxAnswer = { ...answer, word_count: countWords(answer.content) };

  const crit = (id: string) => asRecord(criteria[id]);
  const raw: Record<string, Rec> = {};

  const r1 = asRecord(aiResults["1"]);
  raw["1"] = {
    points: num(r1.points) >= 1 ? 1 : 0,
    zero_reasons: asRecord(r1.zero_reasons),
  };

  // 2 — base score minus one point per factual error, never below the floor.
  const adjust = asRecord(crit("2").factual_error_adjustment);
  const r2 = asRecord(aiResults["2"]);
  const max2 = num(crit("2").max_points, 16);
  const base = Math.max(0, Math.min(max2, Math.round(num(r2.base_points_before_factual_errors))));
  const factual = count(r2.factual_error_count);
  const deducted = adjust.enabled === false ? base : base - factual * num(adjust.deduction_per_error, 1);
  raw["2"] = {
    base_points_before_factual_errors: base,
    factual_error_count: factual,
    final_points: Math.max(num(adjust.minimum_points, 0), deducted),
  };

  // 3a — the classification letter the examiner circles maps to points.
  const cls3a = String(asRecord(aiResults["3a"]).classification || "").toUpperCase().slice(0, 1);
  const rule3a = ((crit("3a").rules as Rec[]) || []).find((r) => String(r.classification).toUpperCase() === cls3a);
  raw["3a"] = { classification: cls3a, points: num(rule3a?.points) };

  const cohesion = count(asRecord(aiResults["3b"]).cohesion_error_count);
  raw["3b"] = { cohesion_error_count: cohesion, points: num(byCount(crit("3b").rules, cohesion)?.points) };

  raw["3c"] = { points: num(asRecord(aiResults["3c"]).points) >= 1 ? 1 : 0 };

  // 4a — range x error count, straight off the printed matrix.
  const r4a = asRecord(aiResults["4a"]);
  const range = String(r4a.language_range || "");
  const langErrors = count(r4a.language_error_count);
  const cell = ((crit("4a").matrix as Rec[]) || []).find(
    (m) => m.range === range && inCountRange(langErrors, m.error_count as Range)
  );
  raw["4a"] = {
    classification: String(cell?.classification || ""),
    language_error_count: langErrors,
    points: num(cell?.points),
  };

  // 4b / 4c — thresholds, using the dyslexia column when it applies.
  for (const [id, key] of [["4b", "orthographic_error_count"], ["4c", "punctuation_error_count"]] as const) {
    const c = count(asRecord(aiResults[id])[key]);
    const thresholds = asRecord(crit(id).thresholds);
    const list = sld && thresholds.specific_learning_difficulties ? thresholds.specific_learning_difficulties : thresholds.standard;
    raw[id] = { [key]: c, points: num(byCount(list, c)?.points) };
  }

  /* ---- gating: which of those actually count ---- */
  const assessed = (id: string) => (id === "2" ? num(raw["2"].final_points) : num(raw[id].points));

  const effective: EssayEvaluation["effective_table_fill"] = {};
  ESSAY_ALL_CRITERIA.forEach((id) => {
    effective[id] = { counted: true, display_state: "counted", points: assessed(id) };
  });

  const context: Rec = { ...raw, user_answer: ctxAnswer };
  const applied: string[] = [];

  for (const rule of (common.gating_rules as Rec[]) || []) {
    if (!gatingHolds(asRecord(rule.condition), context)) continue;
    applied.push(String(rule.id ?? ""));
    const effect = asRecord(rule.effect);
    // `evaluate_only` keeps target_criteria and zeroes the rest; every other
    // action zeroes what it targets.
    const zeroed = (effect.action === "evaluate_only" ? effect.set_zero_for : effect.target_criteria) as string[] | undefined;
    (zeroed || []).forEach((id) => {
      if (!effective[id]) return;
      effective[id] = { counted: false, display_state: "greyed_out", points: num(effect.value, 0) };
    });
  }

  const sum = (fn: (id: string) => number) => ESSAY_ALL_CRITERIA.reduce((t, id) => t + (fn(id) || 0), 0);

  return {
    raw_table_fill: raw,
    effective_table_fill: effective,
    totals: {
      raw_diagnostic_points: sum(assessed),
      official_points: sum((id) => effective[id].points),
      max_points: num(question?.scoring?.max_points, 35),
    },
    applied_gating_rules: applied,
  };
}
