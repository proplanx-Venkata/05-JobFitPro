import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";

type InterviewSessionRow = Database["public"]["Tables"]["interview_sessions"]["Row"];

// ---------------------------------------------------------------------------
// POST /api/interview-sessions/[id]/abort
// Aborts a pending or in-progress interview session.
// Body (JSON, optional): { reason?: string }
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

  // Attempt to parse optional body
  let reason: string | undefined;
  try {
    const body = await request.json() as { reason?: string };
    reason = body.reason;
  } catch {
    // body is optional — ignore parse failures
  }

  // ── Fetch and validate ───────────────────────────────────────────────────
  const { data: session, error: fetchError } = await supabase
    .from("interview_sessions")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !session) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Interview session not found." },
      { status: 404 }
    );
  }
  if (session.status !== "pending" && session.status !== "in_progress") {
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: `Session is already ${session.status} and cannot be aborted.`,
      },
      { status: 409 }
    );
  }

  // ── Abort ────────────────────────────────────────────────────────────────
  const { data: updated, error: updateError } = await supabase
    .from("interview_sessions")
    .update({
      status: "aborted",
      aborted_at: new Date().toISOString(),
      abort_reason: reason ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to abort session." },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<InterviewSessionRow>>({
    success: true,
    data: updated,
  });
}
