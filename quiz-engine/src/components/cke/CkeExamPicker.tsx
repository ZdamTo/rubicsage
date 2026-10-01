import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { describeContents, describeSession } from "@/lib/cke/exam-code";

/**
 * The prototype's arkusz picker: a matrix with levels down the side and CKE
 * sessions across. One card design for every cell; a session with no paper
 * at that level keeps its column with an empty dashed slot, so the years stay
 * aligned. Click the card to practise; the small ⏱ button sits the paper
 * under the clock.
 *
 * Unlike the prototype this does not list papers we have not converted
 * (papers.json is a pipeline artefact); only exams published in the admin
 * panel appear here.
 */

type Meta = { max_points?: number; questions?: number; kind?: string; minutes?: number };
type Progress = { answered?: number; graded?: number; points?: number; max_points?: number; questions?: number };

const LEVELS = [
  { code: "podstawowy", label: "Podstawowa", long: "poziom podstawowy" },
  { code: "rozszerzony", label: "Rozszerzona", long: "poziom rozszerzony" },
] as const;

// Literal class names (Tailwind cannot see classes built at runtime).
const COLOURS = {
  podstawowy: {
    blob: "bg-indigo-50 group-hover:bg-indigo-100",
    badge: "bg-indigo-600 text-white",
    glyph: "text-indigo-300",
    cta: "text-indigo-600",
    timer: "hover:text-indigo-600 hover:border-indigo-300",
  },
  rozszerzony: {
    blob: "bg-purple-50 group-hover:bg-purple-100",
    badge: "bg-purple-600 text-white",
    glyph: "text-purple-300",
    cta: "text-purple-600",
    timer: "hover:text-purple-600 hover:border-purple-300",
  },
} as const;

export default async function CkeExamPicker() {
  const supabase = await createServerSupabaseClient();
  const { data: exams, error } = await supabase
    .from("quizzes")
    .select("id, title, level, session, exam_code, meta, status")
    .eq("subject", "polish")
    .eq("format", "cke_exam")
    .eq("status", "published")
    .order("session", { ascending: true });

  if (error) {
    return (
      <p className="text-sm text-red-600">
        Nie udało się wczytać arkuszy CKE. Upewnij się, że migracja <code>004_polish_cke_exams.sql</code> została uruchomiona.
      </p>
    );
  }
  if (!exams?.length) {
    return <p className="text-sm text-gray-500">Brak opublikowanych arkuszy CKE.</p>;
  }

  const { data: { user } } = await supabase.auth.getUser();
  const latest = new Map<string, { status: string; mode: string; progress: Progress }>();
  type HistoryRow = { id: string; quiz_id: string; status: string; mode: string; progress: Progress; started_at: string };
  let history: HistoryRow[] = [];
  if (user) {
    const { data: attempts } = await supabase
      .from("attempts")
      .select("id, quiz_id, status, mode, progress, started_at")
      .eq("user_id", user.id)
      .in("quiz_id", exams.map((e) => e.id))
      .order("started_at", { ascending: false })
      .limit(200);
    history = (attempts ?? []) as unknown as HistoryRow[];
    for (const a of history) {
      if (a.status === "abandoned" || latest.has(a.quiz_id)) continue;
      latest.set(a.quiz_id, { status: a.status, mode: a.mode, progress: a.progress ?? {} });
    }
  }

  const sessions = [...new Set(exams.map((e) => e.session).filter(Boolean) as string[])].sort();
  const cell = (level: string, session: string) => exams.find((e) => e.level === level && e.session === session);
  const levels = LEVELS.filter((l) => exams.some((e) => e.level === l.code));
  const titleOf = new Map(exams.map((e) => [e.id, e.title]));

  return (
    <div className="space-y-8">
      <div className="overflow-x-auto pb-2">
        <div className="grid gap-4" style={{ gridTemplateColumns: `7rem repeat(${sessions.length}, 15rem)` }}>
          <div />
          {sessions.map((s) => (
            <div key={s} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {describeSession(s).when}
            </div>
          ))}
          {levels.map((level) => (
            <LevelRow key={level.code} level={level} sessions={sessions} cell={cell} latest={latest} />
          ))}
        </div>
      </div>

      {history.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-3">Twoje podejścia</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {history.slice(0, 10).map((a) => {
              const p = a.progress ?? {};
              const done = (p.graded ?? 0) > 0 && p.graded === p.questions;
              return (
                <li key={a.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-700">{titleOf.get(a.quiz_id)}</span>
                  <span className="text-slate-500">
                    {a.mode === "exam" ? "egzamin" : "nauka"} ·{" "}
                    {a.status === "in_progress" ? "w trakcie" : a.status === "submitted" ? "zakończone" : "zarchiwizowane"} ·{" "}
                    {done ? `${p.points}/${p.max_points} pkt` : `${p.answered ?? 0}/${p.questions ?? "?"} zadań`} ·{" "}
                    {new Date(a.started_at).toLocaleDateString("pl-PL")}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function LevelRow({
  level,
  sessions,
  cell,
  latest,
}: {
  level: (typeof LEVELS)[number];
  sessions: string[];
  cell: (level: string, session: string) => { id: string; meta: unknown; session: string | null } | undefined;
  latest: Map<string, { status: string; mode: string; progress: Progress }>;
}) {
  const c = COLOURS[level.code];
  return (
    <>
      <div className="sticky left-0 z-20 bg-gray-50 self-center text-sm font-semibold text-slate-600">{level.label}</div>
      {sessions.map((session) => {
        const exam = cell(level.code, session);
        if (!exam) return <div key={session} className="rounded-2xl border border-dashed border-slate-200/70 min-h-[11rem]" />;
        const meta = (exam.meta ?? {}) as Meta;
        const a = latest.get(exam.id);
        const total = Number(meta.questions) || 0;
        const p = a?.progress ?? {};
        // A score only once every question is marked: a half-marked paper's
        // running total is not the student's result.
        const done = (p.graded ?? 0) > 0 && p.graded === p.questions;
        const pct = done && p.max_points ? Math.round(((p.points ?? 0) / p.max_points) * 100) : 0;
        return (
          <div key={session} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl flex flex-col min-h-[11rem]">
            <div className={`absolute -right-5 -top-5 h-20 w-20 rounded-full transition-colors ${c.blob}`} />
            {/* Whole-card link underneath; the timer link sits above it. */}
            <Link href={`/quiz/${exam.id}`} className="absolute inset-0 z-10" aria-label={`Rozwiąż: Matura ${describeSession(session).when}, ${level.long}`} />
            <div className="relative flex h-full flex-col pointer-events-none">
              <div className="mb-3 flex items-center justify-between">
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${c.badge}`}>{level.label}</span>
                <span className={`text-2xl ${c.glyph}`} aria-hidden="true">✎</span>
              </div>
              <h3 className="mb-0.5 text-base font-bold text-slate-800">Matura {describeSession(session).when}</h3>
              <p className="mb-3 text-[11px] text-slate-500">{level.long} · {describeContents(meta.kind ?? "full", total)}</p>
              <ul className="mb-3 flex-grow space-y-1 text-[11px] text-slate-500">
                <li>☰ {Math.min(p.answered ?? 0, total)}/{total} zadań{a?.status === "in_progress" ? " · w trakcie" : ""}</li>
                <li>★ {done ? `${p.points}/${p.max_points} pkt · ${pct}%` : `${meta.max_points ?? "?"} pkt`}</li>
              </ul>
              <div className="mt-auto flex items-center justify-between gap-2">
                <span className={`flex items-center gap-1 text-xs font-semibold ${c.cta}`}>Rozwiąż →</span>
                <Link
                  href={`/quiz/${exam.id}?mode=exam`}
                  title="Z zegarem, bez sprawdzania w trakcie"
                  className={`pointer-events-auto relative z-20 rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-400 transition-colors ${c.timer}`}
                >
                  ⏱ {meta.minutes ?? (level.code === "rozszerzony" ? 210 : 240)} min
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
