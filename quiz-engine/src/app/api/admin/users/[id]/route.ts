import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireSuperAdmin, writeAuditLog } from "@/lib/auth";
import { AdminUpdateUserSchema } from "@/lib/zod/db";

// PATCH /api/admin/users/[id] – update role / status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireSuperAdmin();
  const body = await req.json();
  const parsed = AdminUpdateUserSchema.safeParse({ ...body, user_id: params.id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { user_id, ...update } = parsed.data;
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("profiles")
    .update(update)
    .eq("id", user_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    actorId: admin.id,
    action: "user.update",
    targetType: "user",
    targetId: user_id,
    details: update as Record<string, unknown>,
  });

  return NextResponse.json(data);
}
