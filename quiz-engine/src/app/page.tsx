import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAllTools } from "@/lib/tools/registry";

export const dynamic = "force-dynamic";

const MATURA_SUBJECTS = [
  {
    slug: "polish",
    name: "Język Polski",
    description: "Matura z języka polskiego — poziom podstawowy.",
    icon: "📖",
  },
  {
    slug: "math",
    name: "Matematyka",
    description: "Matura z matematyki — poziom podstawowy.",
    icon: "📐",
  },
  {
    slug: "informatics",
    name: "Informatyka",
    description: "Matura z informatyki — poziom rozszerzony.",
    icon: "💻",
  },
];

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const { data: quizCounts } = await supabase
    .from("quizzes")
    .select("subject")
    .eq("status", "published");

  const countBySubject = (quizCounts ?? []).reduce<Record<string, number>>(
    (acc, q) => ({ ...acc, [q.subject]: (acc[q.subject] ?? 0) + 1 }),
    {}
  );

  const tools = getAllTools();
  const activeTools = tools.filter((t) => t.status === "active");
  const comingSoonTools = tools.filter((t) => t.status === "coming-soon");

  return (
    <div className="space-y-14">
      {/* Hero */}
      <div className="text-center pt-4 pb-2">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">ZdamTo.io</h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto">
          Platforma do nauki z AI — przygotuj się do Matury, zdobądź Prawo Jazdy i korzystaj z
          interaktywnych narzędzi edukacyjnych.
        </p>
      </div>

      {/* ── 1. MATURA ── */}
      <section>
        <SectionHeader
          icon="🎓"
          title="Matura"
          description="Próbne egzaminy maturalne z natychmiastowym ocenianiem AI."
          href="/subjects/polish"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
          {MATURA_SUBJECTS.map((subject) => {
            const count = countBySubject[subject.slug] ?? 0;
            return (
              <Link
                key={subject.slug}
                href={`/subjects/${subject.slug}`}
                className="block bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
              >
                <div className="text-4xl mb-3">{subject.icon}</div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">{subject.name}</h2>
                <p className="text-gray-600 text-sm mb-3">{subject.description}</p>
                <div className="text-sm text-blue-600 font-medium">
                  {count} {count === 1 ? "test" : "testów"} dostępnych
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── 2. TOOLS ── */}
      <section>
        <SectionHeader
          icon="🛠️"
          title="Narzędzia"
          description="Interaktywne pomoce dydaktyczne do nauki i powtórek."
          href="/tools"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
          {activeTools.map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="block bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:border-green-300 transition-all"
            >
              <div className="text-4xl mb-3">{tool.icon}</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">{tool.name}</h2>
              <p className="text-gray-600 text-sm">{tool.description}</p>
            </Link>
          ))}

          {comingSoonTools.slice(0, Math.max(0, 3 - activeTools.length)).map((tool) => (
            <div
              key={tool.slug}
              className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm opacity-60"
            >
              <div className="text-4xl mb-3">{tool.icon}</div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-semibold text-gray-900">{tool.name}</h2>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                  Wkrótce
                </span>
              </div>
              <p className="text-gray-600 text-sm">{tool.description}</p>
            </div>
          ))}

          {tools.length === 0 && (
            <div className="col-span-3 text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-100">
              Narzędzia są w przygotowaniu — wróć wkrótce!
            </div>
          )}
        </div>
        {(activeTools.length > 3 || comingSoonTools.length > 3 - activeTools.length) && (
          <div className="mt-4 text-center">
            <Link href="/tools" className="text-sm text-green-600 hover:underline font-medium">
              Zobacz wszystkie narzędzia →
            </Link>
          </div>
        )}
      </section>

      {/* ── 3. PRAWO JAZDY ── */}
      <section>
        <SectionHeader
          icon="🚗"
          title="Prawo Jazdy"
          description="Przygotowanie do egzaminu teoretycznego na prawo jazdy."
          href="/prawo-jazdy"
        />
        <Link
          href="/prawo-jazdy"
          className="block mt-4 bg-white rounded-xl border border-gray-100 p-8 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="text-5xl">🚗</div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-semibold text-gray-900">Moduł Prawo Jazdy</h2>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                  Wkrótce
                </span>
              </div>
              <p className="text-gray-500 text-sm">
                Baza pytań WORD, znaki drogowe, symulacje egzaminu — w przygotowaniu.
              </p>
            </div>
          </div>
        </Link>
      </section>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
  href,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="flex items-end justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="text-gray-500 text-sm">{description}</p>
        </div>
      </div>
      <Link href={href} className="text-sm text-blue-600 hover:underline font-medium hidden sm:block">
        Więcej →
      </Link>
    </div>
  );
}
