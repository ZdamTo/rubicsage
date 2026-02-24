import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth";
import AdminQuizzesClient from "./AdminQuizzesClient";

export const dynamic = "force-dynamic";

export default async function AdminQuizzesPage() {
  await requireSuperAdmin();
  const service = createServiceRoleClient();

  const { data: quizzes } = await service
    .from("quizzes")
    .select("*, quiz_versions(id, version, is_active, change_note, created_at)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Quiz Management</h1>
      <AdminQuizzesClient initialQuizzes={quizzes ?? []} />
    </div>
  );
}
