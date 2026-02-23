import Link from "next/link";
import { getSubjects, getQuizzesBySubject } from "@/lib/quiz/loader";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return getSubjects().map((s) => ({ slug: s.slug }));
}

export default function SubjectPage({ params }: { params: { slug: string } }) {
  const subjects = getSubjects();
  const subject = subjects.find((s) => s.slug === params.slug);
  if (!subject) return notFound();

  const quizzes = getQuizzesBySubject(params.slug);

  return (
    <div>
      <div className="mb-6">
        <div className="text-3xl mb-2">{subject.icon}</div>
        <h1 className="text-2xl font-bold text-gray-900">{subject.name}</h1>
        <p className="text-gray-600">{subject.description}</p>
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-3">
        Available Quizzes
      </h2>

      <div className="space-y-3">
        {quizzes.map((quiz) => (
          <div
            key={quiz.id}
            className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between shadow-sm"
          >
            <div>
              <h3 className="font-medium text-gray-900">{quiz.title}</h3>
              <p className="text-sm text-gray-500">
                {quiz.questions.length} question{quiz.questions.length !== 1 ? "s" : ""} &middot; v{quiz.version}
              </p>
            </div>
            <Link
              href={`/subject/${params.slug}/quiz/${quiz.id}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Start Quiz
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
