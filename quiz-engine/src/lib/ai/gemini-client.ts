import { GoogleGenAI } from "@google/genai";
import type { LLMClient, GradePayload } from "./types";
import type { AISettings, GradeResult } from "@/lib/quiz/schemas";
import { GradeResult as GradeResultSchema } from "@/lib/quiz/schemas";
import { buildSystemPrompt, buildRubricScoringPrompt } from "./prompts";

export class GeminiClient implements LLMClient {
  private client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }

  async grade(payload: GradePayload, settings: AISettings): Promise<GradeResult> {
    const model = settings.model || process.env.DEFAULT_GEMINI_MODEL || "gemini-2.5-flash";
    const userPrompt = buildRubricScoringPrompt(payload);

    // Build content parts
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: userPrompt },
    ];

    // Add image if provided
    if (payload.attachments?.imageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: payload.attachments.imageBase64,
        },
      });
    }

    // Build config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {
      systemInstruction: payload.systemPromptOverride ?? buildSystemPrompt(),
      responseMimeType: "application/json",
    };

    // Thinking level config
    if (settings.reasoningLevel) {
      const levelMap: Record<string, string> = {
        minimal: "low",
        low: "low",
        medium: "medium",
        high: "high",
      };
      config.thinkingConfig = {
        thinkingBudget: levelMap[settings.reasoningLevel] === "low"
          ? 1024
          : levelMap[settings.reasoningLevel] === "medium"
            ? 4096
            : 8192,
      };
    }

    // Web search: TODO for Gemini — would use Google Search grounding
    if (settings.allowWeb) {
      // TODO: Enable Google Search grounding tool when available in SDK
    }

    const response = await this.client.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config,
    });

    const content = response.text || "";
    return this.parseResponse(content, model, payload, settings);
  }

  private async parseResponse(
    content: string,
    model: string,
    payload: GradePayload,
    settings: AISettings
  ): Promise<GradeResult> {
    try {
      const parsed = JSON.parse(content);
      parsed.modelUsed = model;
      return GradeResultSchema.parse(parsed);
    } catch {
      // Retry once
      try {
        const retryPrompt = `Your previous response was not valid JSON. Please respond ONLY with a JSON object matching this schema: {"score": number, "maxScore": number, "feedback": {"summary": string, "strengths": [string], "issues": [string], "nextSteps": [string]}, "confidence": number, "modelUsed": "${model}"}.\n\nOriginal question:\n${buildRubricScoringPrompt(payload)}`;

        const retry = await this.client.models.generateContent({
          model: settings.model || model,
          contents: [{ role: "user", parts: [{ text: retryPrompt }] }],
          config: {
            systemInstruction: buildSystemPrompt(),
            responseMimeType: "application/json",
          },
        });

        const retryContent = retry.text || "";
        const retryParsed = JSON.parse(retryContent);
        retryParsed.modelUsed = model;
        return GradeResultSchema.parse(retryParsed);
      } catch {
        return this.fallbackResult(model, payload.maxScore);
      }
    }
  }

  private fallbackResult(model: string, maxScore: number): GradeResult {
    return {
      score: 0,
      maxScore,
      feedback: {
        summary: "Grading failed — the AI response could not be parsed. Please try again.",
        strengths: [],
        issues: ["AI grading error — response was not valid JSON."],
        nextSteps: ["Try resubmitting or switching AI provider in Settings."],
      },
      confidence: 0,
      modelUsed: model,
    };
  }
}
