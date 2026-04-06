"use client";

import type { ClozeBlank } from "@/lib/quiz/schemas";
import type { ClozeBlankResult } from "@/lib/ai/deterministic-scorer";

type Segment = { kind: "text"; value: string } | { kind: "blank"; id: string };

/** Parse one line into alternating text / blank segments. */
function parseLine(line: string): Segment[] {
  const segments: Segment[] = [];
  const re = /\{\{(\w+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: "text", value: line.slice(lastIndex, match.index) });
    }
    segments.push({ kind: "blank", id: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    segments.push({ kind: "text", value: line.slice(lastIndex) });
  }
  return segments;
}

/**
 * Heuristic: does the template contain markdown table rows (| cell | cell |)?
 * If so the author should use a future `table_fill` type instead.
 */
function isTableLike(template: string): boolean {
  return template.split("\n").some((line) => /^\s*\|.+\|\s*$/.test(line));
}

interface Props {
  template: string;
  blanks: ClozeBlank[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  disabled?: boolean;
  submitted?: boolean;
  /** Per-blank results injected after grading for inline colour feedback. */
  blankResults?: ClozeBlankResult[];
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
  const lines = template.split("\n");
  const resultMap = new Map(blankResults?.map((r) => [r.blankId, r]) ?? []);
  const blankMap = new Map(blanks.map((b) => [b.id, b]));
  const tableLike = isTableLike(template);

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Uzupełnij luki — wpisz brakujące słowa kluczowe lub wyrażenia.
      </p>

      {/* Author warning: markdown tables belong in a future table_fill type */}
      {tableLike && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-3 text-sm text-yellow-800">
          <span className="font-semibold">Uwaga dla autora:</span> szablon zawiera
          składnię tabelaryczną Markdown. Typ <code className="font-mono">cloze_text</code>{" "}
          jest przeznaczony do tekstu ciągłego, formuł i krótkich fragmentów kodu.
          Do zadań tabelarycznych użyj przyszłego typu{" "}
          <code className="font-mono">table_fill</code>.
        </div>
      )}

      {/* ── Template body ───────────────────────────────────────────────── */}
      <div className="font-mono text-sm bg-gray-900 text-gray-100 rounded-xl px-5 py-4 leading-[1.9] overflow-x-auto cursor-text">
        {lines.map((line, lineIdx) => {
          const segments = parseLine(line);

          // Blank line → vertical spacer
          const isBlank =
            segments.length === 0 ||
            (segments.length === 1 &&
              segments[0].kind === "text" &&
              segments[0].value.trim() === "");
          if (isBlank) {
            return <div key={lineIdx} className="h-2" aria-hidden />;
          }

          return (
            /* One flex row per template line. items-end so correction labels
               below wrong inputs don't push the text baseline up. */
            <div
              key={lineIdx}
              className="flex flex-wrap items-end"
            >
              {segments.map((seg, segIdx) => {
                if (seg.kind === "text") {
                  return (
                    // whitespace-pre preserves leading spaces (pseudocode indents)
                    <span key={segIdx} className="whitespace-pre">
                      {seg.value}
                    </span>
                  );
                }

                /* ── Blank input ── */
                const blank = blankMap.get(seg.id);
                const result = resultMap.get(seg.id);
                const value = values[seg.id] ?? "";
                const answerLen = blank?.correctAnswer?.length ?? 5;
                // width: at least 5ch, correct-answer length + 2 padding chars
                const widthCh = Math.max(5, answerLen + 2);

                // Colour states
                let wrapClass = "";
                let inputClass =
                  "border-b-2 border-blue-400 text-blue-100 bg-white/10 placeholder-blue-700 " +
                  "focus:border-blue-300 focus:bg-white/15 focus:ring-0 focus:outline-none cursor-text";
                if (submitted && result) {
                  if (result.isCorrect) {
                    wrapClass = "";
                    inputClass =
                      "border-b-2 border-green-400 text-green-300 bg-green-950/40 cursor-not-allowed";
                  } else {
                    wrapClass = "";
                    inputClass =
                      "border-b-2 border-red-400 text-red-300 bg-red-950/40 cursor-not-allowed";
                  }
                }

                const hasNonDefaultPoints =
                  blank?.points !== undefined && blank.points !== 1;

                return (
                  <span
                    key={segIdx}
                    className={`inline-flex flex-col items-center mx-0.5 ${wrapClass}`}
                  >
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => onChange(seg.id, e.target.value)}
                      disabled={disabled}
                      spellCheck={false}
                      autoCapitalize="off"
                      autoComplete="off"
                      aria-label={`Luka: ${seg.id}`}
                      style={{ width: `${widthCh}ch` }}
                      className={
                        `bg-transparent text-center px-1 py-0 text-sm font-mono ` +
                        `rounded-sm transition-colors disabled:cursor-not-allowed ` +
                        inputClass
                      }
                    />

                    {/* Correct answer revealed below wrong blank after submit */}
                    {submitted && result && !result.isCorrect && (
                      <span className="text-xs text-green-400 mt-0.5 whitespace-nowrap leading-none">
                        ✓&nbsp;{result.correctAnswer}
                      </span>
                    )}

                    {/* Non-default point value badge */}
                    {hasNonDefaultPoints && (
                      <span className="text-xs text-gray-600 mt-0.5 leading-none">
                        {blank!.points}p
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Per-blank summary strip after submission ─────────────────────── */}
      {submitted && blankResults && blankResults.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm bg-white border border-gray-200 rounded-lg px-4 py-2.5">
          <span className="font-medium text-gray-600 mr-1">Luki:</span>
          {blankResults.map((r) => (
            <span
              key={r.blankId}
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
              {r.isCorrect ? "✓" : "✗"} {r.blankId}
            </span>
          ))}
          <span className="ml-auto text-gray-500 text-xs">
            {blankResults.filter((r) => r.isCorrect).length} /{" "}
            {blankResults.length} poprawnie
          </span>
        </div>
      )}
    </div>
  );
}
