import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth";

// GET /api/admin/audit – recent admin audit log entries
export async function GET() {
  await requireSuperAdmin();
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from("admin_audit_log")
    .select("*, profiles:actor_id(email, display_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
