import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rewriteResumeWithClaude } from "@/lib/resume/rewrite-with-claude";
import { generateResumePdf } from "@/lib/resume/generate-pdf";
import { logAiUsage } from "@/lib/ai/log-usage";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";
import type { ParsedResume } from "@/types/resume";

type ResumeVersionRow = Database["public"]["Tables"]["resume_versions"]["Row"];

// Claude rewrite + PDF generation can take up to 60 s
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// POST /api/resume-versions/[id]/rewrite
// Rewrites the master resume to align with its linked JD, using the
// confirmed interview answers.  Generates a PDF and stores it in the
// outputs bucket.
//
// Pre-conditions:
//   - resume_version status is "pending" (or "error" for retry)
//   - interview_session for this version is "completed" with approved_answers
//   - master resume status is "ready" with parsed_content
//   - JD has cleaned_text
//
// On success: resume_version status → "ready", rewritten_content + PDF path saved.
// On failure: resume_version status → "error".
// ---------------------------------------------------------------------------
export async function POST(
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

  // ── 1. Atomically claim the version by transitioning to "generating" ────────
  // Using a conditional update (WHERE status IN allowed) prevents two concurrent
  // rewrite requests from both passing a status check and burning double Claude tokens.
  const { data: version, error: vErr } = await supabase
    .from("resume_versions")
    .update({ status: "generating" })
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["pending", "error", "ready"])
    .select("*")
    .single();

  if (vErr || !version) {
    // Either not found, wrong owner, or already generating
    const { data: existing } = await supabase
      .from("resume_versions")
      .select("status")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (!existing) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Resume version not found." },
        { status: 404 }
      );
    }
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: `Cannot rewrite a version with status "${existing.status}".`,
      },
      { status: 409 }
    );
  }

  // ── 2. Fetch interview_session ────────────────────────────────────────────
  const { data: session, error: sErr } = await supabase
    .from("interview_sessions")
    .select("status, approved_answers")
    .eq("resume_version_id", id)
    .single();

  if (sErr || !session) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Interview session not found for this version." },
      { status: 404 }
    );
  }
  if (session.status !== "completed") {
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: `Interview session is "${session.status}". Complete the interview before rewriting.`,
      },
      { status: 422 }
    );
  }

  const approvedAnswers =
    (session.approved_answers as Record<string, string> | null) ?? {};

  // ── 3. Fetch master resume ────────────────────────────────────────────────
  const { data: resume, error: rErr } = await supabase
    .from("resumes")
    .select("parsed_content, status")
    .eq("id", version.resume_id)
    .eq("user_id", user.id)
    .single();

  if (rErr || !resume) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Master resume not found." },
      { status: 404 }
    );
  }
  if (resume.status !== "ready" || !resume.parsed_content) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Master resume is not ready for rewriting." },
      { status: 422 }
    );
  }

  // ── 4. Fetch job description ──────────────────────────────────────────────
  const { data: jd, error: jdErr } = await supabase
    .from("job_descriptions")
    .select("cleaned_text, title, company")
    .eq("id", version.job_description_id)
    .eq("user_id", user.id)
    .single();

  if (jdErr || !jd || !jd.cleaned_text) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Job description not found or missing cleaned text." },
      { status: 404 }
    );
  }

  // ── 6. Rewrite with Claude ────────────────────────────────────────────────
  // (status already set to "generating" atomically in step 1)
  let rewrittenResume: ParsedResume;
  try {
    const { data, inputTokens, outputTokens } = await rewriteResumeWithClaude(
      resume.parsed_content as unknown as ParsedResume,
      jd.cleaned_text,
      approvedAnswers
    );
    rewrittenResume = data;
    logAiUsage({ userId: user.id, operation: "rewrite", inputTokens, outputTokens, model: "claude-haiku-4-5-20251001" });
  } catch {
    await supabase
      .from("resume_versions")
      .update({ status: "error" })
      .eq("id", id);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Resume rewrite failed. Please try again." },
      { status: 500 }
    );
  }

  // ── 7. Generate PDF ───────────────────────────────────────────────────────
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateResumePdf(rewrittenResume);
  } catch {
    await supabase
      .from("resume_versions")
      .update({ status: "error" })
      .eq("id", id);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "PDF generation failed. Please try again." },
      { status: 500 }
    );
  }

  // ── 8. Upload PDF to outputs bucket ──────────────────────────────────────
  const safeTitle = (jd.title ?? "resume").replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 40);
  const outputFilename = `resume_${safeTitle}.pdf`;
  const storagePath = `${user.id}/${id}/${outputFilename}`;
  const admin = createSupabaseAdminClient();

  const { error: uploadError } = await admin.storage
    .from("outputs")
    .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    await supabase
      .from("resume_versions")
      .update({ status: "error" })
      .eq("id", id);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to upload PDF to storage." },
      { status: 500 }
    );
  }

  // ── 9. Persist rewritten content + mark ready ─────────────────────────────
  const { data: final, error: finalErr } = await supabase
    .from("resume_versions")
    .update({
      status: "ready",
      rewritten_content: rewrittenResume as unknown as Database["public"]["Tables"]["resume_versions"]["Update"]["rewritten_content"],
      output_storage_path: storagePath,
      output_filename: outputFilename,
    })
    .eq("id", id)
    .select()
    .single();

  if (finalErr || !final) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to save rewrite result." },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<ResumeVersionRow>>(
    { success: true, data: final },
    { status: 200 }
  );
}
