import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";

type AtsScoreRow = Database["public"]["Tables"]["ats_scores"]["Row"];

// ---------------------------------------------------------------------------
// GET /api/ats-scores/[id]
// Returns the full ATS score record including component scores, missing
// keywords, and gap explanations.
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
    .from("ats_scores")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "ATS score not found." },
      { status: 404 }
    );
  }

  return NextResponse.json<ApiResponse<AtsScoreRow>>({ success: true, data });
}
