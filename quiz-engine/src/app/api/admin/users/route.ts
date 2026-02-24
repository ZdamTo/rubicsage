import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth";

// GET /api/admin/users – list all profiles
export async function GET() {
  await requireSuperAdmin();
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("profiles")
    .select("*, streaks(current_streak, best_streak, last_practice_date)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
