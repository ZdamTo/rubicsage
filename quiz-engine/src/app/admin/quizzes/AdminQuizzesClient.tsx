"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface QuizVersion {
  id: string;
  version: number;
  is_active: boolean;
  change_note: string | null;
  created_at: string;
}

interface Quiz {
  id: string;
  subject: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  quiz_versions: QuizVersion[];
}

interface Props {
  initialQuizzes: Quiz[];
}

const DEMO_QUIZ_CONTENT = {
  id: "demo-quiz",
  title: "Demo Quiz",
  subject: "Polish",
  subjectSlug: "polish",
  version: "1.0",
  questions: [
    {
      id: "q1",
      type: "single_choice",
      promptMarkdown: "Which is the capital of Poland?",
      maxScore: 1,
      grading: { mode: "deterministic" },
      choices: [
        { id: "a", text: "Warsaw" },
        { id: "b", text: "Krakow" },
        { id: "c", text: "Gdansk" },
      ],
      correctAnswer: "a",
    },
  ],
};

export default function AdminQuizzesClient({ initialQuizzes }: Props) {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState(initialQuizzes);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", subject: "polish", description: "" });
  const [error, setError] = useState<string | null>(null);

  // Version editor state
  const [editingVersionQuizId, setEditingVersionQuizId] = useState<string | null>(null);
  const [versionContent, setVersionContent] = useState(JSON.stringify(DEMO_QUIZ_CONTENT, null, 2));
  const [versionNote, setVersionNote] = useState("");
  const [versionError, setVersionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);

    const res = await fetch("/api/admin/quizzes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(JSON.stringify(data.error));
      setCreating(false);
      return;
    }

    router.refresh();
    setForm({ title: "", subject: "polish", description: "" });
    setCreating(false);
    const data = await res.json();
    setQuizzes((prev) => [{ ...data, quiz_versions: [] }, ...prev]);
  };

  const handleStatusChange = async (quizId: string, status: string) => {
    await fetch(`/api/admin/quizzes/${quizId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setQuizzes((prev) =>
      prev.map((q) => (q.id === quizId ? { ...q, status } : q))
    );
  };

  const handleAddVersion = async (quizId: string) => {
    setVersionError(null);
    setSaving(true);
    let parsed: unknown;
    try {
      parsed = JSON.parse(versionContent);
    } catch {
      setVersionError("Invalid JSON");
      setSaving(false);
      return;
    }

    const res = await fetch(`/api/admin/quizzes/${quizId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: parsed, change_note: versionNote }),
    });

    const data = await res.json();
    if (!res.ok) {
      setVersionError(JSON.stringify(data.error ?? data.details, null, 2));
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditingVersionQuizId(null);
    router.refresh();
  };

  const handleDelete = async (quizId: string) => {
    if (!confirm("Delete this quiz and all its versions?")) return;
    await fetch(`/api/admin/quizzes/${quizId}`, { method: "DELETE" });
    setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
  };

  return (
    <div className="space-y-6">
      {/* Create form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4">Create new quiz</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            required
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <select
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="polish">Polish</option>
            <option value="math">Math</option>
            <option value="informatics">Informatics</option>
          </select>
          <button
            type="submit"
            disabled={creating}
            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating…" : "Create draft"}
          </button>
          {form.description !== undefined && (
            <input
              type="text"
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="md:col-span-3 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          )}
        </form>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>

      {/* Quiz list */}
      {quizzes.map((quiz) => (
        <div key={quiz.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 flex items-start justify-between gap-4">
            <div>
              <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded mr-2 ${
                quiz.status === "published"
                  ? "bg-green-100 text-green-700"
                  : quiz.status === "archived"
                  ? "bg-gray-100 text-gray-500"
                  : "bg-yellow-100 text-yellow-700"
              }`}>
                {quiz.status}
              </span>
              <span className="text-xs text-gray-400 uppercase">{quiz.subject}</span>
              <h3 className="font-semibold text-gray-900 mt-1">{quiz.title}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {quiz.quiz_versions.length} version(s)
              </p>
            </div>

            <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
              {quiz.status === "draft" && (
                <button
                  onClick={() => handleStatusChange(quiz.id, "published")}
                  className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  Publish
                </button>
              )}
              {quiz.status === "published" && (
                <button
                  onClick={() => handleStatusChange(quiz.id, "archived")}
                  className="text-xs px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  Archive
                </button>
              )}
              {quiz.status === "archived" && (
                <button
                  onClick={() => handleStatusChange(quiz.id, "draft")}
                  className="text-xs px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                >
                  Unarchive
                </button>
              )}
              <button
                onClick={() => {
                  setEditingVersionQuizId(quiz.id);
                  setVersionError(null);
                  setVersionNote("");
                }}
                className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                + Version
              </button>
              <button
                onClick={() => handleDelete(quiz.id)}
                className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Version editor */}
          {editingVersionQuizId === quiz.id && (
            <div className="border-t border-gray-200 px-5 py-4 bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Add new version</h4>
              <div className="mb-3">
                <label className="text-xs text-gray-500 block mb-1">
                  Change note (optional)
                </label>
                <input
                  type="text"
                  value={versionNote}
                  onChange={(e) => setVersionNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Added new questions"
                />
              </div>
              <div className="mb-3">
                <label className="text-xs text-gray-500 block mb-1">
                  Quiz JSON content (must conform to Quiz schema)
                </label>
                <textarea
                  rows={16}
                  value={versionContent}
                  onChange={(e) => setVersionContent(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  spellCheck={false}
                />
              </div>
              {versionError && (
                <pre className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-3 overflow-auto">
                  {versionError}
                </pre>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => handleAddVersion(quiz.id)}
                  disabled={saving}
                  className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving…" : "Save version"}
                </button>
                <button
                  onClick={() => setEditingVersionQuizId(null)}
                  className="text-sm px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Versions list */}
          {quiz.quiz_versions.length > 0 && (
            <div className="border-t border-gray-100 px-5 py-3">
              <div className="space-y-1">
                {quiz.quiz_versions
                  .sort((a, b) => b.version - a.version)
                  .map((v) => (
                    <div key={v.id} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className={`font-mono font-semibold ${v.is_active ? "text-green-600" : ""}`}>
                        v{v.version}
                      </span>
                      {v.is_active && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">active</span>
                      )}
                      {v.change_note && <span className="text-gray-400">— {v.change_note}</span>}
                      <span className="text-gray-300">
                        {new Date(v.created_at).toLocaleDateString("pl-PL")}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {quizzes.length === 0 && (
        <p className="text-center text-gray-400 py-8">No quizzes yet. Create one above.</p>
      )}
    </div>
  );
}
