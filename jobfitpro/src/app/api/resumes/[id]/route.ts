import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";

type ResumeRow = Database["public"]["Tables"]["resumes"]["Row"];

type PatchBody =
  | { action: "set_label"; label: string }
  | { action: "set_active" }
  | { action: "archive" };

// ---------------------------------------------------------------------------
// PATCH /api/resumes/[id]
// Actions: set_label | set_active | archive
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

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  // Confirm ownership
  const { data: resume, error: fetchError } = await supabase
    .from("resumes")
    .select("id, is_active, is_archived")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !resume) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Resume not found." },
      { status: 404 }
    );
  }

  if (resume.is_archived) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Cannot modify an archived resume." },
      { status: 400 }
    );
  }

  // ── set_label ─────────────────────────────────────────────────────────────
  if (body.action === "set_label") {
    const label = body.label.trim().slice(0, 80);
    const { data: updated, error } = await supabase
      .from("resumes")
      .update({ label: label || null })
      .eq("id", id)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to update label." },
        { status: 500 }
      );
    }
    return NextResponse.json<ApiResponse<ResumeRow>>({ success: true, data: updated });
  }

  // ── set_active ────────────────────────────────────────────────────────────
  if (body.action === "set_active") {
    // Deactivate all others first (preserves unique index)
    await supabase
      .from("resumes")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("is_active", true)
      .eq("is_archived", false)
      .neq("id", id);

    const { data: updated, error } = await supabase
      .from("resumes")
      .update({ is_active: true })
      .eq("id", id)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to set active resume." },
        { status: 500 }
      );
    }
    return NextResponse.json<ApiResponse<ResumeRow>>({ success: true, data: updated });
  }

  // ── archive ───────────────────────────────────────────────────────────────
  if (body.action === "archive") {
    const wasActive = resume.is_active;

    const { data: updated, error } = await supabase
      .from("resumes")
      .update({ is_archived: true, is_active: false, archived_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error || !updated) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Failed to archive resume." },
        { status: 500 }
      );
    }

    // If this was the active resume, promote the most recent ready non-archived one
    if (wasActive) {
      const { data: next } = await supabase
        .from("resumes")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_archived", false)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (next) {
        await supabase
          .from("resumes")
          .update({ is_active: true })
          .eq("id", next.id);
      }
    }

    return NextResponse.json<ApiResponse<ResumeRow>>({ success: true, data: updated });
  }

  return NextResponse.json<ApiResponse<never>>(
    { success: false, error: "Unknown action." },
    { status: 400 }
  );
}
