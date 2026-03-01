# JobFit Pro – Claude Prompt Contracts & Test Matrix

**Version:** 1.0 (MVP)

**Audience:** AI Coding Agents, Technical Architects, Test Engineers

**Purpose:** Claude-specific prompts, AI interaction contracts, and test matrix for **JobFit Pro**.

**Note:** JobFit Pro is the foundational module of the future **CareerBoost** platform.

---

## 1. Claude Prompt Contracts

### 1.1 Resume Parsing Prompt
- Input: PDF or DOCX resume
- Output: JSON structured fields
- Rules: No inference beyond text, do not hallucinate content

### 1.2 Gap Analysis Prompt
- Input: Resume JSON + JD text/JSON
- Output: List of missing skills/keywords, top 10 gaps
- Rules: Deterministic, section-aware, exact & synonym match

### 1.3 Interview Prompt
- Input: List of top gaps
- Output: Chat-style questions to elicit metrics, proof, user confirmation
- Rules: Only clarify or ask for equivalents; never invent

### 1.4 Rewrite Prompt
- Input: Resume JSON + user responses
- Output: PDF-ready resume content JSON
- Rules: Rewrite wording only; preserve structure; ATS-safe

### 1.5 Cover Letter Prompt
- Input: Resume JSON + JD + user responses
- Output: PDF-ready cover letter JSON
- Rules: 150–200 words; bullet/paragraph; reference company/role/recruiter

---

## 2. Test Matrix (MVP Focus)

| Test Area | Input | Expected Output | Notes |
|-----------|-------|----------------|-------|
| Resume Upload | PDF, DOCX | Parsed JSON, max 3 pages, 5 MB | Reject scanned PDFs, corrupt files, non-resume docs |
| JD Ingestion | PDF, DOCX, URL | Cleaned JD JSON, max 5 pages/50 KB | Strip EO/legal boilerplate |
| Gap Analysis | Resume JSON + JD JSON | Top 10 missing keywords/skills | Synonyms, section weights applied |
| Interview Loop | Top gaps | Max 20 questions, user confirmation | Abort if critical gaps unfillable |
| Resume Rewrite | JSON + user input | PDF, max 3 pages, ATS-safe | Preserve layout, no fabricated data |
| Cover Letter | JSON + JD + user input | PDF, 150–200 words | Bullets/paragraphs, reference company/role |
| ATS Scoring | Resume + JD | Score 0–100, category | Explain missing keywords/gaps |
| History Table | User actions | Resume + cover letter + ATS score | Track company, role, date, notes |

---

## 3. Future-Proof Notes
- Multi-resume support
- CRM-style job tracking
- Automated application & job discovery
- Recruiter collaboration modules
- Analytics dashboard
- Integration into **CareerBoost** ecosystem

---

**END OF DOCUMENT – JobFit Pro**

