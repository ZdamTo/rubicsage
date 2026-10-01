import type { CkeGradeResult, CkeQuestion } from "./types";
import { inputRows, optionLabel } from "./answers";

/**
 * Questions with an exact key are graded by comparison, never by a model:
 * P-TF, P-CHOICE and every P-TABLE-MATCH whose key lines up one-to-one with
 * its rows and whose rubric is all-or-nothing. Exact, instant and free.
 *
 * Ported 1:1 from renderers.js (PTf.grade, PChoice.grade, PTableMatch.canGrade
 * / grade). Always ask `gradesDeterministically(q)` rather than checking the
 * type: the button label, the cost estimate and the grading path must agree.
 */

type Det = Omit<CkeGradeResult, "gradedAt" | "source">;

/** "A1, B3" -> Map { A => "1", B => "3" }. null if it is not that shape. */
export function parseMatchKey(raw: unknown): Map<string, string> | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const pairs = new Map<string, string>();
  for (const part of text.split(/[,;]/)) {
    const m = part.trim().match(/^([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+)\s*[.:–-]?\s*(\d+)$/);
    if (!m) return null;
    const letter = m[1].toUpperCase();
    if (pairs.has(letter)) return null; // "A1, A2" is not a matching
    pairs.set(letter, m[2]);
  }
  return pairs.size ? pairs : null;
}

/** Row "A." -> "A". The key writes bare letters; the table prints them dotted. */
function rowLetter(row: { label?: string }): string {
  return String(row?.label ?? "").replace(/[.\s]/g, "").toUpperCase();
}

/** Does the rubric offer anything between 0 and full marks? */
function isAllOrNothing(scoring: CkeQuestion["scoring"]): boolean {
  const max = Number(scoring?.max_points ?? 0);
  if (!(max > 0)) return false;
  const crit = scoring?.scoring_criteria;
  if (!crit || typeof crit !== "object" || Array.isArray(crit)) return max === 1;
  const keys = Object.keys(crit).map((k) => String(k).trim());
  return keys.length === 2 && keys.includes("0") && keys.includes(String(max));
}

function canGradeTableMatch(q: CkeQuestion): boolean {
  const key = parseMatchKey(q.scoring?.correct_answers);
  if (!key) return false;
  const rows = inputRows(q);
  if (!rows.length || rows.length !== key.size) return false;
  if (!rows.every((row) => key.has(rowLetter(row)))) return false;
  return isAllOrNothing(q.scoring);
}

export function gradesDeterministically(q: CkeQuestion): boolean {
  switch (q.type) {
    case "P-TF":
    case "P-CHOICE":
    case "P-SINGLE-CHOICE":
      return true;
    case "P-TABLE-MATCH":
      return canGradeTableMatch(q);
    default:
      return false;
  }
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function gradeTf(q: CkeQuestion, answer: unknown): Det {
  const max = Number(q.scoring?.max_points ?? 1);
  const ua = asRecord(answer);
  const expected = String(q.scoring?.correct_answers || "").replace(/\s+/g, "").toUpperCase();
  const given = (q.tf_questions ?? []).map((s) => String(ua[s.id] || "").toUpperCase()).join("");
  // An unanswered statement contributes nothing to `given`, so the length
  // check already catches incomplete answers. All-or-nothing, as CKE marks it.
  const correct = given.length === expected.length && given === expected;
  return { correct, points: correct ? max : 0, max_points: max, expected, given };
}

function gradeChoice(q: CkeQuestion, answer: unknown): Det {
  const max = Number(q.scoring?.max_points ?? 1);
  const ua = asRecord(answer);
  const expected = String(q.scoring?.correct_answers || "").trim().toUpperCase();
  const selId = String(ua.selected_option_id || ua.selected_option || "");
  const selected = (q.options ?? []).find((o) => o.id === selId);
  const given = selected ? String(selected.label || optionLabel(selected)).trim().toUpperCase() : "";
  const correct = given !== "" && given === expected;
  return { correct, points: correct ? max : 0, max_points: max, expected, given };
}

function gradeTableMatch(q: CkeQuestion, answer: unknown): Det {
  const max = Number(q.scoring?.max_points ?? 1);
  const key = parseMatchKey(q.scoring?.correct_answers) ?? new Map<string, string>();
  const rows = inputRows(q);
  const ua = asRecord(answer);
  const answerFor = (row: { id: string }) => String(ua[row.id] ?? "").trim();
  // Unanswered is wrong, not correct-by-vacuity: "niepełna" scores 0.
  const complete = rows.every((row) => answerFor(row) !== "");
  const correct = complete && rows.every((row) => key.get(rowLetter(row)) === answerFor(row));
  return {
    correct,
    points: correct ? max : 0,
    max_points: max,
    expected: rows.map((r) => `${rowLetter(r)}${key.get(rowLetter(r))}`).join(", "),
    given: rows.map((r) => `${rowLetter(r)}${answerFor(r) || "?"}`).join(", "),
  };
}

/** Grade a question by comparison. Throws if the question needs a model. */
export function gradeDeterministic(q: CkeQuestion, answer: unknown): CkeGradeResult {
  if (!gradesDeterministically(q)) throw new Error(`Question ${q.id} cannot be graded by comparison`);
  const det =
    q.type === "P-TF" ? gradeTf(q, answer)
    : q.type === "P-TABLE-MATCH" ? gradeTableMatch(q, answer)
    : gradeChoice(q, answer);
  return { ...det, source: "auto", gradedAt: new Date().toISOString() };
}
