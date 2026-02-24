"use client";

import { useState } from "react";

interface StreakInfo {
  current_streak: number;
  best_streak: number;
  last_practice_date: string | null;
}

interface User {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  status: string;
  created_at: string;
  streaks: StreakInfo | StreakInfo[] | null;
}

function getStreak(user: User): StreakInfo | null {
  if (!user.streaks) return null;
  if (Array.isArray(user.streaks)) return user.streaks[0] ?? null;
  return user.streaks;
}

export default function AdminUsersClient({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = users.filter(
    (u) =>
      !search ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  const update = async (userId: string, patch: { status?: string; role?: string }) => {
    setActionError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = await res.json();
      setActionError(JSON.stringify(data.error));
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, ...patch } : u))
    );
  };

  const resetStreak = async (userId: string) => {
    if (!confirm("Reset all streak data for this user?")) return;
    setActionError(null);
    const res = await fetch(`/api/admin/users/${userId}/streak-reset`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      setActionError(data.error);
      return;
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, streaks: { current_streak: 0, best_streak: 0, last_practice_date: null } }
          : u
      )
    );
  };

  return (
    <div className="space-y-4">
      <input
        type="search"
        placeholder="Search by email or name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />

      {actionError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {actionError}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Streak</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((user) => {
              const streak = getStreak(user);
              return (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{user.display_name || "—"}</div>
                    <div className="text-xs text-gray-400">{user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => update(user.id, { role: e.target.value })}
                      className="border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                      <option value="super_admin">super_admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded font-semibold ${
                        user.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {streak
                      ? `${streak.current_streak} / best ${streak.best_streak}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      {user.status === "active" ? (
                        <button
                          onClick={() => update(user.id, { status: "banned" })}
                          className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Ban
                        </button>
                      ) : (
                        <button
                          onClick={() => update(user.id, { status: "active" })}
                          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          Unban
                        </button>
                      )}
                      <button
                        onClick={() => resetStreak(user.id)}
                        className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                      >
                        Reset streak
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-400 py-6">No users found.</p>
      )}
    </div>
  );
}
