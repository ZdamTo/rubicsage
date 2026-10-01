/**
 * Text layout helpers ported from the prototype's renderers.js. They return
 * plain data and the React components render it, so exam text is always
 * escaped by React — nothing here builds HTML strings.
 */

/** "0–1–2" for a 2-point question; the span "0–35" above five points. */
export function scoreRange(maxPoints: number): string {
  const max = Number(maxPoints) || 0;
  if (max > 5) return `0–${max}`;
  return Array.from({ length: max + 1 }, (_, i) => i).join("–");
}

export type StemBlock = { list: boolean; text: string };

/**
 * The stem as CKE prints it: a bold lead line, then the polecenie as a list.
 * Only a BLANK line is a paragraph break; a line that neither opens a bullet
 * nor follows a finished sentence is the tail of a wrapped one.
 * The minimum length bullet is restored from minimum_word_count when the
 * stem does not state it (the 2025 papers).
 */
export function stemBlocks(text: string | undefined, minimumWords?: number): StemBlock[] {
  const raw = String(text ?? "");
  const min = Number(minimumWords) || 0;
  const lines = raw.split("\n").map((l) => l.trim());
  if (min && !/wyraz/i.test(raw)) lines.push(`• Twoja praca powinna liczyć co najmniej ${min} wyrazów.`);

  const blocks: StemBlock[] = [];
  let blank = true;
  const open = (last?: StemBlock) => !!last && !/[.:;?!…)]$/.test(last.text);
  for (const line of lines) {
    if (!line) { blank = true; continue; }
    const bullet = /^[•·*–—-]\s+(.+)$/.exec(line);
    const last = blocks[blocks.length - 1];
    if (bullet) blocks.push({ list: true, text: bullet[1] });
    else if (!blank && open(last)) last.text += " " + line;
    else blocks.push({ list: false, text: line });
    blank = false;
  }
  return blocks;
}

/** Group consecutive list blocks so they can be rendered as one <ul>. */
export function groupStem(blocks: StemBlock[]): Array<{ list: false; text: string } | { list: true; items: string[] }> {
  const out: Array<{ list: false; text: string } | { list: true; items: string[] }> = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    if (b.list) {
      if (last && last.list) last.items.push(b.text);
      else out.push({ list: true, items: [b.text] });
    } else out.push({ list: false, text: b.text });
  }
  return out;
}

export type Segment = { text: string; sup?: boolean };

/**
 * A footnote marker as CKE prints it: a lone digit glued to the end of a word
 * ("Kołakowski2", "carstwa10") or a closing quote ("„Piołun”1"). Raised to <sup>.
 * A digit after a space ("t. 33") or inside a number is left alone.
 */
export function footnoteSegments(text: string): Segment[] {
  const re = /(\p{L}|[”’»)\]])([1-9][0-9]?)(?![\d\p{L}])/gu;
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    out.push({ text: text.slice(last, idx + m[1].length) });
    out.push({ text: m[2], sup: true });
    last = idx + m[0].length;
  }
  out.push({ text: text.slice(last) });
  return out.filter((s) => s.text !== "");
}

/** Source prose: one paragraph per line; a trailing "Na podstawie: …" is the attribution. */
export function proseParagraphs(text: string | undefined): Array<{ text: string; source: boolean }> {
  const paras = String(text ?? "").split("\n").map((p) => p.trim()).filter(Boolean);
  return paras.map((p, i) => ({
    text: p,
    source: i === paras.length - 1 && /^(na podstawie|źródło|źr\.)/i.test(p),
  }));
}

/** A temat that opens with a cytat: quotation, attribution, then the question itself. */
export function topicTitleParts(title: string | undefined): Array<{ kind: "title" | "quote" | "source"; text: string }> {
  const parts = String(title ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return [{ kind: "title", text: String(title ?? "") }];
  return parts.map((text, i) => ({
    kind: /^(na podstawie|źródło|źr\.)/i.test(text) ? "source" : i === parts.length - 1 ? "title" : "quote",
    text,
  }));
}
