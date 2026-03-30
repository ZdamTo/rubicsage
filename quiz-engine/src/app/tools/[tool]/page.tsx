import { notFound } from "next/navigation";
import Link from "next/link";
import { getActiveTool, getAllTools } from "@/lib/tools/registry";

/**
 * Generic tool page — renders the appropriate tool component based on slug.
 *
 * To add a new tool:
 *   1. Add it to TOOLS in /src/lib/tools/registry.ts with status: "active"
 *   2. Create its component in /src/components/tools/[YourToolName].tsx
 *   3. Import and wire it up in the TOOL_COMPONENTS map below.
 *
 * See docs/creating-tool-modules.md for the full guide.
 */

// Map slug → React component. Import tool components here as they are built.
// Example (uncomment when the component exists):
// import { Flashcards } from "@/components/tools/Flashcards";
const TOOL_COMPONENTS: Record<string, React.ComponentType> = {
  // flashcards: Flashcards,
};

export async function generateStaticParams() {
  return getAllTools()
    .filter((t) => t.status === "active")
    .map((t) => ({ tool: t.slug }));
}

export default function ToolPage({ params }: { params: { tool: string } }) {
  const tool = getActiveTool(params.tool);
  if (!tool) notFound();

  const Component = TOOL_COMPONENTS[params.tool];
  if (!Component) {
    // Tool is registered as active but component not wired yet
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-3">{tool.icon}</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{tool.name}</h1>
        <p className="text-gray-500 mb-6">{tool.description}</p>
        <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 inline-block">
          Narzędzie jest oznaczone jako aktywne, ale komponent UI nie jest jeszcze podpięty.
          <br />
          Dodaj go do mapy <code className="font-mono">TOOL_COMPONENTS</code> w{" "}
          <code className="font-mono">src/app/tools/[tool]/page.tsx</code>.
        </p>
        <div className="mt-6">
          <Link href="/tools" className="text-sm text-blue-600 hover:underline">
            ← Wróć do narzędzi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/tools" className="text-sm text-gray-500 hover:text-gray-700">
          ← Narzędzia
        </Link>
      </div>
      <div className="mb-6">
        <div className="text-3xl mb-1">{tool.icon}</div>
        <h1 className="text-2xl font-bold text-gray-900">{tool.name}</h1>
        <p className="text-gray-500 mt-1">{tool.description}</p>
      </div>
      <Component />
    </div>
  );
}
