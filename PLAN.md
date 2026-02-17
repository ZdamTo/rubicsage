# RubicSage — Polish Exam AI Platform: Development Plan

> **Version:** 1.0 | **Date:** 2026-02-17 | **Status:** Draft

---

## Table of Contents

1. [Product Vision & Assumptions](#1-product-vision--assumptions)
2. [User Personas & Stories](#2-user-personas--stories)
3. [Information Architecture & Sitemap](#3-information-architecture--sitemap)
4. [Feature Breakdown by MVP / v1.1 / v2.0](#4-feature-breakdown-by-mvp--v11--v20)
5. [Tech Stack & Architecture](#5-tech-stack--architecture)
6. [Database Schema](#6-database-schema)
7. [AI Pipeline Design](#7-ai-pipeline-design)
8. [API Contract (Key Endpoints)](#8-api-contract-key-endpoints)
9. [Frontend Component Tree](#9-frontend-component-tree)
10. [CKE Content Ingestion Pipeline](#10-cke-content-ingestion-pipeline)
11. [Grading Engine Design](#11-grading-engine-design)
12. [Security & Compliance](#12-security--compliance)
13. [DevOps & Infrastructure](#13-devops--infrastructure)
14. [Testing Strategy](#14-testing-strategy)
15. [Milestone Timeline](#15-milestone-timeline)
16. [Risks & Mitigations](#16-risks--mitigations)
17. [Open Questions](#17-open-questions)

---

## 1. Product Vision & Assumptions

### Vision

A web platform where Polish students can take realistic mock exams (matura, egzamin osmoklasisty, driving license theory, and more), receive **instant AI-powered grading** aligned with official CKE assessment criteria, and get **personalized feedback** that helps them improve.

### Core Assumptions

| # | Assumption | Impact if wrong |
|---|-----------|-----------------|
| A1 | CKE publishes enough past exam sheets (arkusze) and rubrics publicly to seed the platform | Must negotiate data licensing or crowd-source |
| A2 | LLM grading of Polish-language free-text answers can reach >= 85% agreement with human examiners | Need hybrid human-review fallback |
| A3 | Students are willing to use a freemium model (free practice, paid detailed analytics) | Explore B2B school licensing instead |
| A4 | The platform initially targets desktop + mobile web; native apps are v2+ | Responsive design is sufficient for MVP |
| A5 | We can legally scrape/use publicly posted CKE materials for educational purposes | Legal review required before launch |
| A6 | Polish language LLM capabilities (GPT-4o / Claude) are sufficient for nuanced literary analysis | Benchmark against human graders early |

---

## 2. User Personas & Stories

### Personas

| Persona | Description | Primary Goal |
|---------|-------------|-------------|
| **Kasia (17, liceum)** | Preparing for matura z polskiego, stressed about the essay component | Practice essays under timed conditions, get actionable feedback |
| **Tomek (14, 8th grade)** | Needs to pass egzamin osmoklasisty, weak in reading comprehension | Drill reading-comprehension questions, track progress |
| **Pani Nowak (teacher)** | Polish teacher at a public liceum, 120 students | Assign mock exams, view class-wide analytics, save grading time |
| **Marek (30, career changer)** | Studying for driving license theory exam | Quick quiz sessions on his phone during commute |
| **Admin (platform)** | Content manager / ops | Add new exam categories, upload arkusze, tune AI rubrics |

### Key User Stories (MVP)

| ID | As a... | I want to... | So that... | Priority |
|----|---------|-------------|-----------|----------|
| US-01 | Student | Browse available exam types and pick one | I can practice the specific exam I'm preparing for | P0 |
| US-02 | Student | Take a timed mock exam with realistic questions | I simulate real exam conditions | P0 |
| US-03 | Student | Get instant AI grading and feedback after submission | I know my score and what to improve without waiting | P0 |
| US-04 | Student | Review my past attempts and see progress over time | I can track improvement | P1 |
| US-05 | Student | See the official CKE rubric next to my graded answer | I understand how scoring works | P0 |
| US-06 | Teacher | Create a classroom and invite students | I can monitor my students' practice | P1 |
| US-07 | Teacher | View aggregated class results and weak-area reports | I can tailor my teaching | P1 |
| US-08 | Admin | Upload a new exam sheet (arkusz) via a structured form | New content is available to students within minutes | P0 |
| US-09 | Admin | Add a new exam category (e.g., driving license) with its own rubric schema | The platform grows beyond matura | P1 |
| US-10 | Student | Get AI-generated hints (without full answers) when stuck | I learn actively instead of just seeing the solution | P1 |

---

## 3. Information Architecture & Sitemap

```
/                           Landing page (hero, CTA, exam category cards)
/auth/login                 Login (email + OAuth)
/auth/register              Registration
/dashboard                  Student dashboard (recent attempts, progress chart, recommended exams)
/exams                      Exam catalog (filterable by type, year, difficulty)
/exams/:category            Category page (e.g., /exams/matura-polski)
/exams/:category/:examId    Exam detail — start exam, see metadata
/session/:sessionId         Active exam session (timer, questions, answer input)
/session/:sessionId/review  Post-submission: AI grade + feedback per question
/progress                   Historical progress, streaks, weak areas
/teacher/dashboard          Teacher class overview
/teacher/classroom/:id      Single classroom — student list, results
/admin/exams                Exam management CRUD
/admin/categories           Category + rubric management
/admin/content-pipeline     Content ingestion queue & status
/settings                   Account settings, subscription
```

---

## 4. Feature Breakdown by MVP / v1.1 / v2.0

### MVP (Weeks 1–8)

| Feature | Description |
|---------|-------------|
| **Auth system** | Email/password + Google OAuth; JWT sessions |
| **Exam catalog** | Browse exam categories, filter by year/type |
| **Exam session engine** | Timed quiz with multiple-choice AND free-text questions |
| **AI grading (core)** | LLM grades each answer against CKE rubric; returns score + written feedback |
| **Rubric display** | Show official CKE criteria alongside the AI grade |
| **Exam admin panel** | Upload/edit exams via structured JSON/form; attach rubric |
| **2 exam categories seeded** | Matura z jezyka polskiego (base + extended), Egzamin osmoklasisty |
| **Basic progress tracking** | List of past attempts with scores |
| **Responsive UI** | Works on desktop and mobile browsers |

### v1.1 (Weeks 9–14)

| Feature | Description |
|---------|-------------|
| **Teacher classrooms** | Create class, invite students, view aggregated results |
| **Detailed analytics** | Per-student weak-area identification, score trends |
| **AI hints** | "Hint" button gives progressive clues without full answer |
| **Internet-augmented grading** | AI agent can search the web to verify current CKE guidance |
| **Exam generation** | AI generates new practice questions in the style of real exams |
| **PDF export** | Export graded exam as PDF for offline review |
| **Notification system** | Email/in-app reminders for study streaks |

### v2.0 (Weeks 15–24)

| Feature | Description |
|---------|-------------|
| **New exam categories** | Driving license theory, matura z matematyki, matura z angielskiego |
| **Adaptive difficulty** | AI adjusts question difficulty based on student performance |
| **Spaced repetition** | Resurface missed questions using SM-2 algorithm |
| **Subscription/paywall** | Freemium model: free basic, paid pro with analytics + unlimited exams |
| **Native mobile (PWA)** | Installable PWA with offline exam caching |
| **School/institution licensing** | B2B portal for schools to buy bulk access |
| **Accessibility (WCAG 2.1 AA)** | Full keyboard nav, screen reader support, high contrast |

---

## 5. Tech Stack & Architecture

### Stack Selection

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 14 (App Router) + TypeScript | SSR for SEO on landing/catalog; React ecosystem; great DX |
| **UI Library** | shadcn/ui + Tailwind CSS | Accessible components, easy theming, fast iteration |
| **State** | Zustand (client) + React Query (server) | Lightweight, avoids Redux boilerplate |
| **Backend** | Next.js API Routes + tRPC | End-to-end type safety; colocated with frontend |
| **Database** | PostgreSQL 16 | Relational data (users, exams, attempts); JSONB for flexible rubrics |
| **ORM** | Drizzle ORM | Type-safe, performant, great migration tooling |
| **Auth** | NextAuth.js (Auth.js v5) | Built-in OAuth providers, JWT + database sessions |
| **AI / LLM** | Anthropic Claude API (primary), OpenAI GPT-4o (fallback) | Best Polish language understanding; fallback for resilience |
| **AI Orchestration** | LangChain.js + custom prompt pipeline | Tool use (web search), structured output, rubric injection |
| **Web Search (AI)** | Tavily API or Bing Search API | Allows AI to verify current CKE rules online |
| **File Storage** | AWS S3 (or Cloudflare R2) | Exam PDFs, images, uploaded arkusze |
| **Cache** | Redis (Upstash) | Session cache, rate limiting, LLM response cache |
| **Search** | PostgreSQL full-text search (MVP) → Meilisearch (v1.1) | Exam search; defer dedicated engine until needed |
| **Hosting** | Vercel (app) + Neon (Postgres) + Upstash (Redis) | Serverless, scales to zero, low ops overhead for MVP |
| **CI/CD** | GitHub Actions | Lint, test, preview deploys on PR, prod deploy on main |
| **Monitoring** | Sentry (errors) + Vercel Analytics + PostHog (product) | Full observability stack |

### Architecture Diagram (Logical)

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                    │
│  Next.js App Router — React Components — Zustand         │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / tRPC / WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                   NEXT.JS SERVER                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐  │
│  │ tRPC API │  │ Auth.js  │  │  Background Jobs      │  │
│  │ Routes   │  │ Sessions │  │  (Inngest / QStash)   │  │
│  └────┬─────┘  └────┬─────┘  └──────────┬────────────┘  │
│       │              │                   │               │
│  ┌────▼──────────────▼───────────────────▼────────────┐  │
│  │              SERVICE LAYER                          │  │
│  │  ExamService | GradingService | UserService         │  │
│  │  ContentPipeline | AnalyticsService                 │  │
│  └────┬─────────────┬───────────────┬─────────────────┘  │
└───────│─────────────│───────────────│────────────────────┘
        │             │               │
   ┌────▼────┐  ┌─────▼─────┐  ┌─────▼──────┐
   │Postgres │  │  Redis     │  │ AI Pipeline │
   │ (Neon)  │  │ (Upstash)  │  │            │
   │         │  │            │  │ Claude API │
   │ Users   │  │ Sessions   │  │ + Tools    │
   │ Exams   │  │ Rate Limit │  │ (Web srch) │
   │ Attempts│  │ LLM Cache  │  │            │
   └─────────┘  └────────────┘  └─────┬──────┘
                                      │
                                ┌─────▼──────┐
                                │ Tavily /    │
                                │ Bing Search │
                                │ (CKE rules) │
                                └─────────────┘
```

---

## 6. Database Schema

### Core Tables

```sql
-- USERS
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255),          -- NULL for OAuth-only users
    name            VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'student',
                    -- 'student' | 'teacher' | 'admin'
    avatar_url      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- EXAM CATEGORIES (extensible — matura, osmoklasisty, driving, etc.)
CREATE TABLE exam_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug            VARCHAR(100) UNIQUE NOT NULL,   -- 'matura-polski'
    name            VARCHAR(255) NOT NULL,           -- 'Matura z Jezyka Polskiego'
    description     TEXT,
    icon_url        TEXT,
    grading_schema  JSONB NOT NULL,
    -- Defines the rubric structure for this category, e.g.:
    -- { "criteria": [
    --     { "key": "tresc", "label": "Realizacja tematu", "maxPoints": 25 },
    --     { "key": "kompozycja", "label": "Kompozycja", "maxPoints": 25 },
    --     ...
    -- ]}
    metadata        JSONB DEFAULT '{}',             -- extensible fields
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- EXAMS (a specific exam sheet / arkusz)
CREATE TABLE exams (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id     UUID NOT NULL REFERENCES exam_categories(id),
    title           VARCHAR(500) NOT NULL,           -- 'Matura 2025 — Poziom Podstawowy'
    year            INTEGER,
    level           VARCHAR(50),                     -- 'podstawowy' | 'rozszerzony'
    source          VARCHAR(100),                    -- 'CKE' | 'custom' | 'ai-generated'
    source_url      TEXT,                            -- link to original PDF
    time_limit_min  INTEGER,                         -- exam duration in minutes
    total_points    INTEGER NOT NULL,
    is_published    BOOLEAN DEFAULT FALSE,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- QUESTIONS (within an exam)
CREATE TABLE questions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id         UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    order_index     INTEGER NOT NULL,
    type            VARCHAR(30) NOT NULL,
                    -- 'multiple_choice' | 'free_text' | 'essay' | 'fill_blank' | 'matching'
    prompt_text     TEXT NOT NULL,                   -- the question itself (Markdown)
    prompt_media    JSONB DEFAULT '[]',              -- images, audio clips, text excerpts
    options         JSONB,                           -- for MC: [{ "key":"A", "text":"..." }, ...]
    correct_answer  TEXT,                            -- for MC / fill_blank; NULL for essays
    max_points      INTEGER NOT NULL,
    rubric          JSONB,
    -- Per-question rubric (supplements category-level schema), e.g.:
    -- { "criteria": [
    --     { "key": "argument", "label": "Argumentacja", "maxPoints": 8, "descriptors": [...] }
    -- ]}
    hints           JSONB DEFAULT '[]',             -- progressive hints for AI hint feature
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- TEXT PASSAGES / READING MATERIAL (attached to exams)
CREATE TABLE exam_texts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id         UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    order_index     INTEGER NOT NULL,
    title           VARCHAR(500),                    -- 'Fragment "Lalki" B. Prusa'
    content         TEXT NOT NULL,                   -- the actual passage
    author          VARCHAR(255),
    source_ref      VARCHAR(500),                   -- bibliographic reference
    media_urls      JSONB DEFAULT '[]'
);

-- EXAM ATTEMPTS (a student taking an exam)
CREATE TABLE exam_attempts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    exam_id         UUID NOT NULL REFERENCES exams(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'in_progress',
                    -- 'in_progress' | 'submitted' | 'graded' | 'expired'
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    submitted_at    TIMESTAMPTZ,
    time_spent_sec  INTEGER,
    total_score     NUMERIC(6,2),
    max_score       INTEGER,
    percentage      NUMERIC(5,2),
    ai_model_used   VARCHAR(100),                   -- 'claude-sonnet-4-5-20250929'
    graded_at       TIMESTAMPTZ,
    metadata        JSONB DEFAULT '{}'
);

-- ANSWERS (per-question responses within an attempt)
CREATE TABLE answers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id      UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    question_id     UUID NOT NULL REFERENCES questions(id),
    response_text   TEXT,                            -- student's written answer
    selected_option VARCHAR(10),                     -- for MC questions
    score           NUMERIC(5,2),
    max_score       INTEGER NOT NULL,
    ai_feedback     TEXT,                            -- markdown feedback from AI
    ai_score_breakdown JSONB,
    -- Per-criterion scores: { "argument": 6, "jezyk": 4, ... }
    grading_confidence NUMERIC(3,2),                -- 0.00–1.00
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- CLASSROOMS (teacher feature, v1.1)
CREATE TABLE classrooms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID NOT NULL REFERENCES users(id),
    name            VARCHAR(255) NOT NULL,
    join_code       VARCHAR(20) UNIQUE NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE classroom_members (
    classroom_id    UUID REFERENCES classrooms(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (classroom_id, user_id)
);

-- CKE RUBRIC DOCUMENTS (source-of-truth for grading)
CREATE TABLE rubric_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id     UUID NOT NULL REFERENCES exam_categories(id),
    title           VARCHAR(500) NOT NULL,
    content         TEXT NOT NULL,                   -- full text of CKE rubric doc
    source_url      TEXT,
    version         VARCHAR(50),                    -- 'CKE 2025'
    is_active       BOOLEAN DEFAULT TRUE,
    uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_exams_category ON exams(category_id);
CREATE INDEX idx_questions_exam ON questions(exam_id);
CREATE INDEX idx_attempts_user ON exam_attempts(user_id);
CREATE INDEX idx_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX idx_answers_attempt ON answers(attempt_id);
CREATE INDEX idx_classroom_members_user ON classroom_members(user_id);
```

### Entity Relationship Summary

```
users 1──* exam_attempts *──1 exams *──1 exam_categories
                │                  │
                │                  ├──* questions
                └──* answers ──────┘
                                   ├──* exam_texts
                                   └──* rubric_documents

users 1──* classrooms *──* users (via classroom_members)
```

---

## 7. AI Pipeline Design

### 7.1 Grading Pipeline (Core)

```
Student submits answer
        │
        ▼
┌───────────────────┐
│  1. Classify       │  Determine question type → route to correct grading prompt
│     Question Type  │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  2. Load Context   │  • Question text + prompt media
│                    │  • CKE rubric (from rubric_documents)
│                    │  • Category grading_schema
│                    │  • Per-question rubric (if any)
│                    │  • Model answer (if exists)
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  3. Construct      │  System prompt:
│     Prompt         │  "You are a CKE examiner for {exam_type}.
│                    │   Grade this answer strictly per the rubric below.
│                    │   Return structured JSON."
│                    │
│                    │  Includes: rubric text, marking descriptors,
│                    │  point ranges, and example graded answers
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  4. LLM Call       │  Claude API with structured output (tool_use)
│     (+ tools)      │  Tools available:
│                    │    - web_search: verify current CKE rules
│                    │    - lookup_literary_work: check facts about texts
│                    │  Temperature: 0.1 (deterministic grading)
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  5. Parse &        │  Validate JSON schema:
│     Validate       │  { scores: { criterion: number },
│                    │    totalScore: number,
│                    │    feedback: string,
│                    │    confidence: number }
│                    │  Retry once if schema invalid
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  6. Store &        │  Write to answers table
│     Return         │  Flag low-confidence grades for human review
└───────────────────┘
```

### 7.2 Prompt Template (Essay Grading Example)

```
<system>
You are an expert Polish language examiner certified by CKE
(Centralna Komisja Egzaminacyjna). You grade matura exam essays
with strict adherence to the official rubric.

RUBRIC:
{{rubric_text}}

GRADING CRITERIA:
{{criteria_table}}

INSTRUCTIONS:
1. Read the student's essay carefully.
2. Evaluate against EACH criterion independently.
3. Assign points within the allowed range per criterion.
4. Write specific, constructive feedback in Polish.
5. Quote the student's text when pointing out strengths or errors.
6. If unsure about a current CKE rule, use web_search to verify.
7. Return your evaluation as structured JSON.
</system>

<user>
TEMAT WYPRACOWANIA:
{{essay_topic}}

TEKST ZRODLOWY:
{{source_text}}

ODPOWIEDZ UCZNIA:
{{student_essay}}
</user>
```

### 7.3 Web Search Integration

The AI grading agent has access to a `web_search` tool for:
- Verifying the latest CKE rubric changes (CKE publishes updates yearly)
- Checking interpretations of grading rules on CKE's official site
- Looking up literary facts the student references (to verify correctness)

**Implementation:** LangChain.js `AgentExecutor` with `TavilySearchResults` tool, bounded to max 2 searches per grading call to control latency and cost.

### 7.4 Cost Estimation

| Operation | Model | Avg Tokens | Cost (est.) |
|-----------|-------|-----------|-------------|
| MC question grading (batch of 20) | Claude Haiku | ~2K in, ~500 out | $0.003 |
| Free-text short answer | Claude Sonnet | ~3K in, ~1K out | $0.02 |
| Full essay grading | Claude Sonnet | ~8K in, ~2K out | $0.06 |
| Essay + web search | Claude Sonnet + Tavily | ~12K in, ~3K out | $0.10 |

**Per full matura mock exam (est.):** ~$0.25–$0.40 in AI costs.

---

## 8. API Contract (Key Endpoints)

All endpoints use tRPC. Below is the logical router structure:

### Auth Router

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `auth.register` | mutation | `{ email, password, name }` | `{ user, token }` |
| `auth.login` | mutation | `{ email, password }` | `{ user, token }` |
| `auth.me` | query | — | `User` |

### Exam Router

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `exam.listCategories` | query | — | `ExamCategory[]` |
| `exam.listByCategory` | query | `{ categorySlug, page, filters }` | `{ exams: Exam[], total }` |
| `exam.getById` | query | `{ examId }` | `Exam` (with questions + texts) |
| `exam.search` | query | `{ query, categorySlug? }` | `Exam[]` |

### Session Router

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `session.start` | mutation | `{ examId }` | `{ attemptId, questions, timeLimit }` |
| `session.saveAnswer` | mutation | `{ attemptId, questionId, response }` | `{ saved: true }` |
| `session.submit` | mutation | `{ attemptId }` | `{ status: 'grading' }` |
| `session.getResult` | query | `{ attemptId }` | `AttemptResult` (scores + feedback) |
| `session.getHint` | mutation | `{ attemptId, questionId, hintLevel }` | `{ hint: string }` |

### Progress Router

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `progress.myAttempts` | query | `{ page, categorySlug? }` | `Attempt[]` |
| `progress.dashboard` | query | — | `{ stats, recentAttempts, weakAreas }` |
| `progress.categoryProgress` | query | `{ categorySlug }` | `CategoryProgress` |

### Admin Router

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `admin.createCategory` | mutation | `CreateCategoryInput` | `ExamCategory` |
| `admin.createExam` | mutation | `CreateExamInput` | `Exam` |
| `admin.addQuestion` | mutation | `CreateQuestionInput` | `Question` |
| `admin.uploadRubric` | mutation | `{ categoryId, title, content, sourceUrl }` | `RubricDocument` |
| `admin.publishExam` | mutation | `{ examId }` | `Exam` |
| `admin.importArkusz` | mutation | `{ file (PDF/JSON), categoryId }` | `{ jobId }` |

### Teacher Router (v1.1)

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `teacher.createClassroom` | mutation | `{ name }` | `Classroom` |
| `teacher.classroomResults` | query | `{ classroomId, examId? }` | `ClassroomReport` |

---

## 9. Frontend Component Tree

```
app/
├── layout.tsx                    # Root layout — nav, theme, auth provider
├── page.tsx                      # Landing page
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── dashboard/
│   └── page.tsx                  # Student dashboard
│       ├── <ProgressChart />     # Recharts — score trend line
│       ├── <RecentAttempts />    # List of last 5 attempts
│       ├── <WeakAreaCards />     # AI-identified weak topics
│       └── <RecommendedExams /> # Smart suggestions
├── exams/
│   ├── page.tsx                  # Catalog with filters
│   │   ├── <CategoryFilter />
│   │   ├── <ExamCard />          # Reusable card component
│   │   └── <SearchBar />
│   └── [category]/
│       ├── page.tsx              # Category listing
│       └── [examId]/
│           └── page.tsx          # Exam detail + "Start" CTA
│               ├── <ExamMeta />
│               └── <StartExamButton />
├── session/
│   └── [sessionId]/
│       ├── page.tsx              # Active exam session
│       │   ├── <Timer />         # Countdown timer
│       │   ├── <QuestionNav />   # Question sidebar navigator
│       │   ├── <QuestionRenderer />
│       │   │   ├── <MultipleChoice />
│       │   │   ├── <FreeTextEditor />  # Rich text (Tiptap)
│       │   │   ├── <EssayEditor />     # Full Tiptap with word count
│       │   │   └── <FillBlank />
│       │   ├── <HintButton />
│       │   └── <SubmitExamModal />
│       └── review/
│           └── page.tsx          # Graded review
│               ├── <ScoreSummary />     # Total + per-criterion
│               ├── <RubricPanel />      # Official CKE rubric sidebar
│               ├── <AnswerReview />     # Per-question: answer + AI feedback
│               └── <FeedbackActions />  # "Report incorrect grade" button
├── progress/
│   └── page.tsx
│       ├── <OverallStats />
│       ├── <CategoryBreakdown />
│       └── <AttemptHistory />
├── teacher/                      # (v1.1)
│   ├── dashboard/page.tsx
│   └── classroom/[id]/page.tsx
├── admin/                        # Admin panel
│   ├── exams/page.tsx            # CRUD exam list
│   ├── categories/page.tsx
│   └── content-pipeline/page.tsx
└── components/                   # Shared
    ├── ui/                       # shadcn components
    ├── ExamCard.tsx
    ├── Navbar.tsx
    ├── Footer.tsx
    ├── RichTextEditor.tsx        # Tiptap wrapper
    └── LoadingStates.tsx
```

---

## 10. CKE Content Ingestion Pipeline

### Goal
Convert official CKE exam sheets (arkusze) — typically published as PDFs — into structured exam data in the database.

### Pipeline Steps

```
1. UPLOAD          Admin uploads PDF or structured JSON via admin panel
       │
       ▼
2. PDF EXTRACT     If PDF:
       │           • pdf-parse (Node) extracts raw text
       │           • GPT-4o Vision or Claude analyzes page images for
       │             tables, diagrams, formatting
       │
       ▼
3. AI STRUCTURING  LLM call to convert extracted text → structured JSON:
       │           { title, year, level, questions: [...], texts: [...] }
       │           Prompt includes schema definition + 2 few-shot examples
       │
       ▼
4. HUMAN REVIEW    Extracted exam enters a review queue in admin panel
       │           Admin verifies/edits each question, correct answers, rubric
       │           Status: draft → reviewed → published
       │
       ▼
5. RUBRIC LINK     System matches exam to existing rubric_documents
       │           or prompts admin to upload the corresponding rubric
       │
       ▼
6. PUBLISH         Exam becomes visible to students
```

### Rubric Ingestion
- CKE rubric PDFs are separately uploaded and stored as `rubric_documents`
- The full text is extracted and stored for injection into AI grading prompts
- Admin maps rubric criteria → `exam_categories.grading_schema` structure
- When CKE publishes updates, admin uploads new version; old version is archived

### Content Sources
| Source | Format | Ingestion Method |
|--------|--------|-----------------|
| CKE website (cke.gov.pl) | PDF | Manual download + upload |
| Historical arkusze | PDF | Batch upload |
| Teacher-contributed exams | Web form | Direct structured input |
| AI-generated questions | JSON | Generated by AI, human-reviewed |

---

## 11. Grading Engine Design

### Multi-Strategy Grading

| Question Type | Strategy | Model |
|---------------|---------|-------|
| `multiple_choice` | Exact match — no AI needed | None (deterministic) |
| `fill_blank` | Fuzzy string match + synonym list | None (deterministic) |
| `free_text` (short) | LLM grading with rubric | Claude Haiku/Sonnet |
| `essay` | Full LLM grading with multi-criteria rubric | Claude Sonnet |
| `matching` | Exact set comparison | None (deterministic) |

### Grading Consistency Measures

1. **Low temperature** (0.1) for all grading calls
2. **Self-consistency check**: For essays, run grading twice; if scores differ by > 15%, run a third time and take the majority
3. **Calibration dataset**: Maintain 50+ human-graded essays as ground truth; regularly benchmark AI against them
4. **Confidence scoring**: AI outputs a 0–1 confidence; scores < 0.7 are flagged for human review
5. **Grade appeal**: Students can flag a grade; flagged answers enter a re-grading queue with a different prompt variant

### Rubric Injection Strategy

```
For each exam category:
  1. Load exam_categories.grading_schema → criteria list
  2. Load rubric_documents (active version) → full CKE rubric text
  3. Load questions.rubric → question-specific rubric overlay
  4. Merge into final rubric context for the prompt
  5. Include 1-2 reference answers (if available) as calibration examples
```

---

## 12. Security & Compliance

### Authentication & Authorization

| Concern | Solution |
|---------|---------|
| Password storage | bcrypt with cost factor 12 |
| Session management | JWT (15min access) + HTTP-only refresh token (7d) |
| OAuth | Google + (future) Facebook via Auth.js |
| Role-based access | Middleware checks `user.role` — student/teacher/admin |
| API rate limiting | Redis-based: 100 req/min general, 10 req/min grading |

### Data Protection

| Concern | Solution |
|---------|---------|
| GDPR/RODO compliance | Polish RODO equivalent; consent banner, data export, delete account |
| Student data (minors) | Parental consent flow for users < 16; minimal data collection |
| Essay content privacy | Student essays are stored encrypted at rest (Neon default) |
| AI data handling | Use Claude API with zero data retention option |
| PII in logs | Structured logging with PII redaction |

### Application Security

- OWASP Top 10 protections: CSRF tokens, parameterized queries (Drizzle ORM), CSP headers
- Input sanitization on all free-text fields (DOMPurify for Markdown rendering)
- File upload validation: type check, size limit (10MB), virus scan (ClamAV in pipeline)
- Dependency audit: `npm audit` in CI, Dependabot enabled

---

## 13. DevOps & Infrastructure

### Environments

| Environment | Purpose | URL |
|-------------|---------|-----|
| `local` | Developer machines | `localhost:3000` |
| `preview` | Per-PR preview deploys (Vercel) | `pr-{n}.rubicsage.vercel.app` |
| `staging` | Pre-production testing | `staging.rubicsage.pl` |
| `production` | Live users | `rubicsage.pl` |

### CI/CD Pipeline (GitHub Actions)

```yaml
# Trigger: push to any branch / PR to main
jobs:
  lint:        ESLint + Prettier check
  typecheck:   tsc --noEmit
  test-unit:   Vitest (unit + integration)
  test-e2e:    Playwright (critical paths)
  build:       next build
  preview:     Deploy to Vercel preview (PR only)
  deploy:      Deploy to production (main branch, after all checks pass)
```

### Infrastructure Costs (MVP Estimate)

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Vercel | Pro | $20 |
| Neon (Postgres) | Launch | $19 |
| Upstash (Redis) | Pay-as-you-go | ~$5 |
| Cloudflare R2 | Free tier | $0 |
| Claude API | Pay-per-use | ~$150 (est. 2K exams/mo) |
| Tavily Search | Starter | $0 (1K free/mo) |
| Sentry | Developer | $0 |
| Domain (rubicsage.pl) | — | ~$15/yr |
| **Total** | | **~$200/mo** |

---

## 14. Testing Strategy

### Test Pyramid

```
         ┌──────────┐
         │   E2E    │   5-10 critical user flows (Playwright)
         │  Tests   │   • Take exam → get graded → view review
         ├──────────┤   • Admin creates exam → student sees it
         │ Integr.  │   15-25 tests (Vitest + test DB)
         │  Tests   │   • tRPC routes, grading pipeline, auth flows
         ├──────────┤
         │   Unit   │   50-100 tests (Vitest)
         │  Tests   │   • Score calculation, rubric parsing, time utils
         └──────────┘   • Component rendering (React Testing Library)
```

### AI Grading Quality Tests

| Test Type | Method | Frequency |
|-----------|--------|-----------|
| **Accuracy benchmark** | Run AI grading on 50 human-graded essays; compare scores | Weekly in CI |
| **Regression suite** | 20 "golden" question+answer pairs with expected score ranges | Every PR |
| **Prompt drift detection** | Log prompt versions; alert if grading distribution shifts > 10% | Daily in prod |
| **Hallucination checks** | Verify AI feedback references only real rubric criteria | In grading pipeline |

---

## 15. Milestone Timeline

### Phase 1: Foundation (Weeks 1–3)

| Week | Tasks |
|------|-------|
| W1 | Project scaffolding (Next.js + tRPC + Drizzle); DB schema + migrations; Auth (register/login/OAuth); CI/CD pipeline |
| W2 | Exam catalog pages (categories, listing, detail); Admin panel: CRUD for categories and exams; Seed database with 2 real matura arkusze |
| W3 | Question renderer components (MC, free-text, essay); Exam session engine (timer, navigation, auto-save); Submit flow |

### Phase 2: AI Grading (Weeks 4–6)

| Week | Tasks |
|------|-------|
| W4 | AI grading pipeline: MC (deterministic) + free-text (LLM); Prompt engineering with real CKE rubrics; Structured output parsing |
| W5 | Essay grading: multi-criteria rubric injection; Self-consistency checks; Confidence scoring; Grading results UI (score summary + per-question feedback) |
| W6 | Rubric display panel; Grade appeal flow; AI cost optimization (caching, batching MC questions); Calibration benchmark (compare AI vs human on 50 essays) |

### Phase 3: Polish & Launch (Weeks 7–8)

| Week | Tasks |
|------|-------|
| W7 | Progress dashboard (charts, attempt history, weak areas); Responsive design pass; Performance optimization (ISR for catalog, lazy loading) |
| W8 | E2E tests for critical flows; Security audit; Content: seed 5+ complete matura exams + 3 egzamin osmoklasisty; Landing page; **MVP Launch** |

### Phase 4: v1.1 Features (Weeks 9–14)

| Week | Tasks |
|------|-------|
| W9-10 | Teacher classrooms + student management |
| W11 | Internet-augmented grading (web search tool for AI) |
| W12 | AI hint system; AI-generated practice questions |
| W13 | Detailed analytics & weak-area reports |
| W14 | PDF export; Notification system; v1.1 release |

### Phase 5: v2.0 Scale (Weeks 15–24)

| Milestone | Tasks |
|-----------|-------|
| W15-17 | New exam categories (driving license, matura math, matura English) |
| W18-19 | Adaptive difficulty engine + spaced repetition |
| W20-21 | Subscription system (Stripe) + paywall |
| W22-23 | PWA support; B2B school licensing portal |
| W24 | WCAG 2.1 AA audit + fixes; v2.0 release |

---

## 16. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | AI grading accuracy below acceptable threshold for essays | Medium | High | Calibration benchmarks; human-review fallback for low-confidence; continuous prompt tuning |
| R2 | CKE changes rubric mid-year; AI uses stale criteria | Medium | Medium | Web search tool for real-time CKE verification; admin alert to upload new rubric docs |
| R3 | Legal challenge on use of CKE exam materials | Low | High | Legal review before launch; attribute CKE as source; consider official partnership |
| R4 | LLM API costs exceed budget at scale | Medium | Medium | Cache repeat grading patterns; use Haiku for MC/short; batch questions; set user rate limits |
| R5 | Students game the system (submit known model answers) | Low | Low | Detect duplicate submissions; vary AI-generated questions; watermark AI answers |
| R6 | Polish language LLM quality degrades in niche literary topics | Medium | Medium | Maintain literary-reference RAG database; fallback to GPT-4o for edge cases |
| R7 | Scalability issues during exam season (May matura peak) | Medium | High | Vercel auto-scales; pre-warm serverless functions; queue grading jobs with backpressure |
| R8 | Teacher/school adoption slower than expected | Medium | Medium | Build B2C audience first; offer free teacher tier; direct school outreach |

---

## 17. Open Questions

| # | Question | Decision needed by | Default assumption |
|---|----------|-------------------|-------------------|
| Q1 | Do we need a formal license/agreement with CKE to use their exam content? | Before MVP launch | Fair use for educational purposes; credit CKE |
| Q2 | Should essay grading use a single LLM call or a multi-agent approach (one agent per criterion)? | Week 4 (start of AI phase) | Single call with multi-criteria prompt (simpler, cheaper) |
| Q3 | Target Claude or GPT-4o as primary model? | Week 4 | Claude Sonnet (better structured output, Polish performance TBD via benchmark) |
| Q4 | Freemium pricing: what goes behind the paywall? | Before v2.0 | Free: 3 exams/month; Pro: unlimited + analytics + teacher features |
| Q5 | Should we support handwriting input (photo of handwritten essay)? | v2.0 planning | No — typed input only for MVP; OCR pipeline in v2.0 |
| Q6 | Do we need real-time collaborative features (teacher watches student live)? | v1.1 planning | No — async review only |
| Q7 | Multi-language UI support (Ukrainian for refugee students)? | v2.0 planning | Polish only for MVP |

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| **CKE** | Centralna Komisja Egzaminacyjna — Poland's Central Examination Board |
| **Matura** | Polish high-school exit exam, required for university admission |
| **Egzamin osmoklasisty** | Exam taken at end of 8th grade (age ~14) |
| **Arkusz** | An exam sheet / paper — the actual set of questions |
| **Rubric** | Official scoring criteria published by CKE for each exam type |
| **RODO** | Polish implementation of GDPR (data protection regulation) |

---

*This plan is a living document. Update it as decisions are made and requirements evolve.*
