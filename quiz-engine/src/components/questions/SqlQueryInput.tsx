"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
        Loading editor…
      </div>
    ),
  }
);

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  schemaMarkdown?: string;
  seedData?: string;
  dialect?: string;
  disabled?: boolean;
}

export function SqlQueryInput({
  query,
  onQueryChange,
  schemaMarkdown,
  seedData,
  dialect = "sql",
  disabled,
}: Props) {
  const [schemaOpen, setSchemaOpen] = useState(true);
  const [seedOpen, setSeedOpen] = useState(false);

  return (
    <div className="space-y-3">
      {/* Schema viewer */}
      {schemaMarkdown && (
        <div className="border border-blue-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setSchemaOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 text-sm font-medium text-blue-800 hover:bg-blue-100 transition-colors"
          >
            <span>📋 Schemat bazy danych</span>
            <svg
              className={`w-4 h-4 transition-transform ${schemaOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {schemaOpen && (
            <div className="px-4 py-3 text-sm bg-white max-h-64 overflow-y-auto">
              <MarkdownRenderer content={schemaMarkdown} />
            </div>
          )}
        </div>
      )}

      {/* Seed data viewer */}
      {seedData && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setSeedOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <span>🌱 Dane testowe (INSERT)</span>
            <svg
              className={`w-4 h-4 transition-transform ${seedOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {seedOpen && (
            <pre className="px-4 py-3 text-xs font-mono bg-gray-900 text-green-400 max-h-48 overflow-y-auto whitespace-pre-wrap">
              {seedData}
            </pre>
          )}
        </div>
      )}

      {/* Dialect badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
          {dialect.toUpperCase()}
        </span>
        <span className="text-xs text-gray-500">
          Wpisz zapytanie SQL poniżej
        </span>
      </div>

      {/* SQL editor */}
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <MonacoEditor
          height="220px"
          language="sql"
          theme="vs-dark"
          value={query}
          onChange={(v) => onQueryChange(v ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            readOnly: disabled,
            wordWrap: "on",
          }}
        />
      </div>
    </div>
  );
}
