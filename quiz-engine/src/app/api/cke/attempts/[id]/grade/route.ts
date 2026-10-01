import { NextRequest, NextResponse } from "next/server";
import {
  ApiError, assertSameOrigin, assertUuid, closeIfExpired, errorResponse, loadOwnedAttempt,
  logPractice, readJson, refreshProgress, requireApiUser,
} from "@/lib/cke/server";
import { gradeQuestionInAttempt, publicFeedback } from "@/lib/cke/grade-service";

// The wypracowanie runs eight model calls in parallel (~20–40 s in practice).
export const maxDuration = 60;

// POST /api/cke/attempts/:id/grade { questionId, answer? }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(req);
    const attemptId = assertUuid(params.id, "attemptId");
    const profile = await requireApiUser();
    const body = await readJson<{ questionId?: unknown; answer?: unknown }>(req, 200_000);
    if (typeof body.questionId !== "string" || body.questionId.length > 120) {
      throw new ApiError(400, "Brak identyfikatora zadania.");
    }

    const loaded = await loadOwnedAttempt(attemptId, profile.id);
    loaded.attempt = await closeIfExpired(loaded.attempt);

    const result = await gradeQuestionInAttempt(profile, loaded, body.questionId, body.answer);
    const progress = await refreshProgress(attemptId, loaded.content);
    await logPractice(profile.id, "answer_submit");
    return NextResponse.json({ grade: publicFeedback(result), progress, attemptStatus: loaded.attempt.status });
  } catch (err) {
    return errorResponse(err);
  }
}
