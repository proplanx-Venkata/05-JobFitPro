# JobFit Pro – AI Build & Engineering Playbook

**Version:** 1.0 (MVP)

**Audience:** AI Coding Agents, Technical Architects, Product Engineers

**Purpose:** Detailed build instructions, system architecture, data model, and AI prompt contracts for **JobFit Pro**, ready for incremental development with Claude or other AI agents.

**Note:** JobFit Pro is the foundational module of the future **CareerBoost** platform.

---

## 1. Data Model

- User
- Resume (master, versioned)
- JobDescription
- ResumeVersion (JD-specific)
- CoverLetter
- InterviewSession
- ATSScore

All artifacts reference `resume_version_id`.

---

## 2. Processing Rules

- Master resume parsed only on upload or replacement
- JD ingestion never triggers resume parsing
- Resume rewrite and cover letter constrained to truth
- Max 3 pages per resume or cover letter
- ATS-safe formatting enforced

---

## 3. Incremental Build Phases

0. Auth & storage
1. Resume upload & parse
2. JD ingestion & cleanup
3. Gap analysis
4. Interview loop
5. Resume rewrite engine
6. Cover letter generation
7. ATS scoring engine
8. History & tracking table

Each phase independently deployable.

---

## 4. Hard System Assertions

- No hallucinated content
- All outputs are PDFs
- User explicitly approves any additions
- Resume parsing only on upload/replacement
- JD ingestion does not trigger parsing

---

## 5. Future Extensions

- Multi-resume profiles
- CRM-style job pipeline
- Interview tracking
- Recruiter sharing
- Analytics dashboard
- Integration into **CareerBoost** for job discovery, automated applications, and recruiter modules

---

**END OF DOCUMENT – JobFit Pro**

