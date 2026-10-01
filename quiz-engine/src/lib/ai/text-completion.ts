import "server-only";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

/**
 * Plain prompt → text completion, used by the CKE (Język polski) grader.
 *
 * The CKE prompts were written and tuned for one call returning one small
 * JSON object, so they do not fit the structured GradeResult flow the
 * Informatyka grader uses. This module is server-only: API keys never reach
 * the browser, and the model is chosen by the server (env), not by the
 * student — a student-chosen model would let anyone pick the most expensive
 * one on the site owner's bill.
 *
 *   POLISH_AI_PROVIDER = gemini | openai | anthropic   (default: gemini)
 *   POLISH_AI_MODEL    = model id                      (default: gemini-2.5-flash)
 *
 * gemini-2.5-flash is the default because the prototype's prompts were
 * calibrated on it (its notes say newer models graded worse there).
 */

export type Provider = "gemini" | "openai" | "anthropic";

export class AICallError extends Error {
  constructor(message: string, public readonly kind: "quota" | "transient" | "config" | "other") {
    super(message);
  }
}

const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-5-20250929",
};

const TIMEOUT_MS = 50_000;
const SYSTEM =
  "Jesteś egzaminatorem CKE. Odpowiadasz wyłącznie poprawnym JSON — bez żadnego tekstu przed ani po obiekcie JSON.";

export function polishGradingModel(): { provider: Provider; model: string } {
  const env = process.env.POLISH_AI_PROVIDER;
  const provider: Provider = env === "openai" || env === "anthropic" || env === "gemini" ? env : "gemini";
  const model = (process.env.POLISH_AI_MODEL || "").trim() || DEFAULT_MODELS[provider];
  return { provider, model };
}

let gemini: GoogleGenAI | null = null;
let openai: OpenAI | null = null;
let anthropic: Anthropic | null = null;

function statusOf(err: unknown): number | undefined {
  const s = (err as { status?: unknown })?.status;
  return typeof s === "number" ? s : undefined;
}

function classify(err: unknown): AICallError {
  if (err instanceof AICallError) return err;
  const status = statusOf(err);
  const msg = err instanceof Error ? err.message : String(err);
  if (status === 429) return new AICallError("Limit dostawcy AI został wyczerpany. Spróbuj później.", "quota");
  if (status === 401 || status === 403) return new AICallError("Serwer ma nieprawidłowy klucz API dostawcy AI.", "config");
  if (status === 500 || status === 502 || status === 503 || status === 504 ||
      /overloaded|high demand|unavailable|timeout|timed out|ECONNRESET/i.test(msg)) {
    return new AICallError("Model chwilowo przeciążony. Spróbuj ponownie za chwilę.", "transient");
  }
  // Do not forward raw provider messages to students; they can include request details.
  console.error("[text-completion] AI call failed:", status, msg);
  return new AICallError("Błąd wywołania modelu AI.", "other");
}

async function callOnce(prompt: string): Promise<{ text: string; model: string }> {
  const { provider, model } = polishGradingModel();

  if (provider === "gemini") {
    if (!process.env.GEMINI_API_KEY) throw new AICallError("Brak GEMINI_API_KEY na serwerze.", "config");
    gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const res = await gemini.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        temperature: 0.1,
        httpOptions: { timeout: TIMEOUT_MS },
      },
    });
    return { text: res.text ?? "", model };
  }

  if (provider === "openai") {
    if (!process.env.OPENAI_API_KEY) throw new AICallError("Brak OPENAI_API_KEY na serwerze.", "config");
    openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: TIMEOUT_MS, maxRetries: 0 });
    const res = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    });
    return { text: res.choices[0]?.message?.content ?? "", model };
  }

  if (!process.env.ANTHROPIC_API_KEY) throw new AICallError("Brak ANTHROPIC_API_KEY na serwerze.", "config");
  anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: TIMEOUT_MS, maxRetries: 0 });
  const res = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    temperature: 0.1,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return { text, model };
}

/** One completion, retried once on transient overload (never on quota/config errors). */
export async function completeText(prompt: string): Promise<{ text: string; model: string }> {
  try {
    return await callOnce(prompt);
  } catch (err) {
    const e = classify(err);
    if (e.kind !== "transient") throw e;
    await new Promise((r) => setTimeout(r, 3_000));
    try {
      return await callOnce(prompt);
    } catch (err2) {
      throw classify(err2);
    }
  }
}
