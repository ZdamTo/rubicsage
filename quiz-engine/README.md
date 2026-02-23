# RubicSage — AI-Graded Quiz Engine

A prototype AI-graded quiz engine for Polish Matura exams (Polish, Mathematics, Informatics).

## Features

- **7 question types**: single_choice, multi_choice, short_text, numeric, math_open_with_work, polish_essay, code_python
- **3 AI providers**: OpenAI (GPT), Google Gemini, Anthropic Claude — switchable in Settings
- **Configurable reasoning/thinking levels** per provider
- **Deterministic + AI hybrid grading**: MC/numeric scored deterministically, open questions graded by AI
- **Strict JSON output validation** with Zod (retry on failure, safe fallback)
- **In-browser Python execution** via Pyodide for code tasks
- **KaTeX math rendering** in question prompts
- **Monaco code editor** for Python tasks
- **CKE-aligned rubrics** for essay grading

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env and add your API keys
cp .env.example .env
# Edit .env with your API keys

# 3. Run dev server
npm run dev

# 4. Open http://localhost:3000
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | For OpenAI | OpenAI API key |
| `GEMINI_API_KEY` | For Gemini | Google Gemini API key |
| `ANTHROPIC_API_KEY` | For Claude | Anthropic API key |
| `DEFAULT_AI_PROVIDER` | No | Default provider (`openai` / `gemini` / `anthropic`) |
| `DEFAULT_OPENAI_MODEL` | No | Default OpenAI model (default: `gpt-4o`) |
| `DEFAULT_GEMINI_MODEL` | No | Default Gemini model (default: `gemini-2.5-flash`) |
| `DEFAULT_CLAUDE_MODEL` | No | Default Claude model (default: `claude-sonnet-4-5-20250929`) |

You only need the API key for the provider you want to use.

## Project Structure

```
quiz-engine/
├── data/quizzes/              # Quiz JSON definitions
│   ├── polish-basic-demo.json
│   ├── math-basic-demo.json
│   └── informatics-advanced-demo.json
├── rubrics/                   # CKE-style rubric Markdown files
│   ├── polish_essay_cke_2025.md
│   ├── math_open_cke_style.md
│   └── polish_short_text_style.md
├── references/cke_2025/       # Downloaded CKE reference PDFs
├── scripts/
│   └── fetch_references.sh    # Download CKE reference PDFs
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── page.tsx           # Home
│   │   ├── settings/page.tsx  # Settings
│   │   ├── subject/[slug]/    # Subject + quiz pages
│   │   └── api/grade/route.ts # Grading API endpoint
│   ├── components/            # React components
│   │   ├── questions/         # Per-type question renderers
│   │   ├── FeedbackPanel.tsx  # AI feedback display
│   │   ├── MarkdownRenderer.tsx
│   │   └── Navbar.tsx
│   ├── hooks/                 # React hooks
│   │   ├── usePyodide.ts     # Pyodide loader + runner
│   │   └── useSettings.ts    # localStorage settings
│   ├── lib/
│   │   ├── ai/               # AI provider abstraction
│   │   │   ├── types.ts
│   │   │   ├── prompts.ts
│   │   │   ├── openai-client.ts
│   │   │   ├── gemini-client.ts
│   │   │   ├── anthropic-client.ts
│   │   │   ├── provider-factory.ts
│   │   │   └── deterministic-scorer.ts
│   │   └── quiz/
│   │       ├── schemas.ts     # Zod schemas
│   │       └── loader.ts      # Quiz data loader
│   └── __tests__/             # Unit tests
└── .env.example
```

## Adding a New Quiz

1. Create a JSON file in `data/quizzes/` following the schema defined in `src/lib/quiz/schemas.ts`
2. Import it in `src/lib/quiz/loader.ts` and add to the `quizzes` array
3. The quiz will appear on its subject page automatically

### Question Type Reference

| Type | Grading | Input UI |
|------|---------|----------|
| `single_choice` | Deterministic + AI explanation | Radio buttons |
| `multi_choice` | Deterministic (exact set match) | Checkboxes |
| `short_text` | AI with rubric + key points | Textarea |
| `numeric` | Deterministic with tolerance | Text input |
| `math_open_with_work` | AI with rubric + partial credit | Answer + reasoning + image upload |
| `polish_essay` | AI with CKE rubric (35 pts) | Large textarea with word counter |
| `code_python` | Deterministic tests + AI feedback | Monaco editor + Pyodide runner |

## Running Tests

```bash
npm test         # Run once
npm run test:watch  # Watch mode
```

## Downloading CKE Reference PDFs

```bash
bash scripts/fetch_references.sh
```

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Validation**: Zod
- **Math rendering**: KaTeX (via react-markdown + remark-math + rehype-katex)
- **Code editor**: Monaco Editor
- **Python execution**: Pyodide (client-side WebAssembly)
- **AI SDKs**: OpenAI, @google/genai, @anthropic-ai/sdk
- **Testing**: Vitest
