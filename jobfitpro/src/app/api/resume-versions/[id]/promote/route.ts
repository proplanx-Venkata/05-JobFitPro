import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";

type ResumeRow = Database["public"]["Tables"]["resumes"]["Row"];

// ---------------------------------------------------------------------------
// POST /api/resume-versions/[id]/promote
// Promotes a rewritten resume version to a base resume.
// Copies PDF from outputs → resumes bucket; rewritten_content → parsed_content.
// Body: { label?: string }
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: versionId } = await params;
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

  // ── 1. Fetch + validate version ──────────────────────────────────────────
  const { data: version, error: versionError } = await supabase
    .from("resume_versions")
    .select("id, user_id, status, rewritten_content, output_storage_path")
    .eq("id", versionId)
    .eq("user_id", user.id)
    .single();

  if (versionError || !version) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Resume version not found." },
      { status: 404 }
    );
  }

  if (version.status !== "ready" || !version.rewritten_content || !version.output_storage_path) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Version must be ready with generated content before promoting." },
      { status: 400 }
    );
  }

  // ── 2. Check resume capacity ─────────────────────────────────────────────
  const { count: resumeCount } = await supabase
    .from("resumes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_archived", false);

  if ((resumeCount ?? 0) >= 3) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Archive an existing resume before promoting (maximum 3)." },
      { status: 403 }
    );
  }

  // ── 3. Parse body ────────────────────────────────────────────────────────
  let label: string | null = null;
  try {
    const body = await request.json();
    label = typeof body.label === "string" ? body.label.trim().slice(0, 80) || null : null;
  } catch {
    // label is optional
  }

  const admin = createSupabaseAdminClient();

  // ── 4. Download PDF from outputs bucket ──────────────────────────────────
  const { data: fileData, error: downloadError } = await admin.storage
    .from("outputs")
    .download(version.output_storage_path);

  if (downloadError || !fileData) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to download generated PDF." },
      { status: 500 }
    );
  }

  // ── 5. Insert new resume record first to get the ID ──────────────────────
  const { data: newResume, error: insertError } = await supabase
    .from("resumes")
    .insert({
      user_id: user.id,
      storage_path: "", // filled after upload
      original_filename: `promoted_${versionId}.pdf`,
      file_size_bytes: fileData.size,
      mime_type: "application/pdf",
      status: "ready",
      parsed_content: version.rewritten_content,
      parsed_at: new Date().toISOString(),
      is_active: false,
      is_promoted: true,
      promoted_from_version_id: versionId,
      label,
    })
    .select()
    .single();

  if (insertError || !newResume) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to create resume record." },
      { status: 500 }
    );
  }

  // ── 6. Upload PDF to resumes bucket ──────────────────────────────────────
  const storagePath = `${user.id}/${newResume.id}/promoted_${versionId}.pdf`;
  const buffer = Buffer.from(await fileData.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("resumes")
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    // Rollback the record
    await supabase.from("resumes").delete().eq("id", newResume.id);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to upload promoted PDF." },
      { status: 500 }
    );
  }

  // ── 7. Update storage_path on the new record ──────────────────────────────
  const { data: final, error: updateError } = await supabase
    .from("resumes")
    .update({ storage_path: storagePath })
    .eq("id", newResume.id)
    .select()
    .single();

  if (updateError || !final) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to finalize promoted resume." },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<ResumeRow>>({ success: true, data: final }, { status: 201 });
}
