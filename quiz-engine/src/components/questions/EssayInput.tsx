"use client";

import { useMemo } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minWords?: number;
}

export function EssayInput({ value, onChange, disabled, minWords = 300 }: Props) {
  const wordCount = useMemo(() => {
    return value
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
  }, [value]);

  const meetsMinimum = wordCount >= minWords;

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Napisz swoją rozprawkę tutaj..."
        rows={16}
        className="w-full border border-gray-300 rounded-lg p-4 text-sm leading-relaxed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 resize-y"
      />
      <div className="flex items-center justify-between mt-2 text-sm">
        <span
          className={`font-medium ${
            meetsMinimum ? "text-green-600" : "text-orange-500"
          }`}
        >
          {wordCount} / {minWords} words
          {meetsMinimum ? " ✓" : " (minimum not met)"}
        </span>
        <span className="text-gray-400">{value.length} characters</span>
      </div>
    </div>
  );
}
