import { describe, it, expect } from "vitest";
import {
  Quiz,
  GradeResult,
  SingleChoiceQuestion,
  CodePythonQuestion,
  PolishEssayQuestion,
  AISettings,
} from "@/lib/quiz/schemas";

describe("Quiz schema", () => {
  it("validates a minimal quiz", () => {
    const quiz = {
      id: "test-1",
      title: "Test Quiz",
      subject: "Test",
      subjectSlug: "test",
      version: "1.0",
      questions: [
        {
          id: "q1",
          type: "single_choice",
          promptMarkdown: "What is 2+2?",
          maxScore: 1,
          grading: { mode: "deterministic" },
          choices: [
            { id: "A", text: "3" },
            { id: "B", text: "4" },
          ],
          correctAnswer: "B",
        },
      ],
    };
    expect(() => Quiz.parse(quiz)).not.toThrow();
  });

  it("rejects quiz with missing subject", () => {
    const quiz = {
      id: "test-1",
      title: "Test Quiz",
      version: "1.0",
      questions: [],
    };
    expect(() => Quiz.parse(quiz)).toThrow();
  });
});

describe("SingleChoiceQuestion schema", () => {
  it("validates correct structure", () => {
    const q = {
      id: "q1",
      type: "single_choice",
      promptMarkdown: "Pick one:",
      maxScore: 1,
      grading: { mode: "deterministic" },
      choices: [
        { id: "A", text: "Opt A" },
        { id: "B", text: "Opt B" },
      ],
      correctAnswer: "A",
    };
    expect(() => SingleChoiceQuestion.parse(q)).not.toThrow();
  });

  it("rejects missing correctAnswer", () => {
    const q = {
      id: "q1",
      type: "single_choice",
      promptMarkdown: "Pick one:",
      maxScore: 1,
      grading: { mode: "deterministic" },
      choices: [{ id: "A", text: "Opt A" }],
    };
    expect(() => SingleChoiceQuestion.parse(q)).toThrow();
  });
});

describe("CodePythonQuestion schema", () => {
  it("validates with tests", () => {
    const q = {
      id: "c1",
      type: "code_python",
      promptMarkdown: "Write code",
      maxScore: 3,
      grading: { mode: "hybrid" },
      starterCode: "# code",
      tests: [
        { name: "t1", stdin: "hello", expectedStdout: "hello" },
      ],
    };
    expect(() => CodePythonQuestion.parse(q)).not.toThrow();
  });
});

describe("PolishEssayQuestion schema", () => {
  it("validates essay question", () => {
    const q = {
      id: "e1",
      type: "polish_essay",
      promptMarkdown: "Write an essay",
      maxScore: 35,
      grading: { mode: "ai" },
      minWords: 300,
      rubricFile: "rubrics/test.md",
    };
    expect(() => PolishEssayQuestion.parse(q)).not.toThrow();
  });
});

describe("GradeResult schema", () => {
  it("validates correct result", () => {
    const result = {
      score: 5,
      maxScore: 10,
      feedback: {
        summary: "Good work",
        strengths: ["Clear argument"],
        issues: ["Minor errors"],
        nextSteps: ["Practice more"],
      },
      confidence: 0.85,
      modelUsed: "gpt-4o",
    };
    expect(() => GradeResult.parse(result)).not.toThrow();
  });

  it("rejects confidence > 1", () => {
    const result = {
      score: 5,
      maxScore: 10,
      feedback: {
        summary: "ok",
        strengths: [],
        issues: [],
        nextSteps: [],
      },
      confidence: 1.5,
      modelUsed: "gpt-4o",
    };
    expect(() => GradeResult.parse(result)).toThrow();
  });

  it("validates with rubric breakdown", () => {
    const result = {
      score: 20,
      maxScore: 35,
      rubricBreakdown: [
        {
          criterion: "Content",
          points: 12,
          maxPoints: 16,
          rationale: "Good references",
        },
      ],
      feedback: {
        summary: "Solid essay",
        strengths: ["Good structure"],
        issues: [],
        nextSteps: [],
      },
      confidence: 0.9,
      modelUsed: "claude-sonnet-4-5-20250929",
    };
    expect(() => GradeResult.parse(result)).not.toThrow();
  });
});

describe("AISettings schema", () => {
  it("validates openai settings", () => {
    const s = {
      provider: "openai",
      model: "gpt-4o",
      reasoningLevel: "medium",
      allowWeb: false,
    };
    expect(() => AISettings.parse(s)).not.toThrow();
  });

  it("rejects invalid provider", () => {
    const s = {
      provider: "invalid",
      model: "test",
    };
    expect(() => AISettings.parse(s)).toThrow();
  });
});
