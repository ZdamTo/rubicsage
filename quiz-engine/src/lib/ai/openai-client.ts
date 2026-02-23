import OpenAI from "openai";
import type { LLMClient, GradePayload } from "./types";
import type { AISettings, GradeResult } from "@/lib/quiz/schemas";
import { GradeResult as GradeResultSchema } from "@/lib/quiz/schemas";
import { buildSystemPrompt, buildRubricScoringPrompt } from "./prompts";

export class OpenAIClient implements LLMClient {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async grade(payload: GradePayload, settings: AISettings): Promise<GradeResult> {
    const model = settings.model || process.env.DEFAULT_OPENAI_MODEL || "gpt-4o";
    const userPrompt = buildRubricScoringPrompt(payload);

    // Build messages
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: buildSystemPrompt() },
    ];

    // If there's an image attachment, include it as multimodal content
    if (payload.attachments?.imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${payload.attachments.imageBase64}`,
            },
          },
        ],
      });
    } else {
      messages.push({ role: "user", content: userPrompt });
    }

    // Build request params
    const params: OpenAI.Chat.ChatCompletionCreateParams = {
      model,
      messages,
      temperature: 0.1,
      response_format: { type: "json_object" },
    };

    // Reasoning effort (for o-series or gpt-5 models that support it)
    // The OpenAI SDK accepts reasoning_effort on compatible models
    if (settings.reasoningLevel) {
      // Map our levels to OpenAI's reasoning_effort
      const effortMap: Record<string, string> = {
        minimal: "low",
        low: "low",
        medium: "medium",
        high: "high",
      };
      const effort = effortMap[settings.reasoningLevel] || "medium";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (params as any).reasoning_effort = effort;
    }

    // Web search tool (OpenAI Responses API style)
    // NOTE: This uses the chat completions API. For full web_search_preview
    // support, you'd use the Responses API endpoint. Marked as TODO for
    // full implementation.
    if (settings.allowWeb) {
      // TODO: Migrate to Responses API for native web_search_preview tool
      // with allowed_domains: ["cke.gov.pl"]
      // For now, we rely on the model's knowledge.
    }

    const response = await this.client.chat.completions.create(params);
    const content = response.choices[0]?.message?.content || "";

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
      // Retry once with correction prompt
      const retryMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildRubricScoringPrompt(payload) },
        { role: "assistant", content },
        {
          role: "user",
          content: `Your previous response was not valid JSON matching the required schema. Please respond with ONLY the JSON object, no other text. The schema requires: score (number), maxScore (number), feedback (object with summary, strengths, issues, nextSteps arrays), confidence (number 0-1). Include modelUsed: "${model}".`,
        },
      ];

      try {
        const retry = await this.client.chat.completions.create({
          model: settings.model || model,
          messages: retryMessages,
          temperature: 0.1,
          response_format: { type: "json_object" },
        });
        const retryContent = retry.choices[0]?.message?.content || "";
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
