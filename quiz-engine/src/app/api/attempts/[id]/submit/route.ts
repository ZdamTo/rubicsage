import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";

// POST /api/attempts/[id]/submit – finalise an attempt
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const profile = await requireAuth();
  if (profile.status === "banned") {
    return NextResponse.json({ error: "Account banned" }, { status: 403 });
  }

  const service = createServiceRoleClient();

  // Verify ownership
  const { data: attempt, error: fetchErr } = await service
    .from("attempts")
    .select("user_id, status, id")
    .eq("id", params.id)
    .single();

  if (fetchErr || !attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }
  if (attempt.user_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ error: "Attempt already closed" }, { status: 400 });
  }

  // Compute total score from answers
  const { data: answers } = await service
    .from("attempt_answers")
    .select("score, max_score")
    .eq("attempt_id", params.id);

  const score = answers?.reduce((s, a) => s + (a.score ?? 0), 0) ?? 0;
  const maxScore = answers?.reduce((s, a) => s + (a.max_score ?? 0), 0) ?? 0;

  const { data, error } = await service
    .from("attempts")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      score,
      max_score: maxScore,
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log practice
  await service.rpc("log_practice_and_update_streak", {
    p_user_id: profile.id,
    p_source: "attempt_submit",
  });

  return NextResponse.json(data);
}
