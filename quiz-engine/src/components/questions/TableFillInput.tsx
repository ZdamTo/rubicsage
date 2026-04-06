"use client";

import type { TableFillColumn, TableFillRow, TableFillInputDef } from "@/lib/quiz/schemas";
import type { TableFillInputResult } from "@/lib/ai/deterministic-scorer";

interface Props {
  columns: TableFillColumn[];
  rows: TableFillRow[];
  inputs: TableFillInputDef[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  disabled?: boolean;
  submitted?: boolean;
  inputResults?: TableFillInputResult[];
}

export function TableFillInput({
  columns,
  rows,
  inputs,
  values,
  onChange,
  disabled,
  submitted,
  inputResults,
}: Props) {
  const resultMap = new Map(inputResults?.map((r) => [r.inputId, r]) ?? []);
  const inputMap = new Map(inputs.map((i) => [i.id, i]));

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Uzupełnij puste komórki tabeli.
      </p>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-sm font-mono border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map((col) => (
                <th
                  key={col.id}
                  className="px-4 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap"
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr
                key={row.id}
                className={rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/60"}
              >
                {columns.map((col) => {
                  const cell = row.cells[col.id];
                  if (!cell) {
                    return (
                      <td key={col.id} className="px-4 py-2 border-t border-gray-100 text-gray-400 italic">
                        —
                      </td>
                    );
                  }

                  if (cell.kind === "static") {
                    return (
                      <td key={col.id} className="px-4 py-2 border-t border-gray-100 text-gray-800">
                        {cell.value}
                      </td>
                    );
                  }

                  // input cell
                  const inputId = cell.inputId;
                  const inputDef = inputMap.get(inputId);
                  const result = resultMap.get(inputId);
                  const value = values[inputId] ?? "";

                  let cellClass = "bg-blue-50 border-blue-200";
                  let inputClass =
                    "border border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 bg-white text-gray-900 placeholder-gray-400";

                  if (submitted && result) {
                    if (result.isCorrect) {
                      cellClass = "bg-green-50 border-green-200";
                      inputClass = "border border-green-400 bg-green-50 text-green-800 cursor-not-allowed";
                    } else {
                      cellClass = "bg-red-50 border-red-200";
                      inputClass = "border border-red-400 bg-red-50 text-red-800 cursor-not-allowed";
                    }
                  }

                  return (
                    <td
                      key={col.id}
                      className={`px-2 py-1.5 border-t border-gray-100 ${cellClass}`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <input
                          type={inputDef?.answerType === "numeric" ? "text" : "text"}
                          inputMode={inputDef?.answerType === "numeric" ? "decimal" : "text"}
                          value={value}
                          onChange={(e) => onChange(inputId, e.target.value)}
                          disabled={disabled}
                          placeholder={inputDef?.placeholder ?? ""}
                          spellCheck={false}
                          autoComplete="off"
                          aria-label={`Komórka: ${inputId}`}
                          className={`w-full min-w-[6rem] px-2 py-1 text-sm font-mono rounded transition-colors outline-none ${inputClass}`}
                        />
                        {/* Show correct answer below wrong cell after submission */}
                        {submitted && result && !result.isCorrect && (
                          <span className="text-xs text-green-700 font-mono mt-0.5">
                            ✓ {result.correctAnswer}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Per-input summary strip after submission */}
      {submitted && inputResults && inputResults.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm bg-white border border-gray-200 rounded-lg px-4 py-2.5">
          <span className="font-medium text-gray-600 mr-1">Komórki:</span>
          {inputResults.map((r) => (
            <span
              key={r.inputId}
              title={
                r.isCorrect
                  ? "Poprawnie"
                  : `Poprawna odpowiedź: ${r.correctAnswer}`
              }
              className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-mono ${
                r.isCorrect
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {r.isCorrect ? "✓" : "✗"} {r.inputId}
            </span>
          ))}
          <span className="ml-auto text-gray-500 text-xs">
            {inputResults.filter((r) => r.isCorrect).length} /{" "}
            {inputResults.length} poprawnie
          </span>
        </div>
      )}
    </div>
  );
}
