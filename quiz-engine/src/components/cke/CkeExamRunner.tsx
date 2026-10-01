"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/app/cke-exam.css";
import type { ClientExam, ClientQuestion } from "@/lib/cke/sanitize";
import { isAnswered, stableStringify } from "@/lib/cke/answers";
import { describeContents, plural } from "@/lib/cke/exam-code";
import { QuestionCard, gradePoints, isEssayGrade, type Grade } from "./QuestionCard";

/**
 * The exam sheet, ported from the prototype's exam.js:
 *
 *  - tryb nauki (practice): grade any question at any time; "Podsumowanie"
 *    summarises without locking anything.
 *  - tryb egzaminacyjny (exam): a countdown runs, grading is refused until the
 *    sheet is finished, and finishing (or the clock running out) freezes it.
 *    Here the deadline is ALSO enforced by the server, so changing the system
 *    clock does not buy extra time (the prototype could only check it in the
 *    browser).
 *
 * Answers autosave (debounced) to Supabase; every grade is computed on the
 * server, which also holds the answer key — the browser never receives it.
 */

export interface PublicAttempt {
  id: string;
  mode: "practice" | "exam";
  status: "in_progress" | "submitted" | "abandoned";
  deadline: string | null;
  startedAt: string;
  submittedAt: string | null;
}

interface Props {
  quiz: { id: string; title: string; level: string; kind: string; minutes: number; maxPoints: number };
  versionId: string;
  exam: ClientExam;
  initialAttempt: PublicAttempt | null;
  initialAnswers: Record<string, unknown>;
  initialGrades: Record<string, Grade>;
  requestedMode: "practice" | "exam";
  supabaseUrl: string;
}

type SaveState = { state: "idle" | "dirty" | "saving" | "saved" | "error"; at?: Date; error?: string };
type Note = { text: string; bad?: boolean } | null;

const SAVE_DELAY_MS = 2_000;

async function api<T = Record<string, unknown>>(url: string, method: string, body?: unknown, keepalive = false) {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive,
      credentials: "same-origin",
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    return { ok: res.ok, status: res.status, data, error: data?.error || (res.ok ? "" : `Błąd ${res.status}`) };
  } catch {
    return { ok: false, status: 0, data: {} as T & { error?: string }, error: "Brak połączenia z serwerem." };
  }
}

/** Run `task` over `items` with at most `limit` in flight. */
async function pool<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await task(items[i++]);
  });
  await Promise.all(workers);
}

function formatClock(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export default function CkeExamRunner(props: Props) {
  const { quiz, exam, supabaseUrl } = props;
  const questions = exam.questions;
  const alone = questions.length <= 1;

  const [attempt, setAttempt] = useState<PublicAttempt | null>(props.initialAttempt);
  const [answers, setAnswers] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(questions.map((q) => [q.id, props.initialAnswers[q.id] ?? q.user_answer]))
  );
  const [grades, setGrades] = useState<Record<string, Grade>>(props.initialGrades);
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, Note>>({});
  const [save, setSave] = useState<SaveState>({ state: "idle" });
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState<null | { reason: "manual" | "expired" }>(null);
  const [sheetBusy, setSheetBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [startError, setStartError] = useState("");

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const attemptRef = useRef(attempt);
  attemptRef.current = attempt;
  const gradesRef = useRef(grades);
  gradesRef.current = grades;
  const dirty = useRef<Set<string>>(new Set());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishing = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const isExam = attempt?.mode === "exam";
  const frozen = !attempt || attempt.status !== "in_progress";
  const gradingLocked = isExam && attempt?.status === "in_progress";
  const deadlineMs = attempt?.deadline ? Date.parse(attempt.deadline) : null;
  const msLeft = deadlineMs !== null ? deadlineMs - now : null;
  const modeMismatch = !!props.initialAttempt && props.initialAttempt.mode !== props.requestedMode;

  const setNote = useCallback((qid: string, note: Note) => setNotes((n) => ({ ...n, [qid]: note })), []);

  /* ── start the attempt (first visit) ─────────────────────────────────── */
  useEffect(() => {
    if (props.initialAttempt) return;
    let cancelled = false;
    (async () => {
      const res = await api<{ attempt: PublicAttempt; resumed: boolean }>("/api/cke/attempts", "POST", {
        quizId: quiz.id,
        versionId: props.versionId,
        mode: props.requestedMode,
      });
      if (cancelled) return;
      if (res.status === 409 || (res.ok && res.data.resumed)) {
        window.location.reload(); // newer version, or an attempt opened in another tab
        return;
      }
      if (!res.ok) { setStartError(res.error); return; }
      setAttempt(res.data.attempt);
    })();
    return () => { cancelled = true; };
  }, [props.initialAttempt, props.requestedMode, props.versionId, quiz.id]);

  /* ── autosave ────────────────────────────────────────────────────────── */
  const flush = useCallback(async (keepalive = false) => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    const a = attemptRef.current;
    if (!a || a.status !== "in_progress" || dirty.current.size === 0) return;
    const ids = [...dirty.current];
    dirty.current.clear();
    const payload = { answers: Object.fromEntries(ids.map((id) => [id, answersRef.current[id]])) };
    // keepalive requests are capped at 64 KB by browsers; a long essay may not fit.
    const canKeepalive = keepalive && JSON.stringify(payload).length < 60_000;
    setSave({ state: "saving" });
    const res = await api<{ clearedGrades?: string[] }>(`/api/cke/attempts/${a.id}/answers`, "PUT", payload, canKeepalive);
    if (res.ok) {
      setSave({ state: dirty.current.size ? "dirty" : "saved", at: new Date() });
    } else {
      if (res.status !== 409) ids.forEach((id) => dirty.current.add(id)); // retry on the next change
      setSave({ state: "error", error: res.error });
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flush(); }, SAVE_DELAY_MS);
  }, [flush]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") void flush(true); };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty.current.size) { void flush(true); e.preventDefault(); }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [flush]);

  const onChange = useCallback((qid: string, value: unknown) => {
    const a = attemptRef.current;
    if (!a || a.status !== "in_progress") return;
    setAnswers((prev) => ({ ...prev, [qid]: value }));
    // A grade belongs to the answer it was given for; the server clears it too.
    if (gradesRef.current[qid]) {
      setGrades((g) => { const n = { ...g }; delete n[qid]; return n; });
    }
    setNotes((n) => (n[qid] ? { ...n, [qid]: null } : n));
    dirty.current.add(qid);
    setSave({ state: "dirty" });
    scheduleSave();
  }, [scheduleSave]);

  /* ── grading ─────────────────────────────────────────────────────────── */
  const gradeOne = useCallback(async (qid: string): Promise<void> => {
    const a = attemptRef.current;
    const q = questions.find((x) => x.id === qid);
    if (!q) return;
    if (!a) { setNote(qid, { text: "Arkusz jeszcze się wczytuje…" }); return; }
    if (a.mode === "exam" && a.status === "in_progress") {
      setNote(qid, { text: "Sprawdzanie jest wyłączone w trybie egzaminacyjnym — zakończ arkusz, aby zobaczyć wynik." });
      return;
    }
    const answer = answersRef.current[qid];
    if (!isAnswered(answer)) { setNote(qid, { text: "Najpierw odpowiedz na zadanie." }); return; }

    const snapshot = stableStringify(answer);
    const wasDirty = dirty.current.delete(qid); // the grade request saves it
    setBusy((b) => ({ ...b, [qid]: q.type === "P-ESSAY" ? "AI…" : "…" }));
    setNote(qid, q.type === "P-ESSAY" ? { text: "Ocenianie 8 kryteriów wypracowania — zwykle 20–40 sekund…" } : null);
    const res = await api<{ grade: Grade }>(`/api/cke/attempts/${a.id}/grade`, "POST", {
      questionId: qid,
      ...(a.status === "in_progress" ? { answer } : {}),
    });
    setBusy((b) => { const n = { ...b }; delete n[qid]; return n; });

    if (!res.ok) {
      if (wasDirty) dirty.current.add(qid);
      setNote(qid, { text: res.error, bad: true });
      if (res.status === 429) throw new Error(res.error); // stop a whole-sheet run
      return;
    }
    if (stableStringify(answersRef.current[qid]) !== snapshot) {
      setNote(qid, { text: "Odpowiedź zmieniła się w trakcie sprawdzania — sprawdź ponownie." });
      return;
    }
    setNote(qid, null);
    setGrades((g) => ({ ...g, [qid]: res.data.grade }));
  }, [questions, setNote]);

  // A click on one card: the error is already shown as that card's note.
  const onGradeClick = useCallback((qid: string) => { gradeOne(qid).catch(() => {}); }, [gradeOne]);

  const isGraded = useCallback((q: ClientQuestion) => gradePoints(grades[q.id]) !== null, [grades]);

  const pending = useMemo(() => {
    const ungraded = questions.filter((q) => isAnswered(answers[q.id]) && !isGraded(q));
    const essay = ungraded.find((q) => q.type === "P-ESSAY") ?? null;
    const essayGrade = essay ? grades[essay.id] : undefined;
    const essayCalls = essay ? 8 - (isEssayGrade(essayGrade) ? Object.keys(essayGrade.ai_raw_results ?? {}).length : 0) : 0;
    return {
      free: ungraded.filter((q) => q.deterministic),
      ai: ungraded.filter((q) => !q.deterministic && q.type !== "P-ESSAY"),
      essay,
      essayCalls,
      unanswered: questions.filter((q) => !isAnswered(answers[q.id])),
    };
  }, [questions, answers, grades, isGraded]);

  const totals = useMemo(() => {
    let points = 0, graded = 0, max = 0;
    const split = { test: { got: 0, max: 0 }, essay: { got: 0, max: 0 } };
    for (const q of questions) {
      const m = Number(q.scoring.max_points ?? 0);
      const p = gradePoints(grades[q.id]);
      max += m;
      const bucket = q.type === "P-ESSAY" ? split.essay : split.test;
      bucket.max += m;
      if (p !== null) { points += p; graded++; bucket.got += p; }
    }
    return { points, graded, max, split };
  }, [questions, grades]);

  const gradeWholeSheet = useCallback(async () => {
    if (gradingLocked) { setStatus("W trybie egzaminacyjnym wynik zobaczysz po zakończeniu arkusza."); return; }
    const calls = pending.ai.length + pending.essayCalls;
    if (!pending.free.length && !calls) {
      setStatus(pending.unanswered.length
        ? `Brak nowych odpowiedzi do sprawdzenia (${pending.unanswered.length} bez odpowiedzi).`
        : "Wszystko już sprawdzone.");
      return;
    }
    if (calls) {
      const parts = [
        pending.ai.length ? `${pending.ai.length} ${plural(pending.ai.length, "zadanie otwarte", "zadania otwarte", "zadań otwartych")}` : null,
        pending.essay ? `wypracowanie (${pending.essayCalls} ${plural(pending.essayCalls, "zapytanie", "zapytania", "zapytań")})` : null,
      ].filter(Boolean).join(" + ");
      const ok = window.confirm(
        `Sprawdzenie całego arkusza wyśle ${calls} ${plural(calls, "zapytanie", "zapytania", "zapytań")} do AI ` +
        `(wliczane do Twojego dziennego limitu).\n\n${parts}\n\nZadania zamknięte sprawdzają się bez AI.\n\nKontynuować?`
      );
      if (!ok) return;
    }
    setSheetBusy("Sprawdzanie…");
    try {
      // Closed questions first: free and instant, so something appears at once.
      await pool(pending.free, 4, (q) => gradeOne(q.id));
      let done = 0;
      await pool(pending.ai, 3, async (q) => {
        await gradeOne(q.id);
        done++;
        setSheetBusy(`Sprawdzanie zadań otwartych: ${done}/${pending.ai.length}`);
      });
      if (pending.essay) {
        setSheetBusy("Ocenianie wypracowania…");
        await gradeOne(pending.essay.id);
      }
      setStatus("Sprawdzono arkusz.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setSheetBusy(null);
    }
  }, [gradingLocked, pending, gradeOne]);

  /* ── finishing, expiry, retake ───────────────────────────────────────── */
  const finish = useCallback(async (reason: "manual" | "expired" = "manual") => {
    const a = attemptRef.current;
    if (!a || finishing.current) return;
    if (a.mode === "exam" && a.status === "in_progress") {
      if (reason === "manual" && !window.confirm("Zakończyć egzamin? Odpowiedzi zostaną zamknięte i nie da się ich zmienić.")) return;
      finishing.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const ids = [...dirty.current];
      dirty.current.clear();
      const res = await api<{ attempt: PublicAttempt }>(`/api/cke/attempts/${a.id}/finish`, "POST", {
        answers: Object.fromEntries(ids.map((id) => [id, answersRef.current[id]])),
      });
      finishing.current = false;
      if (!res.ok) { setStatus(`Nie udało się zakończyć arkusza: ${res.error}`); return; }
      setAttempt(res.data.attempt);
      setSave({ state: "saved", at: new Date() });
    } else {
      await flush();
    }
    setSummary({ reason });
    setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [flush]);

  // The exam clock. Expiry freezes the sheet but never grades: grading
  // spends AI quota and must follow a click, not a clock.
  useEffect(() => {
    if (!isExam || frozen || deadlineMs === null) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= deadlineMs) { clearInterval(t); void finish("expired"); }
    }, 1000);
    return () => clearInterval(t);
  }, [isExam, frozen, deadlineMs, finish]);

  const retake = useCallback(async (mode?: "practice" | "exam") => {
    const a = attemptRef.current;
    if (!a) return;
    if (!window.confirm("Rozpocząć ten arkusz od nowa? Obecne podejście zostanie zachowane w historii.")) return;
    const res = await api(`/api/cke/attempts/${a.id}/retake`, "POST", { mode: mode ?? a.mode });
    if (!res.ok) { setStatus(`Nie udało się rozpocząć od nowa: ${res.error}`); return; }
    window.location.href = `/quiz/${quiz.id}`;
  }, [quiz.id]);

  /* ── render ──────────────────────────────────────────────────────────── */
  const saveBadge = {
    idle: null,
    dirty: <span className="text-slate-400">niezapisane zmiany…</span>,
    saving: <span className="text-slate-400">zapisywanie…</span>,
    saved: <span className="text-green-600 font-medium">zapisano {save.at?.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}</span>,
    error: <span className="text-red-600 font-medium">NIE ZAPISANO ({save.error})</span>,
  }[save.state];

  const calls = pending.ai.length + pending.essayCalls;
  const hasFree = questions.some((q) => q.deterministic);

  return (
    <div className="pb-20">
      <div className="max-w-4xl mx-auto mb-4 flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{quiz.title.replace(/ — poziom.*$/, "")}</h1>
          <p className="text-sm text-slate-500">poziom {quiz.level} · {quiz.maxPoints} pkt · {describeContents(quiz.kind, questions.length)}</p>
        </div>
        <div className="text-sm font-mono" aria-live="off">
          {isExam && msLeft !== null && !frozen && (
            <span className={`font-semibold ${msLeft < 15 * 60_000 ? "text-red-600" : "text-slate-700"}`}>⏱ {formatClock(msLeft)}</span>
          )}
          {isExam && attempt?.status === "submitted" && <span className="text-slate-500">egzamin zakończony</span>}
          {!isExam && attempt && <span className="text-slate-500">tryb nauki</span>}
        </div>
      </div>

      {startError && (
        <div className="max-w-4xl mx-auto mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Nie udało się rozpocząć arkusza: {startError}
        </div>
      )}

      {modeMismatch && attempt && (
        <div className="max-w-4xl mx-auto mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex flex-wrap items-center gap-3">
          <span>
            Kontynuujesz rozpoczęte podejście w trybie {attempt.mode === "exam" ? "egzaminacyjnym" : "nauki"}. Tryb jest stały dla
            całego podejścia (zmiana w trakcie pozwalałaby zatrzymać zegar).
          </span>
          <button type="button" onClick={() => retake(props.requestedMode)} className="underline font-medium">
            Zacznij od nowa w trybie {props.requestedMode === "exam" ? "egzaminacyjnym" : "nauki"}
          </button>
        </div>
      )}

      {gradingLocked && (
        <div className="max-w-4xl mx-auto mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800">
          Tryb egzaminacyjny: zegar biegnie także po zamknięciu karty, a sprawdzanie odpowiedzi jest dostępne dopiero po
          zakończeniu arkusza.
        </div>
      )}

      {summary && (
        <div ref={summaryRef} className="max-w-4xl mx-auto mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-baseline gap-3 mb-4">
              <h2 className="text-lg font-bold text-slate-800">
                {summary.reason === "expired" ? <span className="text-red-600">Czas minął — arkusz zamknięty</span> : isExam ? "Arkusz zakończony" : "Podsumowanie"}
              </h2>
              {!isExam && <span className="text-xs text-slate-400">tryb nauki — nic nie jest zablokowane</span>}
            </div>
            <div className="flex flex-wrap items-end gap-8 mb-4">
              <div>
                <div className="text-3xl font-bold text-slate-900">{totals.points}<span className="text-slate-400 text-xl">/{totals.max}</span></div>
                <div className="text-xs text-slate-500">punktów</div>
              </div>
              <div className="text-sm text-slate-600">
                {totals.split.test.max > 0 && <div>Arkusz 1 (test): <strong>{totals.split.test.got}/{totals.split.test.max}</strong></div>}
                {totals.split.essay.max > 0 && <div>Wypracowanie: <strong>{totals.split.essay.got}/{totals.split.essay.max}</strong></div>}
              </div>
              <div className="text-sm text-slate-600">
                <div>Sprawdzone: <strong>{totals.graded}</strong> z {questions.length}</div>
                {pending.unanswered.length > 0 && <div className="text-amber-600">Bez odpowiedzi: {pending.unanswered.length}</div>}
              </div>
            </div>
            {calls > 0 && (
              <p className="text-xs text-slate-500 mb-4">
                Nie wszystko jest sprawdzone — brakuje {calls} {plural(calls, "zapytania", "zapytań", "zapytań")} do AI.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {(calls > 0 || pending.free.length > 0) && !gradingLocked && (
                <button type="button" onClick={gradeWholeSheet} disabled={!!sheetBusy}
                  className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {sheetBusy ?? "Sprawdź cały arkusz"}
                </button>
              )}
              <button type="button" onClick={() => retake()}
                className="px-4 py-2 text-sm font-semibold border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
                Rozwiąż ponownie
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="exam-sheet bg-white rounded-xl overflow-hidden border border-slate-200 max-w-4xl mx-auto">
        {questions.map((q) => (
          <QuestionCard
            key={q.id}
            q={q}
            value={answers[q.id]}
            grade={grades[q.id]}
            busy={busy[q.id] ?? null}
            note={notes[q.id] ?? null}
            disabled={frozen}
            alone={alone}
            supabaseUrl={supabaseUrl}
            onChange={onChange}
            onGrade={onGradeClick}
          />
        ))}
        <div className="q-sheet-foot" style={{ padding: "20px 28px 24px" }}>
          {!alone && !gradingLocked && (
            <button type="button" onClick={gradeWholeSheet} disabled={!!sheetBusy || !attempt}>
              {sheetBusy ?? "Sprawdź cały arkusz"}
            </button>
          )}
          <button type="button" onClick={() => finish("manual")} disabled={!attempt || (isExam && attempt.status !== "in_progress")}>
            {isExam ? "Zakończ egzamin" : "Podsumowanie"}
          </button>
          <span className="q-sheet-foot-note">
            {gradingLocked
              ? "W trybie egzaminacyjnym wynik zobaczysz po zakończeniu."
              : hasFree
                ? "Zadania zamknięte sprawdzają się kluczem CKE, bez AI. Zadania otwarte ocenia model AI (szacunek, nie wynik CKE)."
                : "Wypracowanie ocenia model AI w 8 kryteriach CKE — wynik jest szacunkiem."}
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-4 text-sm text-slate-500 px-2 flex flex-wrap gap-x-3 gap-y-1">
        <span>{describeContents(quiz.kind, questions.length)}.</span>
        <span className="font-semibold text-slate-700">{totals.points}/{totals.max} pkt · {totals.graded} z {questions.length} sprawdzonych</span>
        {saveBadge}
        {status && <span>{status}</span>}
      </div>
    </div>
  );
}
