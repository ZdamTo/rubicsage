import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth";
import AdminUsersClient from "./AdminUsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireSuperAdmin();
  const service = createServiceRoleClient();

  const { data: users } = await service
    .from("profiles")
    .select("*, streaks(current_streak, best_streak, last_practice_date)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">User Management</h1>
      <AdminUsersClient initialUsers={users ?? []} />
    </div>
  );
}
