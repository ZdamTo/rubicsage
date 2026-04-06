# Implementation Plan — table_fill, true_false_group, cloze_text fix

## Problem statement

- `table_fill` needed: real grid where students fill cells in a pre-populated table (e.g. algorithm tracing)
- `true_false_group` needed: one P/F question covering several statements as a single graded unit
- `cloze_text` bugfix: `select-none` on container makes blanks feel locked; inputs need visible affordances

## Architecture – same 6-layer stack as all other types

```
schemas.ts           → Zod type + union
deterministic-scorer → scoring function
prompts.ts           → AI feedback context builder
grade/route.ts       → case in switch
questions/XInput.tsx → React component
QuizRunner.tsx       → state, buildUserAnswer, switch case
```

---

## File-by-file plan

### `src/lib/quiz/schemas.ts`
Add after `ClozeTextQuestion`:

```
TableFillCell (discriminatedUnion: "static" | "input")
TableFillColumn  { id, label, width?, cellType? }
TableFillRow     { id, cells: Record<colId, TableFillCell> }
TableFillInputDef { id, answerType, correctAnswer, acceptedAnswers?, tolerance?, caseSensitive?, points, placeholder? }
TableFillQuestion → columns, rows, inputs
TrueFalseStatement { id, text, correctAnswer, points? }
TrueFalseGroupQuestion → labels{true,false}, statements
```

Extend QuestionType enum, extend Question union.

### `src/lib/ai/deterministic-scorer.ts`
Add:
- `TableFillInputResult` interface
- `scoreTableFill(userAnswers, inputs, maxScore)` — numeric tolerance or text match per cell
- `TrueFalseStatementResult` interface
- `scoreTrueFalseGroup(userAnswers, statements, maxScore)` — exact match of P/F label per statement

Both return `DeterministicResult & { ...Results[] }` for inline UI feedback.

### `src/lib/ai/prompts.ts`
Add:
- `buildTableFillResultSummary(inputs, inputResults)` — per-cell correct/wrong summary for AI
- `buildTrueFalseResultSummary(statements, statementResults)` — per-statement correct/wrong summary

### `src/app/api/grade/route.ts`
Add two cases:
```
case "table_fill":    → scoreTableFill() → AI feedback with result summary rubric
case "true_false_group": → scoreTrueFalseGroup() → AI feedback with result summary rubric
```
Both: deterministic score, score overridden after AI feedback call.

### `src/components/questions/TableFillInput.tsx` (NEW)
- Renders `<table>` with `overflow-x-auto` wrapper
- Static cells: `<td>` with value
- Input cells: `<td>` containing `<input>`; auto-width via `size` attr or `min-w`
- After submit: green/red cell background; wrong cells show correct answer below
- Keyboard-navigable (Tab between inputs)
- Props: `columns, rows, inputs, values, onChange, disabled?, submitted?, inputResults?`

### `src/components/questions/TrueFalseGroupInput.tsx` (NEW)
- `<div role="group">` with one row per statement
- Each row: statement text (MarkdownRenderer) + two radio buttons (labels.true / labels.false)
- After submit: green row = correct, red row = wrong + show correct label
- Props: `statements, labels, values, onChange, disabled?, submitted?, statementResults?`

### `src/components/questions/ClozeTextInput.tsx` (FIX)
- Remove `select-none` from outer container (was blocking perceived interactivity)
- Add explicit `cursor-text` + subtle `bg-white/10` background on inputs so they're visually distinct
- Add `relative z-10` to input wrapper spans to ensure no stacking issues

### `src/app/quiz/[quizId]/QuizRunner.tsx`
Extend `QuestionState`:
```typescript
tableFillAnswers?: Record<string, string>;
tableFillInputResults?: TableFillInputResult[];
trueFalseAnswers?: Record<string, string>;
trueFalseStatementResults?: TrueFalseStatementResult[];
```
Add `buildUserAnswer` cases: both serialize to `JSON.stringify(state.XAnswers ?? {})`.
Add post-grade recompute for both types (same pattern as cloze_text).
Add imports + two switch cases in `QuestionInput`.

### `data/quizzes/informatics-exam-demo.json` (NEW)
Full 5-question informatics exam around the "smallest prime factor" algorithm:
- Q1 (1.1) `table_fill` — trace spf(n) for two unknown rows
- Q2 (1.2) `true_false_group` — four P/F statements about spf
- Q3 (5)   `cloze_text` — fill in the Euclidean GCD algorithm (while loop)
- Q4 (6.4) `spreadsheet_task` — Excel analysis of algorithm timing data
- Q5 (7.5) `sql_query` — SELECT primes from Wyniki table

### `docs/question-types.md`
- Add sections 11 (`table_fill`) and 12 (`true_false_group`)
- Update authoring matrix table
- Update "Adding a New Type" checklist
