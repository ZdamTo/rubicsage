"use client";

import type { TrueFalseStatement } from "@/lib/quiz/schemas";
import type { TrueFalseStatementResult } from "@/lib/ai/deterministic-scorer";

interface Props {
  statements: TrueFalseStatement[];
  labels: { true: string; false: string };
  values: Record<string, string>;
  onChange: (id: string, value: "true" | "false") => void;
  disabled?: boolean;
  submitted?: boolean;
  statementResults?: TrueFalseStatementResult[];
}

export function TrueFalseGroupInput({
  statements,
  labels,
  values,
  onChange,
  disabled,
  submitted,
  statementResults,
}: Props) {
  const resultMap = new Map(statementResults?.map((r) => [r.statementId, r]) ?? []);

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Oceń każde zdanie: <strong>{labels.true}</strong> (Prawda) lub{" "}
        <strong>{labels.false}</strong> (Fałsz).
      </p>

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700 w-full">
                Stwierdzenie
              </th>
              <th className="px-4 py-2.5 text-center font-semibold text-gray-700 whitespace-nowrap">
                {labels.true}
              </th>
              <th className="px-4 py-2.5 text-center font-semibold text-gray-700 whitespace-nowrap">
                {labels.false}
              </th>
            </tr>
          </thead>
          <tbody>
            {statements.map((stmt, idx) => {
              const result = resultMap.get(stmt.id);
              const selected = values[stmt.id];
              const isAnswered = selected === "true" || selected === "false";

              let rowClass = idx % 2 === 0 ? "bg-white" : "bg-gray-50/60";
              if (submitted && result) {
                rowClass = result.isCorrect
                  ? "bg-green-50"
                  : "bg-red-50";
              }

              return (
                <tr key={stmt.id} className={`${rowClass} border-t border-gray-100`}>
                  <td className="px-4 py-3 text-gray-800 leading-snug">
                    <div className="flex items-start gap-2">
                      <span>{stmt.text}</span>
                      {submitted && result && (
                        <span
                          className={`shrink-0 mt-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
                            result.isCorrect
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {result.isCorrect ? "✓" : `✗ → ${result.correctAnswer === "true" ? labels.true : labels.false}`}
                        </span>
                      )}
                    </div>
                  </td>

                  {(["true", "false"] as const).map((val) => {
                    const labelText = val === "true" ? labels.true : labels.false;
                    const isSelected = selected === val;
                    const inputId = `${stmt.id}-${val}`;

                    let radioClass =
                      "w-4 h-4 cursor-pointer accent-blue-600";
                    if (disabled) radioClass += " cursor-not-allowed opacity-60";

                    let cellClass = "px-4 py-3 text-center";
                    if (submitted && result) {
                      const isCorrectChoice = result.correctAnswer === val;
                      if (isSelected && result.isCorrect) {
                        cellClass += " text-green-600 font-semibold";
                      } else if (isSelected && !result.isCorrect) {
                        cellClass += " text-red-500";
                      } else if (!isSelected && isCorrectChoice) {
                        cellClass += " text-green-600";
                      }
                    }

                    return (
                      <td key={val} className={cellClass}>
                        <label className="flex items-center justify-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            id={inputId}
                            name={stmt.id}
                            value={val}
                            checked={isSelected}
                            onChange={() => onChange(stmt.id, val)}
                            disabled={disabled}
                            className={radioClass}
                          />
                          <span className="text-sm font-medium">{labelText}</span>
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary strip after submission */}
      {submitted && statementResults && statementResults.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm bg-white border border-gray-200 rounded-lg px-4 py-2.5">
          <span className="font-medium text-gray-600 mr-1">Ocena:</span>
          {statementResults.map((r) => (
            <span
              key={r.statementId}
              title={
                r.isCorrect
                  ? "Poprawnie"
                  : `Poprawna odpowiedź: ${r.correctAnswer === "true" ? labels.true : labels.false}`
              }
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-mono ${
                r.isCorrect
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {r.isCorrect ? "✓" : "✗"} {r.statementId}
            </span>
          ))}
          <span className="ml-auto text-gray-500 text-xs">
            {statementResults.filter((r) => r.isCorrect).length} /{" "}
            {statementResults.length} poprawnie
          </span>
        </div>
      )}
    </div>
  );
}
