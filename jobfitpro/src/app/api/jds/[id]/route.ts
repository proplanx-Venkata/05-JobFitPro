import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse } from "@/types/api";
import type { Database, JdApplicationStatus } from "@/types/database";

type JdRow = Database["public"]["Tables"]["job_descriptions"]["Row"];

const ALLOWED_APP_STATUSES: JdApplicationStatus[] = [
  "saved", "applied", "phone_screen", "interview", "offer", "rejected", "withdrawn",
];

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

  // ── Clean up output files (resume PDFs + cover letter PDFs) ─────────────
  // Collect all output_storage_path values from resume_versions and their
  // cover_letters. The DB cascade will delete the rows; we must remove files.
  const admin = createSupabaseAdminClient();

  const { data: versions } = await supabase
    .from("resume_versions")
    .select("id, output_storage_path")
    .eq("job_description_id", id);

  if (versions && versions.length > 0) {
    const versionIds = versions.map((v) => v.id);

    const { data: coverLetters } = await supabase
      .from("cover_letters")
      .select("output_storage_path")
      .in("resume_version_id", versionIds);

    const outputPaths: string[] = [];
    for (const v of versions) {
      if (v.output_storage_path) outputPaths.push(v.output_storage_path);
    }
    if (coverLetters) {
      for (const cl of coverLetters) {
        if (cl.output_storage_path) outputPaths.push(cl.output_storage_path);
      }
    }

    if (outputPaths.length > 0) {
      // Non-fatal: proceed even if some removals fail
      await admin.storage.from("outputs").remove(outputPaths);
    }
  }

  // Delete JD storage file if one was uploaded
  if (jd.storage_path) {
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

// ---------------------------------------------------------------------------
// PATCH /api/jds/[id]
// Update application pipeline status, notes, or applied_at.
// Body: { application_status?, notes?, applied_at? }
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

  let body: {
    application_status?: JdApplicationStatus;
    notes?: string | null;
    applied_at?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!body.application_status && body.notes === undefined && body.applied_at === undefined) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "At least one field is required." },
      { status: 400 }
    );
  }

  if (body.application_status && !ALLOWED_APP_STATUSES.includes(body.application_status)) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Invalid application_status value." },
      { status: 400 }
    );
  }

  if (typeof body.notes === "string" && body.notes.length > 5000) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Notes must be under 5000 characters." },
      { status: 400 }
    );
  }

  // Confirm ownership
  const { data: jd, error: fetchError } = await supabase
    .from("job_descriptions")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !jd) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Job description not found." },
      { status: 404 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (body.application_status) updates.application_status = body.application_status;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.applied_at !== undefined) updates.applied_at = body.applied_at;

  const { data: updated, error: updateError } = await supabase
    .from("job_descriptions")
    .update(updates)
    .eq("id", id)
    .select(
      "id, user_id, title, company, source_type, storage_path, source_url, page_count, text_size_bytes, status, application_status, notes, applied_at, created_at, updated_at"
    )
    .single();

  if (updateError || !updated) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to update job description." },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<Omit<JdRow, "raw_text" | "cleaned_text">>>({
    success: true,
    data: updated as Omit<JdRow, "raw_text" | "cleaned_text">,
  });
}
