import type { ParsedResume } from "@/types/resume";
import { anthropic, withRetry } from "@/lib/ai/claude-client";

const SYSTEM_PROMPT = `\
You are a precise resume parser. Extract structured information from resume text \
and return ONLY valid JSON — no markdown fences, no explanation, no commentary.

RULES:
- Extract ONLY information explicitly present in the text.
- Do NOT infer, assume, or hallucinate any content.
- If a field is absent, use null for strings or [] for arrays.
- Preserve exact dates, company names, job titles, and wording.
- For end_date: use null if no explicit end date appears in the text — never write "Present", "Current", or "Now" unless that exact word appears in the resume.`;

const USER_PROMPT_TEMPLATE = `\
Parse the resume below and return a JSON object with exactly this structure:

{
  "personal_info": {
    "name": string | null,
    "email": string | null,
    "phone": string | null,
    "location": string | null,
    "linkedin": string | null,
    "website": string | null
  },
  "summary": string | null,
  "experience": [
    {
      "company": string,
      "title": string,
      "start_date": string | null,
      "end_date": string | null,
      "location": string | null,
      "bullets": string[]
    }
  ],
  "education": [
    {
      "institution": string,
      "degree": string | null,
      "field": string | null,
      "start_date": string | null,
      "end_date": string | null,
      "gpa": string | null
    }
  ],
  "skills": {
    "technical": string[],
    "soft": string[],
    "other": string[]
  },
  "certifications": [
    {
      "name": string,
      "issuer": string | null,
      "date": string | null
    }
  ],
  "projects": [
    {
      "name": string,
      "description": string | null,
      "technologies": string[]
    }
  ],
  "languages": string[]
}

RESUME TEXT:
---
{{TEXT}}
---`;

/**
 * Sends resume plain-text to Claude and returns the structured ParsedResume JSON.
 * Uses claude-haiku-4-5 for speed and cost efficiency.
 *
 * Hard contract: no hallucination — only content present in the text.
 */
export async function parseResumeWithClaude(
  resumeText: string
): Promise<{ data: ParsedResume; inputTokens: number; outputTokens: number }> {
  const message = await withRetry(() =>
    anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: USER_PROMPT_TEMPLATE.replace("{{TEXT}}", resumeText),
        },
      ],
    })
  );

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected non-text response from Claude");
  }

  // Strip accidental markdown fences (e.g. ```json ... ```)
  const json = block.text.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();

  try {
    return {
      data: JSON.parse(json) as ParsedResume,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  } catch {
    throw new Error("Claude returned invalid JSON during resume parsing.");
  }
}
