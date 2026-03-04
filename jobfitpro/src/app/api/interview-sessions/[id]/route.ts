import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";

type InterviewSessionRow = Database["public"]["Tables"]["interview_sessions"]["Row"];


// ---------------------------------------------------------------------------
// GET /api/interview-sessions/[id]
// Returns the full interview session including transcript, gaps, and status.
// ---------------------------------------------------------------------------
export async function GET(
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

  const { data, error } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Interview session not found." },
      { status: 404 }
    );
  }

  return NextResponse.json<ApiResponse<InterviewSessionRow>>({
    success: true,
    data,
  });
}

// ---------------------------------------------------------------------------
// PATCH /api/interview-sessions/[id]
// Updates approved_answers on a completed session.
// Body: { approved_answers: Record<string, string> }
// ---------------------------------------------------------------------------
export async function PATCH(
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

  // Fetch session (ownership check)
  const { data: session, error: sErr } = await supabase
    .from("interview_sessions")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (sErr || !session) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Interview session not found." },
      { status: 404 }
    );
  }

  if (session.status !== "completed") {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Only completed sessions can be edited." },
      { status: 422 }
    );
  }

  let body: { approved_answers?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Request body must be JSON." },
      { status: 400 }
    );
  }

  const { approved_answers } = body;
  if (!approved_answers || typeof approved_answers !== "object" || Array.isArray(approved_answers)) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "approved_answers must be a key-value object." },
      { status: 400 }
    );
  }

  const { error: updateErr } = await supabase
    .from("interview_sessions")
    .update({
      approved_answers: approved_answers as unknown as Database["public"]["Tables"]["interview_sessions"]["Update"]["approved_answers"],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to save answers." },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<null>>({ success: true, data: null });
}
