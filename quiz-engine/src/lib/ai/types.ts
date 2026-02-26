import { GradeResult, AISettings } from "@/lib/quiz/schemas";

export interface GradePayload {
  questionType: string;
  promptMarkdown: string;
  maxScore: number;
  userAnswer: string;
  rubric?: string;
  expectedKeyPoints?: string[];
  correctAnswer?: string;
  attachments?: {
    imageBase64?: string;
    code?: string;
    stdout?: string;
    stderr?: string;
    testReport?: unknown;
  };
  /** DB-sourced system prompt override (from grading_criteria table) */
  systemPromptOverride?: string;
}

export interface LLMClient {
  grade(payload: GradePayload, settings: AISettings): Promise<GradeResult>;
}

export const GRADE_JSON_SCHEMA = `{
  "score": <number>,
  "maxScore": <number>,
  "rubricBreakdown": [
    {
      "criterion": "<string>",
      "points": <number>,
      "maxPoints": <number>,
      "rationale": "<string>"
    }
  ],
  "feedback": {
    "summary": "<string>",
    "strengths": ["<string>"],
    "issues": ["<string>"],
    "nextSteps": ["<string>"]
  },
  "confidence": <number 0..1>
}`;
