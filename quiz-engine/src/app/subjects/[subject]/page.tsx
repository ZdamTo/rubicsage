import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import CkeExamPicker from "@/components/cke/CkeExamPicker";
import { ThemedCard, SUBJECT_ACCENT } from "@/components/ThemedCard";

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
      <div className="mb-8 flex items-center gap-4">
        <div className="text-4xl" aria-hidden="true">{meta.icon}</div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{meta.name}</h1>
          <p className="text-slate-500 mt-0.5">{meta.description}</p>
        </div>
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
          <p>Nie ma jeszcze opublikowanych testów z tego przedmiotu.</p>
          <p className="text-sm mt-1">Zajrzyj wkrótce!</p>
        </div>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((quiz) => {
            const activeVersion = (quiz.quiz_versions as Array<{ id: string; version: number; is_active: boolean }>)
              ?.find((v) => v.is_active);
            return (
              <ThemedCard
                key={quiz.id}
                href={`/quiz/${quiz.id}${activeVersion ? `?versionId=${activeVersion.id}` : ""}`}
                accent={SUBJECT_ACCENT[subject] ?? "indigo"}
                badge={meta.name}
                icon={meta.icon}
                title={quiz.title}
                subtitle={quiz.description ?? undefined}
                chip={activeVersion ? `v${activeVersion.version}` : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
