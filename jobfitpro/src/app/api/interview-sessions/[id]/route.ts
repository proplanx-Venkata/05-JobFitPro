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
