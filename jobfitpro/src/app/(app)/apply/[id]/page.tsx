import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowStepper, type WorkflowStep } from "@/components/apply/workflow-stepper";
import { GapList } from "@/components/apply/gap-list";
import { InterviewChat } from "@/components/apply/interview-chat";
import { RewritePanel } from "@/components/apply/rewrite-panel";
import { CoverLetterPanel } from "@/components/apply/cover-letter-panel";
import { AtsScoreCard } from "@/components/apply/ats-score-card";
import { ReInterviewButton } from "@/components/apply/re-interview-button";
import { InterviewPrepPanel } from "@/components/apply/interview-prep-panel";
import { Building2, Briefcase } from "lucide-react";
import type { Gap } from "@/types/gap";
import type { TranscriptMessage } from "@/types/interview";

interface ApplyPageProps {
  params: Promise<{ id: string }>;
}

function resolveStep(
  interviewStatus: string,
  versionStatus: string,
  hasCoverLetter: boolean
): WorkflowStep {
  if (interviewStatus === "pending") return "gap_analysis";
  if (interviewStatus === "in_progress") return "interview";
  if (versionStatus === "pending" || versionStatus === "error" || versionStatus === "generating")
    return "rewrite";
  if (versionStatus === "ready" && !hasCoverLetter) return "cover_letter";
  return "ats_score";
}

export default async function ApplyPage({ params }: ApplyPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load resume version with interview session
  const { data: version } = await supabase
    .from("resume_versions")
    .select(
      "id, status, output_storage_path, job_description_id, share_token, share_pin, interview_sessions(id, status, identified_gaps, conversation_transcript, question_count, approved_answers)"
    )
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!version) notFound();

  const session = Array.isArray(version.interview_sessions)
    ? version.interview_sessions[0]
    : version.interview_sessions;

  // Load JD info
  const { data: jd } = await supabase
    .from("job_descriptions")
    .select("id, title, company")
    .eq("id", version.job_description_id)
    .single();

  // Load cover letter (if any) — use newest to avoid .single() error on regenerations
  const { data: coverLetter } = await supabase
    .from("cover_letters")
    .select("id, status, output_storage_path")
    .eq("resume_version_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Load post-rewrite ATS score (latest non-pre-rewrite) and pre-rewrite score in parallel
  const [{ data: atsScore }, { data: preAtsScore }] = await Promise.all([
    supabase
      .from("ats_scores")
      .select(
        "id, overall_score, category, keyword_match_score, format_score, skills_score, experience_score, missing_keywords, gap_explanations, passes_threshold"
      )
      .eq("resume_version_id", id)
      .eq("is_pre_rewrite", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("ats_scores")
      .select("overall_score, category")
      .eq("resume_version_id", id)
      .eq("is_pre_rewrite", true)
      .limit(1)
      .single(),
  ]);

  const interviewStatus = session?.status ?? "pending";
  const hasCoverLetter = !!coverLetter?.id;
  const currentStep = resolveStep(interviewStatus, version.status, hasCoverLetter);

  const gaps = ((session?.identified_gaps as { gaps?: Gap[] } | null)?.gaps ?? []) as Gap[];
  const transcript = (session?.conversation_transcript as TranscriptMessage[] | null) ?? [];

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Briefcase className="h-4 w-4" />
          <span>Application workflow</span>
        </div>
        <h2 className="text-2xl font-bold">{jd?.title ?? "Job Application"}</h2>
        {jd?.company && (
          <div className="flex items-center gap-1 mt-1 text-muted-foreground text-sm">
            <Building2 className="h-4 w-4" />
            {jd.company}
          </div>
        )}
      </div>

      {/* Stepper */}
      <div className="overflow-x-auto">
        <WorkflowStepper currentStep={currentStep} />
      </div>

      {/* Gap Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gap Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <GapList gaps={gaps} />
        </CardContent>
      </Card>

      {/* Interview — show from gap_analysis step onwards so user can start it */}
      {(currentStep === "gap_analysis" ||
        currentStep === "interview" ||
        currentStep === "rewrite" ||
        currentStep === "cover_letter" ||
        currentStep === "ats_score") && session && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Interview</CardTitle>
          </CardHeader>
          <CardContent>
            <InterviewChat
              sessionId={session.id}
              initialStatus={session.status}
              initialTranscript={transcript as { role: "assistant" | "user"; content: string }[]}
              initialApprovedAnswers={(session.approved_answers as Record<string, string> | null) ?? undefined}
            />
          </CardContent>
        </Card>
      )}

      {/* Rewrite — show from rewrite step onwards */}
      {(currentStep === "rewrite" ||
        currentStep === "cover_letter" ||
        currentStep === "ats_score") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resume Rewrite</CardTitle>
          </CardHeader>
          <CardContent>
            <RewritePanel
              versionId={id}
              initialStatus={version.status}
              initialPdfPath={version.output_storage_path}
              initialShareToken={version.share_token ?? null}
              initialSharePin={version.share_pin ?? null}
            />
          </CardContent>
        </Card>
      )}

      {/* Cover Letter — show from cover letter step onwards */}
      {(currentStep === "cover_letter" || currentStep === "ats_score") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cover Letter</CardTitle>
          </CardHeader>
          <CardContent>
            <CoverLetterPanel
              versionId={id}
              existingCoverId={coverLetter?.id ?? null}
            />
          </CardContent>
        </Card>
      )}

      {/* ATS Score — always show at final step */}
      {currentStep === "ats_score" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ATS Score</CardTitle>
          </CardHeader>
          <CardContent>
            <AtsScoreCard
              versionId={id}
              initialScore={
                atsScore
                  ? {
                      ...atsScore,
                      missing_keywords:
                        (atsScore.missing_keywords as string[]) ?? [],
                      gap_explanations:
                        (atsScore.gap_explanations as Record<string, string>) ??
                        {},
                    }
                  : null
              }
              preRewriteScore={preAtsScore ?? null}
            />
            {session && (
              <>
                <hr className="my-2 border-border" />
                <ReInterviewButton sessionId={session.id} />
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Interview Prep — bonus panel at final step */}
      {currentStep === "ats_score" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Interview Prep</CardTitle>
          </CardHeader>
          <CardContent>
            <InterviewPrepPanel versionId={id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
