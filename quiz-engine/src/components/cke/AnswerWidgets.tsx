"use client";

import type { ClientQuestion } from "@/lib/cke/sanitize";
import type { CkeTableCell, EssayAnswer, PTextAnswerField } from "@/lib/cke/types";
import { countWords, inputColumn, isInputCell, optionLabel } from "@/lib/cke/answers";
import { topicTitleParts } from "@/lib/cke/display";

/**
 * Answer widgets for the six CKE types, ported from the prototype's
 * renderers.js `render()` / `collect()` pairs. Controlled components: the
 * answer lives in the runner's state in exactly the prototype's shape.
 */

export interface WidgetProps<T = unknown> {
  q: ClientQuestion;
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
}

const rec = (v: unknown): Record<string, string> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};

function cellText(cell: CkeTableCell | undefined): string {
  if (typeof cell === "object" && cell !== null) return cell.content || "";
  return cell || "";
}

/* P-TEXT — one or more free-text fields, each with an optional prefix. */
export function PTextWidget({ q, value, onChange, disabled }: WidgetProps) {
  const fields = (Array.isArray(value) ? value : (q.user_answer as PTextAnswerField[]) ?? []) as PTextAnswerField[];
  const list = fields.length ? fields : [{ answer: "" }];
  return (
    <>
      {list.map((f, i) => (
        <div className="answer-row" key={f["input-field-id"] ?? i}>
          {f["input-field-prefix"] && <label className="answer-label" htmlFor={`${q.id}-f${i}`}>{f["input-field-prefix"]}</label>}
          <textarea
            id={`${q.id}-f${i}`}
            className="student-input"
            rows={4}
            value={f.answer ?? ""}
            disabled={disabled}
            aria-label={f["input-field-prefix"] || `Odpowiedź do zadania ${q.number}`}
            onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
          />
        </div>
      ))}
    </>
  );
}

/* P-TABLE-TEXT — a table whose empty cells are filled in with free text. */
export function PTableTextWidget({ q, value, onChange, disabled }: WidgetProps) {
  const rows = q.table?.rows ?? [];
  if (!rows.length) return <div className="q-unsupported">Brak wierszy w tabeli.</div>;
  const columns = Object.keys(rows[0].cells ?? {});
  const hasLabels = rows.some((r) => r.label);
  const ua = rec(value);
  return (
    <table className="task-table">
      <thead>
        <tr>
          {hasLabels && <th />}
          {columns.map((c) => <th key={c}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const input = inputColumn(row);
          return (
            <tr key={row.id}>
              {hasLabels && <td className="row-label">{row.label}</td>}
              {columns.map((col) => (
                <td key={col}>
                  {col === input ? (
                    <input
                      className="student-input"
                      value={ua[row.id] ?? ""}
                      disabled={disabled}
                      aria-label={`${col}${row.label ? ` (${row.label})` : ""}`}
                      onChange={(e) => onChange({ ...ua, [row.id]: e.target.value })}
                    />
                  ) : (
                    <div className="cell-content">{cellText(row.cells[col])}</div>
                  )}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* P-TABLE-MATCH — each row gets one option picked from the legend. */
export function PTableMatchWidget({ q, value, onChange, disabled }: WidgetProps) {
  const rows = q.table?.rows ?? [];
  if (!rows.length) return <div className="q-unsupported">Brak wierszy w tabeli.</div>;
  const columns = Object.keys(rows[0].cells ?? {});
  const hasLabels = rows.some((r) => r.label);
  const ua = rec(value);
  const options = q.options ?? [];
  return (
    <>
      <table className="task-table">
        <thead>
          <tr>
            {hasLabels && <th />}
            {columns.map((c) => <th key={c}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {hasLabels && <td className="row-label">{row.label}</td>}
              {columns.map((col) => (
                <td key={col}>
                  {isInputCell(row, col) ? (
                    <select
                      className="student-input"
                      value={ua[row.id] ?? ""}
                      disabled={disabled}
                      aria-label={`${col}${row.label ? ` (${row.label})` : ""}`}
                      onChange={(e) => onChange({ ...ua, [row.id]: e.target.value })}
                    >
                      <option value="" />
                      {options.map((o) => (
                        <option key={o.id} value={optionLabel(o)}>{optionLabel(o)}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="cell-content">{cellText(row.cells[col])}</div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!!options.length && (
        <div className="q-options">
          <div className="q-options-title">Opcje</div>
          <ul className="option-list">
            {options.map((o) => (
              <li key={o.id} className="option-item">
                <span className="option-value">{optionLabel(o)}.</span> {o.content}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/* P-TF — P/F boxes, coloured like the paper's cells. */
export function PTfWidget({ q, value, onChange, disabled }: WidgetProps) {
  const statements = q.tf_questions ?? [];
  if (!statements.length) return <div className="q-unsupported">Brak stwierdzeń.</div>;
  const ua = rec(value);
  return (
    <div className="tf-list">
      {statements.map((s, i) => (
        <div className="tf-row" key={s.id}>
          <div className="tf-num">{i + 1}.</div>
          <div className="tf-statement">{s.question}</div>
          <div className="tf-choices" role="radiogroup" aria-label={`Stwierdzenie ${i + 1}`}>
            {(["P", "F"] as const).map((val) => (
              <label key={val} className={`tf-box tf-box-${val.toLowerCase()}`}>
                <input
                  type="radio"
                  name={`tf-${q.id}-${s.id}`}
                  value={val}
                  checked={ua[s.id] === val}
                  disabled={disabled}
                  onChange={() => onChange({ ...ua, [s.id]: val })}
                />
                <span className="tf-box-face">{val}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* P-CHOICE / P-SINGLE-CHOICE — one option from a list. */
export function PChoiceWidget({ q, value, onChange, disabled }: WidgetProps) {
  const options = q.options ?? [];
  if (!options.length) return <div className="q-unsupported">Brak opcji.</div>;
  const ua = rec(value);
  const key = "selected_option" in ua && !("selected_option_id" in ua) ? "selected_option" : "selected_option_id";
  const current = ua[key] ?? "";
  return (
    <div className="choice-list" role="radiogroup">
      {options.map((o) => (
        <label key={o.id} className={`choice-row ${current === o.id ? "choice-selected" : ""}`}>
          <input
            type="radio"
            name={`choice-${q.id}`}
            value={o.id}
            checked={current === o.id}
            disabled={disabled}
            onChange={() => onChange({ [key]: o.id })}
          />
          <span className="choice-label">{o.label || optionLabel(o)}</span>
          <span className="choice-content">{o.content}</span>
        </label>
      ))}
    </div>
  );
}

/* P-ESSAY — pick one of the topics, then write on the lined sheet. */
export function PEssayWidget({ q, value, onChange, disabled }: WidgetProps) {
  const ua = (value && typeof value === "object" ? value : {}) as Partial<EssayAnswer>;
  const answer: EssayAnswer = {
    selected_topic_id: ua.selected_topic_id ?? "",
    content: ua.content ?? "",
    has_specific_learning_difficulties: ua.has_specific_learning_difficulties === true,
  };
  const topics = q.topics ?? [];
  const selected = topics.find((t) => t.id === answer.selected_topic_id);
  const words = countWords(answer.content);
  const min = Number(q.minimum_word_count) || 0;
  const set = (patch: Partial<EssayAnswer>) => onChange({ ...answer, ...patch, word_count: countWords(patch.content ?? answer.content) });

  return (
    <div className="essay">
      <div className="topic-picker" role="radiogroup" aria-label="Wybór tematu">
        {topics.map((t) => (
          <label key={t.id} className={`topic-card ${answer.selected_topic_id === t.id ? "topic-selected" : ""}`}>
            <div className="topic-head">
              <input
                type="radio"
                name={`essay-${q.id}`}
                value={t.id}
                checked={answer.selected_topic_id === t.id}
                disabled={disabled}
                onChange={() => set({ selected_topic_id: t.id })}
              />
              <span className="topic-num">{t.number}</span>
            </div>
            {topicTitleParts(t.title).map((p, i) =>
              p.kind === "title" ? (
                <div key={i} className="topic-title">{p.text}</div>
              ) : (
                <p key={i} className={p.kind === "source" ? "topic-source" : "topic-quote"}>{p.text}</p>
              )
            )}
            {!!t.requirements?.length && (
              <>
                <div className="topic-req-intro">W pracy odwołaj się do:</div>
                <ul className="topic-req">{t.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </>
            )}
          </label>
        ))}
      </div>
      <div className="essay-heading">
        <div className="essay-heading-title">WYPRACOWANIE</div>
        <div className="essay-heading-sub">na temat nr <span>{selected?.number || "…………"}</span></div>
      </div>
      <textarea
        className="essay-content"
        rows={16}
        placeholder="Tutaj napisz swoje wypracowanie…"
        value={answer.content}
        disabled={disabled}
        aria-label="Treść wypracowania"
        onChange={(e) => set({ content: e.target.value })}
      />
      <div className="essay-meta">
        Liczba wyrazów:{" "}
        <span className={min ? (words >= min ? "count-ok" : "count-low") : undefined}>{words}</span>
        {min ? ` / min. ${min}` : ""}
      </div>
      <label className="essay-sld">
        <input
          type="checkbox"
          checked={answer.has_specific_learning_difficulties}
          disabled={disabled}
          onChange={(e) => set({ has_specific_learning_difficulties: e.target.checked })}
        />
        Mam stwierdzone specyficzne trudności w uczeniu się (dysleksja) — przy ocenie ortografii i interpunkcji
        stosowane są wtedy łagodniejsze progi CKE.
      </label>
    </div>
  );
}
