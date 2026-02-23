import { NextRequest, NextResponse } from "next/server";
import { GradeRequest, GradeResult } from "@/lib/quiz/schemas";
import { getClient } from "@/lib/ai/provider-factory";
import {
  scoreSingleChoice,
  scoreMultiChoice,
  scoreNumeric,
  scoreCodeTests,
} from "@/lib/ai/deterministic-scorer";
import {
  buildObjectiveFeedbackPrompt,
  buildRubricScoringPrompt,
} from "@/lib/ai/prompts";
import type { GradePayload } from "@/lib/ai/types";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = GradeRequest.parse(body);
    const { question, userAnswer, attachments, aiSettings } = parsed;
    const q = question;

    // Load rubric file if referenced
    let rubricText = q.rubric || "";
    if (q.rubricFile) {
      try {
        const rubricPath = path.join(process.cwd(), q.rubricFile);
        rubricText = fs.readFileSync(rubricPath, "utf-8");
      } catch {
        // Rubric file not found — use inline rubric if available
      }
    }

    const payload: GradePayload = {
      questionType: q.type,
      promptMarkdown: q.promptMarkdown,
      maxScore: q.maxScore,
      userAnswer: typeof userAnswer === "string" ? userAnswer : JSON.stringify(userAnswer),
      rubric: rubricText,
      expectedKeyPoints: q.expectedKeyPoints,
      correctAnswer: q.correctAnswer?.toString(),
      attachments,
    };

    let result: GradeResult;

    switch (q.type) {
      case "single_choice": {
        const det = scoreSingleChoice(userAnswer, q.correctAnswer, q.maxScore);
        payload.correctAnswer = q.correctAnswer;
        // Get AI explanation feedback
        const client = getClient(aiSettings.provider);
        const prompt = buildObjectiveFeedbackPrompt(payload, det.score);
        const aiResult = await client.grade(
          { ...payload, userAnswer: `Selected: ${userAnswer}` },
          aiSettings
        );
        result = { ...aiResult, score: det.score, maxScore: det.maxScore, confidence: 1.0 };
        break;
      }

      case "multi_choice": {
        const answers = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
        const det = scoreMultiChoice(answers, q.correctAnswers, q.maxScore);
        const client = getClient(aiSettings.provider);
        const aiResult = await client.grade(
          { ...payload, userAnswer: `Selected: ${answers.join(", ")}`, correctAnswer: q.correctAnswers.join(", ") },
          aiSettings
        );
        result = { ...aiResult, score: det.score, maxScore: det.maxScore, confidence: 1.0 };
        break;
      }

      case "numeric": {
        const det = scoreNumeric(userAnswer, q.correctAnswer, q.tolerance || 0, q.maxScore);
        const client = getClient(aiSettings.provider);
        const aiResult = await client.grade(
          { ...payload, correctAnswer: q.correctAnswer.toString() },
          aiSettings
        );
        result = { ...aiResult, score: det.score, maxScore: det.maxScore, confidence: 1.0 };
        break;
      }

      case "code_python": {
        // Score from test report
        const testReport = attachments?.testReport as Array<{ name: string; passed: boolean; expected?: string; actual?: string }> || [];
        const det = scoreCodeTests(testReport, q.maxScore);
        // Get AI feedback on code quality + failures
        const client = getClient(aiSettings.provider);
        const aiResult = await client.grade(payload, aiSettings);
        result = {
          ...aiResult,
          score: det.score,
          maxScore: det.maxScore,
          confidence: det.isCorrect ? 1.0 : aiResult.confidence,
        };
        break;
      }

      case "short_text":
      case "math_open_with_work":
      case "polish_essay": {
        // Full AI grading
        const client = getClient(aiSettings.provider);
        result = await client.grade(payload, aiSettings);
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown question type: ${q.type}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Grading error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        score: 0,
        maxScore: 0,
        feedback: {
          summary: `Grading failed: ${message}`,
          strengths: [],
          issues: [message],
          nextSteps: ["Check your API keys in .env and try again."],
        },
        confidence: 0,
        modelUsed: "error",
      },
      { status: 500 }
    );
  }
}
