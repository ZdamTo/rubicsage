-- ============================================================
-- RubicSage – Grading Criteria
-- Stores per-subject (and optionally per-question-type) AI grading
-- configuration: system prompt, rubric template, extra instructions.
--
-- Lookup priority in the grade API:
--   1. question-level rubric from quiz_versions.content  (most specific)
--   2. subject + question_type row from this table
--   3. subject + NULL question_type row from this table  (subject default)
--   4. 'global' + NULL row from this table               (global fallback)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.grading_criteria (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 'polish' | 'math' | 'informatics' | 'global'
  subject               text NOT NULL
                          CHECK (subject IN ('polish', 'math', 'informatics', 'global')),

  -- NULL means "applies to every question type in this subject"
  question_type         text
                          CHECK (question_type IS NULL OR question_type IN (
                            'short_text', 'polish_essay', 'math_open_with_work',
                            'code_python', 'single_choice', 'multi_choice', 'numeric'
                          )),

  name                  text NOT NULL,

  -- Replaces the hardcoded system prompt in prompts.ts when set
  system_prompt         text,

  -- Default rubric markdown used when a question has no inline rubric.
  -- For polish_essay this replaces the rubricFile filesystem lookup.
  rubric_template       text,

  -- Appended verbatim to the grading prompt after the rubric
  grading_instructions  text,

  is_active             boolean NOT NULL DEFAULT true,
  created_by            uuid REFERENCES public.profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- One active row per scope; deactivate old row before inserting a new one
  UNIQUE (subject, question_type)
);

ALTER TABLE public.grading_criteria ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_grading_criteria_updated_at
  BEFORE UPDATE ON public.grading_criteria
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Everyone authenticated can read active criteria (needed by the grade API)
CREATE POLICY "grading_criteria_select" ON public.grading_criteria
  FOR SELECT USING (is_active = true OR public.is_super_admin());

-- Only super_admin can write
CREATE POLICY "grading_criteria_write_admin" ON public.grading_criteria
  FOR ALL USING (public.is_super_admin());

-- ── Seed: Global fallback ─────────────────────────────────────────────────────

INSERT INTO public.grading_criteria
  (subject, question_type, name, system_prompt, rubric_template, grading_instructions)
VALUES (
  'global', NULL,
  'Global fallback',

  'You are an expert exam grader certified by CKE (Centralna Komisja Egzaminacyjna) in Poland.
You grade exam answers with strict adherence to official rubrics.
You always respond with valid JSON only — no explanatory text, no markdown fences, just the JSON object.',

  NULL,

  'Be fair but strict. Award partial credit where the rubric allows.
Write brief, specific feedback that helps the student improve.'
);

-- ── Seed: Polish – subject default ───────────────────────────────────────────

INSERT INTO public.grading_criteria
  (subject, question_type, name, system_prompt, rubric_template, grading_instructions)
VALUES (
  'polish', NULL,
  'Język Polski – default',

  'Jesteś egzaminatorem CKE (Centralna Komisja Egzaminacyjna) specjalizującym się w języku polskim na poziomie matury.
Oceniasz odpowiedzi zgodnie z oficjalnym schematem punktowania CKE.
Odpowiadasz WYŁĄCZNIE poprawnym JSON — bez żadnego tekstu poza obiektem JSON.',

  NULL,

  'Oceniaj zgodnie ze schematem punktowania. Przyznawaj punkty cząstkowe tam, gdzie schemat na to pozwala.
Informacje zwrotne pisz po polsku. Cytuj fragmenty odpowiedzi ucznia wskazując mocne strony i błędy.'
);

-- ── Seed: Polish – polish_essay ──────────────────────────────────────────────

INSERT INTO public.grading_criteria
  (subject, question_type, name, system_prompt, rubric_template, grading_instructions)
VALUES (
  'polish', 'polish_essay',
  'Język Polski – wypracowanie (poziom podstawowy)',

  'Jesteś egzaminatorem CKE oceniającym wypracowanie z języka polskiego (poziom podstawowy).
Oceniasz WYŁĄCZNIE według poniższego schematu punktowania CKE.
Odpowiadasz WYŁĄCZNIE poprawnym JSON.',

  '## Schemat punktowania – Wypracowanie (matura podstawowa, max 20 pkt)

### A. Realizacja tematu wypowiedzi (0–2 pkt)
- 2 pkt – wypowiedź w pełni realizuje temat, właściwa forma, adekwatna treść
- 1 pkt – wypowiedź częściowo realizuje temat lub drobne uchybienia formalne
- 0 pkt – wypowiedź nie realizuje tematu

### B. Elementy retoryczne / kompozycja (0–2 pkt)
- 2 pkt – logiczna kompozycja, wyraźny wstęp, rozwinięcie i zakończenie
- 1 pkt – kompozycja częściowo zaburzona
- 0 pkt – brak kompozycji

### C. Styl i język (0–4 pkt)
- 4 pkt – styl stosowny do formy, brak rażących błędów językowych
- 2–3 pkt – nieliczne błędy językowe lub stylistyczne
- 0–1 pkt – liczne błędy, styl niespójny

### D. Środki językowe / bogactwo słownictwa (0–4 pkt)
- 4 pkt – bogate słownictwo, różnorodne struktury składniowe
- 2–3 pkt – słownictwo wystarczające
- 0–1 pkt – ubogie słownictwo, powtórzenia

### E. Zapis – ortografia i interpunkcja (0–4 pkt)
- 4 pkt – brak błędów ortograficznych i interpunkcyjnych lub tylko jeden błąd
- 2–3 pkt – 2–4 błędy
- 0–1 pkt – 5 lub więcej błędów

### F. Objętość i zgodność z poleceniem (0–4 pkt)
- 4 pkt – wymagana liczba słów zachowana, polecenie w pełni wykonane
- 2–3 pkt – niewielkie odchylenia
- 0–1 pkt – znaczne odchylenia od wymaganej objętości lub tematu',

  'Oceń każde kryterium (A–F) osobno i podaj liczbę punktów.
Wpisz szczegółowe uzasadnienie dla każdego kryterium w rubricBreakdown.
Informacje zwrotne pisz po polsku.
Całkowity wynik = suma punktów A+B+C+D+E+F (max 20 pkt — przeskaluj do maxScore z pytania).'
);

-- ── Seed: Polish – short_text ────────────────────────────────────────────────

INSERT INTO public.grading_criteria
  (subject, question_type, name, system_prompt, rubric_template, grading_instructions)
VALUES (
  'polish', 'short_text',
  'Język Polski – zadanie krótkiej odpowiedzi',

  'Jesteś egzaminatorem CKE oceniającym zadania krótkiej odpowiedzi z języka polskiego.
Odpowiadasz WYŁĄCZNIE poprawnym JSON.',

  '## Schemat punktowania – Krótka odpowiedź

- Pełna liczba punktów: odpowiedź zawiera wszystkie wymagane elementy (kluczowe punkty)
- Połowa punktów: odpowiedź zawiera część wymaganych elementów
- 0 pkt: odpowiedź błędna, nieadekwatna lub brak odpowiedzi',

  'Sprawdź, czy odpowiedź zawiera wszystkie kluczowe punkty (expectedKeyPoints).
Przyznaj punkty proporcjonalnie do pokrycia kluczowych punktów.
Informacje zwrotne pisz po polsku. Bądź precyzyjny i zwięzły.'
);

-- ── Seed: Math – subject default ─────────────────────────────────────────────

INSERT INTO public.grading_criteria
  (subject, question_type, name, system_prompt, rubric_template, grading_instructions)
VALUES (
  'math', NULL,
  'Matematyka – default',

  'You are a CKE exam grader specialising in Polish Matura mathematics.
You grade strictly according to the official CKE scoring scheme.
You respond ONLY with valid JSON — no text outside the JSON object.',

  NULL,

  'Award marks strictly according to the rubric.
For method marks: award them if the correct method is shown even if the final answer is wrong.
Show the breakdown of marks per step in rubricBreakdown.
Write feedback in Polish.'
);

-- ── Seed: Math – math_open_with_work ─────────────────────────────────────────

INSERT INTO public.grading_criteria
  (subject, question_type, name, system_prompt, rubric_template, grading_instructions)
VALUES (
  'math', 'math_open_with_work',
  'Matematyka – zadanie otwarte z rozwiązaniem',

  'Jesteś egzaminatorem CKE oceniającym zadania otwarte z matematyki (matura).
Odpowiadasz WYŁĄCZNIE poprawnym JSON.',

  '## Schemat punktowania – Zadanie otwarte z rozwiązaniem

### Metoda (M) – za poprawny tok rozumowania
Przyznaj punkty za metodę nawet jeśli wynik końcowy jest błędny z powodu błędu rachunkowego.

### Wynik (W) – za poprawny wynik końcowy
Tylko jeśli metoda i wynik są oba poprawne.

### Zapis (Z) – za czytelny i kompletny zapis (opcjonalnie, wg schematu)

Punkty M i W są niezależne. Błąd rachunkowy nie odbiera punktów za metodę.',

  'Oceń tok rozumowania (metoda) i wynik końcowy niezależnie.
Wskaż dokładnie, który krok jest błędny jeśli uczeń popełnił błąd.
W rubricBreakdown rozróżnij punkty za metodę i wynik.
Pisz po polsku.'
);

-- ── Seed: Informatics – subject default ──────────────────────────────────────

INSERT INTO public.grading_criteria
  (subject, question_type, name, system_prompt, rubric_template, grading_instructions)
VALUES (
  'informatics', NULL,
  'Informatyka – default',

  'You are a CKE exam grader specialising in Polish Matura computer science (informatyka).
You grade strictly according to the official CKE scoring scheme.
You respond ONLY with valid JSON — no text outside the JSON object.',

  NULL,

  'Evaluate correctness first, then code quality.
For code tasks: check algorithmic correctness, edge cases, and efficiency separately.
Write feedback in Polish.'
);

-- ── Seed: Informatics – code_python ──────────────────────────────────────────

INSERT INTO public.grading_criteria
  (subject, question_type, name, system_prompt, rubric_template, grading_instructions)
VALUES (
  'informatics', 'code_python',
  'Informatyka – zadanie programistyczne (Python)',

  'You are a CKE exam grader specialising in Python programming tasks at Polish Matura level.
You respond ONLY with valid JSON — no text outside the JSON object.',

  '## Scoring Scheme – Programming Task (Python)

### Correctness (passed test cases)
Scored automatically from test results. Do not override test scores.

### Code Quality (assessed by AI)
- Algorithm: correct approach, no off-by-one errors, handles edge cases
- Readability: meaningful variable names, no dead code
- Efficiency: no obvious O(n²) when O(n) is possible for large inputs

### Partial credit
Award partial credit if the solution is correct for most test cases
or if the correct algorithm is used but has a minor implementation bug.',

  'The test results are provided in the prompt. Use them to determine the correctness score.
Assess code quality separately and note any issues.
If all tests pass, focus feedback on code quality improvements.
If tests fail, identify the specific bug and explain how to fix it.
Write feedback in Polish.'
);
