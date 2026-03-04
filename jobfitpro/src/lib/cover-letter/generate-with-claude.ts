import type { ParsedResume } from "@/types/resume";
import type { CoverLetterContent } from "@/types/cover-letter";
import { anthropic, withRetry } from "@/lib/ai/claude-client";

const SYSTEM_PROMPT = `\
You are a professional cover letter writer. Generate a concise, compelling cover letter \
that is truthfully grounded in the candidate's actual experience. \
Return ONLY valid JSON — no markdown fences, no explanation, no commentary.

STRICT RULES:
- Exactly 3 paragraphs:
    [0] Opening  — hook + why this specific role/company; lead with your strongest relevant credential.
    [1] Body     — 2–3 concrete achievements/skills that directly address the JD; use numbers where available.
    [2] Closing  — brief call to action; express genuine enthusiasm without clichés.
- Total word count across all 3 paragraphs: 150–200 words (strictly enforced).
- Reference the company name and job title explicitly.
- If a recruiter name is provided, use it in the greeting; otherwise use "Dear Hiring Manager,".
- ONLY reference experience, skills, and evidence present in the resume or confirmed interview answers.
- Do NOT fabricate achievements, metrics, or credentials.
- Plain prose — no bullet points, no special characters, no markdown.
- Closing valediction should be "Sincerely," (no name on that line).`;

const USER_PROMPT_TEMPLATE = `\
Generate a cover letter for the application below.

CANDIDATE RESUME:
---
{{RESUME_JSON}}
---

TARGET ROLE:
Company: {{COMPANY}}
Job Title: {{TITLE}}

JOB DESCRIPTION:
---
{{JD_TEXT}}
---

CONFIRMED INTERVIEW ANSWERS (additional evidence to draw on):
---
{{ANSWERS_JSON}}
---

RECRUITER NAME (use in greeting, or "Dear Hiring Manager," if blank): {{RECRUITER}}

Return a JSON object with exactly this structure:
{
  "greeting": string,
  "paragraphs": [string, string, string],
  "closing": string,
  "candidate_name": string
}`;

/**
 * Generates a CoverLetterContent object using Claude Haiku.
 *
 * Hard contract: 150–200 words, 3 paragraphs, truth-constrained to
 * resume + confirmed interview answers — no fabrication.
 */
export async function generateCoverLetterWithClaude(
  resume: ParsedResume,
  jdCleanedText: string,
  jdTitle: string | null,
  jdCompany: string | null,
  approvedAnswers: Record<string, string>,
  recruiterName: string | null
): Promise<{ data: CoverLetterContent; inputTokens: number; outputTokens: number }> {
  const message = await withRetry(() =>
    anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: USER_PROMPT_TEMPLATE.replace(
            "{{RESUME_JSON}}",
            JSON.stringify(resume, null, 2)
          )
            .replace("{{COMPANY}}", jdCompany ?? "the company")
            .replace("{{TITLE}}", jdTitle ?? "the position")
            .replace("{{JD_TEXT}}", jdCleanedText)
            .replace("{{ANSWERS_JSON}}", JSON.stringify(approvedAnswers, null, 2))
            .replace("{{RECRUITER}}", recruiterName ?? ""),
        },
      ],
    })
  );

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected non-text response from Claude");
  }

  const json = block.text.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
  try {
    const content = JSON.parse(json) as CoverLetterContent;
    // Ensure exactly 3 paragraphs
    if (!Array.isArray(content.paragraphs) || content.paragraphs.length !== 3) {
      throw new Error("Claude returned wrong number of paragraphs");
    }
    return {
      data: content,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(
        `Claude returned invalid JSON. Raw response: ${block.text.slice(0, 200)}`
      );
    }
    throw err;
  }
}
