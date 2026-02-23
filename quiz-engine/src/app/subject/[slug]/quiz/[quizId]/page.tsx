"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getQuiz } from "@/lib/quiz/loader";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { SingleChoiceInput } from "@/components/questions/SingleChoiceInput";
import { ShortTextInput } from "@/components/questions/ShortTextInput";
import { EssayInput } from "@/components/questions/EssayInput";
import { MathOpenInput } from "@/components/questions/MathOpenInput";
import { CodePythonInput } from "@/components/questions/CodePythonInput";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { useSettings } from "@/hooks/useSettings";
import type { GradeResult, Question } from "@/lib/quiz/schemas";
import type { TestResult } from "@/hooks/usePyodide";

// Per-question local state
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

export default function QuizRunnerPage({
  params,
}: {
  params: { slug: string; quizId: string };
}) {
  const router = useRouter();
  const quiz = getQuiz(params.quizId);
  const { settings } = useSettings();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [states, setStates] = useState<Record<string, QuestionState>>({});

  // Initialize states for all questions
  useEffect(() => {
    if (!quiz) return;
    const initial: Record<string, QuestionState> = {};
    for (const q of quiz.questions) {
      initial[q.id] = {
        answer: "",
        code: q.type === "code_python" ? (q as any).starterCode || "" : undefined,
        stdin: q.type === "code_python" ? "" : undefined,
        codeTestResults: [],
        codeStdout: "",
        codeStderr: "",
      };
    }
    setStates(initial);
  }, [quiz]);

  if (!quiz) {
    return (
      <div className="text-center py-12">
        <h1 className="text-xl font-bold text-gray-800">Quiz not found</h1>
        <button
          onClick={() => router.back()}
          className="mt-4 text-blue-600 hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  const question = quiz.questions[currentIdx];
  const state = states[question?.id] || { answer: "" };

  const updateState = (qId: string, update: Partial<QuestionState>) => {
    setStates((prev) => ({ ...prev, [qId]: { ...prev[qId], ...update } }));
  };

  const handleSubmit = async () => {
    if (state.submitted) return;
    updateState(question.id, { grading: true, submitted: true });

    // Build the request
    const userAnswer = buildUserAnswer(question, state);
    const attachments = buildAttachments(question, state);

    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: quiz.id,
          questionId: question.id,
          question,
          userAnswer,
          attachments,
          aiSettings: settings,
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
            nextSteps: ["Check if the dev server is running and API keys are set"],
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
        {/* Progress bar */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-600">
            Q {currentIdx + 1} / {quiz.questions.length}
          </span>
          <span className="text-sm text-gray-500">{quiz.title}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4">
          <div
            className="bg-blue-600 h-1.5 rounded-full transition-all"
            style={{
              width: `${((currentIdx + 1) / quiz.questions.length) * 100}%`,
            }}
          />
        </div>

        {/* Question prompt */}
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

        {/* Answer input */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <QuestionInput
            question={question}
            state={state}
            onUpdate={(update) => updateState(question.id, update)}
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-40 transition-colors"
          >
            Previous
          </button>

          <button
            onClick={handleSubmit}
            disabled={state.grading || state.submitted}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {state.grading ? "Grading..." : state.submitted ? "Submitted" : "Submit"}
          </button>

          <button
            onClick={() =>
              setCurrentIdx((i) => Math.min(quiz.questions.length - 1, i + 1))
            }
            disabled={currentIdx === quiz.questions.length - 1}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {/* Right: AI Feedback */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
          AI Feedback
        </h3>
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

// ── Question Input Renderer ─────────────────────────────────────────────────

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
  const q = question as any;

  switch (question.type) {
    case "single_choice":
      return (
        <SingleChoiceInput
          choices={q.choices}
          value={state.answer}
          onChange={(v) => onUpdate({ answer: v })}
          disabled={disabled}
          correctAnswer={state.submitted ? q.correctAnswer : undefined}
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
          minWords={q.minWords}
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
          tests={q.tests || []}
          hiddenTests={q.hiddenTests}
          onTestResults={(results, stdout, stderr) =>
            onUpdate({
              codeTestResults: results,
              codeStdout: stdout,
              codeStderr: stderr,
            })
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
          placeholder="Answer..."
        />
      );
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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
  const attachments: Record<string, unknown> = {};

  if (question.type === "math_open_with_work" && state.mathImage) {
    attachments.imageBase64 = state.mathImage;
  }

  if (question.type === "code_python") {
    attachments.code = state.code || "";
    attachments.stdout = state.codeStdout || "";
    attachments.stderr = state.codeStderr || "";
    attachments.testReport = state.codeTestResults || [];
  }

  return Object.keys(attachments).length > 0 ? attachments : undefined;
}
