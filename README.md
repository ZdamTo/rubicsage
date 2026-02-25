# RubicSage — Quiz Engine MVP

AI-powered exam practice platform for Polish Matura, built on Next.js 14, Supabase, and Vercel.

## Features

- **Auth**: Supabase email/password authentication, automatic profile provisioning
- **Quizzes**: Published/draft/archived lifecycle with versioned JSON content
- **AI Grading**: OpenAI, Gemini, or Anthropic — server-side only, never exposed to browser
- **Attempts**: Full attempt tracking with per-question graded answers stored in Postgres
- **Daily Streak**: Practice calendar view, streak counter via Postgres RPC, Europe/Warsaw timezone
- **Super Admin Panel** (`/admin`): Quiz CRUD with version editor, user management (ban/promote/streak-reset), audit log
- **RLS**: Row-Level Security on every table — users cannot see each other's data

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 App Router, TypeScript |
| DB & Auth | Supabase (Postgres, Auth, RLS) |
| ORM/Client | `@supabase/supabase-js`, `@supabase/ssr` |
| Validation | Zod |
| Styling | Tailwind CSS |
| AI | OpenAI / Google Gemini / Anthropic |
| Hosting | Vercel |

---

## Local Development

### Prerequisites

- Node.js 18+
- A Supabase project (free tier is fine)

### 1. Clone and install

```bash
git clone <repo-url>
cd quiz-engine
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPER_ADMIN_EMAILS=your@email.com
OPENAI_API_KEY=sk-...
# or GEMINI_API_KEY / ANTHROPIC_API_KEY
```

### 3. Apply Supabase migrations

Open the [Supabase SQL Editor](https://supabase.com/dashboard) for your project and run the files in order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_seed_demo_quiz.sql   (optional demo stubs)
```

Or with the Supabase CLI:

```bash
supabase db push
```

### 4. Configure Supabase Auth

In Supabase Dashboard → Authentication → Settings:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: Add `http://localhost:3000/auth/callback`
- Enable **Email/Password** sign-in

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Supabase Setup (Detailed)

### Tables created by migration 001

| Table | Description |
|-------|-------------|
| `profiles` | App-level user data (role, status, timezone) |
| `quizzes` | Quiz metadata (subject, title, status) |
| `quiz_versions` | Versioned JSON content of each quiz |
| `attempts` | User quiz attempts with score totals |
| `attempt_answers` | Per-question answers and AI feedback |
| `practice_log` | One row per user per local date practiced |
| `streaks` | Cached current/best streak counters |
| `admin_audit_log` | Log of all admin actions |

### RLS summary

- Users can only read/write **their own** attempts, answers, practice log, and streak
- `quizzes`/`quiz_versions` are visible only when `status='published'` and `is_active=true`
- `admin_audit_log` is readable only by `super_admin`
- All admin mutations use the **service role** (server-only)

### RPC function

`public.log_practice_and_update_streak(p_user_id, p_source)` is called after every answer or attempt submission. It:

1. Inserts into `practice_log` (with `ON CONFLICT DO NOTHING`)
2. Upserts `streaks` applying consecutive-day logic in Europe/Warsaw timezone

---

## Vercel Deployment

### 1. Push to GitHub

```bash
git push origin main
```

### 2. Import to Vercel

- Go to [vercel.com](https://vercel.com) → New Project → Import your repo
- Set **Root Directory** to `quiz-engine`
- Framework preset: **Next.js**

### 3. Set environment variables in Vercel

| Variable | Where to find |
|----------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same |
| `SUPABASE_SERVICE_ROLE_KEY` | Same — **never expose this** |
| `SUPER_ADMIN_EMAILS` | Comma-separated list of admin emails |
| `OPENAI_API_KEY` | platform.openai.com |
| `GEMINI_API_KEY` | aistudio.google.com |
| `ANTHROPIC_API_KEY` | console.anthropic.com |

### 4. Configure Supabase Auth for production

In Supabase Dashboard → Authentication → Settings:

- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: Add `https://your-app.vercel.app/auth/callback`

### 5. Deploy

Vercel auto-deploys on push to your main branch.

---

## Admin Workflow

1. Sign up / log in with an email listed in `SUPER_ADMIN_EMAILS`
2. Navigate to `/admin` — the panel appears automatically
3. **Quizzes tab**:
   - Create a draft quiz (title + subject)
   - Click **+ Version**, paste a Quiz JSON (see `data/quizzes/*.json` for examples), save
   - Click **Publish** to make it visible to regular users
4. **Users tab**: ban/unban accounts, promote/demote roles, reset streaks
5. **Audit Log tab**: view all admin actions

### Quiz JSON format

Quiz content must conform to the schema in `src/lib/quiz/schemas.ts`. Example:

```json
{
  "id": "my-quiz-id",
  "title": "My Quiz",
  "subject": "Polish",
  "subjectSlug": "polish",
  "version": "1.0",
  "questions": [
    {
      "id": "q1",
      "type": "single_choice",
      "promptMarkdown": "## Question\n\nWhat is 2+2?",
      "maxScore": 1,
      "grading": { "mode": "deterministic" },
      "choices": [
        { "id": "a", "text": "3" },
        { "id": "b", "text": "4" },
        { "id": "c", "text": "5" }
      ],
      "correctAnswer": "b"
    }
  ]
}
```

Supported question types: `single_choice`, `multi_choice`, `short_text`, `numeric`, `math_open_with_work`, `polish_essay`, `code_python`.

---

## Security Notes

- AI provider keys are **server-only** — never bundled into the browser
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and is **server-only**
- All admin API routes verify `profiles.role = 'super_admin'` via the server session
- Grading endpoint rate limit: 30 req/min per user (in-memory; use Upstash Rate Limit for production)

---

## Project Structure

```
quiz-engine/
├── src/
│   ├── app/
│   │   ├── admin/              # Super admin panel (quizzes, users, audit)
│   │   ├── api/
│   │   │   ├── admin/          # Admin CRUD API routes
│   │   │   ├── attempts/       # Attempt start / submit routes
│   │   │   ├── auth/           # Sign-out route
│   │   │   └── grade/          # AI grading (with DB persistence + streak logging)
│   │   ├── auth/               # Login / signup / OAuth callback pages
│   │   ├── quiz/[quizId]/      # Quiz runner (Supabase-backed)
│   │   ├── streak/             # Daily practice calendar page
│   │   ├── subjects/[subject]/ # Subject quiz listing
│   │   └── settings/           # AI provider settings
│   ├── components/             # Navbar (server), NavbarClient, question inputs, FeedbackPanel
│   ├── lib/
│   │   ├── ai/                 # AI provider clients (OpenAI, Gemini, Anthropic)
│   │   ├── auth/               # requireAuth, requireSuperAdmin, writeAuditLog
│   │   ├── quiz/               # Zod schemas, file-based loader (legacy demo)
│   │   ├── supabase/           # Browser client, server client, middleware, DB types
│   │   └── zod/                # DB entity schemas
│   └── middleware.ts            # Session refresh + protected route guard
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql   # All tables, RLS, triggers, RPC
│       └── 002_seed_demo_quiz.sql   # Demo quiz metadata stubs
└── data/quizzes/               # Demo quiz JSON (paste into admin version editor)
```

---

## Running Tests

```bash
cd quiz-engine
npm test
```
