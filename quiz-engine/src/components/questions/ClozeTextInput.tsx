"use client";

import type { ClozeBlank } from "@/lib/quiz/schemas";
import type { ClozeBlankResult } from "@/lib/ai/deterministic-scorer";

interface Props {
  template: string;
  blanks: ClozeBlank[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  disabled?: boolean;
  submitted?: boolean;
  /** Per-blank results injected after grading so we can colour the inputs. */
  blankResults?: ClozeBlankResult[];
}

/**
 * Splits the template string into alternating text/blank segments.
 * "SELECT {{col}} FROM {{tbl}}" →
 *   [ { text: "SELECT " }, { blank: "col" }, { text: " FROM " }, { blank: "tbl" } ]
 */
function parseTemplate(
  template: string
): Array<{ kind: "text"; value: string } | { kind: "blank"; id: string }> {
  const segments: Array<{ kind: "text"; value: string } | { kind: "blank"; id: string }> = [];
  const re = /\{\{(\w+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(template)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: "text", value: template.slice(lastIndex, match.index) });
    }
    segments.push({ kind: "blank", id: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < template.length) {
    segments.push({ kind: "text", value: template.slice(lastIndex) });
  }
  return segments;
}

export function ClozeTextInput({
  template,
  blanks,
  values,
  onChange,
  disabled,
  submitted,
  blankResults,
}: Props) {
  const segments = parseTemplate(template);
  const resultMap = new Map(blankResults?.map((r) => [r.blankId, r]) ?? []);
  const blankMap = new Map(blanks.map((b) => [b.id, b]));

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Uzupełnij luki w poniższym tekście:
      </p>

      {/* Inline template with inputs */}
      <div className="font-mono text-base leading-relaxed bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-wrap items-baseline gap-y-2">
        {segments.map((seg, i) => {
          if (seg.kind === "text") {
            return (
              <span key={i} className="whitespace-pre-wrap">
                {seg.value}
              </span>
            );
          }

          const blank = blankMap.get(seg.id);
          const result = resultMap.get(seg.id);
          const value = values[seg.id] ?? "";

          // Width heuristic: base on correctAnswer length
          const answerLen = blank?.correctAnswer?.length ?? 6;
          const widthCh = Math.max(6, answerLen + 2);

          let borderClass = "border-gray-400 focus:border-blue-500 focus:ring-blue-200";
          if (submitted && result) {
            borderClass = result.isCorrect
              ? "border-green-500 bg-green-50 text-green-800"
              : "border-red-400 bg-red-50 text-red-800";
          }

          return (
            <span key={i} className="inline-flex flex-col items-center mx-0.5">
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(seg.id, e.target.value)}
                disabled={disabled}
                title={`Luka: ${seg.id}`}
                style={{ width: `${widthCh}ch` }}
                className={`border-b-2 border-x-0 border-t-0 bg-transparent px-1 py-0 text-center text-base outline-none focus:ring-2 rounded-sm transition-colors ${borderClass} disabled:cursor-not-allowed`}
              />
              {/* Show correct answer below wrong blanks after submission */}
              {submitted && result && !result.isCorrect && (
                <span className="text-xs text-green-700 mt-0.5">
                  ✓ {result.correctAnswer}
                </span>
              )}
              {/* Points badge */}
              {blank && blank.points !== undefined && blank.points !== 1 && (
                <span className="text-xs text-gray-400">({blank.points}p)</span>
              )}
            </span>
          );
        })}
      </div>

      {/* Score summary after submission */}
      {submitted && blankResults && blankResults.length > 0 && (
        <div className="text-sm text-gray-600 bg-white border border-gray-200 rounded-lg px-4 py-3">
          <span className="font-medium">Wynik:</span>{" "}
          {blankResults.filter((r) => r.isCorrect).length} / {blankResults.length} luk
          poprawnie
        </div>
      )}
    </div>
  );
}
