import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";
import type { CkeExamContent, CkeQuestion } from "./types";
import { isAnswered } from "./answers";

/**
 * Shared plumbing for the /api/cke/* routes.
 *
 * Every route: (1) checks the request comes from our own origin, (2) reads a
 * size-limited body, (3) resolves the signed-in, non-banned user from the
 * session cookie, (4) loads the attempt with the service role and checks it
 * belongs to that user. Nothing the browser sends is trusted for identity,
 * ownership, scores or the answer key.
 */

export type AttemptRow = Database["public"]["Tables"]["attempts"]["Row"];
export type ApiProfile = { id: string; role: string; status: string };

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error("[cke api]", err);
  return NextResponse.json({ error: "Wewnętrzny błąd serwera." }, { status: 500 });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function assertUuid(v: unknown, what = "id"): string {
  if (typeof v !== "string" || !UUID_RE.test(v)) throw new ApiError(400, `Niepoprawny ${what}.`);
  return v;
}

/**
 * Reject cross-site state-changing requests. Supabase's auth cookies are
 * SameSite=Lax, which already blocks most CSRF; this is the belt to that braces.
 */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return; // same-origin fetches from older browsers / server calls
  const hosts = [req.headers.get("host"), req.headers.get("x-forwarded-host")?.split(",")[0]?.trim()]
    .filter(Boolean);
  try {
    if (!hosts.includes(new URL(origin).host)) throw new ApiError(403, "Niedozwolone źródło żądania.");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(403, "Niedozwolone źródło żądania.");
  }
}

/** Parse a JSON body, refusing anything larger than `maxBytes`. */
export async function readJson<T = unknown>(req: NextRequest, maxBytes: number): Promise<T> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new ApiError(413, "Żądanie jest zbyt duże.");
  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new ApiError(413, "Żądanie jest zbyt duże.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(400, "Niepoprawny JSON.");
  }
}

export async function requireApiUser(): Promise<ApiProfile> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ApiError(401, "Zaloguj się, aby kontynuować.");
  const service = createServiceRoleClient();
  const { data: profile } = await service.from("profiles").select("id, role, status").eq("id", user.id).single();
  if (!profile) throw new ApiError(401, "Brak profilu użytkownika.");
  if (profile.status !== "active") throw new ApiError(403, "Konto jest zablokowane.");
  return profile;
}

export function isExamExpired(a: Pick<AttemptRow, "mode" | "deadline">, graceMs = 0): boolean {
  return a.mode === "exam" && !!a.deadline && Date.now() > new Date(a.deadline).getTime() + graceMs;
}

export interface LoadedAttempt {
  attempt: AttemptRow;
  content: CkeExamContent;
  questions: Map<string, CkeQuestion>;
}

/** Load an attempt owned by `userId`, together with the exam content it was started on. */
export async function loadOwnedAttempt(attemptId: string, userId: string): Promise<LoadedAttempt> {
  const service = createServiceRoleClient();
  const { data: attempt } = await service.from("attempts").select("*").eq("id", attemptId).single();
  // Same answer for "missing" and "someone else's": do not confirm existence.
  if (!attempt || attempt.user_id !== userId) throw new ApiError(404, "Nie znaleziono podejścia.");
  if (!attempt.quiz_version_id) throw new ApiError(409, "Podejście nie ma przypisanej wersji arkusza.");

  const { data: version } = await service
    .from("quiz_versions")
    .select("content, quiz_id")
    .eq("id", attempt.quiz_version_id)
    .single();
  const content = version?.content as unknown as CkeExamContent | undefined;
  if (!content || content.format !== "cke_exam") throw new ApiError(409, "To nie jest arkusz CKE.");

  return { attempt, content, questions: new Map(content.questions.map((q) => [q.id, q])) };
}

/** Auto-close an exam whose clock ran out; returns the (possibly updated) row. */
export async function closeIfExpired(attempt: AttemptRow): Promise<AttemptRow> {
  if (attempt.status !== "in_progress" || !isExamExpired(attempt)) return attempt;
  const service = createServiceRoleClient();
  const { data } = await service
    .from("attempts")
    .update({ status: "submitted", submitted_at: attempt.deadline ?? new Date().toISOString() })
    .eq("id", attempt.id)
    .eq("status", "in_progress")
    .select("*")
    .single();
  return data ?? { ...attempt, status: "submitted" };
}

/** Recompute the cached counters and score from the stored answers. */
export async function refreshProgress(attemptId: string, content: CkeExamContent) {
  const service = createServiceRoleClient();
  const { data: rows } = await service
    .from("attempt_answers")
    .select("question_id, answer, score")
    .eq("attempt_id", attemptId);
  const known = new Set(content.questions.map((q) => q.id));
  let answered = 0, graded = 0, points = 0;
  for (const r of rows ?? []) {
    if (!known.has(r.question_id)) continue;
    if (isAnswered(r.answer)) answered++;
    if (r.score !== null && r.score !== undefined) { graded++; points += Number(r.score); }
  }
  const maxPoints = content.questions.reduce((s, q) => s + Number(q.scoring?.max_points ?? 0), 0);
  const progress = { answered, graded, points, max_points: maxPoints, questions: content.questions.length };
  await service
    .from("attempts")
    .update({ progress: progress as unknown as Json, score: points, max_score: maxPoints })
    .eq("id", attemptId);
  return progress;
}

/**
 * Reserve AI calls against the user's daily quota (atomic, in Postgres).
 * Super admins are not limited. POLISH_AI_DAILY_LIMIT defaults to 60 calls,
 * enough for two full podstawowy sheets (each ~20–23 calls incl. the essay).
 */
export async function reserveAiCalls(profile: ApiProfile, calls: number) {
  if (calls <= 0 || profile.role === "super_admin") return;
  const limit = Math.max(1, Number(process.env.POLISH_AI_DAILY_LIMIT) || 60);
  const service = createServiceRoleClient();
  const { data, error } = await service.rpc("consume_ai_calls", {
    p_user_id: profile.id,
    p_calls: calls,
    p_daily_limit: limit,
  });
  if (error) {
    console.error("[cke api] quota rpc failed", error.message);
    throw new ApiError(503, "Nie udało się sprawdzić limitu AI. Czy migracja 004 została uruchomiona?");
  }
  if (data !== true) {
    throw new ApiError(429, `Osiągnięto dzienny limit ocen AI (${limit} zapytań). Spróbuj jutro.`);
  }
}

export async function logPractice(userId: string, source: "answer_submit" | "attempt_submit") {
  const service = createServiceRoleClient();
  const { error } = await service.rpc("log_practice_and_update_streak", { p_user_id: userId, p_source: source });
  if (error) console.warn("[cke api] streak log failed:", error.message);
}

/** Like requireApiUser, but only for an active super_admin (403 otherwise, never a redirect). */
export async function requireApiSuperAdmin(): Promise<ApiProfile> {
  const profile = await requireApiUser();
  if (profile.role !== "super_admin") throw new ApiError(403, "Brak uprawnień administratora.");
  return profile;
}
