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

