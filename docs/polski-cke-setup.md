# Język polski — arkusze CKE: setup and publishing

This adds the zdamto.io prototype's exam sheets to the Next.js + Supabase app.
Informatyka (and the other existing quizzes) keep working exactly as before.

## What you get

- **Picker** on `/subjects/polish`: levels (Podstawowa / Rozszerzona) down, CKE sessions across.
  Click a card → *tryb nauki* (practice). Click **⏱ 240 min** → *tryb egzaminacyjny* (exam).
- **Exam sheet** laid out like the printed arkusz: lavender "Zadanie N. (0–X)" bar, the
  examiner's score stack (the score box *is* the "Sprawdź" button), reference texts with
  footnotes, images, and the essay scorecard drawn as the CKE examiner table.
- **Question types**: `P-TEXT`, `P-TABLE-TEXT`, `P-TABLE-MATCH`, `P-TF`, `P-CHOICE` /
  `P-SINGLE-CHOICE`, `P-ESSAY` — same JSON as the prototype, no conversion needed.
- **Grading** (all on the server):
  - `P-TF`, `P-CHOICE`, and `P-TABLE-MATCH` with an exact key → compared with the CKE key, free.
  - open questions → 1 AI call each.
  - wypracowanie → 8 AI calls (one per criterion). The model only reports raw observations;
    the points come from the matrix/thresholds/gating rules in the JSON (`aggregateEssay`).
- **Modes**: practice (grade anytime) and exam (countdown, no grading until finished).
  The exam deadline is enforced by the API, not only by the browser clock.
- **Progress** is autosaved to Supabase; "Rozwiąż ponownie" keeps the old attempt in history.

## 1. Supabase (one time)

1. Open **Supabase Dashboard → SQL Editor → New query**.
2. Paste the whole of `supabase/migrations/004_polish_cke_exams.sql` and click **Run**.
   (Migrations 001 and 003 must already be applied. The file is safe to run twice.)
   It creates/changes:
   - `quizzes`: `format`, `exam_code`, `level`, `session`, `meta`
   - `attempts`: `mode`, `deadline`, `progress`, `updated_at`
   - table `ai_usage` + function `consume_ai_calls` (daily AI quota per student)
   - Storage bucket **`exam-assets`** (public read, images only, max 5 MB)
   - security fixes: students can no longer write their own attempts/scores through the
     public REST API, and the streak function is no longer callable by anyone but the server.
3. Check: **Storage** shows a bucket `exam-assets` marked *Public*. If your project blocks
   SQL inserts into `storage.buckets`, create it by hand: name `exam-assets`, Public ✓,
   file size limit 5 MB, allowed MIME types `image/jpeg, image/png, image/webp, image/gif`.
   Do **not** add any upload policies — uploads go through the admin API with the service role.

## 2. Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `GEMINI_API_KEY` | required for the default Polish grader |
| `POLISH_AI_PROVIDER` | optional: `gemini` (default), `openai` or `anthropic` |
| `POLISH_AI_MODEL` | optional: default `gemini-2.5-flash` (what the prototype's prompts were tuned on) |
| `POLISH_AI_DAILY_LIMIT` | optional: AI calls per student per day, default `60` (super admins are not limited) |

The existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` and `SUPER_ADMIN_EMAILS` stay as they are. Redeploy after changing them.

> Unlike the prototype, students do **not** paste their own Gemini key: the server's key is
> used and the daily limit protects your bill. The model is chosen by the server, not by the
> student's settings page (that page still controls Informatyka).

## 3. Import the JSON files in the admin panel

The nine prototype files are in this repo at `quiz-engine/data/cke-polski/<CODE>/<CODE>.json`
(the same files as in `zdamtoio/exams/` in the zip).

1. Log in with an email listed in `SUPER_ADMIN_EMAILS` → **/admin/quizzes**.
2. In **Import arkuszy CKE — Język polski** either
   - **folder (easiest):** use the second picker and choose the folder `quiz-engine/data/cke-polski`
     (or `zdamtoio/exams` from the zip). All `MPOP-…json` files inside are imported and the
     referenced images in each `assets/` folder are uploaded automatically; or
   - **files:** use the first picker and select one or more `MPOP-…json` files (a normal file
     dialog only selects within one folder, so this is handy for a single year).

   P1 + P2 of the same session are joined into one
   60-point exam (`MPOP-P0-100-2505`), R0 stays a 35-point exam. Files are validated
   first; if any file is invalid nothing is imported and the errors are listed.
3. Click **Importuj**. Each exam is created as a **draft** (or gets a new version if it
   already exists — re-importing only P2 replaces only the wypracowanie).
4. Under each imported exam there is an image table. For every row still marked *brak* choose
   the image file from `data/cke-polski/<CODE>/assets/` (or from `exams/<CODE>/assets/` in
   the zip). The file goes exactly where the sheet looks for it, whatever its name on disk.
   You can reopen this table later with **Obrazy w arkuszu…** on the exam's card.
5. Optional: click **Podgląd arkusza (tylko admin)** to open the draft as a student would.
6. Click **Publish**. The exam now appears on `/subjects/polish`.

Images needed by the prototype files:

| Exam | Question | File |
|---|---|---|
| MPOP-P1-100-2305 | 10 | `10-Young_Man_holding_a_Skull.jpg` |
| MPOP-P1-100-2305 | 14 | `14_Piotr_Kunce_Wesele_poster.jpg` |
| MPOP-P1-100-2405 | 7 | `img-x86-p009.jpeg` |
| MPOP-P1-100-2405 | 12 | `12-Plakat do przedstawienia Kordian – fot. …jpg` — **missing**: the file in the zip is 0 bytes (its name contains `:` and was truncated). Export it again from the arkusz PDF (page with zadanie 12) and upload it in that row. Until then the sheet shows "Brak obrazu". |
| MPOP-P1-100-2505 | 12 | `12_okladka_ksiazki_rok_1984.jpg` |

### Adding a new year later

Convert the paper with the pdf-json pipeline as before, then import the new `MPOP-…json`
files here, upload its images, publish. No code change, no redeploy.

## Security notes

- The answer key (`correct_answers`, `exemplary_answers`, rubric) never leaves the server;
  the browser gets a sanitised copy (`src/lib/cke/sanitize.ts`, covered by tests).
- Every write goes through `/api/cke/*` routes that check the session, ownership, attempt
  state, deadline, request origin and body size; answers are rebuilt from the exam's own
  structure before storage, and student text is fenced in the AI prompts.
- Images are checked by their bytes (JPEG/PNG/GIF/WebP only), only for references that exist
  in the exam, and only admins can upload them.
- Exam images are public URLs (like the prototype's GitHub Pages files): unpublished ≠ secret.
- AI grades are estimates. The same essay graded twice can differ by a few points; the
  scorecard says so.
