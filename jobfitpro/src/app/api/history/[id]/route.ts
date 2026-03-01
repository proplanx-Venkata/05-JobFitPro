import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApiResponse } from "@/types/api";
import type { HistoryDetail } from "@/types/history";

// ---------------------------------------------------------------------------
// GET /api/history/[id]
// Full detail for one resume version — all fields from every related table:
//   resume_version (full), job_description (full), interview_session (full),
//   all ats_scores (newest first), cover_letter (full).
//
// [id] is the resume_version id.
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

  // ── 1. Resume version ─────────────────────────────────────────────────────
  const { data: version, error: vErr } = await supabase
    .from("resume_versions")
    .select(
      "id, status, rewritten_content, output_filename, output_storage_path, job_description_id, created_at, updated_at"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (vErr || !version) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Resume version not found." },
      { status: 404 }
    );
  }

  // ── 2. Batch-fetch all related records ────────────────────────────────────
  const [jdResult, interviewResult, atsResult, clResult] = await Promise.all([
    supabase
      .from("job_descriptions")
      .select(
        "id, title, company, source_type, source_url, cleaned_text, page_count, created_at"
      )
      .eq("id", version.job_description_id)
      .eq("user_id", user.id)
      .single(),

    supabase
      .from("interview_sessions")
      .select(
        "id, status, identified_gaps, conversation_transcript, approved_answers, question_count, started_at, completed_at, aborted_at, abort_reason, created_at"
      )
      .eq("resume_version_id", id)
      .single(),

    supabase
      .from("ats_scores")
      .select(
        "id, overall_score, category, keyword_match_score, format_score, skills_score, experience_score, missing_keywords, gap_explanations, threshold, passes_threshold, created_at"
      )
      .eq("resume_version_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),

    supabase
      .from("cover_letters")
      .select(
        "id, status, generated_content, recruiter_name, output_storage_path, created_at"
      )
      .eq("resume_version_id", id)
      .eq("user_id", user.id)
      .single(),
  ]);

  if (!jdResult.data) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Job description not found for this version." },
      { status: 404 }
    );
  }

  const detail: HistoryDetail = {
    resume_version: {
      id: version.id,
      status: version.status,
      rewritten_content: version.rewritten_content,
      output_filename: version.output_filename,
      output_storage_path: version.output_storage_path,
      created_at: version.created_at,
      updated_at: version.updated_at,
    },
    job_description: {
      id: jdResult.data.id,
      title: jdResult.data.title,
      company: jdResult.data.company,
      source_type: jdResult.data.source_type,
      source_url: jdResult.data.source_url,
      cleaned_text: jdResult.data.cleaned_text,
      page_count: jdResult.data.page_count,
      created_at: jdResult.data.created_at,
    },
    interview: interviewResult.data
      ? {
          id: interviewResult.data.id,
          status: interviewResult.data.status,
          identified_gaps: interviewResult.data.identified_gaps,
          conversation_transcript: interviewResult.data.conversation_transcript,
          approved_answers: interviewResult.data.approved_answers,
          question_count: interviewResult.data.question_count,
          started_at: interviewResult.data.started_at,
          completed_at: interviewResult.data.completed_at,
          aborted_at: interviewResult.data.aborted_at,
          abort_reason: interviewResult.data.abort_reason,
          created_at: interviewResult.data.created_at,
        }
      : null,
    ats_scores: (atsResult.data ?? []).map((s) => ({
      id: s.id,
      overall_score: s.overall_score,
      category: s.category,
      keyword_match_score: s.keyword_match_score,
      format_score: s.format_score,
      skills_score: s.skills_score,
      experience_score: s.experience_score,
      missing_keywords: s.missing_keywords,
      gap_explanations: s.gap_explanations,
      threshold: s.threshold,
      passes_threshold: s.passes_threshold,
      created_at: s.created_at,
    })),
    cover_letter: clResult.data
      ? {
          id: clResult.data.id,
          status: clResult.data.status,
          generated_content: clResult.data.generated_content,
          recruiter_name: clResult.data.recruiter_name,
          output_storage_path: clResult.data.output_storage_path,
          created_at: clResult.data.created_at,
        }
      : null,
  };

  return NextResponse.json<ApiResponse<HistoryDetail>>({
    success: true,
    data: detail,
  });
}
