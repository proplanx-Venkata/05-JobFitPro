import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateCoverLetterPdf } from "@/lib/cover-letter/generate-pdf";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";
import type { CoverLetterContent } from "@/types/cover-letter";
import type { ParsedResume } from "@/types/resume";

type CoverLetterRow = Database["public"]["Tables"]["cover_letters"]["Row"];

// ---------------------------------------------------------------------------
// GET /api/cover-letters/[id]
// Returns the full cover letter record including generated_content.
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
    .from("cover_letters")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Cover letter not found." },
      { status: 404 }
    );
  }

  return NextResponse.json<ApiResponse<CoverLetterRow>>({ success: true, data });
}

// ---------------------------------------------------------------------------
// PATCH /api/cover-letters/[id]
// Updates cover letter content and regenerates the PDF.
// Body: { generated_content: CoverLetterContent }
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

  // Parse body
  let body: { generated_content?: CoverLetterContent };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Request body must be JSON." },
      { status: 400 }
    );
  }

  const { generated_content } = body;

  // Validate all fields
  if (
    !generated_content ||
    typeof generated_content.greeting !== "string" ||
    typeof generated_content.closing !== "string" ||
    typeof generated_content.candidate_name !== "string" ||
    !Array.isArray(generated_content.paragraphs) ||
    generated_content.paragraphs.length !== 3 ||
    generated_content.paragraphs.some((p) => typeof p !== "string")
  ) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Invalid generated_content: all fields required, paragraphs must be 3-element array." },
      { status: 400 }
    );
  }

  // Fetch cover letter (ownership check)
  const { data: cl, error: clErr } = await supabase
    .from("cover_letters")
    .select("id, resume_version_id, output_storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (clErr || !cl) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Cover letter not found." },
      { status: 404 }
    );
  }

  // Fetch resume_version to get resume_id and job_description_id
  const { data: version } = await supabase
    .from("resume_versions")
    .select("resume_id, job_description_id")
    .eq("id", cl.resume_version_id)
    .eq("user_id", user.id)
    .single();

  if (!version) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Resume version not found." },
      { status: 404 }
    );
  }

  // Fetch master resume
  const { data: masterResume } = await supabase
    .from("resumes")
    .select("parsed_content")
    .eq("id", version.resume_id)
    .eq("user_id", user.id)
    .single();

  if (!masterResume?.parsed_content) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Master resume not found." },
      { status: 404 }
    );
  }

  // Fetch JD
  const { data: jd } = await supabase
    .from("job_descriptions")
    .select("title, company")
    .eq("id", version.job_description_id)
    .eq("user_id", user.id)
    .single();

  // Generate PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateCoverLetterPdf(
      generated_content,
      masterResume.parsed_content as unknown as ParsedResume,
      jd?.company ?? null,
      jd?.title ?? null
    );
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "PDF generation failed. Please try again." },
      { status: 500 }
    );
  }

  // Upload to same storage path (overwrite)
  const admin = createSupabaseAdminClient();
  const { error: uploadErr } = await admin.storage
    .from("outputs")
    .upload(cl.output_storage_path!, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to upload updated PDF." },
      { status: 500 }
    );
  }

  // Update DB
  const { error: updateErr } = await supabase
    .from("cover_letters")
    .update({
      generated_content: generated_content as unknown as Database["public"]["Tables"]["cover_letters"]["Update"]["generated_content"],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to save cover letter." },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<{ id: string }>>({ success: true, data: { id } });
}
