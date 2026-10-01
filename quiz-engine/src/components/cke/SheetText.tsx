"use client";

import { useState } from "react";
import { footnoteSegments, groupStem, proseParagraphs, stemBlocks } from "@/lib/cke/display";
import { assetPublicUrl } from "@/lib/cke/assets";
import type { CkeReference } from "@/lib/cke/types";

/** Text with CKE footnote markers raised to superscripts. */
export function WithFootnotes({ text }: { text: string }) {
  return (
    <>
      {footnoteSegments(text).map((s, i) => (s.sup ? <sup key={i}>{s.text}</sup> : <span key={i}>{s.text}</span>))}
    </>
  );
}

/** The polecenie: bold lead line(s), then the bullets as a list. */
export function Stem({ text, minimumWords }: { text?: string; minimumWords?: number }) {
  const groups = groupStem(stemBlocks(text, minimumWords));
  return (
    <div className="q-prompt">
      {groups.map((g, i) =>
        g.list ? (
          <ul key={i} className="q-bullets">
            {g.items.map((item, j) => <li key={j}>{item}</li>)}
          </ul>
        ) : (
          <p key={i} className="q-lead">{g.text}</p>
        )
      )}
    </div>
  );
}

function ReferenceImage({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <div className="ref-missing">🖼 Brak obrazu w arkuszu ({alt || "ilustracja"}).</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="ref-image" src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} />;
}

/** Source materials (texts, images) printed above the question. */
export function References({ items, partId, supabaseUrl }: { items?: CkeReference[]; partId?: string; supabaseUrl: string }) {
  if (!items?.length) return null;
  return (
    <div className={`q-reference${items.length > 1 ? " q-reference-multi" : ""}`}>
      {items.map((ref, i) => {
        const type = ref.type || "text";
        const label = ref.title || ref.name || "";
        return (
          <figure key={ref.id ?? i} className="q-reference-item">
            {ref.author && <figcaption className="ref-author">{ref.author}</figcaption>}
            {label && <figcaption className="ref-title">{label}</figcaption>}
            {type === "image" && ref.path && partId ? (
              <ReferenceImage src={assetPublicUrl(supabaseUrl, partId, ref.path)} alt={label} />
            ) : type === "image" || type === "sound" ? (
              <div className="ref-missing">Materiał niedostępny w wersji internetowej.</div>
            ) : (
              <div className="ref-content">
                {proseParagraphs(ref.content).map((p, j) => (
                  <p key={j} className={p.source ? "ref-source" : undefined}>
                    <WithFootnotes text={p.text} />
                  </p>
                ))}
              </div>
            )}
            {!!ref.footnotes?.length && (
              <ul className="ref-footnotes">
                {ref.footnotes.map((f, j) => (
                  <li key={j} className="footnote-item">
                    <span className="footnote-n">{String(f.n ?? "")}</span> {f.text}
                  </li>
                ))}
              </ul>
            )}
          </figure>
        );
      })}
    </div>
  );
}
