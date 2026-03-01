import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApiResponse } from "@/types/api";
import type { HistoryEntry } from "@/types/history";

// ---------------------------------------------------------------------------
// GET /api/history
// Returns the user's full application history — all resume versions with their
// associated job description, interview status, latest ATS score, and cover
// letter — aggregated in 5 batch queries (no N+1).
// Sorted newest-first by resume_version.created_at.
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

  // ── 1. All resume versions for this user ─────────────────────────────────
  const { data: versions, error: vErr } = await supabase
    .from("resume_versions")
    .select(
      "id, status, output_filename, output_storage_path, job_description_id, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (vErr) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: vErr.message },
      { status: 500 }
    );
  }
  if (!versions || versions.length === 0) {
    return NextResponse.json<ApiResponse<HistoryEntry[]>>({
      success: true,
      data: [],
    });
  }

  const versionIds = versions.map((v) => v.id);
  const jdIds = [...new Set(versions.map((v) => v.job_description_id))];

  // ── 2. Batch-fetch related data (4 parallel queries) ─────────────────────
  const [jdsResult, interviewsResult, atsResult, clResult] = await Promise.all([
    supabase
      .from("job_descriptions")
      .select("id, title, company, source_type")
      .in("id", jdIds),

    supabase
      .from("interview_sessions")
      .select("id, resume_version_id, status, question_count, completed_at")
      .in("resume_version_id", versionIds),

    supabase
      .from("ats_scores")
      .select(
        "id, resume_version_id, overall_score, category, passes_threshold, created_at"
      )
      .in("resume_version_id", versionIds)
      .order("created_at", { ascending: false }),

    supabase
      .from("cover_letters")
      .select("id, resume_version_id, status, output_storage_path")
      .in("resume_version_id", versionIds),
  ]);

  // Build lookup maps keyed by resume_version_id or jd id
  const jdMap = new Map(
    (jdsResult.data ?? []).map((j) => [j.id, j])
  );

  const interviewMap = new Map(
    (interviewsResult.data ?? []).map((s) => [s.resume_version_id, s])
  );

  // For ATS scores: only keep the latest per version (already ordered desc)
  const atsMap = new Map<string, NonNullable<typeof atsResult.data>[number]>();
  for (const score of atsResult.data ?? []) {
    if (!atsMap.has(score.resume_version_id)) {
      atsMap.set(score.resume_version_id, score);
    }
  }

  const clMap = new Map(
    (clResult.data ?? []).map((cl) => [cl.resume_version_id, cl])
  );

  // ── 3. Assemble HistoryEntry list ─────────────────────────────────────────
  const history: HistoryEntry[] = versions.map((v) => {
    const jd = jdMap.get(v.job_description_id);
    const interview = interviewMap.get(v.id) ?? null;
    const ats = atsMap.get(v.id) ?? null;
    const cl = clMap.get(v.id) ?? null;

    return {
      resume_version: {
        id: v.id,
        status: v.status,
        output_filename: v.output_filename,
        output_storage_path: v.output_storage_path,
        created_at: v.created_at,
      },
      job_description: {
        id: v.job_description_id,
        title: jd?.title ?? null,
        company: jd?.company ?? null,
        source_type: jd?.source_type ?? "url",
      },
      interview: interview
        ? {
            id: interview.id,
            status: interview.status,
            question_count: interview.question_count,
            completed_at: interview.completed_at,
          }
        : null,
      latest_ats_score: ats
        ? {
            id: ats.id,
            overall_score: ats.overall_score,
            category: ats.category,
            passes_threshold: ats.passes_threshold,
            created_at: ats.created_at,
          }
        : null,
      cover_letter: cl
        ? {
            id: cl.id,
            status: cl.status,
            output_storage_path: cl.output_storage_path,
          }
        : null,
    };
  });

  return NextResponse.json<ApiResponse<HistoryEntry[]>>({
    success: true,
    data: history,
  });
}
