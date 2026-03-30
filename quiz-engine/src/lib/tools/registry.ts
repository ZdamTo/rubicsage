/**
 * Tools Registry
 *
 * Each entry describes one learning tool submodule.
 * To add a new tool:
 *   1. Add an entry to the TOOLS array below.
 *   2. Create /src/app/tools/[your-slug]/page.tsx
 *   3. Create /src/components/tools/[YourToolName].tsx  (the actual UI)
 *   4. Set status to "active" once ready, or "coming-soon" while in development.
 *
 * See docs/creating-tool-modules.md for the full authoring guide.
 */

export type ToolStatus = "active" | "coming-soon";
export type ToolSubject = "polish" | "math" | "informatics" | "prawo-jazdy" | "general";

export interface Tool {
  /** URL slug — used in /tools/[tool] route */
  slug: string;
  name: string;
  description: string;
  icon: string;
  /** Which subject this tool primarily supports (optional) */
  subject?: ToolSubject;
  status: ToolStatus;
}

export const TOOLS: Tool[] = [
  {
    slug: "flashcards",
    name: "Flashcards",
    description: "Przeglądaj kluczowe pojęcia na interaktywnych fiszkach.",
    icon: "🃏",
    subject: "general",
    status: "coming-soon",
  },
  {
    slug: "formula-sheet",
    name: "Arkusz Wzorów",
    description: "Szybki dostęp do wzorów matematycznych na egzamin.",
    icon: "📋",
    subject: "math",
    status: "coming-soon",
  },
  {
    slug: "essay-planner",
    name: "Planer Wypracowania",
    description: "Interaktywny kreator struktury wypracowania maturalnego.",
    icon: "✏️",
    subject: "polish",
    status: "coming-soon",
  },
];

export function getActiveTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug && t.status === "active");
}

export function getAllTools(): Tool[] {
  return TOOLS;
}
