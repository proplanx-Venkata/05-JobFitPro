# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**JobFit Pro** is an AI-powered resume optimization tool that aligns a candidate's resume to a specific job description (JD) to maximize ATS compatibility — without fabricating content. It is the foundational module of the future **CareerBoost** platform.

This repository is in early planning/pre-build stage. The three spec documents below are the authoritative source of truth:

| File | Purpose |
|------|---------|
| `job_fit_pro_pbrd.md` | Product & Business Requirements (full functional spec, tiers, limits, security) |
| `job_fit_pro_ai_build_playbook.md` | Data model, processing rules, and incremental build phases |
| `job_fit_pro_claude_prompts_test_matrix.md` | Claude prompt contracts per feature and the MVP test matrix |

---

## Architecture & Data Model

Seven core entities (all JD-specific artifacts reference `resume_version_id`):

```
User → Resume (master, immutable)
             ↓ (one per JD)
        ResumeVersion → ATSScore
                      → CoverLetter
                      → InterviewSession
JobDescription
```

**Key processing rule:** Master resume is parsed **only on upload or replacement**. JD ingestion never triggers re-parsing.

---

## Incremental Build Phases

Build in this order (each phase independently deployable):

0. Auth & storage
1. Resume upload & parse
2. JD ingestion & cleanup
3. Gap analysis
4. Interview loop
5. Resume rewrite engine
6. Cover letter generation
7. ATS scoring engine
8. History & tracking table

---

## Claude Prompt Contracts (summary)

Each AI-powered feature has a defined input/output contract:

| Feature | Input | Output |
|---------|-------|--------|
| Resume Parse | PDF/DOCX | Structured JSON — no inference beyond text |
| Gap Analysis | Resume JSON + JD text | Top 10 missing skills/keywords (deterministic, synonym-aware) |
| Interview | Gap list | ≤20 chat-style questions; only clarify, never invent |
| Rewrite | Resume JSON + interview responses | PDF-ready resume JSON; preserve layout, ATS-safe |
| Cover Letter | Resume JSON + JD + interview responses | PDF-ready JSON; 150–200 words, 3 paragraphs/bullets |

---

## Hard System Assertions (never violate)

- **No hallucinated content** — all output constrained to resume + user-confirmed interview responses
- **All final outputs are PDFs** (resume ≤3 pages, cover letter ≤3 pages)
- **User explicitly approves** any additions before they appear in output
- **Resume parsing only on upload/replacement**, never on JD ingestion

---

## Key Business Constraints

- Resume: PDF/DOCX input, ≤5 MB, ≤3 pages, English only; reject scanned/corrupt/non-resume files
- JD: PDF/DOCX/URL input, ≤5 pages or 50 KB; strip EO statements and legal boilerplate
- ATS score: 0–100 numeric + category (Excellent/Strong/Weak); explain gaps
- Free tier: 1 master resume, max 2 JD-customized resumes total
- Paid tier: 1 master resume, up to 10 JD-customized resumes/month + bundles
