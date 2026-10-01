/**
 * Exam images live in the public Supabase Storage bucket `exam-assets`,
 * at `<booklet id>/<safe key>` — one folder per booklet, as the prototype kept
 * one assets/ directory per booklet.
 *
 * The JSON references images by their original file name, which may contain
 * Polish letters, spaces, dashes, colons… ("12-Plakat do przedstawienia
 * Kordian – fot. …, projekt: Elipsy….jpg"). Supabase Storage only accepts a
 * narrow ASCII set in object keys, so every name is mapped to a safe key here.
 * Upload and display both go through `assetKey`, so they cannot disagree.
 */

export const ASSET_BUCKET = "exam-assets";

const PL_MAP: Record<string, string> = { ł: "l", Ł: "L" };

export function assetKey(fileName: string): string {
  const name = String(fileName ?? "").trim();
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const stem = (dot > 0 ? name.slice(0, dot) : name)
    .replace(/[łŁ]/g, (c) => PL_MAP[c])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.-]+|[_.-]+$/g, "")
    .slice(0, 120) || "file";
  return ext ? `${stem}.${ext}` : stem;
}

export function assetObjectPath(partId: string, fileName: string): string {
  return `${partId}/${assetKey(fileName)}`;
}

/** Public URL of an image. Works in the browser and on the server. */
export function assetPublicUrl(supabaseUrl: string, partId: string, fileName: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  const path = assetObjectPath(partId, fileName).split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${ASSET_BUCKET}/${path}`;
}

/** Every image a stored exam needs, one entry per (booklet, file name). */
export function requiredAssets(questions: Array<{ number?: string; part_id?: string; reference_data?: Array<{ type?: string; path?: string }> }>) {
  const out: Array<{ partId: string; path: string; key: string; question: string }> = [];
  const seen = new Set<string>();
  for (const q of questions) {
    for (const ref of q.reference_data ?? []) {
      if ((ref.type ?? "text") !== "image" || !ref.path || !q.part_id) continue;
      const id = `${q.part_id}/${ref.path}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ partId: q.part_id, path: ref.path, key: assetKey(ref.path), question: String(q.number ?? "") });
    }
  }
  return out;
}

/**
 * Identify an image from its first bytes rather than trusting the browser's
 * Content-Type or the file extension. Returns the MIME type or null.
 */
export function sniffImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 &&
      (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return "image/gif";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}
