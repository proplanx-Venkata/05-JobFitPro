import Anthropic from "@anthropic-ai/sdk";
import type { ParsedResume } from "@/types/resume";
import type { AtsClaudeOutput } from "@/types/ats";

const client = new Anthropic();

const SYSTEM_PROMPT = `\
You are a precise ATS (Applicant Tracking System) compatibility evaluator. \
Score a resume against a job description and return ONLY valid JSON — \
no markdown fences, no explanation, no commentary.

SCORING COMPONENTS (each 0–100):

keyword_match_score
  Count every distinct keyword/skill/technology required or preferred in the JD.
  Score = (keywords present in resume ÷ total JD keywords) × 100.
  Treat synonyms as matches (JS ↔ JavaScript, k8s ↔ Kubernetes, ML ↔ "machine learning").

skills_score
  How well the resume's skills section covers the JD's required and preferred skills.
  Required skills have double weight.

experience_score
  Relevance of the candidate's experience history to the role:
  seniority match, industry alignment, key responsibilities covered.

format_score
  ATS friendliness of the resume content (for JSON input assume 90 unless content
  contains tables, columns, graphics, or non-standard sections that suggest poor ATS parsing).

missing_keywords
  Array of JD keywords/skills completely absent from the resume (after synonym matching).
  Include only REQUIRED and clearly PREFERRED keywords — omit minor nice-to-haves.

gap_explanations
  Object: { "missing keyword": "brief explanation ≤15 words" }
  One entry per item in missing_keywords.

RULES:
- Be objective and consistent — the same resume + JD should always score the same.
- Do NOT penalise for skills implied by extensive experience in a domain.
- Keep missing_keywords to the most impactful gaps (max 10).`;

const USER_PROMPT_TEMPLATE = `\
Score the following resume against the job description.

RESUME (rewritten, JD-aligned):
---
{{RESUME_JSON}}
---

JOB DESCRIPTION:
---
{{JD_TEXT}}
---

Return a JSON object with exactly this structure:
{
  "keyword_match_score": number,
  "format_score": number,
  "skills_score": number,
  "experience_score": number,
  "missing_keywords": string[],
  "gap_explanations": { "keyword": "explanation" }
}`;

/**
 * Sends the rewritten resume and JD cleaned text to Claude Haiku and returns
 * raw component scores plus missing keyword analysis.
 *
 * overall_score and category are computed server-side for determinism.
 */
export async function scoreResumeWithClaude(
  resume: ParsedResume,
  jdCleanedText: string
): Promise<AtsClaudeOutput> {
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: USER_PROMPT_TEMPLATE.replace(
          "{{RESUME_JSON}}",
          JSON.stringify(resume, null, 2)
        ).replace("{{JD_TEXT}}", jdCleanedText),
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected non-text response from Claude");
  }

  const json = block.text.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
  try {
    return JSON.parse(json) as AtsClaudeOutput;
  } catch {
    throw new Error(
      `Claude returned invalid JSON. Raw response: ${block.text.slice(0, 200)}`
    );
  }
}
