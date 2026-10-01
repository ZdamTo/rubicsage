import { NextRequest, NextResponse } from "next/server";
import {
  ApiError, assertSameOrigin, assertUuid, errorResponse, isExamExpired, loadOwnedAttempt,
  readJson, refreshProgress, requireApiUser,
} from "@/lib/cke/server";
import { saveAnswers } from "@/lib/cke/grade-service";

const SAVE_GRACE_MS = 2 * 60_000; // network latency around the deadline

// PUT /api/cke/attempts/:id/answers { answers: { [questionId]: answer } } — autosave.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(req);
    const attemptId = assertUuid(params.id, "attemptId");
    const profile = await requireApiUser();
    const body = await readJson<{ answers?: unknown }>(req, 600_000);

    const answers = body.answers;
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      throw new ApiError(400, "Brak odpowiedzi do zapisania.");
    }
    const loaded = await loadOwnedAttempt(attemptId, profile.id);
    const { attempt } = loaded;
    if (attempt.status !== "in_progress") throw new ApiError(409, "Arkusz jest zamknięty — odpowiedzi nie można już zmieniać.");
    if (isExamExpired(attempt, SAVE_GRACE_MS)) throw new ApiError(409, "Czas egzaminu minął.");

    const entries = Object.entries(answers as Record<string, unknown>);
    if (entries.length > 200) throw new ApiError(400, "Zbyt wiele odpowiedzi w jednym żądaniu.");
    const known = Object.fromEntries(entries.filter(([qid]) => loaded.questions.has(qid)));

    const cleared = await saveAnswers(loaded, known);
    const progress = await refreshProgress(attemptId, loaded.content);
    return NextResponse.json({ savedAt: new Date().toISOString(), clearedGrades: cleared, progress });
  } catch (err) {
    return errorResponse(err);
  }
}
