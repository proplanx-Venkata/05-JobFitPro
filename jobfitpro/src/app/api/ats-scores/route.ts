import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scoreResumeWithClaude } from "@/lib/ats/score-with-claude";
import { computeAtsScore } from "@/types/ats";
import { logAiUsage } from "@/lib/ai/log-usage";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";
import type { ParsedResume } from "@/types/resume";

type AtsScoreRow = Database["public"]["Tables"]["ats_scores"]["Row"];

// Claude scoring can take up to 30 s
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// GET /api/ats-scores?resume_version_id=X
// Returns the pre-rewrite ATS score (is_pre_rewrite=true) for a given version.
// Used by the client to fetch the pre-rewrite score after manually scoring.
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
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

  const versionId = request.nextUrl.searchParams.get("resume_version_id");
  if (!versionId) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "resume_version_id is required." },
      { status: 400 }
    );
  }

  const { data } = await supabase
    .from("ats_scores")
    .select("overall_score, category")
    .eq("resume_version_id", versionId)
    .eq("user_id", user.id)
    .eq("is_pre_rewrite", true)
    .limit(1)
    .single();

  return NextResponse.json<ApiResponse<{ overall_score: number; category: string } | null>>({
    success: true,
    data: data ?? null,
  });
}

// ---------------------------------------------------------------------------
// POST /api/ats-scores
// Scores the rewritten resume against its JD and inserts an immutable record.
//
// Body (JSON): { resume_version_id: string, threshold?: number }
//   threshold — pass/fail threshold 0–100, defaults to 75 (DB default).
//
// Pre-conditions:
//   - resume_version status is "ready"
//
// ats_scores is INSERT-only (RLS has no UPDATE policy) — each call creates
// a new score snapshot. Callers can score the same version multiple times
// to track improvement after edits.
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
  let body: { resume_version_id?: string; threshold?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Request body must be JSON." },
      { status: 400 }
    );
  }

  const { resume_version_id, threshold } = body;
  if (!resume_version_id) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "resume_version_id is required." },
      { status: 400 }
    );
  }

  if (threshold !== undefined && (threshold < 0 || threshold > 100)) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "threshold must be between 0 and 100." },
      { status: 400 }
    );
  }

  // ── 2. Fetch resume_version (must be ready) ───────────────────────────────
  const { data: version, error: vErr } = await supabase
    .from("resume_versions")
    .select("status, rewritten_content, resume_id, job_description_id")
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
        error: `Resume version is "${version.status}". Complete the rewrite before scoring.`,
      },
      { status: 422 }
    );
  }

  // ── 3. Resolve the resume to score (rewritten > master fallback) ──────────
  let resumeToScore: ParsedResume;
  if (version.rewritten_content) {
    resumeToScore = version.rewritten_content as unknown as ParsedResume;
  } else {
    const { data: master, error: mErr } = await supabase
      .from("resumes")
      .select("parsed_content")
      .eq("id", version.resume_id)
      .eq("user_id", user.id)
      .single();
    if (mErr || !master?.parsed_content) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Master resume not found or not parsed." },
        { status: 404 }
      );
    }
    resumeToScore = master.parsed_content as unknown as ParsedResume;
  }

  // ── 4. Fetch JD cleaned text ──────────────────────────────────────────────
  const { data: jd, error: jdErr } = await supabase
    .from("job_descriptions")
    .select("cleaned_text")
    .eq("id", version.job_description_id)
    .eq("user_id", user.id)
    .single();

  if (jdErr || !jd?.cleaned_text) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Job description not found." },
      { status: 404 }
    );
  }

  // ── 5. Score with Claude ──────────────────────────────────────────────────
  let scored;
  try {
    const { data: raw, inputTokens, outputTokens } = await scoreResumeWithClaude(resumeToScore, jd.cleaned_text);
    scored = computeAtsScore(raw);
    logAiUsage({ userId: user.id, operation: "ats_score", inputTokens, outputTokens, model: "claude-haiku-4-5-20251001" });
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "ATS scoring failed. Please try again." },
      { status: 500 }
    );
  }

  // ── 6. Insert immutable score record ──────────────────────────────────────
  const { data: record, error: insertErr } = await supabase
    .from("ats_scores")
    .insert({
      user_id: user.id,
      resume_version_id,
      overall_score: scored.overall_score,
      category: scored.category,
      keyword_match_score: scored.keyword_match_score,
      format_score: scored.format_score,
      skills_score: scored.skills_score,
      experience_score: scored.experience_score,
      missing_keywords: scored.missing_keywords as unknown as Database["public"]["Tables"]["ats_scores"]["Insert"]["missing_keywords"],
      gap_explanations: scored.gap_explanations as unknown as Database["public"]["Tables"]["ats_scores"]["Insert"]["gap_explanations"],
      ...(threshold !== undefined ? { threshold } : {}),
    })
    .select()
    .single();

  if (insertErr || !record) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to save ATS score." },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<AtsScoreRow>>(
    { success: true, data: record },
    { status: 201 }
  );
}
