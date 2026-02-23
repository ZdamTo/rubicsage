import { describe, it, expect } from "vitest";
import {
  scoreSingleChoice,
  scoreMultiChoice,
  scoreNumeric,
  scoreCodeTests,
} from "@/lib/ai/deterministic-scorer";

describe("scoreSingleChoice", () => {
  it("scores correct answer", () => {
    const result = scoreSingleChoice("B", "B", 1);
    expect(result.score).toBe(1);
    expect(result.isCorrect).toBe(true);
  });

  it("scores incorrect answer", () => {
    const result = scoreSingleChoice("A", "B", 1);
    expect(result.score).toBe(0);
    expect(result.isCorrect).toBe(false);
  });

  it("is case insensitive", () => {
    const result = scoreSingleChoice("b", "B", 1);
    expect(result.score).toBe(1);
    expect(result.isCorrect).toBe(true);
  });

  it("trims whitespace", () => {
    const result = scoreSingleChoice(" B ", "B", 1);
    expect(result.score).toBe(1);
  });
});

describe("scoreMultiChoice", () => {
  it("scores exact match", () => {
    const result = scoreMultiChoice(["A", "C"], ["A", "C"], 2);
    expect(result.score).toBe(2);
    expect(result.isCorrect).toBe(true);
  });

  it("fails on partial match", () => {
    const result = scoreMultiChoice(["A"], ["A", "C"], 2);
    expect(result.score).toBe(0);
    expect(result.isCorrect).toBe(false);
  });

  it("fails on over-selection", () => {
    const result = scoreMultiChoice(["A", "B", "C"], ["A", "C"], 2);
    expect(result.score).toBe(0);
    expect(result.isCorrect).toBe(false);
  });

  it("is order independent", () => {
    const result = scoreMultiChoice(["C", "A"], ["A", "C"], 2);
    expect(result.score).toBe(2);
    expect(result.isCorrect).toBe(true);
  });
});

describe("scoreNumeric", () => {
  it("scores exact match", () => {
    const result = scoreNumeric("42", 42, 0, 1);
    expect(result.score).toBe(1);
    expect(result.isCorrect).toBe(true);
  });

  it("scores within tolerance", () => {
    const result = scoreNumeric("3.14", 3.14159, 0.01, 1);
    expect(result.score).toBe(1);
  });

  it("fails outside tolerance", () => {
    const result = scoreNumeric("3.0", 3.14159, 0.01, 1);
    expect(result.score).toBe(0);
  });

  it("handles comma decimal separator", () => {
    const result = scoreNumeric("3,14", 3.14, 0.01, 1);
    expect(result.score).toBe(1);
  });

  it("handles non-numeric input", () => {
    const result = scoreNumeric("abc", 42, 0, 1);
    expect(result.score).toBe(0);
    expect(result.isCorrect).toBe(false);
  });
});

describe("scoreCodeTests", () => {
  it("scores all passing tests", () => {
    const tests = [
      { name: "t1", passed: true },
      { name: "t2", passed: true },
      { name: "t3", passed: true },
    ];
    const result = scoreCodeTests(tests, 3);
    expect(result.score).toBe(3);
    expect(result.isCorrect).toBe(true);
  });

  it("scores partial passing tests", () => {
    const tests = [
      { name: "t1", passed: true },
      { name: "t2", passed: false },
      { name: "t3", passed: true },
    ];
    const result = scoreCodeTests(tests, 3);
    expect(result.score).toBe(2);
    expect(result.isCorrect).toBe(false);
  });

  it("scores zero tests passed", () => {
    const tests = [
      { name: "t1", passed: false },
      { name: "t2", passed: false },
    ];
    const result = scoreCodeTests(tests, 4);
    expect(result.score).toBe(0);
    expect(result.isCorrect).toBe(false);
  });

  it("handles empty test array", () => {
    const result = scoreCodeTests([], 3);
    expect(result.score).toBe(0);
    expect(result.isCorrect).toBe(false);
  });
});
