import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { assertSameOrigin, assertUuid, errorResponse, loadOwnedAttempt, readJson, requireApiUser } from "@/lib/cke/server";
import { createAttempt, loadPublishedCkeQuiz, publicAttempt } from "@/lib/cke/attempts";
import { examMeta } from "@/lib/cke/import";

// POST /api/cke/attempts/:id/retake { mode? } — "Rozwiąż ponownie".
// The old attempt is kept as history (in_progress → abandoned; a submitted
// exam stays submitted) and a fresh one starts on the current version.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(req);
    const attemptId = assertUuid(params.id, "attemptId");
    const profile = await requireApiUser();
    const body = await readJson<{ mode?: unknown }>(req, 1_024);
    const { attempt } = await loadOwnedAttempt(attemptId, profile.id);

    const service = createServiceRoleClient();
    if (attempt.status === "in_progress") {
      await service.from("attempts").update({ status: "abandoned" }).eq("id", attempt.id).eq("status", "in_progress");
    }
    // A submitted exam stays as it is; the new attempt (started later) becomes the open one.
    const { quiz, version } = await loadPublishedCkeQuiz(attempt.quiz_id, { allowDraft: profile.role === "super_admin" });
    const mode = body.mode === "exam" ? "exam" : body.mode === "practice" ? "practice" : attempt.mode;
    const fresh = await createAttempt({
      userId: profile.id,
      quizId: attempt.quiz_id,
      versionId: version.id,
      examCode: quiz.exam_code ?? version.content.id,
      mode,
      maxPoints: examMeta(version.content).max_points,
    });
    return NextResponse.json({ attempt: publicAttempt(fresh) }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
