/**
 * One message in the interview conversation transcript.
 */
export interface TranscriptMessage {
  role: "assistant" | "user";
  content: string;
  timestamp: string; // ISO 8601
}

/**
 * Claude's response for each interview turn.
 *
 * When done=false: question holds the next question; answers_summary is null.
 * When done=true:  question is null; answers_summary maps each gap keyword to
 *                  the evidence the candidate provided (or "not addressed").
 */
export interface InterviewTurn {
  question: string | null;
  done: boolean;
  answers_summary: Record<string, string> | null;
}
