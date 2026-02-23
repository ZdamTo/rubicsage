"use client";

import { useState, useRef, useCallback } from "react";

interface PyodideInstance {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdin: (opts: { stdin: () => string }) => void;
  setStdout: (opts: { batched: (text: string) => void }) => void;
  setStderr: (opts: { batched: (text: string) => void }) => void;
}

export interface TestCase {
  name: string;
  stdin: string;
  expectedStdout: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  error?: string;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  error?: string;
}

declare global {
  interface Window {
    loadPyodide?: () => Promise<PyodideInstance>;
  }
}

export function usePyodide() {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const pyodideRef = useRef<PyodideInstance | null>(null);

  const loadPyodide = useCallback(async () => {
    if (pyodideRef.current) {
      setReady(true);
      return;
    }
    setLoading(true);

    // Load Pyodide script if not already loaded
    if (!window.loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Pyodide"));
        document.head.appendChild(script);
      });
    }

    pyodideRef.current = await window.loadPyodide!();
    setReady(true);
    setLoading(false);
  }, []);

  const runCode = useCallback(
    async (code: string, stdin: string = ""): Promise<RunResult> => {
      if (!pyodideRef.current) {
        return { stdout: "", stderr: "", error: "Pyodide not loaded" };
      }

      let stdout = "";
      let stderr = "";
      const stdinLines = stdin.split("\n");
      let stdinIndex = 0;

      pyodideRef.current.setStdin({
        stdin: () => {
          if (stdinIndex < stdinLines.length) {
            return stdinLines[stdinIndex++];
          }
          return "";
        },
      });
      pyodideRef.current.setStdout({
        batched: (text: string) => {
          stdout += text;
        },
      });
      pyodideRef.current.setStderr({
        batched: (text: string) => {
          stderr += text;
        },
      });

      try {
        // Timeout: 10 seconds
        await Promise.race([
          pyodideRef.current.runPythonAsync(code),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Execution timeout (10s)")), 10000)
          ),
        ]);
        return { stdout: stdout.trim(), stderr: stderr.trim() };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return { stdout: stdout.trim(), stderr: stderr.trim(), error: errMsg };
      }
    },
    []
  );

  const runTests = useCallback(
    async (code: string, tests: TestCase[]): Promise<TestResult[]> => {
      const results: TestResult[] = [];
      for (const test of tests) {
        const result = await runCode(code, test.stdin);
        const actual = result.stdout.trim();
        const expected = test.expectedStdout.trim();
        results.push({
          name: test.name,
          passed: actual === expected && !result.error,
          expected,
          actual,
          error: result.error || result.stderr || undefined,
        });
      }
      return results;
    },
    [runCode]
  );

  return { loadPyodide, loading, ready, runCode, runTests };
}
