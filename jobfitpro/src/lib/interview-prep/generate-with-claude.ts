import Anthropic from "@anthropic-ai/sdk";
import type { ParsedResume } from "@/types/resume";
import type { GapAnalysisResult } from "@/types/gap";

const client = new Anthropic();

export interface PrepQuestion {
  question: string;
  tip: string;
  category: "behavioral" | "technical" | "situational";
}

export interface InterviewPrepResult {
  questions: PrepQuestion[];
}

const SYSTEM_PROMPT = `\
Generate exactly 10 hiring-manager interview questions (3 behavioral, 4 technical, 3 situational). \
Each has a question string and a 1-sentence tip. \
Return ONLY valid JSON: { "questions": [...] }. No markdown fences.`;

/**
 * Generates 10 interview prep questions based on the resume, JD, and identified gaps.
 * Ephemeral — not stored in DB.
 */
export async function generateInterviewPrepWithClaude(
  resume: ParsedResume,
  jdCleanedText: string,
  gaps: GapAnalysisResult
): Promise<{ data: InterviewPrepResult; inputTokens: number; outputTokens: number }> {
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate 10 interview questions for the following candidate and role.

CANDIDATE SUMMARY:
---
${JSON.stringify({ name: resume.personal_info?.name, summary: resume.summary, skills: resume.skills }, null, 2)}
---

JOB DESCRIPTION:
---
${jdCleanedText.slice(0, 3000)}
---

IDENTIFIED GAPS (keywords missing from resume):
---
${JSON.stringify(gaps, null, 2)}
---

Return JSON: { "questions": [{ "question": "...", "tip": "...", "category": "behavioral"|"technical"|"situational" }] }`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected non-text response from Claude");
  }

  const json = block.text.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
  try {
    return {
      data: JSON.parse(json) as InterviewPrepResult,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  } catch {
    throw new Error(
      `Claude returned invalid JSON. Raw response: ${block.text.slice(0, 200)}`
    );
  }
}
