import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { StartAttemptSchema } from "@/lib/zod/db";

// POST /api/attempts – start a new quiz attempt
export async function POST(req: NextRequest) {
  const profile = await requireAuth();
  if (profile.status === "banned") {
    return NextResponse.json({ error: "Account banned" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = StartAttemptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("attempts")
    .insert({
      user_id: profile.id,
      quiz_id: parsed.data.quiz_id,
      quiz_version_id: parsed.data.quiz_version_id,
      status: "in_progress",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// GET /api/attempts – list user's attempts
export async function GET() {
  const profile = await requireAuth();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("attempts")
    .select("*, quizzes(title, subject)")
    .eq("user_id", profile.id)
    .order("started_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
