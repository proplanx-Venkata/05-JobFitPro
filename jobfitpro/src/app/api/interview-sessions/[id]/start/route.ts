import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { conductInterviewTurn } from "@/lib/interview/conduct-with-claude";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";
import type { GapAnalysisResult } from "@/types/gap";
import type { TranscriptMessage } from "@/types/interview";

type InterviewSessionRow = Database["public"]["Tables"]["interview_sessions"]["Row"];

// Claude call can take up to 30 s
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// POST /api/interview-sessions/[id]/start
// Moves a pending session to in_progress and generates the first question.
// Safe to retry: Claude is called before the DB status is updated, so a
// Claude failure leaves the session in "pending" and the caller can retry.
// ---------------------------------------------------------------------------
export async function POST(
  _request: NextRequest,
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

  // ── 1. Fetch and validate session ────────────────────────────────────────
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
  if (session.status !== "pending") {
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: `Session is already ${session.status}. Only pending sessions can be started.`,
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

  const gapResult = session.identified_gaps as unknown as GapAnalysisResult;

  // ── 2. Generate first question (Claude called before DB update) ──────────
  let firstQuestion: string;
  let initialTranscript: TranscriptMessage[];
  try {
    const { turn, updatedTranscript } = await conductInterviewTurn(
      gapResult.gaps,
      [],
      null, // no user message on start
      0     // no questions asked yet
    );
    if (turn.done || !turn.question) {
      // Edge case: no gaps to interview about
      firstQuestion = "It looks like your resume already covers the key requirements. No further questions — great work!";
      initialTranscript = updatedTranscript;
    } else {
      firstQuestion = turn.question;
      initialTranscript = updatedTranscript;
    }
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to generate first question. Please try again." },
      { status: 500 }
    );
  }

  // ── 3. Commit to DB: status, timestamp, first transcript entry ───────────
  const { data: updated, error: updateError } = await supabase
    .from("interview_sessions")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
      conversation_transcript: initialTranscript as unknown as Database["public"]["Tables"]["interview_sessions"]["Update"]["conversation_transcript"],
      question_count: 1,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to start interview session." },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<InterviewSessionRow>>(
    { success: true, data: updated },
    { status: 200 }
  );
}
