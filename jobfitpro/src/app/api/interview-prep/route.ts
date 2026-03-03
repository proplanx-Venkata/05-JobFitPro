import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateInterviewPrepWithClaude } from "@/lib/interview-prep/generate-with-claude";
import { logAiUsage } from "@/lib/ai/log-usage";
import type { ApiResponse } from "@/types/api";
import type { ParsedResume } from "@/types/resume";
import type { GapAnalysisResult } from "@/types/gap";

export const maxDuration = 30;

// ---------------------------------------------------------------------------
// POST /api/interview-prep
// Generates 10 ephemeral interview prep questions (not stored in DB).
//
// Body (JSON): { resume_version_id: string }
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

  let body: { resume_version_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Request body must be JSON." },
      { status: 400 }
    );
  }

  const { resume_version_id } = body;
  if (!resume_version_id) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "resume_version_id is required." },
      { status: 400 }
    );
  }

  // Fetch resume_version
  const { data: version, error: vErr } = await supabase
    .from("resume_versions")
    .select("resume_id, job_description_id")
    .eq("id", resume_version_id)
    .eq("user_id", user.id)
    .single();

  if (vErr || !version) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Resume version not found." },
      { status: 404 }
    );
  }

  // Fetch interview session for gaps
  const { data: session, error: sErr } = await supabase
    .from("interview_sessions")
    .select("identified_gaps")
    .eq("resume_version_id", resume_version_id)
    .eq("user_id", user.id)
    .single();

  if (sErr || !session) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Interview session not found." },
      { status: 404 }
    );
  }

  // Fetch master resume parsed_content
  const { data: resume, error: rErr } = await supabase
    .from("resumes")
    .select("parsed_content")
    .eq("id", version.resume_id)
    .eq("user_id", user.id)
    .single();

  if (rErr || !resume?.parsed_content) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Master resume not found or not parsed." },
      { status: 404 }
    );
  }

  // Fetch JD cleaned_text
  const { data: jd, error: jErr } = await supabase
    .from("job_descriptions")
    .select("cleaned_text")
    .eq("id", version.job_description_id)
    .eq("user_id", user.id)
    .single();

  if (jErr || !jd?.cleaned_text) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Job description not found." },
      { status: 404 }
    );
  }

  const gaps = (session.identified_gaps ?? { gaps: [] }) as unknown as GapAnalysisResult;

  try {
    const { data, inputTokens, outputTokens } = await generateInterviewPrepWithClaude(
      resume.parsed_content as unknown as ParsedResume,
      jd.cleaned_text,
      gaps
    );
    logAiUsage({ userId: user.id, operation: "interview_prep", inputTokens, outputTokens, model: "claude-haiku-4-5-20251001" });
    return NextResponse.json<ApiResponse<{ questions: typeof data.questions }>>(
      { success: true, data: { questions: data.questions } },
      { status: 200 }
    );
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Failed to generate interview questions. Please try again." },
      { status: 500 }
    );
  }
}
