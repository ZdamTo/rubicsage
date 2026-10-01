"use client";

import { useState, useEffect } from "react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { SingleChoiceInput } from "@/components/questions/SingleChoiceInput";
import { ShortTextInput } from "@/components/questions/ShortTextInput";
import { EssayInput } from "@/components/questions/EssayInput";
import { MathOpenInput } from "@/components/questions/MathOpenInput";
import { CodePythonInput } from "@/components/questions/CodePythonInput";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { AskAIPanel } from "@/components/AskAIPanel";
import { SqlQueryInput } from "@/components/questions/SqlQueryInput";
import { SpreadsheetTaskInput } from "@/components/questions/SpreadsheetTaskInput";
import { ClozeTextInput } from "@/components/questions/ClozeTextInput";
import { TableFillInput } from "@/components/questions/TableFillInput";
import { TrueFalseGroupInput } from "@/components/questions/TrueFalseGroupInput";
import { useSettings } from "@/hooks/useSettings";
import type { GradeResult, Question, Quiz, SqlQueryQuestion, SpreadsheetTaskQuestion, ClozeTextQuestion, TableFillQuestion, TrueFalseGroupQuestion } from "@/lib/quiz/schemas";
import type { ClozeBlankResult, TableFillInputResult, TrueFalseStatementResult } from "@/lib/ai/deterministic-scorer";
import type { TestResult } from "@/hooks/usePyodide";

interface QuestionState {
  answer: string;
  mathFinalAnswer?: string;
  mathReasoning?: string;
  mathImage?: string | null;
  code?: string;
  stdin?: string;
  codeTestResults?: TestResult[];
  codeStdout?: string;
  codeStderr?: string;
  /** spreadsheet_task: keyed by output id */
  spreadsheetOutputs?: Record<string, string>;
  /** cloze_text: keyed by blank id */
  clozeAnswers?: Record<string, string>;
  /** cloze_text: per-blank results injected from gradeResult for UI feedback */
  clozeBlankResults?: ClozeBlankResult[];
  /** table_fill: keyed by input id */
  tableFillAnswers?: Record<string, string>;
  /** table_fill: per-cell results for UI feedback */
  tableFillInputResults?: TableFillInputResult[];
  /** true_false_group: keyed by statement id ("true" | "false") */
  trueFalseAnswers?: Record<string, string>;
  /** true_false_group: per-statement results for UI feedback */
  trueFalseStatementResults?: TrueFalseStatementResult[];
  gradeResult?: GradeResult | null;
  grading?: boolean;
  submitted?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  single_choice: "jednokrotny wybór",
  multi_choice: "wielokrotny wybór",
  short_text: "krótka odpowiedź",
  numeric: "liczba",
  math_open_with_work: "zadanie otwarte",
  polish_essay: "wypracowanie",
  code_python: "Python",
  sql_query: "SQL",
  spreadsheet_task: "arkusz kalkulacyjny",
  cloze_text: "uzupełnij luki",
  table_fill: "uzupełnij tabelę",
  true_false_group: "prawda / fałsz",
};

interface Props {
  quiz: Quiz;
  quizId: string;
  attemptId: string | null;
}

export default function QuizRunner({ quiz, quizId, attemptId }: Props) {
  const { settings } = useSettings();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [states, setStates] = useState<Record<string, QuestionState>>({});
  const [attemptSubmitted, setAttemptSubmitted] = useState(false);
  const [askAIOpen, setAskAIOpen] = useState(false);

  useEffect(() => {
    const initial: Record<string, QuestionState> = {};
    for (const q of quiz.questions) {
      initial[q.id] = {
        answer: "",
        code: q.type === "code_python" ? (q as { starterCode?: string }).starterCode || "" : undefined,
        stdin: q.type === "code_python" ? "" : undefined,
        codeTestResults: [],
        codeStdout: "",
        codeStderr: "",
      };
    }
    setStates(initial);
  }, [quiz]);

  const question = quiz.questions[currentIdx];
  const state = states[question?.id] || { answer: "" };

  const updateState = (qId: string, update: Partial<QuestionState>) => {
    setStates((prev) => ({ ...prev, [qId]: { ...prev[qId], ...update } }));
  };

  const allSubmitted = quiz.questions.every((q) => states[q.id]?.submitted);

  const handleSubmitAttempt = async () => {
    if (!attemptId || attemptSubmitted) return;
    await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
    setAttemptSubmitted(true);
  };

  const handleGrade = async () => {
    if (state.submitted) return;
    updateState(question.id, { grading: true, submitted: true });

    const userAnswer = buildUserAnswer(question, state);
    const attachments = buildAttachments(question, state);

    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId,
          questionId: question.id,
          question,
          userAnswer,
          attachments,
          aiSettings: settings,
          quizSubject: quiz.subjectSlug,
          attemptId,
        }),
      });
      const result: GradeResult = await res.json();

      // Compute per-item results client-side for inline UI feedback
      let clozeBlankResults: ClozeBlankResult[] | undefined;
      let tableFillInputResults: TableFillInputResult[] | undefined;
      let trueFalseStatementResults: TrueFalseStatementResult[] | undefined;

      const scorer = await import("@/lib/ai/deterministic-scorer");

      if (question.type === "cloze_text") {
        const ct = question as ClozeTextQuestion;
        const parsed = (() => {
          try { return JSON.parse(userAnswer) as Record<string, string>; } catch { return {}; }
        })();
        clozeBlankResults = scorer.scoreClozeText(parsed, ct.blanks, question.maxScore).blankResults;
      }

      if (question.type === "table_fill") {
        const tf = question as TableFillQuestion;
        const parsed = (() => {
          try { return JSON.parse(userAnswer) as Record<string, string>; } catch { return {}; }
        })();
        tableFillInputResults = scorer.scoreTableFill(parsed, tf.inputs, question.maxScore).inputResults;
      }

      if (question.type === "true_false_group") {
        const tfg = question as TrueFalseGroupQuestion;
        const parsed = (() => {
          try { return JSON.parse(userAnswer) as Record<string, string>; } catch { return {}; }
        })();
        trueFalseStatementResults = scorer.scoreTrueFalseGroup(parsed, tfg.statements, question.maxScore).statementResults;
      }

      updateState(question.id, {
        gradeResult: result,
        grading: false,
        clozeBlankResults,
        tableFillInputResults,
        trueFalseStatementResults,
      });
    } catch (err) {
      updateState(question.id, {
        grading: false,
        gradeResult: {
          score: 0,
          maxScore: question.maxScore,
          feedback: {
            summary: `Error: ${err instanceof Error ? err.message : "Network error"}`,
            strengths: [],
            issues: ["Failed to reach grading API"],
            nextSteps: ["Check API keys and server."],
          },
          confidence: 0,
          modelUsed: "error",
        },
      });
    }
  };

  const typeLabel = TYPE_LABELS[question.type] ?? question.type.replace(/_/g, " ");
  const graded = !!state.gradeResult && !state.grading;
  const scoreRange =
    question.maxScore > 5 ? `0–${question.maxScore}` : Array.from({ length: question.maxScore + 1 }, (_, i) => i).join("–");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Question, laid out like a CKE arkusz (same theme as Język polski) */}
      <div>
        <div className="flex items-end justify-between mb-3 gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{quiz.title}</h1>
            <p className="text-xs text-slate-500">
              Zadanie {currentIdx + 1} z {quiz.questions.length}
            </p>
          </div>
        </div>

        {/* Question navigator: one box per zadanie, filled once it is checked */}
        <div className="flex flex-wrap gap-1.5 mb-4" role="tablist" aria-label="Zadania">
          {quiz.questions.map((q, i) => {
            const done = !!states[q.id]?.submitted;
            const current = i === currentIdx;
            return (
              <button
                key={q.id}
                type="button"
                role="tab"
                aria-selected={current}
                onClick={() => setCurrentIdx(i)}
                className={`w-8 h-8 text-xs font-bold rounded-sm border-[1.5px] transition-colors ${
                  done ? "bg-[#7030a0] border-[#7030a0] text-white" : "bg-white border-[#7030a0] text-[#7030a0] hover:bg-[#e7ddf3]"
                } ${current ? "ring-2 ring-offset-1 ring-[#b984de]" : ""}`}
                title={`Zadanie ${i + 1}${done ? " — sprawdzone" : ""}`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <div className="exam-sheet bg-white rounded-xl overflow-hidden border border-slate-200 mb-4">
          <section className="q-card">
            <header className="q-header">
              <div className="q-head-bar">
                Zadanie {currentIdx + 1}. (0–{question.maxScore})
                <span className="q-type">{typeLabel}</span>
              </div>
              <div className="q-score-stack">
                <div className="q-score-num" aria-hidden="true">{currentIdx + 1}.</div>
                <div className="q-score-range" aria-hidden="true">{scoreRange}</div>
                <button
                  type="button"
                  className={`q-score-box ${graded ? "q-score-box-filled" : ""} ${state.grading ? "q-score-box-busy" : ""}`}
                  onClick={handleGrade}
                  disabled={state.grading || state.submitted}
                  title={graded ? `Wynik: ${state.gradeResult!.score} pkt` : "Sprawdź odpowiedź"}
                  aria-label={graded ? `Wynik: ${state.gradeResult!.score} pkt` : "Sprawdź odpowiedź"}
                >
                  {graded ? (
                    String(state.gradeResult!.score)
                  ) : state.grading ? (
                    "…"
                  ) : (
                    <span className="q-mark" aria-hidden="true">
                      <span className="q-mark-top">sprawdź</span>
                      <span className="q-mark-bot">teraz</span>
                    </span>
                  )}
                </button>
              </div>
            </header>
            <div className="q-prompt">
              <MarkdownRenderer content={question.promptMarkdown} />
            </div>
            <div className="q-answer">
              <QuestionInput
                question={question}
                state={state}
                onUpdate={(update) => updateState(question.id, update)}
              />
            </div>
          </section>
        </div>

        <div className="q-sheet-foot !mt-0 !pt-4 justify-between">
          <button
            type="button"
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="!bg-white !text-[#7030a0] disabled:opacity-40"
          >
            ← Poprzednie
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGrade}
              disabled={state.grading || state.submitted}
              className="!bg-[#7030a0] !text-white disabled:opacity-50"
            >
              {state.grading ? "Sprawdzanie…" : state.submitted ? "Sprawdzone" : "Sprawdź"}
            </button>
            <button
              type="button"
              onClick={() => setAskAIOpen(true)}
              className="!bg-white !text-[#7030a0]"
              title="Zapytaj AI o to zadanie"
            >
              🤖 Zapytaj AI
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCurrentIdx((i) => Math.min(quiz.questions.length - 1, i + 1))}
            disabled={currentIdx === quiz.questions.length - 1}
            className="!bg-white !text-[#7030a0] disabled:opacity-40"
          >
            Następne →
          </button>
        </div>

        {/* Finish attempt button */}
        {allSubmitted && attemptId && !attemptSubmitted && (
          <div className="mt-6 text-center">
            <button
              onClick={handleSubmitAttempt}
              className="px-8 py-3 bg-[#7030a0] text-white rounded-md text-sm font-semibold hover:bg-[#4c2168] transition-colors"
            >
              Zakończ i zapisz wyniki
            </button>
          </div>
        )}
        {attemptSubmitted && (
          <div className="mt-6 text-center text-sm text-green-700 font-medium bg-green-50 border border-green-200 rounded-lg py-3">
            Test zakończony, wyniki zapisane. Tak trzymaj!
          </div>
        )}
      </div>

      {/* Right: Feedback */}
      <div>
        <h3 className="text-sm font-semibold text-[#4c2168] uppercase tracking-wide mb-3">Ocena i wskazówki</h3>
        {state.submitted ? (
          <FeedbackPanel result={state.gradeResult || null} loading={!!state.grading} />
        ) : (
          <div className="bg-gray-50 border border-gray-200 border-dashed rounded-lg p-8 text-center text-gray-400">
            Kliknij „Sprawdź”, aby otrzymać ocenę i wskazówki
          </div>
        )}
      </div>

      {/* Ask AI panel — fixed side drawer */}
      <AskAIPanel
        question={question}
        userAnswer={buildUserAnswer(question, state)}
        aiSettings={settings}
        isOpen={askAIOpen}
        onClose={() => setAskAIOpen(false)}
      />
    </div>
  );
}

// ── Question Input ────────────────────────────────────────────────────────────

function QuestionInput({
  question,
  state,
  onUpdate,
}: {
  question: Question;
  state: QuestionState;
  onUpdate: (update: Partial<QuestionState>) => void;
}) {
  const disabled = state.submitted;
  const q = question as Record<string, unknown>;

  switch (question.type) {
    case "single_choice":
      return (
        <SingleChoiceInput
          choices={q.choices as Array<{ id: string; text: string }>}
          value={state.answer}
          onChange={(v) => onUpdate({ answer: v })}
          disabled={disabled}
          correctAnswer={state.submitted ? (q.correctAnswer as string) : undefined}
          submitted={state.submitted}
        />
      );
    case "short_text":
      return (
        <ShortTextInput
          value={state.answer}
          onChange={(v) => onUpdate({ answer: v })}
          disabled={disabled}
        />
      );
    case "polish_essay":
      return (
        <EssayInput
          value={state.answer}
          onChange={(v) => onUpdate({ answer: v })}
          disabled={disabled}
          minWords={q.minWords as number}
        />
      );
    case "math_open_with_work":
      return (
        <MathOpenInput
          finalAnswer={state.mathFinalAnswer || ""}
          reasoning={state.mathReasoning || ""}
          onFinalAnswerChange={(v) => onUpdate({ mathFinalAnswer: v })}
          onReasoningChange={(v) => onUpdate({ mathReasoning: v })}
          onImageChange={(v) => onUpdate({ mathImage: v })}
          imagePreview={state.mathImage || null}
          disabled={disabled}
        />
      );
    case "code_python":
      return (
        <CodePythonInput
          code={state.code || ""}
          onCodeChange={(v) => onUpdate({ code: v })}
          stdin={state.stdin || ""}
          onStdinChange={(v) => onUpdate({ stdin: v })}
          tests={q.tests as Array<{ name: string; stdin: string; expectedStdout: string }>}
          hiddenTests={q.hiddenTests as Array<{ name: string; stdin: string; expectedStdout: string }> | undefined}
          onTestResults={(results, stdout, stderr) =>
            onUpdate({ codeTestResults: results, codeStdout: stdout, codeStderr: stderr })
          }
          testResults={state.codeTestResults || []}
          lastStdout={state.codeStdout || ""}
          lastStderr={state.codeStderr || ""}
          disabled={disabled}
        />
      );
    case "sql_query": {
      const sq = question as SqlQueryQuestion;
      return (
        <SqlQueryInput
          query={state.answer}
          onQueryChange={(v) => onUpdate({ answer: v })}
          schemaMarkdown={(sq as { schemaMarkdown?: string }).schemaMarkdown}
          seedData={(sq as { seedData?: string }).seedData}
          dialect={(sq as { dialect?: string }).dialect}
          disabled={disabled}
        />
      );
    }
    case "spreadsheet_task": {
      const ss = question as SpreadsheetTaskQuestion;
      return (
        <SpreadsheetTaskInput
          sourceDataDescription={ss.sourceDataDescription}
          expectedOutputs={ss.expectedOutputs}
          requiredChart={(ss as { requiredChart?: { type: string; description: string } }).requiredChart}
          values={state.spreadsheetOutputs ?? {}}
          onChange={(id, val) =>
            onUpdate({ spreadsheetOutputs: { ...(state.spreadsheetOutputs ?? {}), [id]: val } })
          }
          disabled={disabled}
        />
      );
    }
    case "cloze_text": {
      const ct = question as ClozeTextQuestion;
      return (
        <ClozeTextInput
          template={ct.template}
          blanks={ct.blanks}
          values={state.clozeAnswers ?? {}}
          onChange={(id, val) =>
            onUpdate({ clozeAnswers: { ...(state.clozeAnswers ?? {}), [id]: val } })
          }
          disabled={disabled}
          submitted={state.submitted}
          blankResults={state.clozeBlankResults}
        />
      );
    }
    case "table_fill": {
      const tf = question as TableFillQuestion;
      return (
        <TableFillInput
          columns={tf.columns}
          rows={tf.rows}
          inputs={tf.inputs}
          values={state.tableFillAnswers ?? {}}
          onChange={(id, val) =>
            onUpdate({ tableFillAnswers: { ...(state.tableFillAnswers ?? {}), [id]: val } })
          }
          disabled={disabled}
          submitted={state.submitted}
          inputResults={state.tableFillInputResults}
        />
      );
    }
    case "true_false_group": {
      const tfg = question as TrueFalseGroupQuestion;
      return (
        <TrueFalseGroupInput
          statements={tfg.statements}
          labels={tfg.labels}
          values={state.trueFalseAnswers ?? {}}
          onChange={(id, val) =>
            onUpdate({ trueFalseAnswers: { ...(state.trueFalseAnswers ?? {}), [id]: val } })
          }
          disabled={disabled}
          submitted={state.submitted}
          statementResults={state.trueFalseStatementResults}
        />
      );
    }
    default:
      return (
        <ShortTextInput
          value={state.answer}
          onChange={(v) => onUpdate({ answer: v })}
          disabled={disabled}
          placeholder="Answer…"
        />
      );
  }
}

function buildUserAnswer(question: Question, state: QuestionState): string {
  switch (question.type) {
    case "math_open_with_work":
      return JSON.stringify({
        finalAnswer: state.mathFinalAnswer || "",
        reasoning: state.mathReasoning || "",
      });
    case "code_python":
      return state.code || "";
    case "spreadsheet_task":
      return JSON.stringify(state.spreadsheetOutputs ?? {});
    case "cloze_text":
      return JSON.stringify(state.clozeAnswers ?? {});
    case "table_fill":
      return JSON.stringify(state.tableFillAnswers ?? {});
    case "true_false_group":
      return JSON.stringify(state.trueFalseAnswers ?? {});
    default:
      return state.answer;
  }
}

function buildAttachments(question: Question, state: QuestionState) {
  const att: Record<string, unknown> = {};
  if (question.type === "math_open_with_work" && state.mathImage) {
    att.imageBase64 = state.mathImage;
  }
  if (question.type === "code_python") {
    att.code = state.code || "";
    att.stdout = state.codeStdout || "";
    att.stderr = state.codeStderr || "";
    att.testReport = state.codeTestResults || [];
  }
  return Object.keys(att).length > 0 ? att : undefined;
}
