# JobFit Pro – Product & Business Requirements Document (PBRD)

**Version:** 1.0 (MVP)

**Audience:** AI Coding Agents, Technical Architects, Product Engineers

**Purpose:** Complete end-to-end PBRD for **JobFit Pro**, designed to be handed directly to AI coding agents or an engineering team for incremental build and future expansion.

**Note:** JobFit Pro is the foundational module of the future **CareerBoost** platform.

---

## 1. Product Vision

Job seekers are frequently rejected by ATS systems not because they lack capability, but because resumes fail automated keyword, phrasing, and relevance checks. JobFit Pro systematically aligns a candidate’s experience to each job description, maximizing ATS compatibility while preserving truthfulness and ethical standards.

Key points:
- Accepts **one master resume per user**
- Supports multiple **job descriptions**
- Identifies ATS gaps
- Interviews users to fill truthful gaps
- Generates **ATS-optimized resumes and cover letters (PDF)**
- Maintains complete application history

---

## 2. Target User & Scope (MVP)

- **User Type:** Mid-level professionals (5–15 years)
- **Industries:** IT, IT Consulting, Technology
- **Geography:** US
- **Usage Model:** Personal tool

---

## 3. Business Model

### 3.1 Free Tier

- 1 master resume per user
- Max 2 JD-customized resumes total
- No time restrictions

### 3.2 Paid Tier

- 1 master resume per user
- Up to 10 JD-customized resumes per month
- Additional resumes via bundles (5/10/20), lower per-resume cost for larger bundles

---

## 4. Functional Requirements

### Resume Handling
- Input: PDF (text-based), DOCX
- Output: PDF only
- Max length: 3 pages
- Max size: 5 MB
- Language: English
- Resume parsed once on upload; reprocessed only if replaced
- Master resume immutable; JD-specific copies versioned

### Job Description Handling
- Upload PDF/DOCX, paste URL (HTML scrape)
- Limits: PDF ≤5 pages, URL text ≤50 KB
- Clean EO statements and legal boilerplate
- Focus on required > preferred

### Keyword & Gap Analysis
- Exact & synonym keyword matching
- Section-aware weighting
- Top 10 gaps per JD

### Interview System
- Chat-style, structured with examples
- Ask for confirmation, metrics, proof
- Max 10 gaps, absolute max 20 questions
- User approval required; abort if critical gaps unfillable

### Resume Rewrite Engine
- Preserve layout & structure
- Rewrite wording only, no fabricated data
- Output PDF ≤3 pages

### Cover Letter Generation
- PDF only, 150–200 words, 3 paragraphs/bullets
- Reference company, role, recruiter
- Truth-constrained to resume + interview

### ATS Scoring
- Components: keyword %, section coverage, seniority alignment, formatting
- Numeric 0–100, category: Excellent/Strong/Weak
- Explain missing keywords/gaps
- Threshold configurable per JD

### History & Tracking
- Track company, role, date, resume PDF, cover letter PDF, ATS score
- Future-ready: interview status, notes with timestamps

### Input Validation & Extreme Cases
- Resume: max 3 pages, 5 MB, reject scanned/non-resume/corrupt files
- JD: max 5 pages or 50 KB, strip boilerplate, truncate if necessary
- Sparse resumes: interview to fill
- Heavy styling: strip formatting
- Non-English: reject

### Security & Compliance
- Virus scan, input sanitization, encryption, user access control
- No data selling, no AI training on user data
- User-controlled deletion, data retention: 3 years

---

**END OF DOCUMENT – JobFit Pro PBRD**

---

## Post-Launch Changes

Changes shipped after initial build, grouped by category.

### Bug Fixes

| # | Description |
|---|-------------|
| 1 | **PDF extraction** — replaced `pdf-parse` with Claude's native document API. Handles real-world PDFs (embedded fonts, scanned layouts) that `pdf-parse` failed on. |
| 2 | **Server Component callback props** — removed callback functions passed as props to Client Components; caused Next.js serialization crash. State changes now driven by `router.refresh()`. |
| 3 | **JD form navigation** — fixed `data.data.id` path; form was reading `data.id` (undefined), so `router.push` navigated to `/apply/undefined`. |
| 4 | **Gap Analysis step** — interview chat now shown from the `gap_analysis` step onward, so users can click "Start Interview" without waiting for a page transition. |
| 5 | **Cover letter → ATS advance** — cover letter panel now calls `router.refresh()` after generation, which causes `resolveStep` to return `ats_score` and the ATS card to render. |
| 6 | **`formatDateRange` null end date** — function no longer infers "Present" for null end dates; dates are omitted cleanly instead of showing incorrect "Present" label. |

### Resume & Cover Letter PDF

| # | Description |
|---|-------------|
| 1 | **Page numbers** — both resume and cover letter PDFs now render a centred `Page N of N` footer on every page using pdfkit's `bufferedPageRange()`. |
| 2 | **Justified body text** — summary, bullet points, and project descriptions use `align: "justify"` for a polished, ATS-safe layout. |

### Configuration

| # | Description |
|---|-------------|
| 1 | **Quota env vars** — `QUOTA_FREE_LIMIT` (default 2) and `QUOTA_PAID_MONTHLY_LIMIT` (default 10) control tier limits without a DB migration. |
| 2 | **Quota check location** — moved from a Postgres RPC (`can_create_version`) to the API route layer, giving direct access to env vars and simpler error handling. |

### New Features

| # | Description |
|---|-------------|
| 1 | **Re-interview** — new `POST /api/interview-sessions/[id]/reset` endpoint resets the session (`status=pending`, empty transcript, `approved_answers=null`, `question_count=0`) and its linked resume_version (`status=pending`, clears rewritten content and PDF paths). `identified_gaps` is preserved so gap analysis is not repeated. A `ReInterviewButton` component in the ATS score card triggers this flow and calls `router.refresh()` to return the user to the gap_analysis step. |
| 2 | **Loading UX — Re-score** — ATS score card Re-score button now shows a `Loader2` spinner and "Re-scoring…" label while the API call is in flight. |
| 3 | **Loading UX — Regenerate** — both the Rewrite and Cover Letter panels now show a `Loader2` spinner and "Regenerating…" label on the Regenerate button during generation. Download PDF buttons are disabled (`disabled={loading}`) while generation is running. |

