import { Quiz } from "./schemas";
import polishDemo from "../../../data/quizzes/polish-basic-demo.json";
import mathDemo from "../../../data/quizzes/math-basic-demo.json";
import infoDemo from "../../../data/quizzes/informatics-advanced-demo.json";

const quizzes: Quiz[] = [
  polishDemo as unknown as Quiz,
  mathDemo as unknown as Quiz,
  infoDemo as unknown as Quiz,
];

export interface SubjectInfo {
  slug: string;
  name: string;
  description: string;
  icon: string;
  quizzes: { id: string; title: string }[];
}

export function getSubjects(): SubjectInfo[] {
  const subjectMap = new Map<string, SubjectInfo>();

  for (const quiz of quizzes) {
    if (!subjectMap.has(quiz.subjectSlug)) {
      const meta = SUBJECT_META[quiz.subjectSlug] || {
        name: quiz.subject,
        description: "",
        icon: "📝",
      };
      subjectMap.set(quiz.subjectSlug, {
        slug: quiz.subjectSlug,
        name: meta.name,
        description: meta.description,
        icon: meta.icon,
        quizzes: [],
      });
    }
    subjectMap.get(quiz.subjectSlug)!.quizzes.push({
      id: quiz.id,
      title: quiz.title,
    });
  }

  return Array.from(subjectMap.values());
}

export function getQuiz(quizId: string): Quiz | undefined {
  return quizzes.find((q) => q.id === quizId);
}

export function getQuizzesBySubject(slug: string): Quiz[] {
  return quizzes.filter((q) => q.subjectSlug === slug);
}

const SUBJECT_META: Record<
  string,
  { name: string; description: string; icon: string }
> = {
  polish: {
    name: "Język Polski",
    description:
      "Matura z języka polskiego — poziom podstawowy. Czytanie ze zrozumieniem i wypracowanie.",
    icon: "📖",
  },
  math: {
    name: "Matematyka",
    description:
      "Matura z matematyki — poziom podstawowy. Zadania zamknięte i otwarte.",
    icon: "📐",
  },
  informatics: {
    name: "Informatyka",
    description:
      "Matura z informatyki — poziom rozszerzony. Zadania programistyczne w Pythonie.",
    icon: "💻",
  },
};
