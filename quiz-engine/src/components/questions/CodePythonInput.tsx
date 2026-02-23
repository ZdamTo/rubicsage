"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { usePyodide, TestCase, TestResult } from "@/hooks/usePyodide";

// Lazy-load Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react").then(m => m.default), {
  ssr: false,
  loading: () => <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">Loading editor...</div>,
});

interface Props {
  code: string;
  onCodeChange: (code: string) => void;
  stdin: string;
  onStdinChange: (stdin: string) => void;
  tests: TestCase[];
  hiddenTests?: TestCase[];
  onTestResults: (results: TestResult[], stdout: string, stderr: string) => void;
  testResults: TestResult[];
  lastStdout: string;
  lastStderr: string;
  disabled?: boolean;
}

export function CodePythonInput({
  code,
  onCodeChange,
  stdin,
  onStdinChange,
  tests,
  hiddenTests = [],
  onTestResults,
  testResults,
  lastStdout,
  lastStderr,
  disabled,
}: Props) {
  const { loadPyodide, loading: pyLoading, ready, runCode, runTests } = usePyodide();
  const [running, setRunning] = useState(false);

  const handleRun = useCallback(async () => {
    if (!ready) await loadPyodide();
    setRunning(true);
    const result = await runCode(code, stdin);
    // Just update stdout/stderr for manual run, no test results
    onTestResults([], result.stdout, result.stderr + (result.error ? `\n${result.error}` : ""));
    setRunning(false);
  }, [code, stdin, ready, loadPyodide, runCode, onTestResults]);

  const handleRunTests = useCallback(async () => {
    if (!ready) await loadPyodide();
    setRunning(true);
    const allTests = [...tests, ...(hiddenTests || [])];
    const results = await runTests(code, allTests);
    // Also run once with blank stdin to get general stdout
    const generalRun = await runCode(code, tests[0]?.stdin || "");
    onTestResults(results, generalRun.stdout, generalRun.stderr);
    setRunning(false);
  }, [code, tests, hiddenTests, ready, loadPyodide, runTests, runCode, onTestResults]);

  return (
    <div className="space-y-3">
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        <MonacoEditor
          height="280px"
          language="python"
          theme="vs-dark"
          value={code}
          onChange={(v) => onCodeChange(v || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            readOnly: disabled,
          }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          stdin (input)
        </label>
        <textarea
          value={stdin}
          onChange={(e) => onStdinChange(e.target.value)}
          disabled={disabled}
          rows={3}
          placeholder="Dane wejściowe..."
          className="w-full border border-gray-300 rounded-lg p-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 resize-y"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleRun}
          disabled={running || disabled}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {running ? "Running..." : pyLoading ? "Loading Pyodide..." : "Run"}
        </button>
        <button
          onClick={handleRunTests}
          disabled={running || disabled}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {running ? "Testing..." : "Run Tests"}
        </button>
      </div>

      {/* Console output */}
      {(lastStdout || lastStderr) && (
        <div className="bg-gray-900 text-gray-100 rounded-lg p-3 text-sm font-mono max-h-40 overflow-y-auto">
          {lastStdout && <pre className="text-green-400">{lastStdout}</pre>}
          {lastStderr && <pre className="text-red-400">{lastStderr}</pre>}
        </div>
      )}

      {/* Test results */}
      {testResults.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-gray-700">
            Test Results: {testResults.filter((t) => t.passed).length}/{testResults.length} passed
          </h4>
          {testResults.map((t, i) => (
            <div
              key={i}
              className={`text-xs font-mono p-2 rounded ${
                t.passed ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
              }`}
            >
              <span className="font-bold">{t.passed ? "PASS" : "FAIL"}</span>{" "}
              {t.name}
              {!t.passed && (
                <div className="mt-1">
                  Expected: <code>{t.expected}</code> | Got: <code>{t.actual}</code>
                  {t.error && <div className="text-red-600">Error: {t.error}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
