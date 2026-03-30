import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AskRequest {
  questionType: string;
  questionPrompt: string;
  maxScore: number;
  userAnswer: string;
  messages: ChatMessage[];
  aiSettings: {
    provider: "openai" | "gemini" | "anthropic";
    model: string;
  };
}

function buildSystemPrompt(questionType: string, questionPrompt: string, maxScore: number, userAnswer: string): string {
  return `You are a helpful, encouraging tutor helping a student prepare for the Polish Matura exam (or other subjects).

The student is currently working on this exercise:

--- EXERCISE CONTEXT ---
Question type: ${questionType.replace(/_/g, " ")}
Max score: ${maxScore} point(s)

Question:
${questionPrompt}

Student's current answer:
${userAnswer.trim() || "(student has not written an answer yet)"}
--- END CONTEXT ---

Your role:
- Answer the student's questions about this exercise clearly and helpfully.
- If they ask for hints, guide them — do NOT just hand them the full answer.
- If they share a specific approach or piece of code/text, give targeted feedback.
- Be concise. Use the same language as the student (Polish or English).
- You may use Markdown for formatting (lists, code blocks, bold).`;
}

export async function POST(req: NextRequest) {
  // Auth check — only authenticated users can use Ask AI
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .single();

  if (profile?.status === "banned") {
    return new Response("Account banned", { status: 403 });
  }

  let body: AskRequest;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { questionType, questionPrompt, maxScore, userAnswer, messages, aiSettings } = body;

  if (!messages?.length || messages[messages.length - 1]?.role !== "user") {
    return new Response("Last message must be from user", { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(questionType, questionPrompt, maxScore, userAnswer);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamResponse(controller, encoder, systemPrompt, messages, aiSettings);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`\n\n[Error: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function streamResponse(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  systemPrompt: string,
  messages: ChatMessage[],
  aiSettings: AskRequest["aiSettings"]
) {
  const { provider, model } = aiSettings;

  if (provider === "openai") {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const stream = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      stream: true,
      temperature: 0.7,
      max_tokens: 1024,
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) controller.enqueue(encoder.encode(text));
    }
    return;
  }

  if (provider === "anthropic") {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const stream = anthropic.messages.stream({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.7,
    });
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        controller.enqueue(encoder.encode(event.delta.text));
      }
    }
    return;
  }

  if (provider === "gemini") {
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

    // Gemini requires alternating user/model turns — merge consecutive same-role messages
    const geminiContents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const result = await genAI.models.generateContentStream({
      model,
      contents: geminiContents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });

    for await (const chunk of result) {
      const text = chunk.text ?? "";
      if (text) controller.enqueue(encoder.encode(text));
    }
    return;
  }

  throw new Error(`Unknown provider: ${provider}`);
}
