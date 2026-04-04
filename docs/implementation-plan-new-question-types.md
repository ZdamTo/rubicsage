# Implementation Plan — New Question Types: sql_query, spreadsheet_task, cloze_text

## Architecture Overview

Every question type in ZdamTo.io touches the same 6-layer stack. New types must implement each layer.

```
Layer 1  schemas.ts          → Zod type definition + discriminated union
Layer 2  deterministic-scorer.ts → scoring logic (if not pure AI)
Layer 3  prompts.ts          → AI grading prompt builder
Layer 4  grade/route.ts      → server-side case + DB persist
Layer 5  questions/XInput.tsx → React input component
Layer 6  QuizRunner.tsx      → wire input + buildUserAnswer + buildAttachments
```

---

## File-by-File Plan

### `src/lib/quiz/schemas.ts` — ADD 3 schemas + extend union

**sql_query**
```typescript
SqlQueryQuestion = QuestionBase.extend({
  type: "sql_query",
  schemaMarkdown?: string,        // ERD / table definitions in Markdown
  tables?: Table[],               // structured table metadata
  expectedResult?: Record[],      // expected rows (used in prompt)
  expectedQueryPatterns?: string[], // keywords/patterns the query must contain
  dialect?: "sql" | "mysql" | "postgresql" | "sqlite",
  seedData?: string,              // INSERT statements shown to student
  rubric?: string,
})
```

**spreadsheet_task**
```typescript
SpreadsheetTaskQuestion = QuestionBase.extend({
  type: "spreadsheet_task",
  sourceDataDescription: string,  // markdown table / description shown to student
  expectedOutputs: ExpectedOutput[],  // [{id, label, description, type}]
  requiredChart?: { type, description },
  rubric?: string,
})
```
`ExpectedOutput.type` enum: `"formula" | "value" | "range" | "chart" | "summary"`

**cloze_text**
```typescript
ClozeTextQuestion = QuestionBase.extend({
  type: "cloze_text",
  template: string,               // "SELECT {{col}} FROM {{tbl}}"
  blanks: ClozeBlank[],
})

ClozeBlank = {
  id: string,
  correctAnswer: string,
  acceptedAnswers?: string[],
  caseSensitive?: boolean,        // default false
  points?: number,                // default 1 — partial credit per blank
}
```

---

### `src/lib/ai/deterministic-scorer.ts` — ADD scoreClozeText()

```typescript
export interface ClozeBlankResult {
  blankId: string; userAnswer: string; correctAnswer: string;
  isCorrect: boolean; points: number; earnedPoints: number;
}

scoreClozeText(
  userAnswers: Record<string, string>,
  blanks: ClozeBlank[],
  maxScore: number
): DeterministicResult & { blankResults: ClozeBlankResult[] }
```

Logic: for each blank, check `userAnswer === correctAnswer` (or in `acceptedAnswers`), respecting `caseSensitive`. Sum `earnedPoints`. Scale to `maxScore`.

---

### `src/lib/ai/prompts.ts` — ADD 3 helpers

**buildSqlContextAddendum(question)** — appends schema + expected result to rubric string
**buildSpreadsheetContextAddendum(question)** — appends source data + expected outputs
**buildClozeResultSummary(blankResults)** — appends per-blank correctness to rubric for AI feedback

The main `buildRubricScoringPrompt()` is **not changed** — context is injected via the `rubric` field of `GradePayload` before calling the client.

---

### `src/app/api/grade/route.ts` — ADD 3 cases

```
case "sql_query":
  → AI grade, but rubric is augmented with schema + expected patterns
  → mode: "ai"

case "spreadsheet_task":
  → AI grade, rubric augmented with source data + expected outputs
  → mode: "ai"

case "cloze_text":
  → scoreClozeText() → deterministic score
  → AI called for qualitative feedback only (score overridden to det.score)
  → mode: "hybrid"
```

---

### `src/components/questions/SqlQueryInput.tsx`

- Monaco editor, language `"sql"`
- Collapsible schema panel (renders `schemaMarkdown` via MarkdownRenderer)
- Collapsible seed data panel
- No run button (no in-browser SQL engine)
- Props: `query`, `onQueryChange`, `schemaMarkdown?`, `seedData?`, `disabled?`

---

### `src/components/questions/SpreadsheetTaskInput.tsx`

- Shows `sourceDataDescription` (MarkdownRenderer)
- Renders one labeled textarea per `expectedOutput` entry
- Shows chart description field if `requiredChart` present
- State: `Record<outputId, string>` → serialized as JSON answer
- Props: `outputs`, `values`, `onChange`, `sourceDataDescription`, `requiredChart?`, `disabled?`

---

### `src/components/questions/ClozeTextInput.tsx`

- Parses `template` splitting on `/\{\{(\w+)\}\}/g`
- Renders inline `<input>` elements for each placeholder
- After submission: green border for correct blank, red for wrong
- State: `Record<blankId, string>`
- Props: `template`, `blanks`, `values`, `onChange`, `disabled?`, `submitted?`, `results?`

---

### `src/app/quiz/[quizId]/QuizRunner.tsx`

Add to `QuestionState`:
```typescript
spreadsheetOutputs?: Record<string, string>;
clozeAnswers?: Record<string, string>;
```

Extend `buildUserAnswer`:
```
sql_query        → state.answer (raw SQL string)
spreadsheet_task → JSON.stringify(state.spreadsheetOutputs ?? {})
cloze_text       → JSON.stringify(state.clozeAnswers ?? {})
```

Add 3 cases to `QuestionInput` switch.

---

### Demo JSON Files

`data/quizzes/informatics-sql-demo.json`
- 2 questions: `sql_query` type, realistic Polish matura task (SELECT + JOIN)

`data/quizzes/informatics-spreadsheet-demo.json`
- 2 questions: `spreadsheet_task` type (SUMA/SUMA.JEŻELI formula + chart)

`data/quizzes/informatics-cloze-demo.json`
- 2 questions: `cloze_text` type (fill in SQL keywords, fill in algorithm steps)

---

### `docs/question-types.md`

Full reference covering all 10 question types — schema fields, grading mode, UI behaviour, JSON example for each.

---

## Backward Compatibility

- Existing question types are **not touched** — only the union is extended
- All new types use `grading.mode` consistent with their scoring approach
- Demo quizzes are independent files — no existing quiz is modified
- No database migration required — all content lives in `quiz_versions.content` (jsonb)
