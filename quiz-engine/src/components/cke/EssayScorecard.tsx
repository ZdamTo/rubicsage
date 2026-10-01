"use client";

import { useEffect, type ReactNode } from "react";
import type { EssayEvaluation } from "@/lib/cke/types";
import type { EssayScorecardInfo } from "@/lib/cke/sanitize";

/**
 * The wypracowanie result drawn as CKE's examiner table ("Tabele wypełnia
 * egzaminator!"), criterion by criterion — ported from renderEssayScorecard()
 * in the prototype. Criteria excluded by a gating rule are shown greyed out.
 *
 * Threshold tooltips (3b, 4a, 4b, 4c) are built from the paper's own rubric
 * (podstawowy and rozszerzony differ); the prototype hardcoded the PP ones.
 */

type Rec = Record<string, unknown>;

/* ── tooltip: one floating element for the whole page ─────────────────── */
let tipEl: HTMLDivElement | null = null;
let tipUsers = 0;
let detach: (() => void) | null = null;

function useScTooltip() {
  useEffect(() => {
    tipUsers++;
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.className = "sc-tooltip";
      document.body.appendChild(tipEl);
      const el = tipEl;
      const show = (target: Element) => {
        el.textContent = target.getAttribute("data-tip"); // textContent: never parsed as HTML
        el.classList.add("sc-tooltip-on");
        const r = target.getBoundingClientRect();
        const tw = el.offsetWidth, th = el.offsetHeight;
        let left = r.left + r.width / 2 - tw / 2;
        let top = r.top - th - 9;
        let place = "top";
        if (top < 8) { top = r.bottom + 9; place = "bottom"; }
        left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
        const arrow = r.left + r.width / 2 - left;
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.setProperty("--sc-arrow", `${Math.max(12, Math.min(arrow, tw - 12))}px`);
        el.dataset.place = place;
      };
      const hide = () => el.classList.remove("sc-tooltip-on");
      const over = (e: MouseEvent) => {
        const t = (e.target as Element | null)?.closest?.(".scorecard [data-tip]");
        if (t) show(t);
      };
      const out = (e: MouseEvent) => {
        if ((e.target as Element | null)?.closest?.("[data-tip]")) hide();
      };
      document.addEventListener("mouseover", over);
      document.addEventListener("mouseout", out);
      document.addEventListener("scroll", hide, true);
      detach = () => {
        document.removeEventListener("mouseover", over);
        document.removeEventListener("mouseout", out);
        document.removeEventListener("scroll", hide, true);
        el.remove();
        tipEl = null;
      };
    }
    return () => {
      tipUsers--;
      if (tipUsers === 0 && detach) { detach(); detach = null; }
    };
  }, []);
}

/* ── rubric text (criteria whose wording does not change between levels) ── */
const ZERO_REASONS = [
  { id: "cardinal_error", label: "Błąd kardynalny.", tip: "Błąd kardynalny to błąd rzeczowy świadczący o: (1) nieznajomości treści lektury obowiązkowej, do której odwołuje się zdający — w zakresie fabuły (w tym głównych wątków utworu) lub losów głównych bohaterów; LUB (2) całkowicie nieuprawnionej interpretacji lektury obowiązkowej będącej falsyfikacją danego tekstu." },
  { id: "missing_required_reading", label: "Brak lektury obowiązkowej.", tip: "Aby uzyskać 1 pkt, w wypracowaniu musi być odwołanie do lektury obowiązkowej wybranej z listy lektur zamieszczonej w arkuszu. Odwołanie musi mieć charakter analityczny." },
  { id: "does_not_address_problem", label: "Nie dotyczy problemu.", tip: "Aby uzyskać 1 pkt, wypracowanie musi przynajmniej częściowo dotyczyć problemu wskazanego w poleceniu — obejmować zakres merytoryczny zagadnienia ORAZ opinię zdającego wraz z uzasadnieniem." },
  { id: "not_argumentative", label: "Nie jest wypowiedzią argumentacyjną.", tip: "Aby uzyskać 1 pkt, wypracowanie musi przynajmniej częściowo być wypowiedzią argumentacyjną (zawierać co najmniej jeden akapit argumentacyjny)." },
];
const C1_TIPS: Record<number, string> = {
  1: "1 pkt — brak błędu kardynalnego ORAZ odwołanie do lektury obowiązkowej z listy w arkuszu ORAZ praca przynajmniej częściowo dotyczy problemu z polecenia ORAZ jest przynajmniej częściowo wypowiedzią argumentacyjną.",
  0: "0 pkt — praca nie spełnia któregokolwiek z warunków na 1 pkt. Jeżeli w kryterium 1 przyznano 0 pkt, we wszystkich pozostałych kryteriach przyznaje się 0 pkt.",
};
// Kryterium 2 (KLiK) levels as printed in the PODSTAWOWY rubric only.
const C2_TIPS_PP: Record<number, string> = {
  16: "Dwa utwory wykorzystane w pełni funkcjonalnie. Bogata argumentacja. Funkcjonalne wykorzystanie dwóch kontekstów. Erudycja.",
  15: "Dwa utwory w pełni funkcjonalnie. Zadowalająca argumentacja. Co najmniej jeden kontekst funkcjonalnie.",
  14: "Dwa utwory w pełni funkcjonalnie. Zadowalająca argumentacja. Konteksty częściowo funkcjonalnie.",
  13: "Dwa utwory w pełni funkcjonalnie. Powierzchowna argumentacja. Konteksty niefunkcjonalnie.",
  12: "Jeden utwór w pełni, drugi częściowo funkcjonalnie. Bogata argumentacja. Dwa konteksty funkcjonalnie. Erudycja.",
  11: "Jeden utwór w pełni, drugi częściowo funkcjonalnie. Zadowalająca argumentacja. Co najmniej jeden kontekst funkcjonalnie.",
  10: "Jeden utwór w pełni, drugi częściowo funkcjonalnie. Powierzchowna argumentacja. Konteksty częściowo funkcjonalnie.",
  9: "Jeden utwór w pełni, drugi częściowo funkcjonalnie. Powierzchowna argumentacja. Konteksty niefunkcjonalnie.",
  8: "Dwa utwory częściowo funkcjonalnie ALBO jeden w pełni, drugi niefunkcjonalnie. Trafna argumentacja. Dwa konteksty funkcjonalnie.",
  7: "Dwa utwory częściowo funkcjonalnie ALBO jeden w pełni, drugi niefunkcjonalnie. Zadowalająca argumentacja. Co najmniej jeden kontekst funkcjonalnie.",
  6: "Dwa utwory częściowo funkcjonalnie ALBO jeden w pełni, drugi niefunkcjonalnie. Powierzchowna argumentacja. Konteksty częściowo funkcjonalnie.",
  5: "Dwa utwory częściowo funkcjonalnie ALBO jeden w pełni, drugi niefunkcjonalnie. Powierzchowna argumentacja. Konteksty niefunkcjonalnie.",
  4: "Tylko jeden utwór częściowo funkcjonalnie. Trafna argumentacja. Dwa konteksty funkcjonalnie.",
  3: "Tylko jeden utwór częściowo funkcjonalnie. Zadowalająca argumentacja. Co najmniej jeden kontekst funkcjonalnie.",
  2: "Tylko jeden utwór częściowo funkcjonalnie. Powierzchowna argumentacja. Konteksty częściowo funkcjonalnie.",
  1: "Tylko jeden utwór częściowo funkcjonalnie. Powierzchowna argumentacja. Konteksty niefunkcjonalnie.",
  0: "Żaden utwór nie został wykorzystany przynajmniej częściowo funkcjonalnie. Za każdy błąd rzeczowy odejmuje się 1 pkt.",
};
const C3A_CLS: Array<{ code: string; points: number; desc: string }> = [
  { code: "G", points: 0, desc: "Elementy treściowe niezorganizowane; zbiór w znacznej mierze niezależnych elementów." },
  { code: "F", points: 0, desc: "Organizacja wyłącznie formalna; usterki w podziale w skali ogólnej ORAZ w zakresie akapitów." },
  { code: "E", points: 1, desc: "Organizacja częściowo problemowa, częściowo formalna; usterki w podziale w skali ogólnej ALBO akapitów." },
  { code: "C", points: 1, desc: "Organizacja problemowa; usterki w podziale w skali ogólnej ORAZ akapitów." },
  { code: "D", points: 2, desc: "Próba organizacji problemowej; podział poprawny (dopuszczalna 1 usterka)." },
  { code: "B", points: 2, desc: "Organizacja problemowa; usterki w podziale w skali ogólnej ALBO akapitów." },
  { code: "A", points: 3, desc: "Organizacja problemowa; podział poprawny w skali ogólnej i akapitów (dopuszczalna 1 usterka)." },
];
const C3C_TIPS: Record<number, string> = {
  1: "1 pkt — styl w całości lub w przeważającej części stosowny (adekwatny do odmiany pisanej i sytuacji komunikacyjnej).",
  0: "0 pkt — wypracowanie nie spełnia warunków na 1 pkt.",
};
const RANGE_NAMES: Record<string, string> = { "1": "szeroki zakres środków językowych", "2": "zadowalający zakres", "3": "wąski zakres" };

type CountRange = { min: number; max: number | null; points: number };
function rangeText(r: CountRange, noun: string) {
  const span = r.max === null ? `${r.min} lub więcej` : r.min === r.max ? `${r.min}` : r.min === 0 ? `nie więcej niż ${r.max}` : `${r.min}–${r.max}`;
  return `${span} ${noun}`;
}
function thresholdTips(std: CountRange[], sld: CountRange[], noun: string): Record<number, string> {
  const tips: Record<number, string> = {};
  for (const r of std) {
    const alt = sld.find((s) => s.points === r.points);
    tips[r.points] = `${r.points} pkt — ${rangeText(r, noun)}.${alt ? ` (Specyficzne trudności: ${rangeText(alt, noun)}.)` : ""}`;
  }
  return tips;
}

/* ── building blocks ─────────────────────────────────────────────────── */
const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

function Boxes({ values, awarded, size, tips, filler }: { values: number[]; awarded: unknown; size?: "sm" | "wide"; tips?: Record<number, string>; filler?: boolean }) {
  return (
    <span className={`sc-boxstrip ${size === "sm" ? "sc-boxstrip-sm" : size === "wide" ? "sc-boxstrip-wide" : ""}`}>
      {values.map((n) => (
        <span key={n} className={`sc-box ${String(n) === String(awarded) ? "sc-box-on" : ""}`} data-tip={tips?.[n]}>{n}</span>
      ))}
      {filler && <span className="sc-box sc-box-filler" />}
    </span>
  );
}

function RedBox({ head1, head2, value }: { head1: string; head2: string; value: unknown }) {
  return (
    <div className="sc-redbox">
      <div className="sc-redbox-head">{head1}<br />{head2}</div>
      <div className="sc-redbox-val">{String(value ?? 0)}</div>
    </div>
  );
}

function Row({ num, label, greyed, children }: { num: string; label: string; greyed?: boolean; children: ReactNode }) {
  return (
    <div className={`sc-row ${greyed ? "sc-row-greyed" : ""}`}>
      <div className="sc-num">{num}</div>
      <div className="sc-label">{label}{greyed && <span className="sc-excluded">nie wlicza się</span>}</div>
      <div className="sc-cells">{children}</div>
    </div>
  );
}

export function EssayScorecard({ evaluation, info }: { evaluation: EssayEvaluation; info?: EssayScorecardInfo }) {
  useScTooltip();
  const raw = evaluation.raw_table_fill || {};
  const eff = evaluation.effective_table_fill || {};
  const get = (k: string) => ({ c: (raw[k] || {}) as Rec, greyed: eff[k]?.display_state === "greyed_out" || eff[k]?.counted === false });

  const isPP = (info?.poziom || "PP").toUpperCase() === "PP";
  const tips3b = info?.rules3b?.length ? thresholdTips(info.rules3b, [], "zaburzeń spójności") : undefined;
  const tips4b = info ? thresholdTips(info.thresholds4b.standard, info.thresholds4b.sld, "błędów ortograficznych") : undefined;
  const tips4c = info ? thresholdTips(info.thresholds4c.standard, info.thresholds4c.sld, "błędów interpunkcyjnych") : undefined;
  const matrix4a = info?.matrix4a?.length ? info.matrix4a : [];

  const c1 = get("1"), c2 = get("2"), c3a = get("3a"), c3b = get("3b"), c3c = get("3c"), c4a = get("4a"), c4b = get("4b"), c4c = get("4c");
  const zr = (c1.c.zero_reasons || {}) as Record<string, unknown>;
  const base2 = c2.c.base_points_before_factual_errors ?? 0;
  const final2 = c2.c.final_points ?? base2;
  const cls3a = String(c3a.c.classification || "").toUpperCase();
  const cls4a = String(c4a.c.classification || "").toUpperCase();

  return (
    <div className="scorecard">
      <Row num="1." label="Spełnienie formalnych warunków polecenia" greyed={c1.greyed}>
        <div className="sc-boxrow sc-attach">
          <Boxes values={[0, 1]} awarded={c1.c.points ?? 0} tips={C1_TIPS} />
          <div className="sc-reasons">
            <div className="sc-reasons-head">Jeżeli 0 pkt – wskaż powód.</div>
            <div className="sc-reasons-list">
              {ZERO_REASONS.map((r) => (
                <span key={r.id} className={`sc-reason ${zr[r.id] ? "sc-reason-on" : ""}`} data-tip={r.tip}>{r.label}</span>
              ))}
            </div>
          </div>
        </div>
      </Row>

      <Row num="2." label="Kompetencje literackie i kulturowe" greyed={c2.greyed}>
        <div className="sc-c2">
          <div className="sc-c2-boxes">
            <div className="sc-boxline"><Boxes values={range(0, 8)} awarded={base2} size="sm" tips={isPP ? C2_TIPS_PP : undefined} /></div>
            <div className="sc-boxline"><Boxes values={range(9, 16)} awarded={base2} size="sm" tips={isPP ? C2_TIPS_PP : undefined} filler /></div>
          </div>
          <RedBox head1="Liczba błędów" head2="rzeczowych" value={c2.c.factual_error_count} />
          <div className="sc-ogolem">
            <div className="sc-ogolem-head">OGÓŁEM<br />KLiK</div>
            <div className="sc-ogolem-val">{String(final2)}</div>
          </div>
        </div>
      </Row>

      <Row num="3a" label="Struktura wypowiedzi" greyed={c3a.greyed}>
        <div className="sc-boxrow">
          <Boxes values={range(0, 3)} awarded={c3a.c.points ?? 0} size="wide"
            tips={{ 3: "3 pkt — klasyfikacja A.", 2: "2 pkt — klasyfikacja B albo D.", 1: "1 pkt — klasyfikacja C albo E.", 0: "0 pkt — klasyfikacja F albo G." }} />
        </div>
        <div className="sc-clsrow">
          {C3A_CLS.map((l) => (
            <span key={l.code} className={`sc-cls ${l.code === cls3a ? "sc-cls-on" : ""}`} data-tip={`${l.code} → ${l.points} pkt. ${l.desc}`}>{l.code}</span>
          ))}
        </div>
      </Row>

      <Row num="3b" label="Spójność wypowiedzi" greyed={c3b.greyed}>
        <div className="sc-boxrow">
          <RedBox head1="Liczba błędów" head2="w spójności" value={c3b.c.cohesion_error_count} />
          <Boxes values={range(0, 3)} awarded={c3b.c.points ?? 0} tips={tips3b} />
        </div>
      </Row>

      <Row num="3c" label="Styl wypowiedzi" greyed={c3c.greyed}>
        <div className="sc-boxrow"><Boxes values={[0, 1]} awarded={c3c.c.points ?? 0} tips={C3C_TIPS} /></div>
      </Row>

      <Row num="4a" label="Zakres i poprawność środków językowych" greyed={c4a.greyed}>
        <div className="sc-boxrow">
          <RedBox head1="Liczba błędów" head2="językowych" value={c4a.c.language_error_count} />
          <div className="sc-4a-matrix">
            {matrix4a.map((g) => (
              <div key={g.points} className="sc-4a-col">
                <span className={`sc-box sc-4a-pt ${String(g.points) === String(c4a.c.points ?? 0) ? "sc-box-on" : ""}`}>{g.points}</span>
                <span className="sc-4a-codes">
                  {g.codes.map((code) => (
                    <span key={code} className={`sc-4a-code ${code === cls4a ? "sc-4a-code-on" : ""}`}
                      data-tip={`${code} → ${g.points} pkt. ${RANGE_NAMES[code[0]] ?? ""}, przedział błędów ${code.slice(1)}.`}>
                      <span>{code[0]}</span><span>{code.slice(1)}</span>
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Row>

      <Row num="4b" label="Poprawność ortograficzna" greyed={c4b.greyed}>
        <div className="sc-boxrow">
          <RedBox head1="Liczba błędów" head2="ortograficznych" value={c4b.c.orthographic_error_count} />
          <Boxes values={range(0, 2)} awarded={c4b.c.points ?? 0} tips={tips4b} />
        </div>
      </Row>

      <Row num="4c" label="Poprawność interpunkcyjna" greyed={c4c.greyed}>
        <div className="sc-boxrow">
          <RedBox head1="Liczba błędów" head2="interpunkcyjnych" value={c4c.c.punctuation_error_count} />
          <Boxes values={range(0, 2)} awarded={c4c.c.points ?? 0} tips={tips4c} />
        </div>
      </Row>

      <div className="sc-total">
        <span className="sc-total-label">Łączna liczba punktów:</span>
        <span className="sc-total-val">{evaluation.totals.official_points} / {evaluation.totals.max_points}</span>
      </div>
      {evaluation.applied_gating_rules.length > 0 && (
        <p className="sc-expl">
          Zastosowano reguły zerujące z zasad oceniania ({evaluation.applied_gating_rules.join(", ")}); wyszarzone kryteria
          oceniono diagnostycznie, ale nie wliczają się do wyniku (suma diagnostyczna: {evaluation.totals.raw_diagnostic_points} pkt).
        </p>
      )}
      <p className="sc-caption">
        Ocena AI jest szacunkiem: ten sam tekst oceniony dwukrotnie może dostać inny wynik. Punkty wylicza aplikacja
        z zasad oceniania CKE na podstawie obserwacji modelu — model nie podaje sumy.
      </p>
    </div>
  );
}
