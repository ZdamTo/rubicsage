import { requireAuth } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  // 0=Sun … 6=Sat; shift so Mon=0
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

export default async function StreakPage() {
  const profile = await requireAuth();
  const service = createServiceRoleClient();

  // Fetch streak
  const { data: streak } = await service
    .from("streaks")
    .select("*")
    .eq("user_id", profile.id)
    .single();

  // Fetch this month's practice log
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = `${year}-${String(month + 1).padStart(2, "0")}-${getDaysInMonth(year, month)}`;

  const { data: logs } = await service
    .from("practice_log")
    .select("practice_date")
    .eq("user_id", profile.id)
    .gte("practice_date", firstDay)
    .lte("practice_date", lastDay);

  const practicedDays = new Set(
    (logs ?? []).map((l) => parseInt(l.practice_date.split("-")[2], 10))
  );

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfWeek(year, month); // Mon=0
  const monthName = now.toLocaleString("pl-PL", { month: "long", year: "numeric" });

  const todayDate = now.getDate();

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Daily Practice Streak</h1>

      {/* Streak stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 text-center">
          <div className="text-4xl font-bold text-orange-600">
            {streak?.current_streak ?? 0}
          </div>
          <div className="text-sm text-orange-700 font-medium mt-1">Current streak</div>
          <div className="text-xs text-orange-500 mt-0.5">days in a row</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center">
          <div className="text-4xl font-bold text-blue-600">
            {streak?.best_streak ?? 0}
          </div>
          <div className="text-sm text-blue-700 font-medium mt-1">Best streak</div>
          <div className="text-xs text-blue-500 mt-0.5">all time</div>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 capitalize">{monthName}</h2>

        {/* Day headers */}
        <div className="grid grid-cols-7 text-xs text-center text-gray-400 font-medium mb-2">
          {["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Leading empty cells */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const practiced = practicedDays.has(day);
            const isToday = day === todayDate;

            return (
              <div
                key={day}
                className={`
                  aspect-square flex items-center justify-center rounded-lg text-sm font-medium
                  ${practiced
                    ? "bg-green-500 text-white"
                    : isToday
                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                    : "text-gray-500 hover:bg-gray-50"}
                `}
              >
                {practiced && (
                  <span title="Practiced" className="flex flex-col items-center gap-0.5">
                    <span>{day}</span>
                    <span className="text-[8px] leading-none">✓</span>
                  </span>
                )}
                {!practiced && day}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-green-500 inline-block" />
            Practiced
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 inline-block" />
            Today
          </span>
        </div>
      </div>

      {streak?.last_practice_date && (
        <p className="text-xs text-gray-400 mt-3 text-center">
          Last practice: {streak.last_practice_date}
        </p>
      )}
    </div>
  );
}
