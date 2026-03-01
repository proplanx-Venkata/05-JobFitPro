import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";

type JdRow = Database["public"]["Tables"]["job_descriptions"]["Row"];

// ---------------------------------------------------------------------------
// GET /api/jds/[id]
// Returns the full JD record including cleaned_text and raw_text.
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
    .from("job_descriptions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id) // RLS + explicit ownership check
    .single();

  if (error || !data) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Job description not found." },
      { status: 404 }
    );
  }

  return NextResponse.json<ApiResponse<JdRow>>({ success: true, data });
}

// ---------------------------------------------------------------------------
// DELETE /api/jds/[id]
// Hard-deletes the JD record and its storage file (if any).
// Returns 404 if the JD doesn't exist or doesn't belong to the user.
// ---------------------------------------------------------------------------
export async function DELETE(
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

  // Fetch first to confirm ownership and get storage_path
  const { data: jd, error: fetchError } = await supabase
    .from("job_descriptions")
    .select("id, storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !jd) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Job description not found." },
      { status: 404 }
    );
  }

  // Delete storage file if one was uploaded
  if (jd.storage_path) {
    const admin = createSupabaseAdminClient();
    await admin.storage.from("job-descriptions").remove([jd.storage_path]);
    // Non-fatal: proceed with DB delete even if storage removal fails
  }

  const { error: deleteError } = await supabase
    .from("job_descriptions")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<{ deleted: true }>>({
    success: true,
    data: { deleted: true },
  });
}
