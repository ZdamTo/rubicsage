"use client";

import { useRef } from "react";

interface Props {
  finalAnswer: string;
  reasoning: string;
  onFinalAnswerChange: (value: string) => void;
  onReasoningChange: (value: string) => void;
  onImageChange: (base64: string | null) => void;
  imagePreview: string | null;
  disabled?: boolean;
}

export function MathOpenInput({
  finalAnswer,
  reasoning,
  onFinalAnswerChange,
  onReasoningChange,
  onImageChange,
  imagePreview,
  disabled,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix to get pure base64
      const base64 = result.split(",")[1] || result;
      onImageChange(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Final Answer
        </label>
        <input
          type="text"
          value={finalAnswer}
          onChange={(e) => onFinalAnswerChange(e.target.value)}
          disabled={disabled}
          placeholder="Podaj odpowiedź końcową..."
          className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Reasoning / Work
        </label>
        <textarea
          value={reasoning}
          onChange={(e) => onReasoningChange(e.target.value)}
          disabled={disabled}
          placeholder="Zapisz swoje rozwiązanie krok po kroku..."
          rows={6}
          className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 resize-y"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Photo of handwritten work (optional)
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={disabled}
          className="text-sm"
        />
        {imagePreview && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${imagePreview}`}
              alt="Uploaded work"
              className="max-h-48 rounded border"
            />
            <button
              onClick={() => {
                onImageChange(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="text-sm text-red-500 mt-1"
              disabled={disabled}
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
