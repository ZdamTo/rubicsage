"use client";

import type { GradeResult } from "@/lib/quiz/schemas";

interface Props {
  result: GradeResult | null;
  loading: boolean;
}

export function FeedbackPanel({ result, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-pulse">
        <div className="flex items-center gap-2 text-blue-700">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="font-medium">AI is grading your answer...</span>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const scorePercent = result.maxScore > 0 ? (result.score / result.maxScore) * 100 : 0;
  const scoreColor =
    scorePercent >= 75 ? "text-green-700 bg-green-50 border-green-200" :
    scorePercent >= 40 ? "text-yellow-700 bg-yellow-50 border-yellow-200" :
    "text-red-700 bg-red-50 border-red-200";

  return (
    <div className="space-y-3">
      {/* Score badge */}
      <div className={`rounded-lg border p-4 ${scoreColor}`}>
        <div className="text-2xl font-bold">
          {result.score} / {result.maxScore}
        </div>
        <div className="text-sm mt-1 opacity-80">
          {scorePercent.toFixed(0)}% &middot; Confidence: {(result.confidence * 100).toFixed(0)}%
          &middot; Model: {result.modelUsed}
        </div>
      </div>

      {/* Rubric breakdown */}
      {result.rubricBreakdown && result.rubricBreakdown.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-2">Rubric Breakdown</h4>
          <div className="space-y-2">
            {result.rubricBreakdown.map((item, i) => (
              <div key={i} className="text-sm">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">{item.criterion}</span>
                  <span className={`font-bold ${item.points >= item.maxPoints * 0.7 ? "text-green-600" : item.points >= item.maxPoints * 0.4 ? "text-yellow-600" : "text-red-600"}`}>
                    {item.points}/{item.maxPoints}
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-0.5">{item.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-800 mb-2">Feedback</h4>
        <p className="text-sm text-gray-700 mb-3">{result.feedback.summary}</p>

        {result.feedback.strengths.length > 0 && (
          <div className="mb-2">
            <h5 className="text-xs font-semibold text-green-700 uppercase mb-1">Strengths</h5>
            <ul className="text-sm text-gray-600 space-y-1">
              {result.feedback.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-green-500 mt-0.5">+</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.feedback.issues.length > 0 && (
          <div className="mb-2">
            <h5 className="text-xs font-semibold text-red-700 uppercase mb-1">Issues</h5>
            <ul className="text-sm text-gray-600 space-y-1">
              {result.feedback.issues.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-red-500 mt-0.5">-</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.feedback.nextSteps.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-blue-700 uppercase mb-1">Next Steps</h5>
            <ul className="text-sm text-gray-600 space-y-1">
              {result.feedback.nextSteps.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-blue-500 mt-0.5">&rarr;</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
