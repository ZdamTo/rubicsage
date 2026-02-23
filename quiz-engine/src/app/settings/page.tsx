"use client";

import { useSettings } from "@/hooks/useSettings";

const PROVIDERS = [
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o" },
  { value: "gemini", label: "Google Gemini", defaultModel: "gemini-2.5-flash" },
  { value: "anthropic", label: "Anthropic Claude", defaultModel: "claude-sonnet-4-5-20250929" },
] as const;

const REASONING_LEVELS: Record<string, { value: string; label: string; description: string }[]> = {
  openai: [
    { value: "low", label: "Low", description: "Minimal reasoning — faster, cheaper" },
    { value: "medium", label: "Medium", description: "Balanced reasoning" },
    { value: "high", label: "High", description: "Maximum reasoning — slower, better quality" },
  ],
  gemini: [
    { value: "low", label: "Low", description: "Small thinking budget (1024 tokens)" },
    { value: "medium", label: "Medium", description: "Medium thinking budget (4096 tokens)" },
    { value: "high", label: "High", description: "Large thinking budget (8192 tokens)" },
  ],
  anthropic: [
    { value: "minimal", label: "Minimal", description: "1024 token thinking budget" },
    { value: "low", label: "Low", description: "2048 token thinking budget" },
    { value: "medium", label: "Medium", description: "4096 token thinking budget" },
    { value: "high", label: "High", description: "8192 token thinking budget" },
  ],
};

export default function SettingsPage() {
  const { settings, updateSettings, loaded } = useSettings();

  if (!loaded) {
    return <div className="text-center py-12 text-gray-500">Loading settings...</div>;
  }

  const levels = REASONING_LEVELS[settings.provider] || REASONING_LEVELS.openai;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6 shadow-sm">
        {/* Provider */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            AI Provider
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                onClick={() =>
                  updateSettings({ provider: p.value, model: p.defaultModel })
                }
                className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                  settings.provider === p.value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Model */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Model
          </label>
          <input
            type="text"
            value={settings.model}
            onChange={(e) => updateSettings({ model: e.target.value })}
            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Model name..."
          />
          <p className="text-xs text-gray-400 mt-1">
            Default: {PROVIDERS.find((p) => p.value === settings.provider)?.defaultModel}
          </p>
        </div>

        {/* Reasoning Level */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Reasoning / Thinking Level
          </label>
          <div className="space-y-2">
            {levels.map((level) => (
              <label
                key={level.value}
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  settings.reasoningLevel === level.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="reasoning"
                  value={level.value}
                  checked={settings.reasoningLevel === level.value}
                  onChange={() => updateSettings({ reasoningLevel: level.value })}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-gray-700">
                    {level.label}
                  </div>
                  <div className="text-xs text-gray-500">{level.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Web lookup */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.allowWeb}
              onChange={(e) => updateSettings({ allowWeb: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-semibold text-gray-700">
                Allow web lookup for grading
              </span>
              <p className="text-xs text-gray-500">
                When enabled, the AI may search the web to verify current CKE rules.
                {settings.provider === "openai"
                  ? " (OpenAI: web_search_preview tool — TODO: full Responses API)"
                  : ` (${settings.provider}: not yet implemented — marked as TODO)`}
              </p>
            </div>
          </label>
        </div>

        {/* API key reminder */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          API keys are stored server-side in <code className="text-xs">.env</code>. They never
          appear in the browser. Make sure your <code className="text-xs">.env</code> file has:
          <ul className="mt-1 text-xs space-y-0.5 font-mono">
            <li>OPENAI_API_KEY=sk-...</li>
            <li>GEMINI_API_KEY=AIza...</li>
            <li>ANTHROPIC_API_KEY=sk-ant-...</li>
          </ul>
        </div>
      </div>

      {/* Current config JSON */}
      <div className="mt-6 bg-gray-900 text-gray-300 rounded-lg p-4 text-xs font-mono">
        <div className="text-gray-500 mb-1">Current settings (saved to localStorage):</div>
        <pre>{JSON.stringify(settings, null, 2)}</pre>
      </div>
    </div>
  );
}
