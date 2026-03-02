import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { analyzeGapsWithClaude } from "@/lib/gap/analyze-with-claude";
import { getSystemSetting } from "@/lib/admin/get-setting";
import type { ApiResponse } from "@/types/api";
import type { Database } from "@/types/database";
import type { ParsedResume } from "@/types/resume";
import type { GapAnalysisResult } from "@/types/gap";

type ResumeVersionRow = Database["public"]["Tables"]["resume_versions"]["Row"];
type InterviewSessionRow = Database["public"]["Tables"]["interview_sessions"]["Row"];

export interface ResumeVersionCreated {
  resume_version: ResumeVersionRow;
  interview_session: Pick<
    InterviewSessionRow,
    "id" | "status" | "identified_gaps" | "created_at"
  >;
}

// Gap analysis + Claude call can take up to 60 s
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// POST /api/resume-versions
// Creates a resume_version for a (resume, job_description) pair, runs gap
// analysis with Claude, and creates the linked interview_session with the
// identified gaps pre-populated (status = "pending").
//
// Body (JSON): { resume_id: string, job_description_id: string }
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
  let body: { resume_id?: string; job_description_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Request body must be JSON." },
      { status: 400 }
    );
  }

  const { resume_id, job_description_id } = body;
  if (!resume_id || !job_description_id) {
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: "Both resume_id and job_description_id are required.",
      },
      { status: 400 }
    );
  }

  // ── 2. Quota check ───────────────────────────────────────────────────────
  // Read limits from system_settings (admin-controlled), fall back to env vars.
  const [dbFreeLimit, dbPaidLimit] = await Promise.all([
    getSystemSetting("quota_free_limit"),
    getSystemSetting("quota_paid_monthly_limit"),
  ]);
  const freeLimit =
    typeof dbFreeLimit === "number"
      ? dbFreeLimit
      : parseInt(process.env.QUOTA_FREE_LIMIT ?? "2", 10);
  const paidMonthlyLimit =
    typeof dbPaidLimit === "number"
      ? dbPaidLimit
      : parseInt(process.env.QUOTA_PAID_MONTHLY_LIMIT ?? "10", 10);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tier, monthly_version_count, monthly_reset_at")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Could not verify quota." },
      { status: 500 }
    );
  }

  if (profile.tier === "free") {
    const { data: totalCount } = await supabase.rpc("get_user_version_count", {
      p_user_id: user.id,
    });
    if ((totalCount ?? 0) >= freeLimit) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Version limit reached. Upgrade to paid or wait for your monthly reset.",
        },
        { status: 403 }
      );
    }
  } else {
    // paid tier: monthly limit with auto-reset
    const now = new Date();
    const resetAt = new Date(profile.monthly_reset_at);
    let monthlyCount = profile.monthly_version_count ?? 0;

    if (now >= resetAt) {
      // Advance reset date to the first of next calendar month (UTC)
      const nextReset = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
      );
      await supabase
        .from("profiles")
        .update({ monthly_version_count: 0, monthly_reset_at: nextReset.toISOString() })
        .eq("id", user.id);
      monthlyCount = 0;
    }

    if (monthlyCount >= paidMonthlyLimit) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Monthly version limit reached. Wait for your monthly reset.",
        },
        { status: 403 }
      );
    }
  }

  // ── 3. Validate resume ───────────────────────────────────────────────────
  const { data: resume, error: resumeError } = await supabase
    .from("resumes")
    .select("id, status, parsed_content, is_active")
    .eq("id", resume_id)
    .eq("user_id", user.id)
    .single();

  if (resumeError || !resume) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Resume not found." },
      { status: 404 }
    );
  }
  if (resume.status !== "ready") {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Resume is not ready. Wait for parsing to complete." },
      { status: 422 }
    );
  }
  if (!resume.parsed_content) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Resume has no parsed content." },
      { status: 422 }
    );
  }

  // ── 4. Validate JD ───────────────────────────────────────────────────────
  const { data: jd, error: jdError } = await supabase
    .from("job_descriptions")
    .select("id, cleaned_text, title, company")
    .eq("id", job_description_id)
    .eq("user_id", user.id)
    .single();

  if (jdError || !jd) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Job description not found." },
      { status: 404 }
    );
  }
  if (!jd.cleaned_text) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Job description has no cleaned text." },
      { status: 422 }
    );
  }

  // ── 5. Create resume_version ─────────────────────────────────────────────
  const { data: version, error: versionError } = await supabase
    .from("resume_versions")
    .insert({
      user_id: user.id,
      resume_id,
      job_description_id,
      status: "pending",
    })
    .select()
    .single();

  if (versionError) {
    // UNIQUE (resume_id, job_description_id) violation → 23505
    if (versionError.code === "23505") {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error:
            "A version for this resume + job description pair already exists.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to create resume version." },
      { status: 500 }
    );
  }

  // ── 6. Gap analysis with Claude ──────────────────────────────────────────
  let gapResult: GapAnalysisResult;
  try {
    gapResult = await analyzeGapsWithClaude(
      resume.parsed_content as unknown as ParsedResume,
      jd.cleaned_text
    );
  } catch {
    // Roll back the version record so the user can retry cleanly
    await supabase.from("resume_versions").delete().eq("id", version.id);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Gap analysis failed. Please try again." },
      { status: 500 }
    );
  }

  // ── 7. Create interview_session with identified gaps ─────────────────────
  const { data: session, error: sessionError } = await supabase
    .from("interview_sessions")
    .insert({
      user_id: user.id,
      resume_version_id: version.id,
      status: "pending",
      identified_gaps: gapResult as unknown as Database["public"]["Tables"]["interview_sessions"]["Insert"]["identified_gaps"],
    })
    .select("id, status, identified_gaps, created_at")
    .single();

  if (sessionError || !session) {
    await supabase.from("resume_versions").delete().eq("id", version.id);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to create interview session." },
      { status: 500 }
    );
  }

  // ── 8. Increment monthly_version_count (paid quota tracking) ────────────
  // profile was already fetched in the quota check above; just bump the count.
  // Safe to fail silently — quota check already passed; this is bookkeeping only.
  await supabase
    .from("profiles")
    .update({ monthly_version_count: (profile.monthly_version_count ?? 0) + 1 })
    .eq("id", user.id);

  return NextResponse.json<ApiResponse<ResumeVersionCreated>>(
    {
      success: true,
      data: {
        resume_version: version,
        interview_session: session,
      },
    },
    { status: 201 }
  );
}

// ---------------------------------------------------------------------------
// GET /api/resume-versions
// Lists all resume_versions for the user (newest first).
// rewritten_content excluded — use GET /api/resume-versions/[id] for full detail.
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

  const { data, error } = await supabase
    .from("resume_versions")
    .select(
      "id, user_id, resume_id, job_description_id, output_filename, status, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json<ApiResponse<Omit<ResumeVersionRow, "rewritten_content" | "output_storage_path">[]>>({
    success: true,
    data: data ?? [],
  });
}
