# Run Sheet Generator

Internal tool for **BOP Abstract** that uses OCR + AI to dramatically reduce the time abstractors spend manually typing data from recorded documents into Excel runsheets.

## Quick start

**👉 If you are picking this project up fresh, read these two files first:**

1. **`docs/BUILD_PLAN.md`** — full project context, decisions, and roadmap
2. **`docs/SETUP.md`** — step-by-step instructions for Google Cloud, Anthropic, and Vercel setup

## What this is

- **Input**: Abstractor uploads PDFs of recorded documents (deeds, leases, easements, etc.)
- **Processing**: Google Document AI runs OCR; Claude extracts structured runsheet data
- **Output**: Editable review table → Excel export matching BOP's runsheet template

## Architecture

```
[Browser]
   │ PDF upload
   ▼
[Next.js API route /api/extract]
   │
   ├─→ Google Document AI (OCR)
   │
   └─→ Claude API (structured extraction)
   │
   ▼
[Editable review table in browser]
   │
   ▼
[Excel export with SheetJS]
```

## Tech stack

- **Framework**: Next.js 14 (App Router), TypeScript
- **Hosting**: Vercel
- **OCR**: Google Document AI
- **LLM**: Claude (Anthropic API) — Sonnet 4.6 by default
- **Excel**: SheetJS (xlsx)

## File structure

```
.
├── app/
│   ├── api/
│   │   ├── extract/route.ts    # Main endpoint: PDF → instruments JSON
│   │   └── health/route.ts     # Env var check
│   ├── layout.tsx              # Global styles (BOP orange/dark theme)
│   └── page.tsx                # Form + review table + Excel export
├── lib/
│   ├── docai.ts                # Google Document AI client
│   └── claude.ts               # Claude extraction (with the runsheet prompt)
├── docs/
│   ├── BUILD_PLAN.md           # 👈 Read first
│   └── SETUP.md                # 👈 Then read this
├── package.json
├── next.config.js
├── tsconfig.json
└── .gitignore
```

## Required environment variables

Set in Vercel dashboard. See `docs/SETUP.md` for how to obtain each.

- `ANTHROPIC_API_KEY`
- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_DOCAI_PROCESSOR_ID`
- `GOOGLE_DOCAI_LOCATION` (usually `us`)
- `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64`

## Health check

After deploy, hit `/api/health` to confirm all env vars are configured.

## Status

**Phase 1** — proof-of-concept. Single user, no auth, no persistence, single sheet output.

See `docs/BUILD_PLAN.md` for the full phased roadmap (Phase 2 = accuracy tuning, Phase 3 = multi-user, Phase 4 = operational tooling).

## Important constraints

- **Human review is assumed.** Claude is tuned to flag uncertainty rather than guess. The goal is "review-assisted abstracting," not autonomous extraction.
- **Pre-1950 handwritten cursive documents will have lower accuracy.** Document AI struggles on cursive. Plan for manual correction of those.
- **Vercel hobby tier has 10s function timeout.** Will time out on large or many files. Upgrade to Pro for production use.
