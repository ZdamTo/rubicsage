import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import CkeExamPicker from "@/components/cke/CkeExamPicker";

export const dynamic = "force-dynamic";

const SUBJECT_META: Record<string, { name: string; icon: string; description: string }> = {
  polish: { name: "Język Polski", icon: "📖", description: "Matura z języka polskiego" },
  math: { name: "Matematyka", icon: "📐", description: "Matura z matematyki" },
  informatics: { name: "Informatyka", icon: "💻", description: "Matura z informatyki" },
};

export default async function SubjectPage({
  params,
}: {
  params: { subject: string };
}) {
  const meta = SUBJECT_META[params.subject];
  if (!meta) notFound();
  // subject validation is done below after meta check

  const validSubjects = ["polish", "math", "informatics"] as const;
  type ValidSubject = typeof validSubjects[number];
  const subject = validSubjects.includes(params.subject as ValidSubject)
    ? (params.subject as ValidSubject)
    : null;
  if (!subject) notFound();

  const supabase = await createServerSupabaseClient();
  const { data: allQuizzes, error } = await supabase
    .from("quizzes")
    .select("*, quiz_versions(id, version, is_active)")
    .eq("subject", subject)
    .eq("status", "published")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching quizzes:", error);
  }

  // CKE exam sheets (Język polski) have their own picker; everything else is
  // the regular quiz list. Filtered here rather than in SQL so this page keeps
  // working even before migration 004 adds the `format` column.
  const quizzes = (allQuizzes ?? []).filter((q) => (q as { format?: string }).format !== "cke_exam");
  const isPolish = subject === "polish";

  return (
    <div>
      <div className="mb-8">
        <div className="text-4xl mb-2">{meta.icon}</div>
        <h1 className="text-2xl font-bold text-gray-900">{meta.name}</h1>
        <p className="text-gray-500 mt-1">{meta.description}</p>
      </div>

      {isPolish && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Arkusze maturalne CKE</h2>
          <p className="text-sm text-gray-500 mb-4">
            Pełne arkusze z oficjalnymi zasadami oceniania. Kliknij kartę, aby ćwiczyć (tryb nauki), albo ⏱, aby
            rozwiązać arkusz z zegarem jak na egzaminie.
          </p>
          <CkeExamPicker />
        </section>
      )}

      {isPolish && quizzes.length > 0 && (
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Inne testy</h2>
      )}

      {quizzes.length === 0 ? (
        isPolish ? null : (
        <div className="text-center py-12 text-gray-400">
          <p>No quizzes published yet for this subject.</p>
          <p className="text-sm mt-1">Check back soon!</p>
        </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.map((quiz) => {
            const activeVersion = (quiz.quiz_versions as Array<{ id: string; version: number; is_active: boolean }>)
              ?.find((v) => v.is_active);
            return (
              <Link
                key={quiz.id}
                href={`/quiz/${quiz.id}${activeVersion ? `?versionId=${activeVersion.id}` : ""}`}
                className="block bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
              >
                <h2 className="font-semibold text-gray-900 mb-1">{quiz.title}</h2>
                {quiz.description && (
                  <p className="text-sm text-gray-500 mb-2">{quiz.description}</p>
                )}
                <div className="text-xs text-blue-600 font-medium">
                  {activeVersion ? `v${activeVersion.version}` : ""}
                  {" "}Start quiz →
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
