import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { conductInterviewTurn } from "@/lib/interview/conduct-with-claude";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAiUsage } from "@/lib/ai/log-usage";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";
import type { GapAnalysisResult } from "@/types/gap";
import type { TranscriptMessage } from "@/types/interview";

type InterviewSessionRow = Database["public"]["Tables"]["interview_sessions"]["Row"];
type Json = Database["public"]["Tables"]["interview_sessions"]["Update"]["conversation_transcript"];

// Claude call can take up to 30 s
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// POST /api/interview-sessions/[id]/reply
// Submits the candidate's answer and gets the next question (or completes).
// Body (JSON): { message: string }
//
// Flow:
//   1. Append user message + call Claude with full updated transcript.
//   2a. If Claude says done → mark completed, save approved_answers.
//   2b. If Claude gives another question → append it, bump question_count.
//   3. Save everything in one DB update and return the updated session.
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const rateLimitError = await checkRateLimit(user.id, "interviewTurn");
  if (rateLimitError) return rateLimitError;

  // ── 1. Parse body ────────────────────────────────────────────────────────
  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Request body must be JSON." },
      { status: 400 }
    );
  }
  const { message } = body;
  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "message is required and must be a non-empty string." },
      { status: 400 }
    );
  }

  // ── 2. Fetch and validate session ────────────────────────────────────────
  const { data: session, error: fetchError } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !session) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Interview session not found." },
      { status: 404 }
    );
  }
  if (session.status !== "in_progress") {
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: `Session is ${session.status}. Only in-progress sessions accept replies.`,
      },
      { status: 409 }
    );
  }
  if (!session.identified_gaps) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Session has no identified gaps." },
      { status: 422 }
    );
  }

  const gaps = (session.identified_gaps as unknown as GapAnalysisResult).gaps;
  const currentTranscript = (session.conversation_transcript as unknown as TranscriptMessage[]) ?? [];

  // ── 3. Call Claude with user's message appended ──────────────────────────
  let updatedTranscript: TranscriptMessage[];
  let done: boolean;
  let approvedAnswers: Record<string, string> | null;
  let newQuestionCount = session.question_count;

  try {
    const result = await conductInterviewTurn(
      gaps,
      currentTranscript,
      message.trim(),
      session.question_count
    );
    updatedTranscript = result.updatedTranscript;
    done = result.turn.done;
    approvedAnswers = result.turn.answers_summary ?? null;
    logAiUsage({ userId: user.id, operation: "interview", inputTokens: result.inputTokens, outputTokens: result.outputTokens, model: "claude-haiku-4-5-20251001" });

    if (!done && result.turn.question) {
      // Claude asked another question — count it
      newQuestionCount = session.question_count + 1;
    }
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to generate response. Please try again." },
      { status: 500 }
    );
  }

  // ── 4. Build update payload ──────────────────────────────────────────────
  const now = new Date().toISOString();
  const updatePayload: Database["public"]["Tables"]["interview_sessions"]["Update"] = {
    conversation_transcript: updatedTranscript as unknown as Json,
    question_count: newQuestionCount,
  };

  if (done) {
    updatePayload.status = "completed";
    updatePayload.completed_at = now;
    updatePayload.approved_answers = approvedAnswers as unknown as Json;
  }

  // ── 5. Persist and return ────────────────────────────────────────────────
  const { data: updated, error: updateError } = await supabase
    .from("interview_sessions")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to save reply." },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<InterviewSessionRow>>({
    success: true,
    data: updated,
  });
}
