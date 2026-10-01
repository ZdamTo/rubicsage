/**
 * Reading meaning out of CKE exam codes, e.g. MPOP-P1-100-2505:
 *
 *   MPOP  subject (język polski, poziom podstawowy/rozszerzony share it)
 *   P1    level + part: P1 = Arkusz 1 (test), P2 = wypracowanie,
 *         P0 = P1+P2 joined, R0 = poziom rozszerzony (one wypracowanie)
 *   100   variant: 100 is the standard paper, everything else is adapted
 *   2505  session: YYMM, so May 2025
 *
 * Ported from describeExam / examMinutes / build_index in the prototype.
 */

export interface ParsedCode {
  subject: string;
  level: string;
  variant: string;
  session: string;
}

export function parseExamCode(code: string): ParsedCode | null {
  const m = /^([A-Z]{4})-([A-Z][0-9])-([0-9A-Z]{3})-([0-9]{4})$/.exec(String(code));
  if (!m) return null;
  return { subject: m[1], level: m[2], variant: m[3], session: m[4] };
}

/** The exam a booklet belongs to: P1 and P2 join into P0, everything else stands alone. */
export function examCodeForBooklet(bookletId: string): string | null {
  const p = parseExamCode(bookletId);
  if (!p) return null;
  const level = p.level === "P1" || p.level === "P2" ? "P0" : p.level;
  return `${p.subject}-${level}-${p.variant}-${p.session}`;
}

export function levelOf(code: string): "podstawowy" | "rozszerzony" {
  const p = parseExamCode(code);
  return p?.level.startsWith("R") ? "rozszerzony" : "podstawowy";
}

/** Durations are not in the JSON; CKE gives 240 min (PP) and 210 min (PR). */
const EXAM_MINUTES: Record<string, number> = { P0: 240, R0: 210 };

export function examMinutes(code: string): number {
  const level = parseExamCode(code)?.level ?? "";
  return EXAM_MINUTES[level] ?? (level.startsWith("R") ? 210 : 240);
}

/** Order booklets inside one exam: Arkusz 1 before the wypracowanie. */
export function partOrder(bookletId: string): number {
  const level = parseExamCode(bookletId)?.level ?? "";
  return level === "P1" ? 1 : level === "P2" ? 2 : 3;
}

const MONTHS: Record<string, string> = {
  "01": "Styczeń", "02": "Luty", "03": "Marzec", "04": "Kwiecień",
  "05": "Maj", "06": "Czerwiec", "07": "Lipiec", "08": "Sierpień",
  "09": "Wrzesień", "10": "Październik", "11": "Listopad", "12": "Grudzień",
};

export function describeSession(session: string): { year: string; month: string; when: string } {
  const year = session.length === 4 ? "20" + session.slice(0, 2) : "";
  const month = MONTHS[session.slice(2)] ?? "";
  return { year, month, when: [month, year].filter(Boolean).join(" ") };
}

export function examTitle(code: string): string {
  const p = parseExamCode(code);
  if (!p) return code;
  return `Matura ${describeSession(p.session).when} — poziom ${levelOf(code)}`;
}

/* Polish plurals: 1 zadanie, 2–4 zadania, 5+ zadań (and 12–14 zadań). */
export function plural(n: number, one: string, few: string, many: string): string {
  const num = Number(n) || 0;
  if (num === 1) return one;
  const lastTwo = num % 100;
  const last = num % 10;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few;
  return many;
}

/**
 * "17 zadań + wypracowanie", "wypracowanie" or "12 zadań".
 * The rozszerzony paper really is one wypracowanie, so "1 zadanie" there would
 * read like a failed import.
 */
export function describeContents(kind: string, questions: number): string {
  const n = Number(questions) || 0;
  if (kind === "essay") return "wypracowanie";
  if (kind === "full") {
    const test = Math.max(0, n - 1);
    return `${test} ${plural(test, "zadanie", "zadania", "zadań")} + wypracowanie`;
  }
  return `${n} ${plural(n, "zadanie", "zadania", "zadań")}`;
}

export function kindOf(questions: Array<{ type: string }>): "full" | "essay" | "test" {
  const essays = questions.filter((q) => q.type === "P-ESSAY").length;
  if (!essays) return "test";
  return essays === questions.length ? "essay" : "full";
}
