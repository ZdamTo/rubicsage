"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Admin tools for Język polski CKE exam sheets:
 *   - CkeImportPanel: pick the booklet JSON files (P1, P2, R0 …), validate,
 *     import as drafts (P1+P2 of one session become one 60-point exam).
 *   - CkeAssetManager: upload the images an imported exam references.
 * Publishing is the existing "Publish" button on the quiz card.
 */

export interface AssetRow {
  partId: string;
  path: string;
  key: string;
  question: string;
  uploaded: boolean;
}

interface ImportResult {
  quizId: string;
  examCode: string;
  title: string;
  created: boolean;
  status: string;
  version: number;
  questions: number;
  maxPoints: number;
  missingParts: string[];
  assets: AssetRow[];
}

const MAX_FILE = 3 * 1024 * 1024;

// .jsonc support, as in the prototype: strip line and block comments.
function stripJsonc(text: string) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

async function readBooklet(file: File): Promise<{ name: string; json: unknown }> {
  if (file.size > MAX_FILE) throw new Error(`${file.name}: plik jest większy niż 3 MB`);
  const text = await file.text();
  try {
    return { name: file.name, json: JSON.parse(text) };
  } catch {
    try {
      return { name: file.name, json: JSON.parse(stripJsonc(text)) };
    } catch {
      throw new Error(`${file.name}: to nie jest poprawny JSON`);
    }
  }
}

const BOOKLET_FILE = /^MPOP-[A-Z][0-9]-[0-9A-Z]{3}-[0-9]{4}\.jsonc?$/i;

/** Upload one image for one reference of an exam. Returns the new asset list or an error. */
async function uploadAsset(quizId: string, a: AssetRow, file: File): Promise<{ assets?: AssetRow[]; error?: string }> {
  const form = new FormData();
  form.set("partId", a.partId);
  form.set("path", a.path);
  form.set("file", file);
  const res = await fetch(`/api/admin/cke/${quizId}/assets`, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  return res.ok ? { assets: data.assets } : { error: data.error || `Błąd ${res.status}` };
}

export function CkeImportPanel() {
  const router = useRouter();
  // Everything picked: JSON booklets plus (when a folder is chosen) their images.
  const [picked, setPicked] = useState<File[]>([]);
  const files = picked.filter((f) => BOOKLET_FILE.test(f.name));
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [log, setLog] = useState<string[]>([]);

  /* With a folder picked, upload the images the sheets reference straight from
     <CODE>/assets/<file>. Empty files (like the 2024 Kordian poster in the
     prototype's zip) are skipped and stay "brak". */
  const autoUploadImages = async (list: ImportResult[]) => {
    const lines: string[] = [];
    for (const r of list) {
      for (const a of r.assets.filter((x) => !x.uploaded)) {
        const file = picked.find((f) => {
          const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
          return f.name === a.path && (rel.includes(`${a.partId}/`) || !rel.includes("/"));
        });
        if (!file) continue;
        if (file.size === 0) { lines.push(`⚠ ${a.partId}/${a.path}: plik jest pusty — wgraj go ręcznie`); continue; }
        const out = await uploadAsset(r.quizId, a, file);
        if (out.assets) r.assets = out.assets;
        lines.push(out.error ? `✗ ${a.path}: ${out.error}` : `✓ wgrano ${a.partId}/${a.path}`);
        setLog([...lines]);
      }
    }
    setLog(lines);
    setResults([...list]);
  };

  const onImport = async () => {
    setErrors([]);
    setResults([]);
    setLog([]);
    if (!files.length) { setErrors(["Wybierz co najmniej jeden plik JSON."]); return; }
    setBusy(true);
    try {
      const payload = { files: await Promise.all(files.map(readBooklet)) };
      const res = await fetch("/api/admin/cke/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const list: string[] = [data.error || `Błąd ${res.status}`];
        for (const f of data.fileErrors ?? []) list.push(`${f.file}:`, ...f.errors.map((e: string) => `   • ${e}`));
        for (const e of data.groupErrors ?? []) list.push(e);
        setErrors(list);
        return;
      }
      setResults(data.results ?? []);
      if (data.warnings?.length) setErrors(data.warnings);
      if (picked.some((f) => !BOOKLET_FILE.test(f.name))) await autoUploadImages(data.results ?? []);
      router.refresh();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-purple-200 rounded-xl p-5 shadow-sm">
      <h2 className="font-semibold text-gray-800 mb-1">Import arkuszy CKE — Język polski</h2>
      <p className="text-xs text-gray-500 mb-3 leading-relaxed">
        Wybierz pliki <code>MPOP-…json</code> (np. <code>MPOP-P1-100-2505.json</code> + <code>MPOP-P2-100-2505.json</code>,
        albo <code>MPOP-R0-100-2505.json</code>). Arkusz 1 i wypracowanie z tej samej sesji zostaną połączone w jeden egzamin
        (60 pkt). Nowe arkusze trafiają jako <strong>szkic</strong>; ponowny import tego samego kodu tworzy nową wersję.
        Po imporcie wgraj obrazy i kliknij <strong>Publish</strong>.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-gray-600">
          Pliki JSON:{" "}
          <input
            type="file"
            multiple
            accept=".json,.jsonc,application/json"
            onChange={(e) => setPicked(Array.from(e.target.files ?? []))}
            className="text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          albo cały folder (np. <code>data/cke-polski</code> — razem z obrazami):{" "}
          <input
            type="file"
            multiple
            // Non-standard but supported by Chrome, Edge, Firefox and Safari.
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            onChange={(e) => setPicked(Array.from(e.target.files ?? []))}
            className="text-sm"
          />
        </label>
        <button
          onClick={onImport}
          disabled={busy || !files.length}
          className="bg-purple-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
        >
          {busy ? "Importowanie…" : `Importuj (${files.length})`}
        </button>
      </div>

      {errors.length > 0 && (
        <pre className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3 whitespace-pre-wrap">{errors.join("\n")}</pre>
      )}

      {log.length > 0 && (
        <pre className="mt-3 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded p-3 whitespace-pre-wrap">{log.join("\n")}</pre>
      )}

      {results.length > 0 && (
        <div className="mt-4 space-y-3">
          {results.map((r) => (
            <div key={r.quizId} className="border border-gray-200 rounded-lg p-3">
              <div className="text-sm font-medium text-gray-900">
                {r.created ? "Utworzono" : "Zaktualizowano"}: {r.title}{" "}
                <span className="text-xs text-gray-500 font-mono">({r.examCode}, v{r.version}, {r.status})</span>
              </div>
              <div className="text-xs text-gray-500">{r.questions} zadań · {r.maxPoints} pkt</div>
              {r.missingParts.length > 0 && (
                <div className="text-xs text-amber-700 mt-1">
                  Brakuje części: {r.missingParts.join(", ")} — możesz ją zaimportować później, zostanie dołączona.
                </div>
              )}
              <CkeAssetManager key={`${r.quizId}-${r.assets.filter((a) => a.uploaded).length}`} quizId={r.quizId} initial={r.assets} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CkeAssetManager({ quizId, initial }: { quizId: string; initial?: AssetRow[] }) {
  const [assets, setAssets] = useState<AssetRow[] | null>(initial ?? null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const res = await fetch(`/api/admin/cke/${quizId}/assets`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error || `Błąd ${res.status}`); return; }
    setAssets(data.assets);
  };

  const upload = async (a: AssetRow, file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusyKey(`${a.partId}/${a.path}`);
    const out = await uploadAsset(quizId, a, file);
    setBusyKey(null);
    if (out.error) { setError(out.error); return; }
    setAssets(out.assets ?? null);
  };

  if (!assets) {
    return (
      <button onClick={load} className="mt-2 text-xs px-3 py-1 bg-purple-50 text-purple-700 rounded hover:bg-purple-100">
        Obrazy w arkuszu…
      </button>
    );
  }

  return (
    <div className="mt-2">
      {assets.length === 0 ? (
        <p className="text-xs text-gray-500">Ten arkusz nie zawiera obrazów.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1 pr-2">Zad.</th>
              <th className="py-1 pr-2">Plik w arkuszu</th>
              <th className="py-1 pr-2">Stan</th>
              <th className="py-1">Wgraj</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => {
              const id = `${a.partId}/${a.path}`;
              return (
                <tr key={id} className="border-t border-gray-100 align-top">
                  <td className="py-1 pr-2">{a.question}</td>
                  <td className="py-1 pr-2 break-all font-mono" title={a.partId}>{a.path}</td>
                  <td className="py-1 pr-2">
                    {a.uploaded ? <span className="text-green-700">✓ wgrany</span> : <span className="text-amber-700">brak</span>}
                  </td>
                  <td className="py-1">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={busyKey === id}
                      onChange={(e) => upload(a, e.target.files?.[0])}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
