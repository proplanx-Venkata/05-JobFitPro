import Anthropic from "@anthropic-ai/sdk";
import type { ParsedResume } from "@/types/resume";

const client = new Anthropic();

const SYSTEM_PROMPT = `\
You are an expert resume rewriter. Rewrite the candidate's resume to better align with \
a target job description by incorporating confirmed interview answers. \
Return ONLY valid JSON — no markdown fences, no explanation, no commentary.

STRICT RULES:
1. PRESERVE exactly (do not change):
   - personal_info (all fields)
   - experience[].company, title, start_date, end_date, location
   - education[] (all fields)
   - certifications[].name, issuer, date
   - languages[]

2. REWRITE to align with the JD (using JD keywords and confirmed answers):
   - summary: rewrite to target the specific role; highlight most relevant experience
   - experience[].bullets: reword for ATS impact; embed JD keywords where the candidate
     has genuine matching experience; do NOT add bullets, only rewrite existing ones
   - skills.technical: add ONLY skills the candidate explicitly confirmed having
   - skills.soft and skills.other: preserve as-is or refine wording
   - projects[].description and technologies: enhance only if candidate confirmed

3. NEVER add experience, skills, credentials, or claims the candidate did not confirm.
   If an interview answer indicates the candidate lacks a skill, do NOT add it.

4. ATS-safe output: plain text bullets only, no special symbols, no HTML.
   Bullets should be concise and impact-focused (ideally 1–2 lines each).

5. Return the EXACT same JSON structure as the master resume — no extra fields.`;

const USER_PROMPT_TEMPLATE = `\
Rewrite the resume below to align with the target job description, \
using ONLY the confirmed interview answers.

MASTER RESUME (do not change structure or factual fields):
---
{{RESUME_JSON}}
---

TARGET JOB DESCRIPTION:
---
{{JD_TEXT}}
---

CONFIRMED INTERVIEW ANSWERS (gap keyword → candidate's confirmed evidence):
---
{{ANSWERS_JSON}}
---

Return the rewritten resume using the exact same JSON structure as the master resume.`;

/**
 * Sends the master resume, cleaned JD text, and confirmed interview answers
 * to Claude and returns a rewritten ParsedResume.
 *
 * Hard contract:
 * - Only content the candidate confirmed is ever added.
 * - Structure, companies, titles, and dates are never changed.
 */
export async function rewriteResumeWithClaude(
  masterResume: ParsedResume,
  jdCleanedText: string,
  approvedAnswers: Record<string, string>
): Promise<ParsedResume> {
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: USER_PROMPT_TEMPLATE.replace(
          "{{RESUME_JSON}}",
          JSON.stringify(masterResume, null, 2)
        )
          .replace("{{JD_TEXT}}", jdCleanedText)
          .replace(
            "{{ANSWERS_JSON}}",
            JSON.stringify(approvedAnswers, null, 2)
          ),
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected non-text response from Claude");
  }

  const json = block.text.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
  try {
    return JSON.parse(json) as ParsedResume;
  } catch {
    throw new Error(
      `Claude returned invalid JSON. Raw response: ${block.text.slice(0, 200)}`
    );
  }
}
