import { requireSuperAdmin } from "@/lib/auth";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-gray-200 pb-3">
        <Link
          href="/admin/quizzes"
          className="px-3 py-1.5 rounded text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          Quizzes
        </Link>
        <Link
          href="/admin/users"
          className="px-3 py-1.5 rounded text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          Users
        </Link>
        <Link
          href="/admin/audit"
          className="px-3 py-1.5 rounded text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          Audit Log
        </Link>
      </div>
      {children}
    </div>
  );
}
