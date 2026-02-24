import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireSuperAdmin, writeAuditLog } from "@/lib/auth";
import { UpdateQuizSchema } from "@/lib/zod/db";

// PATCH /api/admin/quizzes/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireSuperAdmin();
  const body = await req.json();
  const parsed = UpdateQuizSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("quizzes")
    .update(parsed.data)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    actorId: admin.id,
    action: "quiz.update",
    targetType: "quiz",
    targetId: params.id,
    details: parsed.data as Record<string, unknown>,
  });

  return NextResponse.json(data);
}

// DELETE /api/admin/quizzes/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireSuperAdmin();
  const service = createServiceRoleClient();
  const { error } = await service.from("quizzes").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    actorId: admin.id,
    action: "quiz.delete",
    targetType: "quiz",
    targetId: params.id,
  });

  return new NextResponse(null, { status: 204 });
}
