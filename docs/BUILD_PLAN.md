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
- Chanc
