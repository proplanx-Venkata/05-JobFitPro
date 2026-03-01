import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";

type ResumeRow = Database["public"]["Tables"]["resumes"]["Row"];

// ---------------------------------------------------------------------------
// GET /api/resumes/active
// Returns the authenticated user's current active resume (full record
// including parsed_content JSON).
// ---------------------------------------------------------------------------
export async function GET() {
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
    .from("resumes")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "No active resume found." },
      { status: 404 }
    );
  }

  return NextResponse.json<ApiResponse<ResumeRow>>({ success: true, data });
}

// ---------------------------------------------------------------------------
// DELETE /api/resumes/active
// Soft-deletes the active resume (sets is_active=false, replaced_at=now).
// Use this before uploading a replacement via POST /api/resumes, or let
// POST handle it automatically.
// ---------------------------------------------------------------------------
export async function DELETE() {
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

  const { error } = await supabase
    .from("resumes")
    .update({ is_active: false, replaced_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (error) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<{ success: true }>>({
    success: true,
    data: { success: true },
  });
}
