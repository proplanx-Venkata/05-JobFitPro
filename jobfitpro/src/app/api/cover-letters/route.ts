import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateCoverLetterWithClaude } from "@/lib/cover-letter/generate-with-claude";
import { generateCoverLetterPdf } from "@/lib/cover-letter/generate-pdf";
import { logAiUsage } from "@/lib/ai/log-usage";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";
import type { ParsedResume } from "@/types/resume";
import type { CoverLetterContent } from "@/types/cover-letter";

type CoverLetterRow = Database["public"]["Tables"]["cover_letters"]["Row"];

// Claude + PDF can take up to 30 s
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// POST /api/cover-letters
// Generates a cover letter for a completed resume_version.
//
// Body (JSON): { resume_version_id: string, recruiter_name?: string }
//
// Pre-conditions:
//   - resume_version status is "ready" (rewrite completed)
//   - interview_session for that version is "completed" (has approved_answers)
//
// Flow: validate → insert (generating) → Claude → PDF → upload → ready
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
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

  // ── 1. Parse body ────────────────────────────────────────────────────────
  let body: { resume_version_id?: string; recruiter_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Request body must be JSON." },
      { status: 400 }
    );
  }

  const { resume_version_id, recruiter_name } = body;
  if (!resume_version_id) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "resume_version_id is required." },
      { status: 400 }
    );
  }

  // ── 2. Fetch resume_version (must be ready) ───────────────────────────────
  const { data: version, error: vErr } = await supabase
    .from("resume_versions")
    .select("id, resume_id, job_description_id, status, rewritten_content")
    .eq("id", resume_version_id)
    .eq("user_id", user.id)
    .single();

  if (vErr || !version) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Resume version not found." },
      { status: 404 }
    );
  }
  if (version.status !== "ready") {
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: `Resume version is "${version.status}". Complete the resume rewrite before generating a cover letter.`,
      },
      { status: 422 }
    );
  }

  // ── 3. Fetch master resume ────────────────────────────────────────────────
  const { data: masterResume, error: rErr } = await supabase
    .from("resumes")
    .select("parsed_content")
    .eq("id", version.resume_id)
    .eq("user_id", user.id)
    .single();

  if (rErr || !masterResume?.parsed_content) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Master resume not found or not parsed." },
      { status: 404 }
    );
  }

  // Prefer rewritten content; fall back to master if somehow missing
  const resumeForCl = (version.rewritten_content ??
    masterResume.parsed_content) as unknown as ParsedResume;

  // ── 4. Fetch job description ──────────────────────────────────────────────
  const { data: jd, error: jdErr } = await supabase
    .from("job_descriptions")
    .select("cleaned_text, title, company")
    .eq("id", version.job_description_id)
    .eq("user_id", user.id)
    .single();

  if (jdErr || !jd?.cleaned_text) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Job description not found." },
      { status: 404 }
    );
  }

  // ── 5. Fetch approved_answers from interview_session ─────────────────────
  const { data: session } = await supabase
    .from("interview_sessions")
    .select("approved_answers")
    .eq("resume_version_id", resume_version_id)
    .single();

  const approvedAnswers =
    (session?.approved_answers as Record<string, string> | null) ?? {};

  // ── 6. Insert cover_letter record (status: generating) ───────────────────
  const { data: clRecord, error: insertErr } = await supabase
    .from("cover_letters")
    .insert({
      user_id: user.id,
      resume_version_id,
      status: "generating",
      recruiter_name: recruiter_name ?? null,
    })
    .select()
    .single();

  if (insertErr || !clRecord) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to create cover letter record." },
      { status: 500 }
    );
  }

  const markError = async () => {
    await supabase
      .from("cover_letters")
      .update({ status: "error" })
      .eq("id", clRecord.id);
  };

  // ── 7. Generate content with Claude ──────────────────────────────────────
  let content: CoverLetterContent;
  try {
    const { data, inputTokens, outputTokens } = await generateCoverLetterWithClaude(
      resumeForCl,
      jd.cleaned_text,
      jd.title,
      jd.company,
      approvedAnswers,
      recruiter_name ?? null
    );
    content = data;
    logAiUsage({ userId: user.id, operation: "cover_letter", inputTokens, outputTokens, model: "claude-haiku-4-5-20251001" });
  } catch {
    await markError();
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Cover letter generation failed. Please try again." },
      { status: 500 }
    );
  }

  // ── 8. Generate PDF ───────────────────────────────────────────────────────
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateCoverLetterPdf(
      content,
      masterResume.parsed_content as unknown as ParsedResume,
      jd.company,
      jd.title
    );
  } catch {
    await markError();
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "PDF generation failed. Please try again." },
      { status: 500 }
    );
  }

  // ── 9. Upload PDF to outputs bucket ──────────────────────────────────────
  const safeTitle = (jd.title ?? "cover_letter")
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 40);
  const outputFilename = `cover_letter_${safeTitle}.pdf`;
  const storagePath = `${user.id}/${resume_version_id}/${outputFilename}`;
  const admin = createSupabaseAdminClient();

  const { error: uploadErr } = await admin.storage
    .from("outputs")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadErr) {
    await markError();
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to upload PDF to storage." },
      { status: 500 }
    );
  }

  // ── 10. Finalize record ───────────────────────────────────────────────────
  const { data: final, error: finalErr } = await supabase
    .from("cover_letters")
    .update({
      status: "ready",
      generated_content: content as unknown as Database["public"]["Tables"]["cover_letters"]["Update"]["generated_content"],
      output_storage_path: storagePath,
    })
    .eq("id", clRecord.id)
    .select()
    .single();

  if (finalErr || !final) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to save cover letter." },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<CoverLetterRow>>(
    { success: true, data: final },
    { status: 201 }
  );
}
