# Question Types Reference — ZdamTo.io

This document describes all 10 question types supported by the platform. Each entry covers the JSON schema, grading mode, UI behaviour, and a minimal fixture example.

---

## Common Fields (all types)

Every question object must include:

```json
{
  "id": "unique-string-within-quiz",
  "type": "<one of the 10 types below>",
  "promptMarkdown": "Question text. Supports **Markdown** and $LaTeX$.",
  "maxScore": 4,
  "grading": { "mode": "deterministic" | "ai" | "hybrid" },
  "metadata": {
    "tags": ["optional", "tags"],
    "source": "e.g. CKE 2024 or synthetic"
  }
}
```

`metadata` is optional but recommended for search and filtering.

---

## 1. `single_choice`

**Grading:** `deterministic` (exact match) + AI feedback

**When to use:** Multiple-choice questions with exactly one correct answer.

### Schema

```json
{
  "type": "single_choice",
  "choices": [
    { "id": "A", "text": "Opcja A" },
    { "id": "B", "text": "Opcja B" },
    { "id": "C", "text": "Opcja C" }
  ],
  "correctAnswer": "B"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `choices` | `{id, text}[]` | ✅ | `text` supports Markdown |
| `correctAnswer` | `string` | ✅ | Must match a `choice.id` |

### UI
Radio buttons. After submission: green = correct, red = wrong selected, no highlight = wrong unselected.

---

## 2. `multi_choice`

**Grading:** `deterministic` (exact set match) + AI feedback

**When to use:** Multiple-choice questions where the student must select all correct answers.

### Schema

```json
{
  "type": "multi_choice",
  "choices": [
    { "id": "A", "text": "Opcja A" },
    { "id": "B", "text": "Opcja B" },
    { "id": "C", "text": "Opcja C" }
  ],
  "correctAnswers": ["A", "C"]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `choices` | `{id, text}[]` | ✅ | |
| `correctAnswers` | `string[]` | ✅ | All IDs must match for full score |

### UI
Checkboxes. Full score only if the student selects exactly the correct set.

---

## 3. `short_text`

**Grading:** `ai`

**When to use:** Short open-ended answers (1–3 sentences, up to ~100 words).

### Schema

```json
{
  "type": "short_text",
  "expectedKeyPoints": [
    "Powód 1: atmosfera egzoplanet jest nieprzyjazna",
    "Powód 2: odległość — dziesiątki tysięcy lat podróży"
  ],
  "rubric": "Przyznaj 1 punkt za każdy poprawnie wskazany powód (max 2). Student musi odwołać się do tekstu."
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `expectedKeyPoints` | `string[]` | optional | Passed to AI as hints |
| `rubric` | `string` | optional | If absent, DB grading_criteria fallback is used |

### UI
Single `<textarea>`. No word count tracking.

---

## 4. `numeric`

**Grading:** `deterministic` (within tolerance) + AI feedback

**When to use:** Exact or approximate numeric answers (math, physics formulas).

### Schema

```json
{
  "type": "numeric",
  "correctAnswer": 3.14159,
  "tolerance": 0.001
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `correctAnswer` | `number` | ✅ | |
| `tolerance` | `number` | optional | Default: `0` (exact match). Absolute tolerance. |

### UI
Text input. Accepts comma as decimal separator.

---

## 5. `math_open_with_work`

**Grading:** `ai`

**When to use:** Multi-step math problems where method and reasoning count.

### Schema

```json
{
  "type": "math_open_with_work",
  "correctAnswer": "x = 5",
  "rubric": "2 pkt za poprawną metodę rozwiązania, 1 pkt za wynik końcowy."
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `correctAnswer` | `string` | ✅ | Shown to AI grader |
| `rubric` | `string` | ✅ | |

### UI
Three fields: **Final answer** (text), **Reasoning / work shown** (textarea), optional **image upload** (base64 to AI).

---

## 6. `polish_essay`

**Grading:** `ai`

**When to use:** Full Matura essays (min 300 words), CKE rubric (0–20 pts).

### Schema

```json
{
  "type": "polish_essay",
  "minWords": 300,
  "rubricFile": "rubrics/polish_essay_cke_2025.md",
  "rubric": "Optional inline rubric text (takes precedence over rubricFile)."
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `minWords` | `number` | optional | Default: `300` |
| `rubricFile` | `string` | ✅ (or `rubric`) | Path relative to project root |
| `rubric` | `string` | ✅ (or `rubricFile`) | Inline rubric text |

### UI
Large `<textarea>` (16 rows) with real-time word count. Turns green when minimum is met.

---

## 7. `code_python`

**Grading:** `hybrid` — deterministic test runner (Pyodide) + AI code quality feedback

**When to use:** Python programming tasks run in-browser.

### Schema

```json
{
  "type": "code_python",
  "starterCode": "def solution(n):\n    pass",
  "tests": [
    { "name": "basic", "stdin": "5", "expectedStdout": "25\n" },
    { "name": "edge_zero", "stdin": "0", "expectedStdout": "0\n" }
  ],
  "hiddenTests": [
    { "name": "large", "stdin": "1000", "expectedStdout": "1000000\n" }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `starterCode` | `string` | optional | Pre-filled code |
| `tests` | `TestCase[]` | ✅ | Visible to student |
| `hiddenTests` | `TestCase[]` | optional | Run on submit, hidden from student |

**TestCase:** `{ name: string, stdin: string, expectedStdout: string }`

### UI
Monaco editor (Python), stdin input, Run/Run Tests buttons, console output, test results table.

---

## 8. `sql_query` *(new)*

**Grading:** `ai` with schema + pattern context

**When to use:** Tasks requiring a SQL SELECT query (matura informatyka tasks involving databases).

### Schema

```json
{
  "type": "sql_query",
  "dialect": "sql",
  "schemaMarkdown": "### Tabela `Produkty`\n| Kolumna | Typ |\n|---|---|\n| `id` | INT (PK) |\n| `nazwa` | VARCHAR |\n| `cena` | DECIMAL |",
  "tables": [
    {
      "name": "Produkty",
      "columns": [
        { "name": "id", "type": "INT" },
        { "name": "nazwa", "type": "VARCHAR(100)" },
        { "name": "cena", "type": "DECIMAL(10,2)" }
      ],
      "sampleRows": [
        { "id": 1, "nazwa": "Laptop", "cena": 2999.00 }
      ]
    }
  ],
  "seedData": "INSERT INTO Produkty VALUES (1,'Laptop',2999.00);\nINSERT INTO Produkty VALUES (2,'Mysz',49.90);",
  "expectedResult": [
    { "nazwa": "Laptop", "avg_cena": 2999.00 }
  ],
  "expectedQueryPatterns": ["GROUP BY", "AVG", "HAVING"],
  "rubric": "2 pkt za poprawny SELECT, 1 pkt za GROUP BY, 1 pkt za HAVING."
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `dialect` | `"sql" \| "mysql" \| "postgresql" \| "sqlite"` | optional | Default: `"sql"` |
| `schemaMarkdown` | `string` | optional | Shown to student in collapsible panel |
| `tables` | `SqlTable[]` | optional | Structured alternative to `schemaMarkdown` |
| `seedData` | `string` | optional | INSERT statements shown to student |
| `expectedResult` | `Record[]` | optional | Correct rows passed to AI |
| `expectedQueryPatterns` | `string[]` | optional | Keywords the query must include (e.g. `"JOIN"`) |
| `rubric` | `string` | optional | |

**`SqlTable`:** `{ name, columns: {name, type}[], sampleRows? }`

### UI
Monaco editor in SQL mode. Collapsible **Schema** panel (above the editor). Collapsible **Seed data** panel. No in-browser execution — AI grades the query.

### Grading
AI is given: question prompt + schema + seed data + expected result + required patterns + rubric. It checks syntax, pattern usage, and logical correctness of the query.

---

## 9. `spreadsheet_task` *(new)*

**Grading:** `ai` with source data + expected outputs context

**When to use:** Tasks requiring Excel/Calc formulas, summaries, or charts.

### Schema

```json
{
  "type": "spreadsheet_task",
  "sourceDataDescription": "| A — Produkt | B — Styczeń |\n|---|---|\n| Laptop | 12 |\n| Mysz | 45 |",
  "expectedOutputs": [
    {
      "id": "total",
      "label": "Suma sprzedaży",
      "description": "Formuła sumująca kolumnę B (B2:B10).",
      "type": "formula"
    },
    {
      "id": "chart_desc",
      "label": "Wykres",
      "description": "Opisz wykres kolumnowy dla danych w kolumnach A–B.",
      "type": "chart"
    }
  ],
  "requiredChart": {
    "type": "Kolumnowy",
    "description": "Dane: A2:B6, tytuł: Sprzedaż styczeń, oś X: Produkt, oś Y: Liczba sztuk"
  },
  "rubric": "1 pkt za każdą poprawną formułę, 2 pkt za poprawny opis wykresu."
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `sourceDataDescription` | `string` | ✅ | Markdown table shown to student |
| `expectedOutputs` | `ExpectedOutput[]` | ✅ | One field per expected output |
| `requiredChart` | `{type, description}` | optional | Adds note to student UI |
| `rubric` | `string` | optional | |

**`ExpectedOutput`:** `{ id, label, description, type: "formula" \| "value" \| "range" \| "chart" \| "summary" }`

### UI
Source data rendered as markdown. One labeled textarea per expected output with type-appropriate placeholder text. Optional chart note banner.

### Grading
AI receives: source data + expected output descriptions + student's filled text per output + rubric.

---

## 10. `cloze_text` *(new)*

**Grading:** `hybrid` — deterministic per-blank scoring + AI qualitative feedback

**When to use:** Fill-in-the-blank tasks rendered as inline inputs inside a code/text block.

### Good use cases ✅

| Pattern | Example template |
|---|---|
| SQL keyword completion | `SELECT {{col}}\nFROM {{tbl}}\nGROUP BY {{col}}\nHAVING {{agg}}(x) > {{n}};` |
| Algorithm tracing | `krok 1: lewy=0, prawy=6, środek={{m1}}, T[środek]={{v1}}` |
| Formula/expression fill | `P(A∪B) = P(A) {{op}} P(B) {{op2}} P(A∩B)` |
| Pseudocode keyword | `Dopóki lewy {{cmp}} prawy:\n    środek := (lewy+prawy) {{div}} 2` |
| Short structured lines | `wejście: {{val}} → wynik: {{result}}, wywołania: {{calls}}` |

### Bad use cases ❌ — use a different type

| Pattern | Correct type |
|---|---|
| Markdown table cells with `\|` | Future `table_fill` type |
| Long prose paragraphs | `short_text` |
| Full essay with blanks | `polish_essay` |
| Multiple independent textareas | `spreadsheet_task` |

> **Rule:** If your template contains lines matching `| cell | cell |`, the component will display an author warning. Use `table_fill` (planned) for tabular fill-in tasks.

### Schema

```json
{
  "type": "cloze_text",
  "template": "SELECT {{col}}, {{agg}}(cena) AS wynik\nFROM Produkty\n{{group}} {{col}}\n{{filter}} {{agg}}(cena) {{op}} 100\n{{sort}} wynik {{dir}};",
  "blanks": [
    {
      "id": "agg",
      "correctAnswer": "AVG",
      "acceptedAnswers": ["avg"],
      "caseSensitive": false,
      "points": 1
    },
    {
      "id": "group",
      "correctAnswer": "GROUP BY",
      "acceptedAnswers": ["group by"],
      "caseSensitive": false,
      "points": 1
    },
    {
      "id": "filter",
      "correctAnswer": "HAVING",
      "acceptedAnswers": ["having"],
      "caseSensitive": false,
      "points": 1
    },
    {
      "id": "op",
      "correctAnswer": ">",
      "points": 1
    },
    {
      "id": "sort",
      "correctAnswer": "ORDER BY",
      "acceptedAnswers": ["order by"],
      "caseSensitive": false,
      "points": 1
    }
  ]
}
```

**Algorithm tracing example** (the recommended compact style):

```json
{
  "type": "cloze_text",
  "template": "-- Szukamy x=23 w T=[2,5,8,12,16,23,38]\nkrok 1: lewy=0, prawy=6, środek={{m1}}, T[środek]={{v1}} → za mało\nkrok 2: lewy={{l2}}, prawy=6, środek={{m2}}, T[środek]={{v2}} → znaleziono!\nWynik: indeks = {{r1}}",
  "blanks": [
    { "id": "m1", "correctAnswer": "3", "points": 1 },
    { "id": "v1", "correctAnswer": "12", "points": 1 },
    { "id": "l2", "correctAnswer": "4", "points": 1 },
    { "id": "m2", "correctAnswer": "5", "points": 1 },
    { "id": "v2", "correctAnswer": "23", "points": 1 },
    { "id": "r1", "correctAnswer": "5", "points": 1 }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `template` | `string` | ✅ | `{{blankId}}` placeholders; `\n` = new line; leading spaces preserved |
| `blanks` | `ClozeBlank[]` | ✅ | Matched by `id` — order in array doesn't matter |

**`ClozeBlank`:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | ✅ | Must match a `{{id}}` in `template` |
| `correctAnswer` | `string` | ✅ | Canonical correct answer |
| `acceptedAnswers` | `string[]` | optional | Alternative spellings, e.g. `["//", "/"]` for integer division |
| `caseSensitive` | `boolean` | optional | Default: `false` (comparison lowercases both sides) |
| `points` | `number` | optional | Default: `1`. Enables partial credit per blank. |

### Scoring

Each blank is checked independently:

```
isCorrect = normalize(userAnswer) ∈ {normalize(correctAnswer)} ∪ {normalize(acceptedAnswers…)}
  where normalize(s) = caseSensitive ? s.trim() : s.trim().toLowerCase()

earnedPoints = Σ blank.points where isCorrect
totalPoints  = Σ blank.points (all blanks)
score        = round((earnedPoints / totalPoints) × maxScore, 1)
```

Blanks with `points: 0` are scored but contribute 0 to the total (useful for "bonus" or "style" blanks).

### UI

- Template is rendered line-by-line in a dark code block
- Each `{{blankId}}` becomes an `<input>` sized to `max(5, correctAnswer.length + 2)` characters
- Leading whitespace in each line is preserved (pseudocode indentation works)
- Empty lines in the template render as vertical spacers
- After submission:
  - **Correct blank** → green border + green text
  - **Wrong blank** → red border + correct answer revealed below in green
- A summary strip below the block lists each blank id with ✓ / ✗

### Table-like template detection

If any line of `template` matches `/^\s*\|.+\|\s*$/`, a yellow author warning is shown:

> ⚠️ Ten szablon zawiera składnię tabelaryczną Markdown. Użyj przyszłego typu `table_fill`.

The component still renders but layout may be suboptimal. Plan to migrate such questions to `table_fill` when that type is implemented.

---

## Grading Mode Summary

| Type | Mode | Score source | AI role |
|---|---|---|---|
| `single_choice` | deterministic | Exact ID match | Feedback / explanation |
| `multi_choice` | deterministic | Exact set match | Feedback |
| `numeric` | deterministic | Within tolerance | Feedback |
| `code_python` | hybrid | Test pass rate | Code quality feedback |
| `cloze_text` | hybrid | Per-blank points | Feedback on wrong blanks |
| `short_text` | ai | AI rubric | Full scoring + feedback |
| `math_open_with_work` | ai | AI rubric | Full scoring + feedback |
| `polish_essay` | ai | CKE rubric | Full scoring + feedback |
| `sql_query` | ai | AI with patterns | Full scoring + feedback |
| `spreadsheet_task` | ai | AI with outputs | Full scoring + feedback |

---

## AI Grading Fallback Chain

For all `ai` and `hybrid` types, the rubric passed to the AI is assembled from:

1. **Question-level `rubric` field** (highest priority)
2. **Question-level `rubricFile`** (filesystem markdown)
3. **DB `grading_criteria` table** — matched by `(subject, question_type)` > `(subject, null)` > `("global", null)`
4. **Type-specific context addendum** (schema for SQL, source data for spreadsheet, blank results for cloze)

---

## Adding a New Type — Checklist

1. Add Zod schema to `src/lib/quiz/schemas.ts` and extend the `Question` discriminated union
2. Add to `QuestionType` enum
3. Create `src/components/questions/YourTypeInput.tsx`
4. Add `buildUserAnswer()` case in `QuizRunner.tsx`
5. Import and add to `QuestionInput` switch in `QuizRunner.tsx`
6. Add grading case to `src/app/api/grade/route.ts`
7. (If deterministic) Add scorer to `src/lib/ai/deterministic-scorer.ts`
8. (If context-rich) Add prompt helper to `src/lib/ai/prompts.ts`
9. Add a demo JSON fixture to `data/quizzes/`
10. Update this document
