import Link from "next/link";
import { getAllTools } from "@/lib/tools/registry";
import type { Tool } from "@/lib/tools/registry";

export const metadata = {
  title: "Tools — ZdamTo.io",
  description: "Narzędzia do nauki wspomagające przygotowanie do egzaminów.",
};

export default function ToolsPage() {
  const tools = getAllTools();
  const activeTools = tools.filter((t) => t.status === "active");
  const comingSoonTools = tools.filter((t) => t.status === "coming-soon");

  return (
    <div>
      <div className="mb-8">
        <div className="text-4xl mb-2">🛠️</div>
        <h1 className="text-2xl font-bold text-gray-900">Narzędzia</h1>
        <p className="text-gray-500 mt-1">
          Interaktywne pomoce dydaktyczne wspomagające naukę do egzaminów.
        </p>
      </div>

      {activeTools.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Dostępne narzędzia</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        </section>
      )}

      {comingSoonTools.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Wkrótce</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comingSoonTools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} disabled />
            ))}
          </div>
        </section>
      )}

      {tools.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">🛠️</div>
          <p className="text-lg">Narzędzia są w przygotowaniu.</p>
          <p className="text-sm mt-1">Wróć wkrótce!</p>
        </div>
      )}
    </div>
  );
}

function ToolCard({ tool, disabled = false }: { tool: Tool; disabled?: boolean }) {
  const card = (
    <div
      className={`bg-white rounded-xl border p-6 shadow-sm transition-all ${
        disabled
          ? "border-gray-100 opacity-60 cursor-default"
          : "border-gray-200 hover:shadow-md hover:border-green-300 cursor-pointer"
      }`}
    >
      <div className="text-4xl mb-3">{tool.icon}</div>
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-xl font-semibold text-gray-900">{tool.name}</h2>
        {tool.status === "coming-soon" && (
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
            Wkrótce
          </span>
        )}
      </div>
      <p className="text-gray-600 text-sm">{tool.description}</p>
    </div>
  );

  if (disabled) return card;
  return <Link href={`/tools/${tool.slug}`}>{card}</Link>;
}
