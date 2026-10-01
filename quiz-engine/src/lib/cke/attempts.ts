import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { CkeExamContent } from "./types";
import { examMinutes } from "./exam-code";
import { normalizeAnswer } from "./answers";
import { ApiError, type AttemptRow } from "./server";
import { loadAnswerRows, publicFeedback } from "./grade-service";

/** The open attempt of a user on a quiz, newest first (practice and exam share one slot). */
export async function findOpenAttempt(userId: string, quizId: string): Promise<AttemptRow | null> {
  const service = createServiceRoleClient();
  const { data } = await service
    .from("attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("quiz_id", quizId)
    .in("status", ["in_progress", "submitted"])
    .order("started_at", { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

export async function loadPublishedCkeQuiz(quizId: string, { allowDraft = false } = {}) {
  const service = createServiceRoleClient();
  const { data: quiz } = await service
    .from("quizzes")
    .select("id, title, status, format, exam_code, level, session, meta")
    .eq("id", quizId)
    .single();
  if (!quiz || quiz.format !== "cke_exam" || (quiz.status !== "published" && !(allowDraft && quiz.status === "draft"))) {
    throw new ApiError(404, "Nie znaleziono opublikowanego arkusza.");
  }
  const { data: version } = await service
    .from("quiz_versions")
    .select("id, content")
    .eq("quiz_id", quizId)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .single();
  if (!version) throw new ApiError(404, "Arkusz nie ma aktywnej wersji.");
  return { quiz, version: { id: version.id, content: version.content as unknown as CkeExamContent } };
}

export async function createAttempt(params: {
  userId: string;
  quizId: string;
  versionId: string;
  examCode: string;
  mode: "practice" | "exam";
  maxPoints: number;
}): Promise<AttemptRow> {
  const service = createServiceRoleClient();
  // The deadline is fixed once, when the attempt starts, so closing the tab
  // does not hand the student extra time. It is enforced by the API.
  const deadline =
    params.mode === "exam" ? new Date(Date.now() + examMinutes(params.examCode) * 60_000).toISOString() : null;
  const { data, error } = await service
    .from("attempts")
    .insert({
      user_id: params.userId,
      quiz_id: params.quizId,
      quiz_version_id: params.versionId,
      status: "in_progress",
      mode: params.mode,
      deadline,
      max_score: params.maxPoints,
    })
    .select("*")
    .single();
  if (error || !data) throw new ApiError(500, "Nie udało się rozpocząć podejścia.");
  return data;
}

/** Answers and grades of an attempt, in the shape the exam UI consumes. */
export async function attemptState(attemptId: string, content: CkeExamContent) {
  const rows = await loadAnswerRows(attemptId);
  const answers: Record<string, unknown> = {};
  const grades: Record<string, unknown> = {};
  for (const q of content.questions) {
    const row = rows.get(q.id);
    if (!row) continue;
    answers[q.id] = normalizeAnswer(q, row.answer);
    if (row.feedback) grades[q.id] = publicFeedback(row.feedback);
  }
  return { answers, grades };
}

export function publicAttempt(a: AttemptRow) {
  return {
    id: a.id,
    mode: a.mode,
    status: a.status,
    deadline: a.deadline,
    startedAt: a.started_at,
    submittedAt: a.submitted_at,
  };
}
