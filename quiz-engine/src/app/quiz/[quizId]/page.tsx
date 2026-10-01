import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import QuizRunner from "./QuizRunner";
import { getProfile } from "@/lib/auth";
import type { Quiz } from "@/lib/quiz/schemas";
import CkeExamRunner, { type PublicAttempt } from "@/components/cke/CkeExamRunner";
import type { Grade } from "@/components/cke/QuestionCard";
import type { CkeExamContent } from "@/lib/cke/types";
import { toClientExam } from "@/lib/cke/sanitize";
import { examMeta } from "@/lib/cke/import";
import { attemptState, findOpenAttempt, publicAttempt } from "@/lib/cke/attempts";
import { closeIfExpired } from "@/lib/cke/server";

export const dynamic = "force-dynamic";

export default async function QuizPage({
  params,
  searchParams,
}: {
  params: { quizId: string };
  searchParams: { versionId?: string; mode?: string };
}) {
  if (!/^[0-9a-f-]{36}$/i.test(params.quizId)) notFound();
  const supabase = await createServerSupabaseClient();

  // Load the quiz (RLS: published, or any status for super_admin)
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", params.quizId)
    .single();

  if (!quiz) notFound();

  if (quiz.format === "cke_exam") {
    return renderCkeExam(quiz, searchParams.mode === "exam" ? "exam" : "practice");
  }

  if (quiz.status !== "published") notFound();

  // Load the active version (or specific version from searchParams)
  const versionQuery = supabase
    .from("quiz_versions")
    .select("*")
    .eq("quiz_id", params.quizId);

  const { data: version } = searchParams.versionId
    ? await versionQuery.eq("id", searchParams.versionId).single()
    : await versionQuery.eq("is_active", true).single();

  if (!version) notFound();

  // Create attempt if user is authenticated
  const profile = await getProfile();
  let attemptId: string | null = null;

  if (profile && profile.status === "active") {
    const service = createServiceRoleClient();
    // Check for an in-progress attempt
    const { data: existing } = await service
      .from("attempts")
      .select("id")
      .eq("user_id", profile.id)
      .eq("quiz_id", params.quizId)
      .eq("quiz_version_id", version.id)
      .eq("status", "in_progress")
      .single();

    if (existing) {
      attemptId = existing.id;
    } else {
      const { data: newAttempt } = await service
        .from("attempts")
        .insert({
          user_id: profile.id,
          quiz_id: params.quizId,
          quiz_version_id: version.id,
          status: "in_progress",
        })
        .select("id")
        .single();
      attemptId = newAttempt?.id ?? null;
    }
  }

  const quizContent = version.content as unknown as Quiz;

  return (
    <QuizRunner
      quiz={quizContent}
      quizId={params.quizId}
      attemptId={attemptId}
    />
  );
}

/* ── Język polski: CKE exam sheet ────────────────────────────────────────── */

type QuizRow = {
  id: string;
  title: string;
  status: string;
  level: string | null;
  exam_code: string | null;
};

async function renderCkeExam(quiz: QuizRow, requestedMode: "practice" | "exam") {
  const profile = await getProfile();
  if (!profile) redirect(`/auth/login?next=/quiz/${quiz.id}`);
  if (profile.status !== "active") redirect("/?error=banned");
  // Drafts are visible to the admin only (to check a sheet before publishing).
  if (quiz.status !== "published" && !(quiz.status === "draft" && profile.role === "super_admin")) notFound();

  const service = createServiceRoleClient();
  const open = await findOpenAttempt(profile.id, quiz.id);
  const attempt = open ? await closeIfExpired(open) : null;

  // An attempt keeps the version it was started on, so a re-import never
  // shifts questions under a student mid-exam.
  const versionQuery = service.from("quiz_versions").select("id, content").eq("quiz_id", quiz.id);
  const { data: version } = attempt?.quiz_version_id
    ? await versionQuery.eq("id", attempt.quiz_version_id).single()
    : await versionQuery.eq("is_active", true).order("version", { ascending: false }).limit(1).single();
  if (!version) notFound();

  const content = version.content as unknown as CkeExamContent;
  if (content?.format !== "cke_exam") notFound();

  const state = attempt ? await attemptState(attempt.id, content) : { answers: {}, grades: {} };
  const meta = examMeta(content);

  return (
    <CkeExamRunner
      quiz={{
        id: quiz.id,
        title: quiz.title,
        level: quiz.level ?? "podstawowy",
        kind: meta.kind,
        minutes: meta.minutes,
        maxPoints: meta.max_points,
      }}
      versionId={version.id}
      exam={toClientExam(content)}
      initialAttempt={attempt ? (publicAttempt(attempt) as PublicAttempt) : null}
      initialAnswers={state.answers}
      initialGrades={state.grades as Record<string, Grade>}
      requestedMode={requestedMode}
      supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}
    />
  );
}
