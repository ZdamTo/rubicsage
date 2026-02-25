import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireSuperAdmin, writeAuditLog } from "@/lib/auth";

// POST /api/admin/users/[id]/streak-reset
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireSuperAdmin();
  const service = createServiceRoleClient();

  // Delete all practice log entries
  await service.from("practice_log").delete().eq("user_id", params.id);

  // Reset streak counters
  const { error } = await service
    .from("streaks")
    .update({
      current_streak: 0,
      best_streak: 0,
      last_practice_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    actorId: admin.id,
    action: "user.streak_reset",
    targetType: "user",
    targetId: params.id,
  });

  return NextResponse.json({ ok: true });
}
