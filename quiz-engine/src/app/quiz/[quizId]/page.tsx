import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import QuizRunner from "./QuizRunner";
import { getProfile } from "@/lib/auth";
import type { Quiz } from "@/lib/quiz/schemas";

export const dynamic = "force-dynamic";

export default async function QuizPage({
  params,
  searchParams,
}: {
  params: { quizId: string };
  searchParams: { versionId?: string };
}) {
  const supabase = await createServerSupabaseClient();

  // Load the quiz
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", params.quizId)
    .eq("status", "published")
    .single();

  if (!quiz) notFound();

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
