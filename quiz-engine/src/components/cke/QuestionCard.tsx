"use client";

import { memo, type ReactElement } from "react";
import type { ClientQuestion } from "@/lib/cke/sanitize";
import type { CkeGradeResult, EssayGrading } from "@/lib/cke/types";
import { scoreRange } from "@/lib/cke/display";
import { References, Stem } from "./SheetText";
import { PChoiceWidget, PEssayWidget, PTableMatchWidget, PTableTextWidget, PTextWidget, PTfWidget, type WidgetProps } from "./AnswerWidgets";
import { EssayScorecard } from "./EssayScorecard";

export type Grade = (CkeGradeResult & { kind?: "question" }) | (EssayGrading & { kind: "essay" });

export function isEssayGrade(g: Grade | undefined): g is EssayGrading & { kind: "essay" } {
  return !!g && (g as { kind?: string }).kind === "essay";
}

/** Points awarded, or null while the question is not (fully) graded. */
export function gradePoints(g: Grade | undefined): number | null {
  if (!g) return null;
  if (isEssayGrade(g)) return g.evaluation ? g.evaluation.totals.official_points : null;
  return g.points ?? null;
}

const WIDGETS: Record<string, (p: WidgetProps) => ReactElement> = {
  "P-TEXT": PTextWidget,
  "P-TABLE-TEXT": PTableTextWidget,
  "P-TABLE-MATCH": PTableMatchWidget,
  "P-TF": PTfWidget,
  "P-CHOICE": PChoiceWidget,
  "P-SINGLE-CHOICE": PChoiceWidget,
  "P-ESSAY": PEssayWidget,
};

/* The marker in the score box: "klucz CKE" when the click compares against
   CKE's own key, "sprawdź teraz" when a model grades it (ours, not CKE's). */
function Mark({ deterministic }: { deterministic: boolean }) {
  return (
    <span className="q-mark" aria-hidden="true">
      <span className="q-mark-top">{deterministic ? "klucz" : "sprawdź"}</span>
      <span className="q-mark-bot">{deterministic ? "CKE" : "teraz"}</span>
    </span>
  );
}

function hint(q: ClientQuestion) {
  if (q.deterministic) return "Sprawdź — porównanie z kluczem odpowiedzi CKE, bez AI";
  if (q.type === "P-ESSAY") return "Oceń wypracowanie — 8 zapytań do AI";
  return "Sprawdź — ocena przez AI (1 zapytanie)";
}

function Paragraphs({ text }: { text: string }) {
  return <>{text.split("\n").map((p) => p.trim()).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</>;
}

function Result({ q, grade }: { q: ClientQuestion; grade: Grade | undefined }) {
  if (!grade) return null;
  if (isEssayGrade(grade)) {
    if (grade.evaluation) return <EssayScorecard evaluation={grade.evaluation} info={q.scorecard} />;
    const failed = grade.failed_criteria ?? [];
    const done = Object.keys(grade.ai_raw_results ?? {}).length;
    return (
      <div className="q-note q-note-bad">
        Oceniono {done}/8 kryteriów. {failed.length ? `Nie udało się: ${failed.map((f) => f.id).join(", ")} (${failed[0].error}). ` : ""}
        Kliknij „Oceń wypracowanie” ponownie, aby dokończyć — zostaną wysłane tylko brakujące kryteria.
      </div>
    );
  }
  if (grade.source === "auto") {
    return grade.correct ? (
      <div className="q-result-box result-ok">✓ Poprawnie — {grade.points}/{grade.max_points} pkt</div>
    ) : (
      <div className="q-result-box result-bad">
        ✗ Niepoprawnie — {grade.points}/{grade.max_points} pkt · poprawna: {grade.expected || "—"}, udzielona: {grade.given || "(brak)"}
      </div>
    );
  }
  if (grade.points === null || grade.points === undefined) {
    return <div className="q-note q-note-bad">Nie udało się odczytać oceny z odpowiedzi modelu. Spróbuj sprawdzić ponownie.</div>;
  }
  return (
    <div className="q-result-box result-ai">
      <div className="result-points">Ocena AI: {grade.points}/{grade.max_points} pkt</div>
      {grade.explanation && <div className="result-expl"><Paragraphs text={grade.explanation} /></div>}
    </div>
  );
}

interface CardProps {
  q: ClientQuestion;
  value: unknown;
  grade: Grade | undefined;
  busy: string | null;
  note: { text: string; bad?: boolean } | null;
  disabled: boolean;
  /** One-question sheet (rozszerzony): no margin stack, labelled button only. */
  alone: boolean;
  supabaseUrl: string;
  onChange: (qid: string, value: unknown) => void;
  onGrade: (qid: string) => void;
}

function QuestionCardImpl({ q, value, grade, busy, note, disabled, alone, supabaseUrl, onChange, onGrade }: CardProps) {
  const Widget = WIDGETS[q.type];
  const max = Number(q.scoring.max_points ?? 0);
  const isEssay = q.type === "P-ESSAY";
  const points = gradePoints(grade);
  const filled = points !== null;

  return (
    <section className={alone ? "q-card q-card-plain" : "q-card"} id={`zadanie-${q.number}`} data-question-id={q.id}>
      <header className="q-header">
        <div className="q-head-bar">Zadanie {q.number}. (0–{max})</div>
        {!alone && (
          <div className="q-score-stack">
            <div className="q-score-num" aria-hidden="true">{q.number}.</div>
            <div className="q-score-range" aria-hidden="true">{scoreRange(max)}</div>
            <button
              type="button"
              className={`q-score-box ${filled ? "q-score-box-filled" : ""} ${busy ? "q-score-box-busy" : ""}`}
              title={filled ? `Wynik: ${points} pkt` : hint(q)}
              aria-label={filled ? `Wynik zadania ${q.number}: ${points} pkt` : hint(q)}
              disabled={filled || !!busy}
              onClick={() => onGrade(q.id)}
            >
              {filled ? String(points) : busy ? busy : <Mark deterministic={q.deterministic} />}
            </button>
          </div>
        )}
      </header>
      <References items={q.reference_data} partId={q.part_id} supabaseUrl={supabaseUrl} />
      <Stem text={q.question} minimumWords={isEssay ? q.minimum_word_count : undefined} />
      <div className="q-answer">
        {Widget ? (
          <Widget q={q} value={value} disabled={disabled} onChange={(v) => onChange(q.id, v)} />
        ) : (
          <div className="q-unsupported">Nieobsługiwany typ: {q.type}</div>
        )}
      </div>
      <div className="q-result" aria-live="polite">
        {note && <div className={`q-note ${note.bad ? "q-note-bad" : ""}`}>{note.text}</div>}
        <Result q={q} grade={grade} />
      </div>
      {(isEssay || alone) && !filled && (
        <footer className="q-actions">
          <button type="button" onClick={() => onGrade(q.id)} disabled={!!busy}>
            {busy ? "Ocenianie… (to może potrwać do minuty)" : isEssay ? "Oceń wypracowanie (8 zapytań AI)" : q.deterministic ? "Sprawdź" : "Sprawdź (AI — 1 zapytanie)"}
          </button>
        </footer>
      )}
    </section>
  );
}

// Typing in one answer should not re-render the other twenty cards.
export const QuestionCard = memo(QuestionCardImpl);
