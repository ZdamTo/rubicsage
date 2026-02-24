import { NextRequest, NextResponse } from "next/server";
import { GradeRequest, GradeResult } from "@/lib/quiz/schemas";
import { getClient } from "@/lib/ai/provider-factory";
import {
  scoreSingleChoice,
  scoreMultiChoice,
  scoreNumeric,
  scoreCodeTests,
} from "@/lib/ai/deterministic-scorer";
import { buildObjectiveFeedbackPrompt } from "@/lib/ai/prompts";
import type { GradePayload } from "@/lib/ai/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";

// Basic in-memory per-user rate limiter (resets on cold start; good enough for prototype)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 grading calls per minute per user

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  // ── Auth check ────────────────────────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userId: string | null = null;
  let attemptId: string | null = null;

  if (user) {
    // Check banned status
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .single();

    if (profile?.status === "banned") {
      return NextResponse.json({ error: "Account banned" }, { status: 403 });
    }

    userId = user.id;

    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in a minute." },
        { status: 429 }
      );
    }
  }

  try {
    const body = await req.json();
    const parsed = GradeRequest.parse(body);
    const { question, userAnswer, attachments, aiSettings } = parsed;

    // Optional: persist answer if attemptId provided
    attemptId = body.attemptId ?? null;

    const q = question;

    // Load rubric file if referenced
    let rubricText = q.rubric || "";
    if (q.rubricFile) {
      try {
        const rubricPath = path.join(process.cwd(), q.rubricFile);
        rubricText = fs.readFileSync(rubricPath, "utf-8");
      } catch {
        // Rubric file not found – use inline rubric
      }
    }

    const payload: GradePayload = {
      questionType: q.type,
      promptMarkdown: q.promptMarkdown,
      maxScore: q.maxScore,
      userAnswer: typeof userAnswer === "string" ? userAnswer : JSON.stringify(userAnswer),
      rubric: rubricText,
      expectedKeyPoints: (q as { expectedKeyPoints?: string[] }).expectedKeyPoints,
      correctAnswer: (q as { correctAnswer?: string | number }).correctAnswer?.toString(),
      attachments,
    };

    let result: GradeResult;

    switch (q.type) {
      case "single_choice": {
        const sc = q as { correctAnswer: string };
        const det = scoreSingleChoice(userAnswer, sc.correctAnswer, q.maxScore);
        payload.correctAnswer = sc.correctAnswer;
        const client = getClient(aiSettings.provider);
        const aiResult = await client.grade(
          { ...payload, userAnswer: `Selected: ${userAnswer}` },
          aiSettings
        );
        result = { ...aiResult, score: det.score, maxScore: det.maxScore, confidence: 1.0 };
        break;
      }

      case "multi_choice": {
        const mc = q as { correctAnswers: string[] };
        const answers = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
        const det = scoreMultiChoice(answers, mc.correctAnswers, q.maxScore);
        const client = getClient(aiSettings.provider);
        const aiResult = await client.grade(
          {
            ...payload,
            userAnswer: `Selected: ${answers.join(", ")}`,
            correctAnswer: mc.correctAnswers.join(", "),
          },
          aiSettings
        );
        result = { ...aiResult, score: det.score, maxScore: det.maxScore, confidence: 1.0 };
        break;
      }

      case "numeric": {
        const nq = q as { correctAnswer: number; tolerance?: number };
        const det = scoreNumeric(userAnswer, nq.correctAnswer, nq.tolerance ?? 0, q.maxScore);
        const client = getClient(aiSettings.provider);
        const aiResult = await client.grade(
          { ...payload, correctAnswer: nq.correctAnswer.toString() },
          aiSettings
        );
        result = { ...aiResult, score: det.score, maxScore: det.maxScore, confidence: 1.0 };
        break;
      }

      case "code_python": {
        const testReport =
          (attachments?.testReport as Array<{
            name: string;
            passed: boolean;
            expected?: string;
            actual?: string;
          }>) || [];
        const det = scoreCodeTests(testReport, q.maxScore);
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
        const client = getClient(aiSettings.provider);
        result = await client.grade(payload, aiSettings);
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown question type: ${(q as { type: string }).type}` },
          { status: 400 }
        );
    }

    // ── Persist answer to DB if user is authenticated and attemptId provided ──
    if (userId && attemptId) {
      const service = createServiceRoleClient();

      await service.from("attempt_answers").upsert(
        {
          attempt_id: attemptId,
          question_id: q.id,
          answer: JSON.parse(JSON.stringify({ value: userAnswer })),
          attachments: attachments ? JSON.parse(JSON.stringify(attachments)) : null,
          score: result.score,
          max_score: result.maxScore,
          feedback: JSON.parse(JSON.stringify(result.feedback)),
          graded_by_model: result.modelUsed,
        },
        { onConflict: "attempt_id,question_id" }
      );

      // Log practice after successful answer
      await service.rpc("log_practice_and_update_streak", {
        p_user_id: userId,
        p_source: "answer_submit",
      });
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
