import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  assertSameOrigin, assertUuid, errorResponse, loadOwnedAttempt, logPractice, readJson,
  refreshProgress, requireApiUser, ApiError,
} from "@/lib/cke/server";
import { saveAnswers } from "@/lib/cke/grade-service";
import { publicAttempt } from "@/lib/cke/attempts";

// POST /api/cke/attempts/:id/finish { answers? }
// Exam mode: freezes the sheet for good (answers can no longer change; grading
// becomes available). Practice mode: only saves — nothing is locked.
// Finishing never grades: expiry must not spend the student's AI quota.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertSameOrigin(req);
    const attemptId = assertUuid(params.id, "attemptId");
    const profile = await requireApiUser();
    const body = await readJson<{ answers?: unknown }>(req, 600_000);
    const loaded = await loadOwnedAttempt(attemptId, profile.id);
    let attempt = loaded.attempt;

    if (attempt.status === "abandoned") throw new ApiError(409, "To podejście zostało zamknięte.");

    if (attempt.status === "in_progress") {
      const graceOk = !attempt.deadline || Date.now() <= new Date(attempt.deadline).getTime() + 2 * 60_000;
      if (graceOk && body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)) {
        const known = Object.fromEntries(
          Object.entries(body.answers as Record<string, unknown>).filter(([qid]) => loaded.questions.has(qid)).slice(0, 200)
        );
        await saveAnswers(loaded, known);
      }
      if (attempt.mode === "exam") {
        const service = createServiceRoleClient();
        const { data } = await service
          .from("attempts")
          .update({ status: "submitted", submitted_at: new Date().toISOString() })
          .eq("id", attemptId)
          .eq("status", "in_progress")
          .select("*")
          .single();
        if (data) attempt = data;
        await logPractice(profile.id, "attempt_submit");
      }
    }

    const progress = await refreshProgress(attemptId, loaded.content);
    return NextResponse.json({ attempt: publicAttempt(attempt), progress });
  } catch (err) {
    return errorResponse(err);
  }
}
