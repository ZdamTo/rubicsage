"use client";

import { useState, useEffect } from "react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { SingleChoiceInput } from "@/components/questions/SingleChoiceInput";
import { ShortTextInput } from "@/components/questions/ShortTextInput";
import { EssayInput } from "@/components/questions/EssayInput";
import { MathOpenInput } from "@/components/questions/MathOpenInput";
import { CodePythonInput } from "@/components/questions/CodePythonInput";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { useSettings } from "@/hooks/useSettings";
import type { GradeResult, Question, Quiz } from "@/lib/quiz/schemas";
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
  gradeResult?: GradeResult | null;
  grading?: boolean;
  submitted?: boolean;
}

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
      updateState(question.id, { gradeResult: result, grading: false });
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Question */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-600">
            Q {currentIdx + 1} / {quiz.questions.length}
          </span>
          <span className="text-sm text-gray-500">{quiz.title}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4">
          <div
            className="bg-blue-600 h-1.5 rounded-full transition-all"
            style={{ width: `${((currentIdx + 1) / quiz.questions.length) * 100}%` }}
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
              {question.type.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-gray-500">
              max {question.maxScore} pt{question.maxScore !== 1 ? "s" : ""}
            </span>
          </div>
          <MarkdownRenderer content={question.promptMarkdown} />
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <QuestionInput
            question={question}
            state={state}
            onUpdate={(update) => updateState(question.id, update)}
          />
        </div>

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-40 transition-colors"
          >
            Previous
          </button>

          <button
            onClick={handleGrade}
            disabled={state.grading || state.submitted}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {state.grading ? "Grading…" : state.submitted ? "Submitted" : "Submit"}
          </button>

          <button
            onClick={() => setCurrentIdx((i) => Math.min(quiz.questions.length - 1, i + 1))}
            disabled={currentIdx === quiz.questions.length - 1}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>

        {/* Finish attempt button */}
        {allSubmitted && attemptId && !attemptSubmitted && (
          <div className="mt-6 text-center">
            <button
              onClick={handleSubmitAttempt}
              className="px-8 py-3 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              Finish Quiz & Save Results
            </button>
          </div>
        )}
        {attemptSubmitted && (
          <div className="mt-6 text-center text-sm text-green-700 font-medium bg-green-50 border border-green-200 rounded-lg py-3">
            Quiz completed! Results saved. Keep up the streak!
          </div>
        )}
      </div>

      {/* Right: Feedback */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">AI Feedback</h3>
        {state.submitted ? (
          <FeedbackPanel result={state.gradeResult || null} loading={!!state.grading} />
        ) : (
          <div className="bg-gray-50 border border-gray-200 border-dashed rounded-lg p-8 text-center text-gray-400">
            Submit your answer to receive AI feedback
          </div>
        )}
      </div>
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
