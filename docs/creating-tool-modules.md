# Tworzenie modułów narzędziowych (Tools)

Ten dokument opisuje, jak dodać nowe interaktywne narzędzie do sekcji **Narzędzia** w ZdamTo.io.

Każde narzędzie to samodzielny submoduł — ma własną stronę, własne komponenty i własny wpis w rejestrze. Dodanie nowego narzędzia wymaga zmian w dokładnie **3–4 plikach** i nie wymaga modyfikacji istniejącego kodu.

---

## Architektura systemu narzędzi

```
src/
├── lib/tools/
│   └── registry.ts                ← centralny rejestr wszystkich narzędzi
├── app/tools/
│   ├── page.tsx                   ← strona listy narzędzi (/tools)
│   └── [tool]/
│       └── page.tsx               ← dynamiczna strona narzędzia (/tools/[slug])
└── components/tools/
    ├── Flashcards.tsx             ← przykładowy komponent narzędzia
    └── FormulaSheet.tsx           ← przykładowy komponent narzędzia
```

Przepływ renderowania:

```
/tools/flashcards
  → app/tools/[tool]/page.tsx
  → sprawdza slug w TOOL_COMPONENTS
  → renderuje <Flashcards />
```

---

## Krok 1 — Zarejestruj narzędzie w rejestrze

Plik: `src/lib/tools/registry.ts`

Dodaj nowy obiekt do tablicy `TOOLS`:

```typescript
export const TOOLS: Tool[] = [
  // ... istniejące narzędzia ...

  {
    slug: "moje-narzedzie",          // URL: /tools/moje-narzedzie
    name: "Moje Narzędzie",
    description: "Krótki opis widoczny na karcie narzędzia.",
    icon: "🧮",                      // emoji — widoczne na kartach i nagłówku strony
    subject: "math",                 // opcjonalne: "polish" | "math" | "informatics" | "prawo-jazdy" | "general"
    status: "coming-soon",           // zacznij od "coming-soon", zmień na "active" gdy gotowe
  },
];
```

**Uwagi:**
- `slug` musi być unikalny i zawierać tylko małe litery, cyfry i myślniki (`kebab-case`)
- `subject` jest opcjonalne — służy tylko do filtrowania/wyświetlania kategorii
- Dopóki `status === "coming-soon"`, narzędzie pojawi się jako wyszarzona karta "Wkrótce" — bez aktywnego linku

---

## Krok 2 — Stwórz komponent narzędzia

Plik: `src/components/tools/MojeNarzedzie.tsx`

Komponent narzędzia to zwykły **Client Component** Next.js. Nie ma żadnych wymaganych propsów — całą logikę i UI implementujesz wewnętrznie.

```tsx
"use client";

import { useState } from "react";

export function MojeNarzedzie() {
  const [value, setValue] = useState("");

  return (
    <div className="space-y-4">
      <p className="text-gray-600">Opis działania narzędzia dla użytkownika.</p>

      {/* Twój UI tutaj */}
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 w-full"
        placeholder="Wpisz coś..."
      />

      {value && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          Wynik: {value}
        </div>
      )}
    </div>
  );
}
```

**Dobre praktyki:**
- Komponent powinien być `"use client"` jeśli używa `useState`, `useEffect` lub interakcji
- Dla narzędzi tylko wyświetlających dane (bez interakcji) możesz pominąć `"use client"`
- Używaj Tailwind CSS do stylowania (spójnie z resztą aplikacji)
- Obsługa dużych zbiorów danych powinna być leniwa (paginacja, lazy loading)
- Narzędzia mogą importować i używać `MarkdownRenderer`, `KaTeX` i innych istniejących komponentów

---

## Krok 3 — Podepnij komponent pod dynamiczną stronę

Plik: `src/app/tools/[tool]/page.tsx`

Dwie zmiany:

### 3a — Zaimportuj komponent na górze pliku

```typescript
import { MojeNarzedzie } from "@/components/tools/MojeNarzedzie";
```

### 3b — Dodaj wpis do mapy `TOOL_COMPONENTS`

```typescript
const TOOL_COMPONENTS: Record<string, React.ComponentType> = {
  // istniejące narzędzia...
  "moje-narzedzie": MojeNarzedzie,
};
```

Slug w mapie musi dokładnie odpowiadać `slug` w rejestrze.

---

## Krok 4 — Aktywuj narzędzie

W `src/lib/tools/registry.ts` zmień `status`:

```typescript
status: "active",   // było: "coming-soon"
```

Od tej chwili:
- Karta narzędzia na `/tools` jest klikalna i prowadzi do `/tools/moje-narzedzie`
- Narzędzie pojawia się w sekcji "Narzędzia" na stronie głównej (jeśli jest wśród pierwszych 3 aktywnych)
- `generateStaticParams` w `[tool]/page.tsx` automatycznie uwzględni slug przy buildzie

---

## Pełna lista plików do zmodyfikowania / utworzenia

| Plik | Zmiana |
|---|---|
| `src/lib/tools/registry.ts` | Dodaj wpis do `TOOLS[]` |
| `src/components/tools/MojeNarzedzie.tsx` | **Utwórz** — komponent UI narzędzia |
| `src/app/tools/[tool]/page.tsx` | Dodaj import + wpis w `TOOL_COMPONENTS` |
| *(opcjonalnie)* `src/lib/tools/moje-narzedzie/` | Logika pomocnicza, dane, hooki |

---

## Struktura rozbudowanego narzędzia

Dla złożonych narzędzi (z własną logiką, danymi, wieloma podwidokami) zalecana struktura:

```
src/
├── components/tools/
│   └── Flashcards/
│       ├── index.tsx              ← eksportuje główny komponent <Flashcards />
│       ├── FlashCard.tsx          ← pojedyncza fiszka
│       ├── DeckSelector.tsx       ← wybór talii
│       └── useFlashcards.ts       ← hook z logiką
└── lib/tools/
    └── flashcards/
        ├── decks.ts               ← dane (talii fiszek)
        └── types.ts               ← typy TypeScript
```

Importuj w `[tool]/page.tsx` z głównego indeksu:

```typescript
import { Flashcards } from "@/components/tools/Flashcards";
```

---

## Narzędzie z danymi z bazy danych

Jeśli narzędzie potrzebuje danych z Supabase (np. spersonalizowane fiszki, historia użytkownika):

```tsx
// src/components/tools/Flashcards/index.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function Flashcards() {
  const [cards, setCards] = useState([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("flashcards")         // tabela do stworzenia w migracji
      .select("*")
      .then(({ data }) => setCards(data ?? []));
  }, []);

  // ...
}
```

Pamiętaj o:
1. Stworzeniu migracji SQL w `supabase/migrations/`
2. Dodaniu odpowiednich polityk RLS (użytkownik widzi tylko swoje dane)
3. Dodaniu typów w odpowiednim pliku

---

## Narzędzie jako Server Component (z parametrami URL)

Jeśli narzędzie potrzebuje `searchParams` (np. filtrowanie) i nie potrzebuje interakcji:

```tsx
// src/app/tools/moje-narzedzie/page.tsx  ← osobna strona zamiast dynamicznej
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function MojeNarzedzieStandalonePage({
  searchParams,
}: {
  searchParams: { subject?: string };
}) {
  const supabase = await createServerSupabaseClient();
  // fetch data...
  return <div>...</div>;
}
```

W tym przypadku zamiast korzystać z dynamicznej trasy `[tool]`, tworzysz dedykowaną stronę w `src/app/tools/moje-narzedzie/page.tsx`. Nadal musisz zarejestrować narzędzie w rejestrze (dla kart na liście), ale nie musisz dodawać go do `TOOL_COMPONENTS`.

---

## Checklisty

### Nowe narzędzie (minimalne)
- [ ] Wpis dodany do `TOOLS[]` w `registry.ts`
- [ ] Komponent utworzony w `src/components/tools/`
- [ ] Import i wpis w `TOOL_COMPONENTS` w `[tool]/page.tsx`
- [ ] `status` zmieniony na `"active"`
- [ ] Ręcznie przetestowano na `localhost:3000/tools/[slug]`

### Narzędzie z bazą danych
- [ ] Migracja SQL w `supabase/migrations/`
- [ ] Polityki RLS zdefiniowane
- [ ] Typy TypeScript zaktualizowane
- [ ] Zmienne środowiskowe (jeśli potrzebne)

### Przed wdrożeniem
- [ ] Responsywność sprawdzona (mobile + desktop)
- [ ] Stany błędów i ładowania obsłużone
- [ ] Brak twardych kodowań (URL, klucze API)

---

## Przykładowe narzędzia do zbudowania

| Nazwa | Opis | Trudność |
|---|---|---|
| **Flashcards** | Fiszki z terminami, odwracalne karty, tryb nauki | Średnia |
| **Arkusz Wzorów** | Przeglądarka wzorów matematycznych z KaTeX | Łatwa |
| **Planer Wypracowania** | Kreator struktury 5-akapitowej rozprawki | Łatwa |
| **Kalkulator Maturalny** | Kalkulator procentów i punktów na świadectwo | Łatwa |
| **Słownik Pojęć** | Searchable glossary for Polish literature terms | Średnia |
| **Testy WORD** | Pytania do egzaminu na prawo jazdy (Prawo Jazdy moduł) | Trudna |
