import Anthropic from "@anthropic-ai/sdk";
import type { Gap } from "@/types/gap";
import type { TranscriptMessage, InterviewTurn } from "@/types/interview";

const client = new Anthropic();

const MAX_QUESTIONS = 20;

const SYSTEM_PROMPT = `\
You are a professional resume interview assistant. Your role is to ask targeted questions
that help candidates articulate real experience for gaps between their resume and a job description.

Every response MUST be exactly valid JSON — no markdown fences, no commentary:
{
  "question": string | null,
  "done": boolean,
  "answers_summary": { "keyword": "confirmed evidence or note" } | null
}

STRICT RULES:
- Ask exactly ONE focused question per response, targeting one specific gap.
- Address required gaps before preferred ones (they are listed in priority order).
- Ask for concrete evidence: specific examples, tools used, dates, metrics/numbers.
- Accept equivalent experience as filling a gap (e.g., similar technology, transferable skill).
- If a candidate says they lack a skill, acknowledge it honestly — do not press further.
- NEVER invent, suggest, or put words in the candidate's mouth.
- NEVER ask about skills not listed in the gaps.
- Set done=true when: all required gaps have a response, OR the question limit is reached.
- When done=true: set question=null and populate answers_summary for EVERY gap.
- When done=false: set answers_summary=null and question=the next question string.`;

/**
 * Generates the next interview question (or concludes the interview).
 *
 * On first call (empty transcript, questionsAsked=0) → returns Q1.
 * On subsequent calls → returns next question or done signal.
 *
 * @param gaps           Identified gaps in priority order (from gap analysis).
 * @param transcript     Full conversation so far (do NOT include the new user message yet).
 * @param userMessage    The candidate's latest reply, or null on first call.
 * @param questionsAsked Number of questions already asked (= session.question_count).
 */
export async function conductInterviewTurn(
  gaps: Gap[],
  transcript: TranscriptMessage[],
  userMessage: string | null,
  questionsAsked: number
): Promise<{ turn: InterviewTurn; updatedTranscript: TranscriptMessage[] }> {
  const now = new Date().toISOString();
  const newTranscript: TranscriptMessage[] = [...transcript];

  // Append the candidate's reply before calling Claude
  if (userMessage !== null) {
    newTranscript.push({ role: "user", content: userMessage, timestamp: now });
  }

  const remaining = MAX_QUESTIONS - questionsAsked;
  const isFirst = transcript.length === 0 && userMessage === null;

  const instruction = isFirst
    ? "Begin the interview. Ask your first question about the most critical required gap."
    : remaining <= 0
    ? "The question limit has been reached. Conclude the interview now and summarise all answers."
    : "The candidate just replied. Ask your next question, or conclude if all required gaps have been addressed.";

  const transcriptText =
    newTranscript.length === 0
      ? "(no messages yet)"
      : newTranscript
          .map(
            (m) =>
              `${m.role === "assistant" ? "Interviewer" : "Candidate"}: ${m.content}`
          )
          .join("\n\n");

  const userContent = `\
GAPS TO ADDRESS (priority order — required before preferred):
${JSON.stringify(gaps, null, 2)}

CONVERSATION (${questionsAsked} of ${MAX_QUESTIONS} questions used):
${transcriptText}

INSTRUCTION: ${instruction}`.trim();

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected non-text response from Claude");

  const json = block.text.replace(/^```(?:json)?\n?|\n?```$/g, "").trim();
  let turn: InterviewTurn;
  try {
    turn = JSON.parse(json) as InterviewTurn;
  } catch {
    throw new Error(
      `Claude returned invalid JSON. Raw: ${block.text.slice(0, 200)}`
    );
  }

  // Append Claude's question to the transcript (if not done)
  if (!turn.done && turn.question) {
    newTranscript.push({
      role: "assistant",
      content: turn.question,
      timestamp: new Date().toISOString(),
    });
  }

  return { turn, updatedTranscript: newTranscript };
}
