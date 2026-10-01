import type { CkeQuestion, CkeTableRow, PTextAnswerField } from "./types";

/**
 * Answer shapes, per type — identical to what the prototype stored, so data
 * can move between the two:
 *
 *   P-TEXT          [{ "input-field-id", "input-field-prefix", answer }]
 *   P-TABLE-TEXT    { [rowId]: string }
 *   P-TABLE-MATCH   { [rowId]: option label, e.g. "3" }
 *   P-TF            { [statementId]: "P" | "F" }
 *   P-CHOICE        { selected_option_id: optionId }
 *   P-ESSAY         { selected_topic_id, content, word_count, has_specific_learning_difficulties }
 *
 * `normalizeAnswer` is the server's gatekeeper: whatever the browser sends is
 * rebuilt from the question's own structure, so only known keys survive,
 * every value is a bounded string, and labels/prefixes always come from the
 * exam JSON rather than from the client (they end up inside AI prompts).
 */

const MAX_FIELD = 10_000;
const MAX_ESSAY = 60_000;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function optionLabel(o: { label?: string; value?: string; number?: string }): string {
  return o.value || o.number || o.label || "";
}

export function countWords(text: string): number {
  return (String(text ?? "").trim().match(/\S+/g) || []).length;
}

/** Is this the input cell of a table row? */
export function isInputCell(row: CkeTableRow, col: string): boolean {
  const cell = row.cells?.[col];
  if (row.user_answer && typeof row.user_answer === "object") return col in row.user_answer;
  if (cell && typeof cell === "object") return cell.type === "input";
  return false;
}

/**
 * The column a student fills in, for one row.
 *
 * Files mark it three ways: `row.user_answer` naming the column, a cell
 * `{ type: "input" }` (P-TABLE-MATCH), or — in every P-TABLE-TEXT shipped so
 * far — simply an empty string cell. The prototype only knew the first, so its
 * P-TABLE-TEXT questions rendered with no input at all.
 */
export function inputColumn(row: CkeTableRow): string | null {
  const cols = Object.keys(row.cells ?? {});
  const marked = cols.find((c) => isInputCell(row, c));
  if (marked) return marked;
  return cols.find((c) => row.cells[c] === "") ?? null;
}

export function inputRows(q: CkeQuestion): CkeTableRow[] {
  return (q.table?.rows ?? []).filter((r) => inputColumn(r) !== null);
}

/** Skeleton for P-TEXT: the fields the JSON ships, or one unnamed field. */
function textFields(q: CkeQuestion): PTextAnswerField[] {
  const sk = Array.isArray(q.user_answer) ? (q.user_answer as PTextAnswerField[]) : [];
  if (!sk.length) return [{ "input-field-id": "input-field-id-1", "input-field-prefix": "", answer: "" }];
  return sk.slice(0, 20).map((f, i) => ({
    "input-field-id": str(f?.["input-field-id"], 80) || `input-field-id-${i + 1}`,
    "input-field-prefix": str(f?.["input-field-prefix"], 300),
    answer: "",
  }));
}

function choiceKey(q: CkeQuestion): "selected_option_id" | "selected_option" {
  const sk = asRecord(q.user_answer);
  return "selected_option" in sk && !("selected_option_id" in sk) ? "selected_option" : "selected_option_id";
}

/** The empty answer for a question (what the student starts from). */
export function emptyAnswer(q: CkeQuestion): unknown {
  switch (q.type) {
    case "P-TEXT":
      return textFields(q);
    case "P-TABLE-TEXT":
    case "P-TABLE-MATCH":
      return Object.fromEntries((q.table?.rows ?? []).map((r) => [r.id, ""]));
    case "P-TF":
      return Object.fromEntries((q.tf_questions ?? []).map((s) => [s.id, ""]));
    case "P-CHOICE":
    case "P-SINGLE-CHOICE":
      return { [choiceKey(q)]: "" };
    case "P-ESSAY":
      return { selected_topic_id: "", content: "", word_count: 0, has_specific_learning_difficulties: false };
    default:
      return null;
  }
}

/** Rebuild an untrusted answer into the question's own shape. */
export function normalizeAnswer(q: CkeQuestion, raw: unknown): unknown {
  switch (q.type) {
    case "P-TEXT": {
      const given = Array.isArray(raw) ? raw : [];
      return textFields(q).map((f, i) => ({ ...f, answer: str(asRecord(given[i]).answer, MAX_FIELD) }));
    }
    case "P-TABLE-TEXT": {
      const given = asRecord(raw);
      return Object.fromEntries((q.table?.rows ?? []).map((r) => [r.id, str(given[r.id], 2_000)]));
    }
    case "P-TABLE-MATCH": {
      const given = asRecord(raw);
      const allowed = new Set((q.options ?? []).map(optionLabel));
      return Object.fromEntries(
        (q.table?.rows ?? []).map((r) => {
          const v = str(given[r.id], 20);
          return [r.id, allowed.has(v) ? v : ""];
        })
      );
    }
    case "P-TF": {
      const given = asRecord(raw);
      return Object.fromEntries(
        (q.tf_questions ?? []).map((s) => {
          const v = str(given[s.id], 1).toUpperCase();
          return [s.id, v === "P" || v === "F" ? v : ""];
        })
      );
    }
    case "P-CHOICE":
    case "P-SINGLE-CHOICE": {
      const given = asRecord(raw);
      const v = str(given.selected_option_id ?? given.selected_option, 80);
      const ok = (q.options ?? []).some((o) => o.id === v);
      return { [choiceKey(q)]: ok ? v : "" };
    }
    case "P-ESSAY": {
      const given = asRecord(raw);
      const topic = str(given.selected_topic_id, 80);
      const content = str(given.content, MAX_ESSAY);
      return {
        selected_topic_id: (q.topics ?? []).some((t) => t.id === topic) ? topic : "",
        content,
        word_count: countWords(content),
        has_specific_learning_difficulties: given.has_specific_learning_difficulties === true,
      };
    }
    default:
      return null;
  }
}

/**
 * Has the student actually put anything in? Only strings count: the essay
 * carries word_count and a boolean even when untouched, and P-TEXT fields
 * carry a non-empty id — only `answer` means anything there.
 */
export function isAnswered(value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.some(isAnswered);
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("answer" in v) return isAnswered(v.answer);
    if ("content" in v && "selected_topic_id" in v) return isAnswered(v.content);
    return Object.entries(v).some(([, x]) => typeof x === "string" && x.trim() !== "");
  }
  return false;
}

/** Stable JSON for comparing two answers (key order independent). */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}
