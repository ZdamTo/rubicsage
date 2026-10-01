import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { completeText, AICallError, polishGradingModel } from "@/lib/ai/text-completion";
import type { CkeGradeResult, CkeQuestion, EssayAnswer, EssayGrading } from "./types";
import { isAnswered, normalizeAnswer, stableStringify, emptyAnswer } from "./answers";
import { gradeDeterministic, gradesDeterministically } from "./deterministic";
import { buildEssayCriterionPrompt, buildQuestionPrompt, ESSAY_CRITERIA, parseJsonReply } from "./prompts";
import { aggregateEssay } from "./essay";
import { ApiError, type ApiProfile, type LoadedAttempt, reserveAiCalls } from "./server";

/**
 * Grading runs here, on the server, for every type:
 *  - closed questions against the CKE key (free, instant),
 *  - open questions with one AI call,
 *  - the wypracowanie with eight AI calls (one per criterion) whose raw
 *    observations are turned into points by aggregateEssay().
 *
 * The grade is stored next to the answer it was given for. Changing the
 * answer later clears the grade (see saveAnswers), so a score on screen is
 * always the score of the answer on screen.
 */

type AnswerRow = { question_id: string; answer: unknown; score: number | null; feedback: unknown };

export type StoredFeedback = (CkeGradeResult & { kind?: "question"; raw?: string }) | (EssayGrading & { kind: "essay"; raw?: Record<string, string> });

/** Strip the verbatim model output before sending a grade to the browser. */
export function publicFeedback(fb: unknown): unknown {
  if (!fb || typeof fb !== "object") return null;
  const { raw: _raw, ...rest } = fb as Record<string, unknown>;
  void _raw;
  return rest;
}

export async function loadAnswerRows(attemptId: string, questionIds?: string[]): Promise<Map<string, AnswerRow>> {
  const service = createServiceRoleClient();
  let query = service.from("attempt_answers").select("question_id, answer, score, feedback").eq("attempt_id", attemptId);
  if (questionIds) query = query.in("question_id", questionIds);
  const { data, error } = await query;
  if (error) throw new ApiError(500, "Nie udało się wczytać odpowiedzi.");
  return new Map((data ?? []).map((r) => [r.question_id, r as AnswerRow]));
}

/**
 * Store answers (already keyed by known question ids). An answer that differs
 * from the stored one replaces it and clears any grade attached to it.
 * Returns the ids whose grade was cleared.
 */
export async function saveAnswers(loaded: LoadedAttempt, incoming: Record<string, unknown>): Promise<string[]> {
  const ids = Object.keys(incoming);
  if (!ids.length) return [];
  const existing = await loadAnswerRows(loaded.attempt.id, ids);
  const upserts: Array<Record<string, unknown>> = [];
  const cleared: string[] = [];

  for (const qid of ids) {
    const q = loaded.questions.get(qid);
    if (!q) continue;
    const normalized = normalizeAnswer(q, incoming[qid]);
    const prev = existing.get(qid);
    if (prev && stableStringify(prev.answer) === stableStringify(normalized)) continue;
    if (!prev && !isAnswered(normalized)) continue;
    if (prev?.feedback) cleared.push(qid);
    upserts.push({
      attempt_id: loaded.attempt.id,
      question_id: qid,
      answer: normalized,
      max_score: Number(q.scoring?.max_points ?? 0),
      score: null,
      feedback: null,
      graded_by_model: null,
    });
  }

  if (upserts.length) {
    const service = createServiceRoleClient();
    const { error } = await service
      .from("attempt_answers")
      .upsert(upserts as never, { onConflict: "attempt_id,question_id" });
    if (error) throw new ApiError(500, "Nie udało się zapisać odpowiedzi.");
  }
  return cleared;
}

async function storeGrade(attemptId: string, q: CkeQuestion, answer: unknown, score: number | null, feedback: StoredFeedback, model: string | null) {
  const service = createServiceRoleClient();
  const { error } = await service.from("attempt_answers").upsert(
    {
      attempt_id: attemptId,
      question_id: q.id,
      answer: answer as Json,
      score,
      max_score: Number(q.scoring?.max_points ?? 0),
      feedback: feedback as unknown as Json,
      graded_by_model: model,
    },
    { onConflict: "attempt_id,question_id" }
  );
  if (error) throw new ApiError(500, "Nie udało się zapisać oceny.");
}

function aiError(err: unknown): never {
  if (err instanceof AICallError) {
    throw new ApiError(err.kind === "quota" ? 429 : err.kind === "config" ? 503 : 502, err.message);
  }
  throw err;
}

async function gradeOpen(profile: ApiProfile, loaded: LoadedAttempt, q: CkeQuestion, answer: unknown) {
  await reserveAiCalls(profile, 1);
  let reply: { text: string; model: string };
  try {
    reply = await completeText(buildQuestionPrompt(q, answer));
  } catch (err) {
    aiError(err);
  }
  const parsed = parseJsonReply(reply.text);
  const max = Number(q.scoring?.max_points ?? 0);
  const n = parsed ? Number(parsed.points) : NaN;
  // Clamp: a model that returns 7/2 is wrong, and storing it would corrupt the total.
  const points = Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : null;
  const result: StoredFeedback = {
    kind: "question",
    source: "ai",
    points,
    max_points: max,
    explanation: typeof parsed?.explanation === "string" ? parsed.explanation.slice(0, 5_000) : "",
    parsed_ok: points !== null,
    model: reply.model,
    gradedAt: new Date().toISOString(),
    raw: reply.text.slice(0, 20_000), // paid for; kept for review, never sent to the browser
  };
  await storeGrade(loaded.attempt.id, q, answer, points, result, reply.model);
  return result;
}

async function gradeEssay(profile: ApiProfile, loaded: LoadedAttempt, q: CkeQuestion, answer: EssayAnswer, prev: AnswerRow | undefined) {
  if (!answer.selected_topic_id) throw new ApiError(400, "Wybierz temat wypracowania.");
  const prevFb = prev?.feedback as (EssayGrading & { kind?: string; raw?: Record<string, string> }) | null | undefined;
  const results: Record<string, Record<string, unknown>> = { ...(prevFb?.kind === "essay" ? prevFb.ai_raw_results : {}) };
  const raws: Record<string, string> = { ...(prevFb?.kind === "essay" ? prevFb.raw ?? {} : {}) };
  const todo: string[] = ESSAY_CRITERIA.map((c) => c.id as string).filter((id) => !results[id]);

  await reserveAiCalls(profile, todo.length);

  // Independent criteria go out together: one call's latency instead of eight.
  const settled = await Promise.allSettled(
    todo.map(async (id) => {
      const reply = await completeText(buildEssayCriterionPrompt(q, answer, id));
      raws[id] = reply.text.slice(0, 20_000);
      const parsed = parseJsonReply(reply.text);
      if (!parsed) throw new Error("nie udało się odczytać odpowiedzi modelu");
      results[id] = parsed;
    })
  );

  const failed = settled
    .map((s, i) => (s.status === "rejected" ? { id: todo[i], error: s.reason instanceof Error ? s.reason.message : String(s.reason) } : null))
    .filter((x): x is { id: string; error: string } => !!x);

  // If nothing at all succeeded because of a config/quota problem, say why.
  const firstAiErr = settled.find((s) => s.status === "rejected" && s.reason instanceof AICallError) as PromiseRejectedResult | undefined;
  if (todo.length && failed.length === todo.length && firstAiErr && !Object.keys(results).length) aiError(firstAiErr.reason);

  const complete = ESSAY_CRITERIA.every((c) => results[c.id]);
  // Points only once every criterion is in: a partial total would read as a result.
  const evaluation = complete ? aggregateEssay(q, answer, results) : null;
  const { model } = polishGradingModel();
  const grading: StoredFeedback = {
    kind: "essay",
    ai_raw_results: results,
    failed_criteria: failed,
    evaluation,
    model,
    gradedAt: new Date().toISOString(),
    raw: raws,
  };
  await storeGrade(loaded.attempt.id, q, answer, evaluation ? evaluation.totals.official_points : null, grading, model);
  return grading;
}

/**
 * Grade one question of an attempt. `answerFromClient` is used (and saved)
 * only while the attempt is open; a submitted attempt is graded on what was
 * stored when it closed.
 */
export async function gradeQuestionInAttempt(
  profile: ApiProfile,
  loaded: LoadedAttempt,
  questionId: string,
  answerFromClient: unknown
) {
  const q = loaded.questions.get(questionId);
  if (!q) throw new ApiError(404, "Nie ma takiego zadania w arkuszu.");

  const { attempt } = loaded;
  if (attempt.mode === "exam" && attempt.status !== "submitted") {
    throw new ApiError(403, "Sprawdzanie jest wyłączone w trybie egzaminacyjnym — zakończ arkusz, aby zobaczyć wynik.");
  }
  if (attempt.status === "abandoned") throw new ApiError(409, "To podejście zostało zamknięte.");

  if (attempt.status === "in_progress" && answerFromClient !== undefined) {
    await saveAnswers(loaded, { [questionId]: answerFromClient });
  }
  const row = (await loadAnswerRows(attempt.id, [questionId])).get(questionId);
  const answer = row ? normalizeAnswer(q, row.answer) : emptyAnswer(q);
  if (!isAnswered(answer)) throw new ApiError(400, "Najpierw odpowiedz na zadanie.");

  const fb = row?.feedback as StoredFeedback | null | undefined;

  if (q.type === "P-ESSAY") {
    // Already fully graded for this exact answer: do not pay again.
    if (fb && fb.kind === "essay" && fb.evaluation) return fb;
    return gradeEssay(profile, loaded, q, answer as EssayAnswer, row);
  }

  if (fb && fb.kind !== "essay" && fb.points !== null && fb.points !== undefined) return fb;

  if (gradesDeterministically(q)) {
    const result: StoredFeedback = { ...gradeDeterministic(q, answer), kind: "question" };
    await storeGrade(attempt.id, q, answer, result.points, result, null);
    return result;
  }
  return gradeOpen(profile, loaded, q, answer);
}

