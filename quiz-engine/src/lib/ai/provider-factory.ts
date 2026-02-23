import type { LLMClient } from "./types";
import { OpenAIClient } from "./openai-client";
import { GeminiClient } from "./gemini-client";
import { AnthropicClient } from "./anthropic-client";

const clients: Record<string, LLMClient> = {};

export function getClient(provider: "openai" | "gemini" | "anthropic"): LLMClient {
  if (!clients[provider]) {
    switch (provider) {
      case "openai":
        clients[provider] = new OpenAIClient();
        break;
      case "gemini":
        clients[provider] = new GeminiClient();
        break;
      case "anthropic":
        clients[provider] = new AnthropicClient();
        break;
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  }
  return clients[provider];
}

export function getDefaultProvider(): "openai" | "gemini" | "anthropic" {
  const env = process.env.DEFAULT_AI_PROVIDER;
  if (env === "openai" || env === "gemini" || env === "anthropic") return env;
  return "openai";
}

export function getDefaultModel(provider: string): string {
  switch (provider) {
    case "openai":
      return process.env.DEFAULT_OPENAI_MODEL || "gpt-4o";
    case "gemini":
      return process.env.DEFAULT_GEMINI_MODEL || "gemini-2.5-flash";
    case "anthropic":
      return process.env.DEFAULT_CLAUDE_MODEL || "claude-sonnet-4-5-20250929";
    default:
      return "gpt-4o";
  }
}
