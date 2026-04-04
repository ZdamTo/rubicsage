"use client";

import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import type { ExpectedOutput } from "@/lib/quiz/schemas";

const OUTPUT_TYPE_ICONS: Record<string, string> = {
  formula: "ƒ",
  value: "123",
  range: "⊞",
  chart: "📊",
  summary: "Σ",
};

const OUTPUT_TYPE_LABELS: Record<string, string> = {
  formula: "Formuła",
  value: "Wartość",
  range: "Zakres",
  chart: "Wykres",
  summary: "Podsumowanie",
};

interface Props {
  sourceDataDescription: string;
  expectedOutputs: ExpectedOutput[];
  requiredChart?: { type: string; description: string };
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  disabled?: boolean;
}

export function SpreadsheetTaskInput({
  sourceDataDescription,
  expectedOutputs,
  requiredChart,
  values,
  onChange,
  disabled,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Source data */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-xs font-semibold text-green-800 uppercase mb-2 tracking-wide">
          📊 Dane źródłowe
        </p>
        <div className="text-sm">
          <MarkdownRenderer content={sourceDataDescription} />
        </div>
      </div>

      {/* Required chart note */}
      {requiredChart && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
          <span className="font-semibold">Wymagany wykres:</span> {requiredChart.type} —{" "}
          {requiredChart.description}
        </div>
      )}

      {/* Output fields */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">
          Uzupełnij poniższe pola zgodnie z poleceniem:
        </p>
        {expectedOutputs.map((output) => (
          <div key={output.id} className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {OUTPUT_TYPE_ICONS[output.type] ?? output.type}
              </span>
              <span className="text-xs text-gray-500 uppercase tracking-wide">
                {OUTPUT_TYPE_LABELS[output.type] ?? output.type}
              </span>
              <span className="text-sm font-semibold text-gray-800">{output.label}</span>
            </div>
            <p className="text-sm text-gray-600 mb-2">{output.description}</p>
            <textarea
              value={values[output.id] ?? ""}
              onChange={(e) => onChange(output.id, e.target.value)}
              disabled={disabled}
              rows={output.type === "chart" || output.type === "summary" ? 3 : 2}
              placeholder={
                output.type === "formula"
                  ? "Wpisz formułę, np. =SUMA.JEŻELI(A2:A10,\">\",50)"
                  : output.type === "chart"
                  ? "Opisz wykres (typ, zakres danych, tytuł, osie...)"
                  : output.type === "range"
                  ? "Podaj zakres komórek, np. A2:D15"
                  : "Wpisz swoją odpowiedź..."
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 resize-y"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
