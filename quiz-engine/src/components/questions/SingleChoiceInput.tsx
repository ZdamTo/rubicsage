"use client";

import { MarkdownRenderer } from "@/components/MarkdownRenderer";

interface Choice {
  id: string;
  text: string;
}

interface Props {
  choices: Choice[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  correctAnswer?: string;
  submitted?: boolean;
}

export function SingleChoiceInput({
  choices,
  value,
  onChange,
  disabled,
  correctAnswer,
  submitted,
}: Props) {
  return (
    <div className="space-y-2">
      {choices.map((choice) => {
        let borderClass = "border-gray-200";
        if (submitted && correctAnswer) {
          if (choice.id === correctAnswer) borderClass = "border-green-500 bg-green-50";
          else if (choice.id === value && choice.id !== correctAnswer)
            borderClass = "border-red-500 bg-red-50";
        } else if (choice.id === value) {
          borderClass = "border-blue-500 bg-blue-50";
        }

        return (
          <label
            key={choice.id}
            className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${borderClass} ${disabled ? "cursor-not-allowed opacity-75" : "hover:border-blue-300"}`}
          >
            <input
              type="radio"
              name="single-choice"
              value={choice.id}
              checked={value === choice.id}
              onChange={() => onChange(choice.id)}
              disabled={disabled}
              className="mt-1"
            />
            <span className="font-medium mr-2 text-gray-500">{choice.id}.</span>
            <span className="flex-1">
              <MarkdownRenderer content={choice.text} />
            </span>
          </label>
        );
      })}
    </div>
  );
}
