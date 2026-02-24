import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireSuperAdmin, writeAuditLog } from "@/lib/auth";
import { CreateQuizSchema, UpdateQuizSchema } from "@/lib/zod/db";

// GET /api/admin/quizzes – list all quizzes (any status)
export async function GET() {
  await requireSuperAdmin();
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("quizzes")
    .select("*, quiz_versions(id, version, is_active, change_note, created_at)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/admin/quizzes – create a new quiz draft
export async function POST(req: NextRequest) {
  const admin = await requireSuperAdmin();
  const body = await req.json();
  const parsed = CreateQuizSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("quizzes")
    .insert({ ...parsed.data, created_by: admin.id, status: "draft" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    actorId: admin.id,
    action: "quiz.create",
    targetType: "quiz",
    targetId: data.id,
    details: { title: data.title, subject: data.subject },
  });

  return NextResponse.json(data, { status: 201 });
}
