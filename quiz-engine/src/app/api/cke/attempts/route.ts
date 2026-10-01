import { NextRequest, NextResponse } from "next/server";
import {
  assertSameOrigin, assertUuid, errorResponse, readJson, requireApiUser, closeIfExpired, ApiError,
} from "@/lib/cke/server";
import { createAttempt, findOpenAttempt, loadPublishedCkeQuiz, attemptState, publicAttempt } from "@/lib/cke/attempts";
import { examMeta } from "@/lib/cke/import";

// POST /api/cke/attempts { quizId, versionId, mode } — start (or resume) a sheet.
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const profile = await requireApiUser();
    const body = await readJson<{ quizId?: unknown; versionId?: unknown; mode?: unknown }>(req, 4_096);
    const quizId = assertUuid(body.quizId, "quizId");
    const mode = body.mode === "exam" ? "exam" : "practice";

    const { quiz, version } = await loadPublishedCkeQuiz(quizId, { allowDraft: profile.role === "super_admin" });

    // One live attempt per sheet. An existing one keeps the mode it was started
    // in — switching mid-exam would be a way to stop the clock.
    const open = await findOpenAttempt(profile.id, quizId);
    if (open) {
      const attempt = await closeIfExpired(open);
      return NextResponse.json({ attempt: publicAttempt(attempt), resumed: true, versionId: attempt.quiz_version_id });
    }

    if (body.versionId !== undefined && body.versionId !== version.id) {
      // The page was rendered from an older version; let it reload.
      throw new ApiError(409, "Arkusz został zaktualizowany — odśwież stronę.");
    }

    const attempt = await createAttempt({
      userId: profile.id,
      quizId,
      versionId: version.id,
      examCode: quiz.exam_code ?? version.content.id,
      mode,
      maxPoints: examMeta(version.content).max_points,
    });
    const state = await attemptState(attempt.id, version.content);
    return NextResponse.json({ attempt: publicAttempt(attempt), resumed: false, versionId: version.id, ...state }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
