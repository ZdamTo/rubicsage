import { NextRequest, NextResponse } from "next/server";
import { GradeRequest, GradeResult } from "@/lib/quiz/schemas";
import type { SqlQueryQuestion, SpreadsheetTaskQuestion, ClozeTextQuestion, TableFillQuestion, TrueFalseGroupQuestion } from "@/lib/quiz/schemas";
import { getClient } from "@/lib/ai/provider-factory";
import {
  scoreSingleChoice,
  scoreMultiChoice,
  scoreNumeric,
  scoreCodeTests,
  scoreClozeText,
  scoreTableFill,
  scoreTrueFalseGroup,
} from "@/lib/ai/deterministic-scorer";
import {
  buildSqlContextAddendum,
  buildSpreadsheetContextAddendum,
  buildClozeResultSummary,
  buildTableFillResultSummary,
  buildTrueFalseResultSummary,
} from "@/lib/ai/prompts";
import type { GradePayload } from "@/lib/ai/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import fs from "fs";
import path from "path";

// ── In-memory per-user rate limiter ──────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

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

// ── Fetch grading criteria from DB ────────────────────────────────────────────
// Priority: (subject + question_type) > (subject + null) > ('global' + null)
interface GradingCriteria {
  system_prompt: string | null;
  rubric_template: string | null;
  grading_instructions: string | null;
}

async function fetchGradingCriteria(
  subject: string,
  questionType: string
): Promise<GradingCriteria> {
  const service = createServiceRoleClient();
  const { data } = await service
    .from("grading_criteria")
    .select("subject, question_type, system_prompt, rubric_template, grading_instructions")
    .eq("is_active", true)
    .in("subject", [subject, "global"] as Array<"polish" | "math" | "informatics" | "global">)
    .or(`question_type.is.null,question_type.eq.${questionType}`)
    .order("subject", { ascending: false })   // subject-specific before 'global'
    .order("question_type", { ascending: false, nullsFirst: false }); // typed before null

  // data is ordered: (subject+type) > (subject+null) > (global+null)
  const row = data?.[0] ?? null;
  return {
    system_prompt: row?.system_prompt ?? null,
    rubric_template: row?.rubric_template ?? null,
    grading_instructions: row?.grading_instructions ?? null,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userId: string | null = null;
  let attemptId: string | null = null;

  if (user) {
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

    attemptId = body.attemptId ?? null;
    // Subject passed from the client (quiz metadata); falls back to 'global'
    const quizSubject: string = body.quizSubject ?? "global";

    const q = question;

    // ── Load rubric: question-level first, then DB, then filesystem ──────────
    let rubricText: string = (q as { rubric?: string }).rubric ?? "";

    if (!rubricText && (q as { rubricFile?: string }).rubricFile) {
      // Legacy filesystem rubric (local dev / old quizzes)
      try {
        const rubricPath = path.join(process.cwd(), (q as { rubricFile: string }).rubricFile);
        rubricText = fs.readFileSync(rubricPath, "utf-8");
      } catch {
        // File not found – will fall through to DB criteria below
      }
    }

    // ── Fetch DB grading criteria for this subject + question type ───────────
    const criteria = await fetchGradingCriteria(quizSubject, q.type);

    // DB rubric_template fills in when question has no inline rubric
    if (!rubricText && criteria.rubric_template) {
      rubricText = criteria.rubric_template;
    }

    // Append subject-level grading instructions to the rubric
    if (criteria.grading_instructions) {
      rubricText = rubricText
        ? `${rubricText}\n\n---\n${criteria.grading_instructions}`
        : criteria.grading_instructions;
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
      // Pass DB system prompt so AI clients can use it
      systemPromptOverride: criteria.system_prompt ?? undefined,
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

      case "sql_query": {
        const sq = q as SqlQueryQuestion;
        const sqlContext = buildSqlContextAddendum(sq);
        const sqlRubric = rubricText
          ? `${rubricText}\n\n---\n${sqlContext}`
          : sqlContext;
        const client = getClient(aiSettings.provider);
        result = await client.grade({ ...payload, rubric: sqlRubric }, aiSettings);
        break;
      }

      case "spreadsheet_task": {
        const ss = q as SpreadsheetTaskQuestion;
        const ssContext = buildSpreadsheetContextAddendum(ss);
        const ssRubric = rubricText
          ? `${rubricText}\n\n---\n${ssContext}`
          : ssContext;
        const client = getClient(aiSettings.provider);
        result = await client.grade({ ...payload, rubric: ssRubric }, aiSettings);
        break;
      }

      case "cloze_text": {
        const ct = q as ClozeTextQuestion;
        let userAnswersParsed: Record<string, string> = {};
        try {
          userAnswersParsed = JSON.parse(
            typeof userAnswer === "string" ? userAnswer : JSON.stringify(userAnswer)
          );
        } catch {
          // fallback to empty answers
        }
        const det = scoreClozeText(userAnswersParsed, ct.blanks, q.maxScore);
        const clozeContext = buildClozeResultSummary(ct.blanks, det.blankResults);
        const clozeRubric = rubricText
          ? `${rubricText}\n\n---\n${clozeContext}`
          : clozeContext;
        const client = getClient(aiSettings.provider);
        const aiResult = await client.grade(
          {
            ...payload,
            rubric: clozeRubric,
            correctAnswer: ct.blanks.map((b) => `${b.id}=${b.correctAnswer}`).join(", "),
          },
          aiSettings
        );
        result = {
          ...aiResult,
          score: det.score,
          maxScore: det.maxScore,
          confidence: 1.0,
        };
        break;
      }

      case "table_fill": {
        const tf = q as TableFillQuestion;
        let userAnswersParsed: Record<string, string> = {};
        try {
          userAnswersParsed = JSON.parse(
            typeof userAnswer === "string" ? userAnswer : JSON.stringify(userAnswer)
          );
        } catch {
          // fallback to empty
        }
        const det = scoreTableFill(userAnswersParsed, tf.inputs, q.maxScore);
        const tfContext = buildTableFillResultSummary(tf.inputs, det.inputResults);
        const tfRubric = rubricText ? `${rubricText}\n\n---\n${tfContext}` : tfContext;
        const client = getClient(aiSettings.provider);
        const aiResult = await client.grade({ ...payload, rubric: tfRubric }, aiSettings);
        result = { ...aiResult, score: det.score, maxScore: det.maxScore, confidence: 1.0 };
        break;
      }

      case "true_false_group": {
        const tfg = q as TrueFalseGroupQuestion;
        let userAnswersParsed: Record<string, string> = {};
        try {
          userAnswersParsed = JSON.parse(
            typeof userAnswer === "string" ? userAnswer : JSON.stringify(userAnswer)
          );
        } catch {
          // fallback to empty
        }
        const det = scoreTrueFalseGroup(userAnswersParsed, tfg.statements, q.maxScore);
        const tfgContext = buildTrueFalseResultSummary(tfg.statements, det.statementResults);
        const tfgRubric = rubricText ? `${rubricText}\n\n---\n${tfgContext}` : tfgContext;
        const client = getClient(aiSettings.provider);
        const aiResult = await client.grade({ ...payload, rubric: tfgRubric }, aiSettings);
        result = { ...aiResult, score: det.score, maxScore: det.maxScore, confidence: 1.0 };
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown question type: ${(q as { type: string }).type}` },
          { status: 400 }
        );
    }

    // ── Persist to DB ─────────────────────────────────────────────────────────
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
