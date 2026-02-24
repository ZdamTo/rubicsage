import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requireSuperAdmin();
  const service = createServiceRoleClient();

  const { data: logs } = await service
    .from("admin_audit_log")
    .select("*, profiles:actor_id(email, display_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Audit Log</h1>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left">Actor</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Target</th>
              <th className="px-4 py-3 text-left">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(logs ?? []).map((log) => {
              const actor = log.profiles as { email?: string; display_name?: string } | null;
              return (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("pl-PL")}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {actor?.display_name || actor?.email || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    <span className="text-gray-400">{log.target_type}/</span>
                    <span className="font-mono">{log.target_id.slice(0, 8)}…</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">
                    {log.details ? JSON.stringify(log.details) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(!logs || logs.length === 0) && (
        <p className="text-center text-gray-400 py-8">No audit log entries yet.</p>
      )}
    </div>
  );
}
