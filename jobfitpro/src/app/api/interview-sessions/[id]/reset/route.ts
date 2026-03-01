import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";

type InterviewSessionRow = Database["public"]["Tables"]["interview_sessions"]["Row"];

// ---------------------------------------------------------------------------
// POST /api/interview-sessions/[id]/reset
// Resets a completed, aborted, or in_progress session back to pending so the
// user can re-do the interview. Keeps identified_gaps intact (gap analysis is
// not repeated). Also resets the linked resume_version to pending so the
// rewrite, cover letter, and ATS steps can be redone.
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
    .select("id, status, resume_version_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !session) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Interview session not found." },
      { status: 404 }
    );
  }

  const resetableStatuses = ["completed", "aborted", "in_progress"];
  if (!resetableStatuses.includes(session.status)) {
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: `Session is "${session.status}". Only completed, aborted, or in_progress sessions can be reset.`,
      },
      { status: 409 }
    );
  }

  // ── 2. Reset the interview session (keep identified_gaps) ────────────────
  const { data: updated, error: sessionError } = await supabase
    .from("interview_sessions")
    .update({
      status: "pending",
      conversation_transcript: [] as unknown as Database["public"]["Tables"]["interview_sessions"]["Update"]["conversation_transcript"],
      approved_answers: null,
      question_count: 0,
      started_at: null,
      completed_at: null,
      aborted_at: null,
      abort_reason: null,
    })
    .eq("id", id)
    .select()
    .single();

  if (sessionError || !updated) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to reset interview session." },
      { status: 500 }
    );
  }

  // ── 3. Reset the linked resume_version ───────────────────────────────────
  await supabase
    .from("resume_versions")
    .update({
      status: "pending",
      rewritten_content: null,
      output_storage_path: null,
      output_filename: null,
    })
    .eq("id", session.resume_version_id)
    .eq("user_id", user.id);

  return NextResponse.json<ApiResponse<InterviewSessionRow>>(
    { success: true, data: updated },
    { status: 200 }
  );
}
