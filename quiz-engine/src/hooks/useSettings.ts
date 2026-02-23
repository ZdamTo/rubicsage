"use client";

import { useState, useEffect } from "react";
import type { AISettings } from "@/lib/quiz/schemas";

const STORAGE_KEY = "rubicsage-settings";

const DEFAULT_SETTINGS: AISettings = {
  provider: "openai",
  model: "gpt-4o",
  reasoningLevel: "medium",
  allowWeb: false,
};

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o",
  gemini: "gemini-2.5-flash",
  anthropic: "claude-sonnet-4-5-20250929",
};

export function useSettings() {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  const updateSettings = (update: Partial<AISettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...update };
      // Auto-set default model when switching provider
      if (update.provider && !update.model) {
        next.model = DEFAULT_MODELS[update.provider] || prev.model;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { settings, updateSettings, loaded, DEFAULT_MODELS };
}
