# Dodawanie quizów z JSON do bazy danych

Ten dokument opisuje, jak szybko importować duże ilości pytań i quizów do ZdamTo.io — zarówno przez skrypt Node.js, jak i ręcznie przez API.

---

## Architektura bazy danych (skrót)

```
quizzes          ← metadane quizu (tytuł, przedmiot, status)
  └── quiz_versions  ← wersjonowana zawartość JSON (plik quizu)
```

Każdy quiz ma:
1. **Wiersz w `quizzes`** — tytuł, przedmiot, status (`draft` / `published` / `archived`)
2. **Wiersz w `quiz_versions`** — pełna treść quizu w polu `content` (jsonb), numer wersji, flaga `is_active`

---

## Format pliku JSON

Plik quizu musi być zgodny ze schematem zdefiniowanym w `src/lib/quiz/schemas.ts`.

### Minimalny przykład

```json
{
  "id": "math-limits-2025",
  "title": "Granice — Poziom Podstawowy",
  "subject": "Matematyka",
  "subjectSlug": "math",
  "version": "1.0",
  "questions": [
    {
      "id": "q1",
      "type": "numeric",
      "promptMarkdown": "Oblicz: $\\lim_{x \\to 2} (3x + 1)$",
      "maxScore": 1,
      "grading": { "mode": "deterministic" },
      "correctAnswer": 7,
      "tolerance": 0
    }
  ]
}
```

### Typy pytań

| `type` | Tryb oceniania | Wymagane pola |
|---|---|---|
| `single_choice` | `deterministic` | `choices[]` (każde z `id` i `text`), `correctAnswer` (id) |
| `multi_choice` | `deterministic` | `choices[]`, `correctAnswers[]` (tablica id) |
| `numeric` | `deterministic` | `correctAnswer` (liczba), `tolerance` (domyślnie 0) |
| `short_text` | `ai` | opcjonalnie: `expectedKeyPoints[]`, `rubric` |
| `math_open_with_work` | `ai` | `correctAnswer` (string), `rubric` (string) |
| `polish_essay` | `ai` | `minWords` (domyślnie 300), `rubricFile` lub `rubric` |
| `code_python` | `hybrid` | `starterCode`, `tests[]` (każdy test: `name`, `stdin`, `expectedStdout`) |

### Wspólne pola każdego pytania

```json
{
  "id": "unikalny-id-w-ramach-quizu",
  "type": "...",
  "promptMarkdown": "Treść pytania w Markdown (obsługuje LaTeX: $...$)",
  "maxScore": 2,
  "grading": { "mode": "deterministic" | "ai" | "hybrid" },
  "metadata": {
    "tags": ["optional", "tags"],
    "source": "opis źródła, np. CKE 2024"
  }
}
```

> **Uwaga dot. `subjectSlug`:** Musi być jednym z `polish`, `math`, `informatics`. To pole decyduje o tym, pod którym przedmiotem quiz się pojawi.

---

## Metoda 1 — Skrypt Node.js (zalecana dla dużych partii)

Utwórz plik `scripts/import-quizzes.ts` (lub `.js`) i uruchom go z konta **super_admin**.

### Wymagania

```bash
# zainstaluj ts-node jeśli nie masz
npm install -D ts-node
```

### Skrypt `scripts/import-quizzes.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// ─── Konfiguracja ──────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
//                       ^ Service role key omija RLS — trzymaj go w tajemnicy!

// Katalog z plikami JSON do zaimportowania
const QUIZZES_DIR = path.join(__dirname, "../data/quizzes");

// UUID super_admina który będzie wpisany jako created_by
const ADMIN_USER_ID = process.env.ADMIN_USER_ID!;

// ─── Klient Supabase ───────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ─── Pomocnicza funkcja importu jednego pliku ──────────────────────────────
async function importQuizFile(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const quizContent = JSON.parse(raw);

  const { subjectSlug, title, subject } = quizContent;

  console.log(`Importuję: ${title} (${subjectSlug})`);

  // 1. Utwórz wiersz w tabeli quizzes
  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .insert({
      subject: subjectSlug,          // "polish" | "math" | "informatics"
      title: title,
      description: `Zaimportowano z: ${path.basename(filePath)}`,
      status: "draft",               // zmień na "published" jeśli chcesz od razu
      created_by: ADMIN_USER_ID,
    })
    .select("id")
    .single();

  if (quizError) {
    console.error(`  BŁĄD (quizzes): ${quizError.message}`);
    return;
  }

  // 2. Utwórz wersję quizu z treścią JSON
  const { error: versionError } = await supabase
    .from("quiz_versions")
    .insert({
      quiz_id: quiz.id,
      version: 1,
      content: quizContent,          // pełny JSON jako jsonb
      is_active: true,
      change_note: "Import z JSON",
    });

  if (versionError) {
    console.error(`  BŁĄD (quiz_versions): ${versionError.message}`);
    // Opcjonalne: usuń quiz żeby uniknąć osieroconych wierszy
    await supabase.from("quizzes").delete().eq("id", quiz.id);
    return;
  }

  console.log(`  OK → quiz.id = ${quiz.id}`);
}

// ─── Główna pętla ──────────────────────────────────────────────────────────
async function main() {
  const files = fs
    .readdirSync(QUIZZES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(QUIZZES_DIR, f));

  if (files.length === 0) {
    console.log("Brak plików JSON w katalogu:", QUIZZES_DIR);
    return;
  }

  console.log(`Znaleziono ${files.length} plik(ów) do importu.\n`);

  for (const file of files) {
    await importQuizFile(file);
  }

  console.log("\nGotowe!");
}

main().catch(console.error);
```

### Uruchomienie

```bash
# Zmienne środowiskowe (albo wpisz bezpośrednio):
export SUPABASE_URL="https://twoj-projekt.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
export ADMIN_USER_ID="uuid-twojego-super-admina"

# Uruchom skrypt
cd quiz-engine
npx ts-node --project tsconfig.json scripts/import-quizzes.ts
```

> **Tip:** UUID super_admina znajdziesz w Supabase Dashboard → Authentication → Users, lub w tabeli `profiles`.

### Masowe importowanie z podkatalogów

Jeśli quizy są podzielone na foldery według przedmiotów, zmień `QUIZZES_DIR` lub użyj `glob`:

```typescript
import { glob } from "glob";

const files = await glob("data/quizzes/**/*.json");
```

---

## Metoda 2 — API (małe partie, testy)

Jeśli wolisz użyć HTTP zamiast skryptu, możesz zaimportować quizy przez API admina.

### Krok 1 — Zaloguj się i pobierz token sesji

```bash
curl -s -X POST https://twoj-projekt.supabase.co/auth/v1/token?grant_type=password \
  -H "apikey: TWOJ_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"haslo"}' \
  | jq .access_token
```

Zapisz token jako `TOKEN`.

### Krok 2 — Utwórz quiz (metadane)

```bash
curl -X POST https://twoja-domena.com/api/admin/quizzes \
  -H "Cookie: sb-access-token=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "math",
    "title": "Granice — Poziom Podstawowy",
    "description": "Zestaw zadań na granice funkcji"
  }'
```

Odpowiedź zawiera `id` nowo utworzonego quizu (status: `draft`).

### Krok 3 — Dodaj wersję z zawartością JSON

```bash
QUIZ_ID="uuid-z-kroku-2"

curl -X POST https://twoja-domena.com/api/admin/quizzes/${QUIZ_ID}/versions \
  -H "Cookie: sb-access-token=TOKEN" \
  -H "Content-Type: application/json" \
  -d @data/quizzes/math-limits-2025.json
```

### Krok 4 — Opublikuj quiz

```bash
curl -X PATCH https://twoja-domena.com/api/admin/quizzes/${QUIZ_ID} \
  -H "Cookie: sb-access-token=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "published"}'
```

---

## Metoda 3 — Supabase Studio (jednorazowo)

Dla małych ilości quizów możesz wkleić JSON bezpośrednio przez Supabase Dashboard:

1. Otwórz **Table Editor** → tabela `quizzes`
2. Kliknij **Insert row** i wypełnij: `subject`, `title`, `description`, `status = draft`, `created_by = twój UUID`
3. Skopiuj zwrócone `id`
4. Przejdź do tabeli `quiz_versions`
5. Wstaw wiersz: `quiz_id`, `version = 1`, `content = <wklej JSON>`, `is_active = true`
6. Wróć do `quizzes`, zmień `status` na `published`

---

## Walidacja przed importem

Możesz walidować pliki JSON lokalnie przed wysłaniem do bazy:

```typescript
import { Quiz } from "@/lib/quiz/schemas";
import fs from "fs";

const raw = JSON.parse(fs.readFileSync("moj-quiz.json", "utf-8"));
const result = Quiz.safeParse(raw);

if (!result.success) {
  console.error("Błędy walidacji:", result.error.flatten());
} else {
  console.log("OK — pytań:", result.data.questions.length);
}
```

Uruchom: `npx ts-node scripts/validate-quiz.ts`

---

## Częste błędy

| Błąd | Przyczyna | Rozwiązanie |
|---|---|---|
| `subject: invalid_enum_value` | `subjectSlug` spoza listy | Użyj `polish`, `math` lub `informatics` |
| `duplicate key value violates unique constraint` | Quiz o tym `id` już istnieje w `content.id` | Zmień `id` w JSON lub wyczyść starą wersję |
| `violates row-level security policy` | Używasz anon key zamiast service role key | Skrypt musi używać `SUPABASE_SERVICE_ROLE_KEY` |
| `content → questions → 0: ...` | Pytanie nie spełnia schematu | Sprawdź wymagane pola dla danego `type` |
| `RangeError: Invalid time value` | Pusty plik JSON | Sprawdź czy plik nie jest uszkodzony |

---

## Struktura katalogów dla quizów

Zalecana konwencja nazewnictwa:

```
data/quizzes/
├── polish/
│   ├── polish-matura-2024-maj.json
│   └── polish-matura-2025-maj.json
├── math/
│   ├── math-matura-2024-maj.json
│   └── math-limits-basics.json
└── informatics/
    ├── informatics-python-basics.json
    └── informatics-algorithms-2025.json
```

Pola `id` i `title` w każdym pliku JSON powinny być unikalne w całej bazie.

---

## Po imporcie

1. Zaloguj się jako super_admin i przejdź do `/admin/quizzes`
2. Sprawdź czy quizy pojawiły się na liście
3. Kliknij quiz → podejrzyj wersję → sprawdź liczbę pytań
4. Jeśli wszystko OK, zmień status na `published` (przez UI lub skrypt)
5. Quiz pojawi się w `/subjects/[subjectSlug]` dla użytkowników
