# Run Sheet Generator — Build Plan

> **READ THIS FIRST if you are a Claude session picking up this project.**
> This document captures the full context, decisions, and roadmap.
> The user (BOPABSTRACT) does not have to re-explain anything if you read this.

---

## 1. What this is

An internal tool for **BOP Abstract** (a title abstracting company) to dramatically reduce the time abstractors spend manually typing data from recorded documents into Excel runsheets.

### Real-world scale (THIS IS IMPORTANT)
- **68 abstractors** (agents)
- **~1,000 runsheets per week**
- Each runsheet today involves hours of manual typing from PDF deeds, leases, easements, mortgages, etc., into a structured Excel template
- Even modest time savings = six-figure annual labor savings
- **This is a real production tool with clear ROI, not a toy project.**

### What the tool does
1. Abstractor uploads PDFs of recorded documents (deeds, leases, easements, ROWs, mortgages, estate docs, etc.)
2. System OCRs each PDF (Google Document AI)
3. System extracts structured instrument data using Claude (grantor, grantee, dates, book/page, legal description, instrument type, etc.)
4. Abstractor reviews/corrects extracted data in a fast keyboard-friendly UI
5. System exports to BOP's exact runsheet template (.xlsx) and supporting docs

### Critical design assumption
**Human review is ASSUMED, not optional.** The accuracy target is NOT "fully autonomous extraction." The target is:
- ~85% of fields correct on first pass
- Never invent/hallucinate data — return blank + low-confidence flag if unsure
- Review UI must make verification faster than typing from scratch

This is a much more achievable target than "near-perfect autonomous accuracy" and is the right design for the actual workflow.

---

## 2. Documents BOP works with

### Document types in a typical chain of title (from samples reviewed)
- General Warranty Deeds (most common)
- Special Warranty Deeds
- Quitclaim Deeds
- Commissioner's Deeds, Trustee's Deeds, Trust Deeds
- Oil & Gas Leases
- Right-of-Way / Easement Agreements (utility, pipeline)
- Affidavits of Death and Heirship
- Death Certificates
- Estate / Will documents (testate and intestate)
- Mineral Severances and Reservations
- Mortgages
- Chancery / Court Orders
- Declarations of Oil and Gas Notice
- Distribution Line Easements

### Document quality reality (from sample analysis)
| Era | Quality | Auto-extraction realistic accuracy |
|---|---|---|
| Modern typed deeds (post-1990) | Clean text PDFs | 95–99% |
| Older typed deeds (1950–1990) | Mixed quality scans | 85–95% |
| Pre-1950 handwritten cursive on printed forms | Hard | 50–70% on handwritten fields |
| Multi-page exhibits with tables of surface owners | Tabular | 90–98% on tables |

The 1938 Hope Natural Gas deed in samples (DEED_BOOK_338-317.pdf) is a good example of the worst case — typed form with key fields filled in cursive. Document AI will read the printed form fields but will struggle on the cursive entries. Abstractor will need to verify/correct those fields.

### Geographic focus
Primary jurisdiction: **West Virginia** (Marion County in samples). Documents reference:
- Deed Book / Page (DB ###/###)
- Will Book / Page (WB ###/###)
- Misc. Book / Page (Misc. Book ###/###)
- Bond Book, Inventory and Estate Book, INH Tax RB
- Districts (Mannington, etc.) within counties
- Tax Map / Parcel numbers

---

## 3. Outputs the system needs to produce

The user's existing template (`12-22-7_-_MOR-RunSheet.xlsx`) has TWO sheets that map to two distinct outputs:

### Output A: "MOR" sheet — Mineral Ownership Report
A header/cover document with current ownership, mortgage info, status flags, agent contact. NOT a list of instruments — it's the summary.

### Output B: "Chain of Title" sheet — the actual runsheet
This is the core deliverable. Header info + a table of every instrument in chronological order back to root of title.

Instrument table columns:
1. **VOL/PAGE** — e.g. "DB 1094/697", "WB 70/808", "Misc. Book 14/169"
2. **Instrument Type** — General Warranty Deed, Special Warranty Deed, Affidavit of Death and Heirship, Death Certificate, Estate, Commissioner's Deed, Chancery Cause, Trustees Deed, Trust Deed, etc.
3. **Doc. Date / Recorded Date** — both dates in one cell separated by spaces (e.g. "8/8/2011  8/23/2011")
4. **Grantor** — full name with marital status / capacity (e.g. "George R. Freeland, widower", "Eunice E. Patrick O'Rourke, divorced and unmarried")
5. **Grantee** — full name with vesting language
6. **Description** — verbatim or summarized legal description from the deed
7. **Comments** — Prior Deed Reference, Examiner's Comments, reservations/exceptions, life estates, etc.

### Output C: Adverse Search Record (`BOP_Abstract_Adverse_Form.xlsx`)
A separate spreadsheet listing every prior owner with date ranges and X marks indicating which records were searched.

### Output D: Title Page (`BOP_Title_Page.docx`)
Formal cover document.

### Output E: Certification Sheet (`Certification_Sheet.docx`)
Formal certification document signed by abstractor.

### Output F (advanced): Deed plot / NDP file parsing
Phase 4 work — not a priority for proof of concept.

---

## 4. Architecture decisions

### Stack (confirmed)
- **Frontend**: Next.js 14 App Router, deployed on Vercel
- **Storage**: Vercel Blob for PDFs (Phase 2+)
- **OCR**: Google Document AI (USER CHOICE — confirmed)
- **LLM extraction**: Claude (Anthropic API) — Sonnet 4.6 by default
- **Spreadsheet generation**: SheetJS (xlsx)
- **Database**: Vercel Postgres or Supabase (Phase 3 — not needed for Phase 1)
- **Auth**: Phase 3 work — Phase 1 is single-user/no auth

### Key environment variables (set in Vercel dashboard, NEVER commit)
- `ANTHROPIC_API_KEY` — Claude API key from console.anthropic.com
- `GOOGLE_CLOUD_PROJECT_ID` — your GCP project ID
- `GOOGLE_DOCAI_PROCESSOR_ID` — the Document AI processor you create
- `GOOGLE_DOCAI_LOCATION` — usually "us"
- `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` — base64-encoded service account JSON

---

## 5. Phased roadmap

### Phase 1 — Single-abstractor proof of concept (CURRENT FOCUS)
Goal: One abstractor saves 30+ min on a real runsheet using the tool. Proves the hypothesis.

Scope: Clean Next.js codebase, frontend matches existing UI, upload PDFs → API route → Document AI OCR → Claude extraction → return JSON, editable review table showing extracted instruments, export to MOR template (Chain of Title sheet only), deploy to Vercel.

### Phase 2 — Accuracy tuning + better review UX
Confidence scores per field color-coded, tab-through-low-confidence-only navigation, side-by-side PDF viewer with field highlighting, track which fields abstractor changes most, handle multi-page exhibit tables specially, auto-detect document type and use type-specific prompts.

### Phase 3 — Multi-user platform
**At this point: hire a real software engineer or contract a dev shop. Don't build this in chat.**
User accounts for 68 agents, project/runsheet management, database for persistent runsheets, generate Adverse Form / MOR header / Title Page / Certification, search across all completed runsheets.

### Phase 4 — Operational tooling
Throughput dashboards, quality metrics, bulk upload, custom Document AI extractors, NDP plot file parsing.

---

## 6. Notes for future Claude sessions

- The user is non-technical. Speak plainly, don't dump code without explaining what it does.
- The user has been frustrated by previous AI sessions promising things that didn't work. **Be honest about what's hard.**
- "Near-perfect accuracy" was the user's stated goal early on, but they later confirmed human review is always part of the workflow. **Optimize for review-assisted extraction, not autonomous extraction.**
- Don't over-engineer. Phase 1 should ship and be testable.
- The user wants to keep building over time, no hard deadline, willing to do GCP/Vercel setup themselves with clear instructions.
- Always read this file first when picking up the project.
- Death Certificates
- Estate / Will documents (testate and intestate)
- Mineral Severances and Reservations
- Mortgages
- Chanc
