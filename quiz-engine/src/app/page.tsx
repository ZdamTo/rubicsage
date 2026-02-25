import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SUBJECTS = [
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
  // Count published quizzes per subject for display
  const supabase = await createServerSupabaseClient();
  const { data: quizCounts } = await supabase
    .from("quizzes")
    .select("subject")
    .eq("status", "published");

  const countBySubject = (quizCounts ?? []).reduce<Record<string, number>>(
    (acc, q) => ({ ...acc, [q.subject]: (acc[q.subject] ?? 0) + 1 }),
    {}
  );

  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">RubicSage</h1>
        <p className="text-gray-600 text-lg">AI-powered exam practice for Polish Matura</p>
        <p className="text-gray-500 mt-1">
          Take mock exams and get instant AI grading with detailed feedback
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SUBJECTS.map((subject) => {
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
                {count} quiz{count !== 1 ? "zes" : ""} available
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
