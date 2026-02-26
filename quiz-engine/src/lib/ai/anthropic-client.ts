import Anthropic from "@anthropic-ai/sdk";
import type { LLMClient, GradePayload } from "./types";
import type { AISettings, GradeResult } from "@/lib/quiz/schemas";
import { GradeResult as GradeResultSchema } from "@/lib/quiz/schemas";
import { buildSystemPrompt, buildRubricScoringPrompt } from "./prompts";

export class AnthropicClient implements LLMClient {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async grade(payload: GradePayload, settings: AISettings): Promise<GradeResult> {
    const model =
      settings.model || process.env.DEFAULT_CLAUDE_MODEL || "claude-sonnet-4-5-20250929";
    const userPrompt = buildRubricScoringPrompt(payload);

    // Build content blocks
    const content: Anthropic.ContentBlockParam[] = [
      { type: "text", text: userPrompt },
    ];

    // Add image if provided
    if (payload.attachments?.imageBase64) {
      content.unshift({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: payload.attachments.imageBase64,
        },
      });
    }

    // Build request params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {
      model,
      max_tokens: 4096,
      system: payload.systemPromptOverride ?? buildSystemPrompt(),
      messages: [{ role: "user", content }],
      temperature: 0.1,
    };

    // Extended thinking / budget config for Claude
    if (settings.reasoningLevel) {
      const budgetMap: Record<string, number> = {
        minimal: 1024,
        low: 2048,
        medium: 4096,
        high: 8192,
      };
      const budget = budgetMap[settings.reasoningLevel] || 4096;
      // Claude's extended thinking (if model supports it)
      params.thinking = {
        type: "enabled",
        budget_tokens: budget,
      };
      // When thinking is enabled, temperature must be 1
      params.temperature = 1;
      // max_tokens must be larger than budget
      params.max_tokens = Math.max(16000, budget + 4096);
    }

    // Web search: TODO for Claude — not natively supported yet
    if (settings.allowWeb) {
      // TODO: Implement web search tool via MCP or manual search integration
    }

    const response = await this.client.messages.create(params);

    // Extract text content
    let textContent = "";
    for (const block of response.content) {
      if (block.type === "text") {
        textContent += block.text;
      }
    }

    return this.parseResponse(textContent, model, payload, settings);
  }

  private async parseResponse(
    content: string,
    model: string,
    payload: GradePayload,
    settings: AISettings
  ): Promise<GradeResult> {
    // Try to extract JSON from potential markdown fences
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      parsed.modelUsed = model;
      return GradeResultSchema.parse(parsed);
    } catch {
      // Retry once
      try {
        const retry = await this.client.messages.create({
          model: settings.model || model,
          max_tokens: 4096,
          system: buildSystemPrompt(),
          messages: [
            { role: "user", content: buildRubricScoringPrompt(payload) },
            { role: "assistant", content },
            {
              role: "user",
              content: `Your previous response was not valid JSON. Respond with ONLY the raw JSON object (no markdown fences). Schema: {"score": number, "maxScore": number, "feedback": {"summary": string, "strengths": [string], "issues": [string], "nextSteps": [string]}, "confidence": number, "modelUsed": "${model}"}`,
            },
          ],
          temperature: 0.1,
        });

        let retryText = "";
        for (const block of retry.content) {
          if (block.type === "text") retryText += block.text;
        }
        const retryParsed = JSON.parse(retryText.trim());
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
        summary:
          "Grading failed — the AI response could not be parsed. Please try again.",
        strengths: [],
        issues: ["AI grading error — response was not valid JSON."],
        nextSteps: ["Try resubmitting or switching AI provider in Settings."],
      },
      confidence: 0,
      modelUsed: model,
    };
  }
}
