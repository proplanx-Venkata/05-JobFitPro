import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";
import type { ResumeVersionCreated } from "../route";

type ResumeVersionRow = Database["public"]["Tables"]["resume_versions"]["Row"];
type InterviewSessionRow = Database["public"]["Tables"]["interview_sessions"]["Row"];

// ---------------------------------------------------------------------------
// GET /api/resume-versions/[id]
// Returns the full resume_version record plus its linked interview_session
// (including identified_gaps). This is the primary way to retrieve gap
// analysis results after a POST /api/resume-versions.
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

  const { data: version, error: versionError } = await supabase
    .from("resume_versions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (versionError || !version) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Resume version not found." },
      { status: 404 }
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from("interview_sessions")
    .select("id, status, identified_gaps, created_at")
    .eq("resume_version_id", id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Interview session not found for this version." },
      { status: 404 }
    );
  }

  return NextResponse.json<ApiResponse<ResumeVersionCreated>>({
    success: true,
    data: {
      resume_version: version as ResumeVersionRow,
      interview_session: session as Pick<
        InterviewSessionRow,
        "id" | "status" | "identified_gaps" | "created_at"
      >,
    },
  });
}
