import Link from "next/link";

/**
 * The exam card from the zdamto.io prototype (rounded-2xl, corner blob, level
 * badge, two-line fact list, "Rozwiąż →" footer), reused for every subject so
 * choosing a subject and choosing a test look like one product.
 */

export type Accent = "indigo" | "purple" | "teal" | "amber" | "slate";

// Literal class names so Tailwind can see them.
const ACCENTS: Record<Accent, { blob: string; badge: string; glyph: string; cta: string; hover: string }> = {
  indigo: { blob: "bg-indigo-50 group-hover:bg-indigo-100", badge: "bg-indigo-600 text-white", glyph: "text-indigo-300", cta: "text-indigo-600", hover: "hover:border-indigo-300" },
  purple: { blob: "bg-purple-50 group-hover:bg-purple-100", badge: "bg-purple-600 text-white", glyph: "text-purple-300", cta: "text-purple-600", hover: "hover:border-purple-300" },
  teal: { blob: "bg-teal-50 group-hover:bg-teal-100", badge: "bg-teal-600 text-white", glyph: "text-teal-300", cta: "text-teal-600", hover: "hover:border-teal-300" },
  amber: { blob: "bg-amber-50 group-hover:bg-amber-100", badge: "bg-amber-500 text-white", glyph: "text-amber-300", cta: "text-amber-600", hover: "hover:border-amber-300" },
  slate: { blob: "bg-slate-100", badge: "bg-slate-200 text-slate-500", glyph: "text-slate-200", cta: "text-slate-500", hover: "" },
};

/** Subject → accent, shared by the home page, the navbar-linked subject pages and the quiz lists. */
export const SUBJECT_ACCENT: Record<string, Accent> = {
  polish: "indigo",
  math: "teal",
  informatics: "purple",
};

interface Props {
  href?: string;
  badge: string;
  icon: string;
  title: string;
  subtitle?: string;
  facts?: string[];
  cta?: string;
  accent: Accent;
  disabled?: boolean;
  chip?: string;
}

export function ThemedCard({ href, badge, icon, title, subtitle, facts = [], cta = "Rozwiąż →", accent, disabled, chip }: Props) {
  const c = ACCENTS[disabled ? "slate" : accent];
  const body = (
    <>
      <div className={`absolute -right-5 -top-5 h-20 w-20 rounded-full transition-colors ${c.blob}`} />
      <div className="relative flex h-full flex-col">
        <div className="mb-3 flex items-center justify-between">
          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${c.badge}`}>{badge}</span>
          <span className={`text-2xl ${c.glyph}`} aria-hidden="true">{icon}</span>
        </div>
        <h3 className={`mb-0.5 text-base font-bold ${disabled ? "text-slate-500" : "text-slate-800"}`}>{title}</h3>
        {subtitle && <p className="mb-3 text-[11px] text-slate-500">{subtitle}</p>}
        {facts.length > 0 && (
          <ul className="mb-3 flex-grow space-y-1 text-[11px] text-slate-500">
            {facts.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        )}
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className={`text-xs font-semibold ${c.cta}`}>{disabled ? chip ?? "wkrótce" : cta}</span>
          {!disabled && chip && <span className="text-[10px] font-semibold text-slate-400">{chip}</span>}
        </div>
      </div>
    </>
  );
  const cls = `group relative flex min-h-[10rem] flex-col overflow-hidden rounded-2xl border p-4 shadow-sm transition-all ${
    disabled ? "border-slate-100 bg-slate-50/60 shadow-none" : `border-slate-200 bg-white hover:-translate-y-1 hover:shadow-xl ${c.hover}`
  }`;
  if (!href || disabled) return <div className={cls}>{body}</div>;
  return <Link href={href} className={cls}>{body}</Link>;
}
