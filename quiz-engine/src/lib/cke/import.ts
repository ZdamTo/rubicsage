import type { CkeBookletInput } from "./schema";
import type { CkeExamContent, CkeQuestion } from "./types";
import { examCodeForBooklet, examMinutes, examTitle, kindOf, levelOf, parseExamCode, partOrder } from "./exam-code";

/**
 * Turning uploaded booklets into stored exams.
 *
 * P1 (Arkusz 1) + P2 (wypracowanie) of one variant and session become one
 * 60-point exam (code …-P0-…); R0 stands alone — same grouping as the
 * prototype's build_index. Booklets can be uploaded together or one at a time:
 * a part that is uploaded replaces only that part of an existing exam.
 */

export const SUPPORTED_SUBJECTS = ["MPOP"] as const;

export interface ImportGroup {
  examCode: string;
  booklets: CkeBookletInput[];
}

export function groupBooklets(booklets: CkeBookletInput[]): { groups: ImportGroup[]; errors: string[] } {
  const errors: string[] = [];
  const byExam = new Map<string, Map<string, CkeBookletInput>>();
  for (const b of booklets) {
    const parsed = parseExamCode(b.id);
    if (!parsed) { errors.push(`${b.id}: niepoprawny kod arkusza`); continue; }
    if (!(SUPPORTED_SUBJECTS as readonly string[]).includes(parsed.subject)) {
      errors.push(`${b.id}: obsługiwany jest tylko język polski (MPOP)`);
      continue;
    }
    if (!["P1", "P2", "R0"].includes(parsed.level)) {
      errors.push(`${b.id}: nieobsługiwany poziom/część ${parsed.level} (oczekiwano P1, P2 lub R0)`);
      continue;
    }
    const code = examCodeForBooklet(b.id)!;
    const parts = byExam.get(code) ?? new Map();
    if (parts.has(b.id)) errors.push(`${b.id}: plik przesłany dwa razy — użyto ostatniego`);
    parts.set(b.id, b);
    byExam.set(code, parts);
  }
  return {
    groups: [...byExam.entries()].map(([examCode, parts]) => ({ examCode, booklets: [...parts.values()] })),
    errors,
  };
}

export function expectedParts(examCode: string): string[] {
  const p = parseExamCode(examCode);
  if (!p) return [];
  if (p.level === "P0") return ["P1", "P2"].map((l) => `${p.subject}-${l}-${p.variant}-${p.session}`);
  return [examCode];
}

/** Build (or update) the stored content for one exam. */
export function buildExamContent(group: ImportGroup, existing?: CkeExamContent | null): CkeExamContent {
  const parts = new Map<string, CkeQuestion[]>();
  let name = "";
  if (existing?.format === "cke_exam") {
    for (const q of existing.questions) {
      const pid = q.part_id ?? existing.id;
      parts.set(pid, [...(parts.get(pid) ?? []), q]);
    }
    name = existing.name;
  }
  for (const b of group.booklets) {
    parts.set(b.id, b.questions.map((q) => ({ ...(q as unknown as CkeQuestion), part_id: b.id })));
    name = name || b.name || "";
  }

  const ordered = [...parts.keys()].sort((a, b) => partOrder(a) - partOrder(b) || a.localeCompare(b));
  const questions = ordered.flatMap((pid) => parts.get(pid)!);

  const seen = new Set<string>();
  for (const q of questions) {
    if (seen.has(q.id)) throw new Error(`Powtórzony identyfikator zadania ${q.id} w ${group.examCode}`);
    seen.add(q.id);
  }

  return {
    format: "cke_exam",
    id: group.examCode,
    name: name || "Matura z języka polskiego",
    subjectSlug: "polish",
    parts: ordered.map((id) => ({ id, questions: parts.get(id)!.length })),
    questions,
  };
}

export function examMeta(content: CkeExamContent) {
  const present = content.parts.map((p) => p.id);
  return {
    max_points: content.questions.reduce((s, q) => s + Number(q.scoring?.max_points ?? 0), 0),
    questions: content.questions.length,
    kind: kindOf(content.questions),
    minutes: examMinutes(content.id),
    parts: present,
    missing_parts: expectedParts(content.id).filter((p) => !present.includes(p)),
  };
}

export function quizRowFor(content: CkeExamContent) {
  const parsed = parseExamCode(content.id)!;
  const meta = examMeta(content);
  return {
    subject: "polish" as const,
    format: "cke_exam" as const,
    exam_code: content.id,
    level: levelOf(content.id),
    session: parsed.session,
    title: examTitle(content.id),
    description:
      `Arkusz CKE ${content.id}` +
      (meta.missing_parts.length ? ` — brakuje części: ${meta.missing_parts.join(", ")}` : ""),
    meta,
  };
}
